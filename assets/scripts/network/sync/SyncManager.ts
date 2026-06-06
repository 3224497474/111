import { createNetworkConfig, type INetworkRuntimeConfig } from '../NetworkConfig';
import { HttpClient, HttpClientError } from '../http/HttpClient';
import { NativeHttpTransport } from '../http/NativeHttpTransport';
import { MockHttpTransport } from '../mock/MockHttpTransport';
import type {
    ActionType,
    IActionSubmitResponseData,
    IApiEnvelope,
    IPlayerAction,
    IQueuedAction,
} from '../protocol/Types';
import { NetworkKV } from '../storage/NetworkKV';

const PENDING_ACTIONS_KEY = 'pending_actions';
const NEXT_SEQ_NO_KEY = 'next_seq_no';
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;

interface ISyncPendingAction extends IPlayerAction {
    seqNo: number;
    uid: string;
    clientVersion: string;
    protocolVersion: number;
}

export class SyncManager {
    private static _instance: SyncManager | null = null;

    public static get instance(): SyncManager {
        if (!this._instance) {
            this._instance = new SyncManager();
        }
        return this._instance;
    }

    private config: INetworkRuntimeConfig = createNetworkConfig();
    private kv: NetworkKV = new NetworkKV(`${this.config.storageKeyPrefix}sync_manager_`);
    private httpClient: HttpClient = new HttpClient(this.config, this.createTransport(this.config));
    private syncPath = '/api/actions/submit';
    private isSyncing = false;
    private syncRequestedWhileBusy = false;
    private pendingActions: ISyncPendingAction[] = [];
    private nextSeqNo = 1;
    private authToken: string | null = null;
    private authUid: string | null = null;
    private retryDelayMs = RETRY_BASE_DELAY_MS;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly listeners = new Set<() => void>();

    private constructor() {
        this.restorePendingActions();
        this.rebuildHttpClient();
    }

    public configure(options?: {
        networkConfig?: Partial<INetworkRuntimeConfig>;
        syncPath?: string;
        token?: string | null;
        uid?: string | null;
    }): void {
        if (options?.networkConfig) {
            this.config = createNetworkConfig({
                ...this.config,
                ...options.networkConfig,
            });
            this.kv = new NetworkKV(`${this.config.storageKeyPrefix}sync_manager_`);
            this.restorePendingActions();
        }

        if (options?.syncPath) {
            this.syncPath = options.syncPath.trim() || this.syncPath;
        }

        if (options && Object.prototype.hasOwnProperty.call(options, 'token')) {
            this.authToken = options.token?.trim() || null;
        }

        if (options && Object.prototype.hasOwnProperty.call(options, 'uid')) {
            this.authUid = options.uid?.trim() || null;
        }

        this.rebuildHttpClient();

        if (this.pendingActions.length > 0) {
            this.scheduleRetry(0);
        }
    }

    public pushAction(
        type: ActionType | string,
        payload: any,
    ): IPlayerAction {
        const normalizedType = String(type || '').trim();
        if (!normalizedType) {
            throw new Error('[SyncManager] action type is required.');
        }

        const seqNo = this.nextSeqNo++;
        const uid = this.getResolvedUid();
        const action: ISyncPendingAction = {
            id: this.generateActionId(uid, seqNo),
            timestamp: Date.now(),
            actionType: normalizedType,
            payload: this.clonePayload(payload),
            seqNo,
            uid,
            clientVersion: this.config.clientVersion,
            protocolVersion: this.config.protocolVersion,
        };

        this.pendingActions = [...this.pendingActions, action];
        this.persistPendingActions();
        this.notifyChanged();
        void this.trySyncToServer();
        return this.cloneAction(action);
    }

    public async trySyncToServer(): Promise<boolean> {
        this.clearRetryTimer();

        if (this.isSyncing) {
            this.syncRequestedWhileBusy = true;
            return false;
        }

        if (!this.isNetworkAvailable()) {
            this.scheduleRetry();
            return false;
        }

        if (this.pendingActions.length === 0) {
            this.resetRetryState();
            return true;
        }

        if (!this.authToken) {
            console.warn('[SyncManager] Skip sync: auth token is missing.');
            return false;
        }

        const actionsToSync = this.pendingActions.map((action) => this.toQueuedAction(action));

        this.isSyncing = true;
        try {
            const envelope = await this.httpClient.post<IActionSubmitResponseData>(
                this.syncPath,
                {
                    actions: actionsToSync,
                },
                {
                    needAuth: true,
                    timeoutMs: this.config.timeoutMs,
                    baseUrl: this.config.baseUrl,
                },
            );

            const response = this.requireSubmitResponse(envelope);
            const removableActionIds = new Set<string>([
                ...response.accepted.map((item) => item.actionId),
                ...response.duplicates.map((item) => item.actionId),
            ]);

            if (removableActionIds.size > 0) {
                this.pendingActions = this.pendingActions
                    .filter((action) => !removableActionIds.has(action.id))
                    .map((action) => this.cloneInternalAction(action));
                this.persistPendingActions();
                this.notifyChanged();
            }

            if (response.rejected.length > 0) {
                console.warn('[SyncManager] Server rejected pending actions.', response.rejected);
                this.resetRetryState();
                return false;
            }

            this.resetRetryState();
            return true;
        } catch (error) {
            if (error instanceof HttpClientError) {
                if (error.status === 403) {
                    this.handleDataDesync(error.payload);
                    return false;
                }

                if (error.status >= 400 && error.status < 500) {
                    console.warn('[SyncManager] Sync aborted by client error.', error.message);
                    return false;
                }
            }

            console.warn('[SyncManager] Sync failed, will retry later.', error);
            this.scheduleRetry();
            return false;
        } finally {
            this.isSyncing = false;
            if (this.syncRequestedWhileBusy) {
                this.syncRequestedWhileBusy = false;
                this.scheduleRetry(0);
            }
        }
    }

    public handleDataDesync(serverSnapshot: any): void {
        console.warn('[SyncManager] Data desync detected, clearing pending actions.', serverSnapshot);
        this.pendingActions = [];
        this.persistPendingActions();
        this.resetRetryState();
        this.notifyChanged();
    }

    public getPendingActionsSnapshot(): IPlayerAction[] {
        return this.pendingActions.map((action) => this.cloneInternalAction(action));
    }

    public restorePendingActionsSnapshot(actions: IPlayerAction[] | null | undefined): void {
        const restoredActions = Array.isArray(actions) ? actions : [];
        this.pendingActions = restoredActions
            .filter((action) => action && typeof action === 'object')
            .map((action, index) => this.normalizeAction(action, index))
            .filter((action) => action.id && action.actionType);
        this.nextSeqNo = this.resolveNextSeqNo(this.pendingActions);
        this.persistPendingActions();
        this.notifyChanged();
    }

    public clearPendingActions(): void {
        this.pendingActions = [];
        this.nextSeqNo = 1;
        this.persistPendingActions();
        this.resetRetryState();
        this.notifyChanged();
    }

    public onChanged(listener: () => void): void {
        this.listeners.add(listener);
    }

    public offChanged(listener: () => void): void {
        this.listeners.delete(listener);
    }

    private rebuildHttpClient(): void {
        this.httpClient.configure(this.config, this.createTransport(this.config));
        this.httpClient.setToken(this.authToken);
    }

    private createTransport(config: INetworkRuntimeConfig) {
        return config.useMockTransport
            ? new MockHttpTransport(config)
            : new NativeHttpTransport();
    }

    private restorePendingActions(): void {
        const stored = this.kv.getJson<IPlayerAction[]>(PENDING_ACTIONS_KEY, []);
        this.pendingActions = Array.isArray(stored)
            ? stored
                .filter((action) => action && typeof action === 'object')
                .map((action, index) => this.normalizeAction(action, index))
                .filter((action) => action.id && action.actionType)
            : [];
        this.nextSeqNo = this.resolveNextSeqNo(
            this.pendingActions,
            Math.max(1, Math.floor(this.kv.getNumber(NEXT_SEQ_NO_KEY, 1))),
        );
        this.persistPendingActions();
    }

    private persistPendingActions(): void {
        this.kv.setJson(PENDING_ACTIONS_KEY, this.pendingActions);
        this.kv.setNumber(NEXT_SEQ_NO_KEY, this.nextSeqNo);
    }

    private notifyChanged(): void {
        this.listeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.error('[SyncManager] listener error:', error);
            }
        });
    }

    private isNetworkAvailable(): boolean {
        if (!this.config.baseUrl.trim()) {
            return false;
        }

        if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
            return navigator.onLine;
        }

        return true;
    }

    private requireSubmitResponse(
        envelope: IApiEnvelope<IActionSubmitResponseData>,
    ): IActionSubmitResponseData {
        if (!envelope?.data) {
            throw new Error('[SyncManager] Server response data is empty.');
        }

        return envelope.data;
    }

    private normalizeAction(action: IPlayerAction, index: number): ISyncPendingAction {
        const fallbackSeqNo = Math.max(1, index + 1);
        const rawAction = action as Partial<ISyncPendingAction>;
        const seqNo = Math.max(1, Math.floor(Number(rawAction.seqNo ?? fallbackSeqNo) || fallbackSeqNo));
        const uid = String(rawAction.uid ?? this.authUid ?? '').trim() || 'anonymous';
        const id = String(action.id ?? '').trim() || this.generateActionId(uid, seqNo);
        return {
            id: id.startsWith(`${uid}-`) ? id : this.generateActionId(uid, seqNo),
            timestamp: Math.max(0, Math.floor(Number(action.timestamp ?? 0) || 0)),
            actionType: String(action.actionType ?? '').trim(),
            payload: this.clonePayload(action.payload),
            seqNo,
            uid,
            clientVersion: String(rawAction.clientVersion ?? this.config.clientVersion),
            protocolVersion: Math.max(1, Math.floor(Number(rawAction.protocolVersion ?? this.config.protocolVersion) || 1)),
        };
    }

    private cloneAction(action: ISyncPendingAction): IPlayerAction {
        return {
            id: action.id,
            timestamp: action.timestamp,
            actionType: action.actionType,
            payload: this.clonePayload(action.payload),
        };
    }

    private cloneInternalAction(action: ISyncPendingAction): ISyncPendingAction {
        return {
            ...action,
            payload: this.clonePayload(action.payload),
        };
    }

    private clonePayload(payload: any): any {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        try {
            return JSON.parse(JSON.stringify(payload));
        } catch {
            return payload;
        }
    }

    private toQueuedAction(action: ISyncPendingAction): IQueuedAction {
        return {
            actionId: action.id,
            seqNo: action.seqNo,
            actionType: action.actionType,
            payload: this.normalizePayload(action.payload),
            createdAt: action.timestamp,
            clientVersion: action.clientVersion,
            protocolVersion: action.protocolVersion,
            status: 'pending',
        };
    }

    private normalizePayload(payload: any): Record<string, unknown> {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return {};
        }

        return this.clonePayload(payload) as Record<string, unknown>;
    }

    private scheduleRetry(delayMs: number = this.retryDelayMs): void {
        if (this.retryTimer || this.pendingActions.length === 0 || !this.authToken) {
            return;
        }

        const safeDelayMs = Math.max(0, Math.min(RETRY_MAX_DELAY_MS, Math.floor(delayMs)));
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.trySyncToServer();
        }, safeDelayMs);
        this.retryDelayMs = Math.min(RETRY_MAX_DELAY_MS, Math.max(RETRY_BASE_DELAY_MS, safeDelayMs * 2 || RETRY_BASE_DELAY_MS));
    }

    private clearRetryTimer(): void {
        if (this.retryTimer === null) {
            return;
        }

        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private resetRetryState(): void {
        this.clearRetryTimer();
        this.retryDelayMs = RETRY_BASE_DELAY_MS;
    }

    private resolveNextSeqNo(actions: ISyncPendingAction[], fallback: number = 1): number {
        const maxSeqNo = actions.reduce((currentMax, action) => Math.max(currentMax, action.seqNo), 0);
        return Math.max(fallback, maxSeqNo + 1);
    }

    private getResolvedUid(): string {
        return this.authUid?.trim() || 'anonymous';
    }

    private generateActionId(uid: string, seqNo: number): string {
        const normalizedUid = uid.trim() || 'anonymous';
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${normalizedUid}-${seqNo}-${crypto.randomUUID()}`;
        }

        return `${normalizedUid}-${seqNo}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    }
}
