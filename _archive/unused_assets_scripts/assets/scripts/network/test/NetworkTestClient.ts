import {
    _decorator,
    Button,
    Component,
    EditBox,
    Label,
} from 'cc';
import { NetworkFacade } from '../facade/NetworkFacade';
import { NativeHttpTransport } from '../http/NativeHttpTransport';
import type { IApiEnvelope, IHttpTransportResponse } from '../protocol/Types';

const { ccclass, property } = _decorator;

type TPendingAssetStatus = 'pending_verify' | 'owned' | 'revoked';

interface IPendingAssetRecord {
    recordId: string;
    uid: string;
    status: TPendingAssetStatus;
    assetKind: string;
    assetId: string;
    amount: number;
    sourceType: string;
    sourceActionId: string;
    sourceActionType: string;
    verificationReason: string;
    createdAt: number;
    updatedAt: number;
    confirmedAt: number | null;
    revokedAt: number | null;
    metadata?: Record<string, unknown>;
}

interface IPendingAssetListResponse {
    records: IPendingAssetRecord[];
    summary: {
        total: number;
        pendingVerifyCount: number;
        ownedCount: number;
        revokedCount: number;
    };
}

@ccclass('NetworkTestClient')
export class NetworkTestClient extends Component {
    @property
    public useMockTransport = false;

    @property
    public autoRunOnLoad = false;

    @property
    public baseUrl = 'http://127.0.0.1:8080';

    @property
    public clientVersion = '0.1.0-dev';

    @property(EditBox)
    public devUserIdInput: EditBox | null = null;

    @property(Button)
    public runFullFlowButton: Button | null = null;

    @property(Button)
    public fetchPendingButton: Button | null = null;

    @property(Button)
    public fetchOwnedButton: Button | null = null;

    @property(Button)
    public fetchRevokedButton: Button | null = null;

    @property(Button)
    public confirmLatestPendingButton: Button | null = null;

    @property(Button)
    public revokeLatestPendingButton: Button | null = null;

    @property(Button)
    public clearLocalButton: Button | null = null;

    @property(Label)
    public runtimeLabel: Label | null = null;

    @property(Label)
    public authLabel: Label | null = null;

    @property(Label)
    public queueLabel: Label | null = null;

    @property(Label)
    public pendingAssetsLabel: Label | null = null;

    @property(Label)
    public logLabel: Label | null = null;

    private readonly facade = NetworkFacade.instance;
    private readonly transport = new NativeHttpTransport();
    private readonly logs: string[] = [];
    private latestPendingAssets: IPendingAssetRecord[] = [];
    private inFlight = false;

    protected onLoad(): void {
        this.facade.configure({
            useMockTransport: this.useMockTransport,
            baseUrl: this.baseUrl.trim(),
            clientVersion: this.clientVersion.trim() || '0.1.0-dev',
        });

        if (this.devUserIdInput && !this.devUserIdInput.string.trim()) {
            this.devUserIdInput.string = this.makeDefaultDevUserId();
        }

        this.bindButton(this.runFullFlowButton, this.onClickRunFullFlow);
        this.bindButton(this.fetchPendingButton, this.onClickFetchPendingVerify);
        this.bindButton(this.fetchOwnedButton, this.onClickFetchOwned);
        this.bindButton(this.fetchRevokedButton, this.onClickFetchRevoked);
        this.bindButton(this.confirmLatestPendingButton, this.onClickConfirmLatestPending);
        this.bindButton(this.revokeLatestPendingButton, this.onClickRevokeLatestPending);
        this.bindButton(this.clearLocalButton, this.onClickClearLocal);

        this.appendLog('Network test client ready.');
        this.refreshView();

        if (this.autoRunOnLoad) {
            void this.runFullFlow();
        }
    }

    protected onDestroy(): void {
        this.unbindButton(this.runFullFlowButton, this.onClickRunFullFlow);
        this.unbindButton(this.fetchPendingButton, this.onClickFetchPendingVerify);
        this.unbindButton(this.fetchOwnedButton, this.onClickFetchOwned);
        this.unbindButton(this.fetchRevokedButton, this.onClickFetchRevoked);
        this.unbindButton(this.confirmLatestPendingButton, this.onClickConfirmLatestPending);
        this.unbindButton(this.revokeLatestPendingButton, this.onClickRevokeLatestPending);
        this.unbindButton(this.clearLocalButton, this.onClickClearLocal);
    }

    public async onClickRunFullFlow(): Promise<void> {
        await this.runFullFlow();
    }

    public async onClickFetchPendingVerify(): Promise<void> {
        await this.runGuarded(async () => {
            const result = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = result.records;
            this.appendLog(`Fetch pending_verify OK: ${this.summarizePendingAssets(result)}`);
        });
    }

    public async onClickFetchOwned(): Promise<void> {
        await this.runGuarded(async () => {
            const result = await this.fetchPendingAssets('owned');
            this.appendLog(`Fetch owned OK: ${this.summarizePendingAssets(result)}`);
        });
    }

    public async onClickFetchRevoked(): Promise<void> {
        await this.runGuarded(async () => {
            const result = await this.fetchPendingAssets('revoked');
            this.appendLog(`Fetch revoked OK: ${this.summarizePendingAssets(result)}`);
        });
    }

    public async onClickConfirmLatestPending(): Promise<void> {
        await this.runGuarded(async () => {
            const record = await this.requireLatestPendingRecord();
            const confirmed = await this.confirmPendingAsset(record.recordId);
            this.appendLog(`Confirm OK: ${JSON.stringify(confirmed)}`);
            const refreshed = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = refreshed.records;
        });
    }

    public async onClickRevokeLatestPending(): Promise<void> {
        await this.runGuarded(async () => {
            const record = await this.requireLatestPendingRecord();
            const revoked = await this.revokePendingAsset(record.recordId, 'manual_reject');
            this.appendLog(`Revoke OK: ${JSON.stringify(revoked)}`);
            const refreshed = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = refreshed.records;
        });
    }

    public onClickClearLocal(): void {
        this.facade.clearLocalState();
        this.latestPendingAssets = [];
        this.appendLog('Local auth and queue cleared.');
        this.refreshView();
    }

    private async runFullFlow(): Promise<void> {
        await this.runGuarded(async () => {
            this.facade.clearLocalState();
            this.latestPendingAssets = [];
            this.appendLog('Run full flow started.');

            const health = await this.facade.healthCheck();
            this.appendLog(`Health OK: ${JSON.stringify(health)}`);

            const login = await this.facade.devLogin(this.getResolvedDevUserId());
            this.appendLog(`DevLogin OK: ${JSON.stringify(login)}`);

            const me = await this.facade.getMe();
            this.appendLog(`AuthMe OK: ${JSON.stringify(me)}`);

            const pingSync = await this.enqueueAndSync('debug_ping', { value: 1 });
            if (pingSync.accepted.length === 0 && pingSync.duplicates.length === 0) {
                throw new Error('debug_ping was neither accepted nor duplicate.');
            }

            const goldSync1 = await this.enqueueAndSync('debug_add_gold', { amount: 50 });
            if (goldSync1.accepted.length === 0) {
                throw new Error('debug_add_gold(50) was not accepted.');
            }

            const pendingList1 = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = pendingList1.records;
            this.appendLog(`Pending after add_gold(50): ${this.summarizePendingAssets(pendingList1)}`);

            const firstPending = await this.requireLatestPendingRecord();
            const confirmed = await this.confirmPendingAsset(firstPending.recordId);
            if (confirmed.status !== 'owned') {
                throw new Error('Pending asset confirm did not transition to owned.');
            }
            this.appendLog(`Confirm OK: ${JSON.stringify(confirmed)}`);

            const ownedList = await this.fetchPendingAssets('owned');
            this.appendLog(`Owned list OK: ${this.summarizePendingAssets(ownedList)}`);

            const goldSync2 = await this.enqueueAndSync('debug_add_gold', { amount: 20 });
            if (goldSync2.accepted.length === 0) {
                throw new Error('debug_add_gold(20) was not accepted.');
            }

            const pendingList2 = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = pendingList2.records;
            this.appendLog(`Pending after add_gold(20): ${this.summarizePendingAssets(pendingList2)}`);

            const secondPending = await this.requireLatestPendingRecord();
            const revoked = await this.revokePendingAsset(secondPending.recordId, 'manual_reject');
            if (revoked.status !== 'revoked') {
                throw new Error('Pending asset revoke did not transition to revoked.');
            }
            this.appendLog(`Revoke OK: ${JSON.stringify(revoked)}`);

            const revokedList = await this.fetchPendingAssets('revoked');
            this.appendLog(`Revoked list OK: ${this.summarizePendingAssets(revokedList)}`);

            const invalidSync = await this.enqueueAndSync('hack_reward', { value: 9999 });
            if (invalidSync.rejected.length === 0) {
                throw new Error('hack_reward should be rejected by the server.');
            }
            this.appendLog(`Rejected action OK: ${JSON.stringify(invalidSync.rejected)}`);

            this.appendLog('Run full flow completed.');
        });
    }

    private async enqueueAndSync(
        actionType: string,
        payload: Record<string, unknown>,
    ) {
        const action = this.facade.enqueueAction(actionType, payload);
        this.appendLog(`Enqueue OK: ${JSON.stringify(action)}`);
        const result = await this.facade.syncPendingActions();
        this.appendLog(`Sync OK: ${JSON.stringify(result)}`);
        this.refreshView();
        return result;
    }

    private async fetchPendingAssets(
        status: TPendingAssetStatus,
    ): Promise<IPendingAssetListResponse> {
        return this.requestApi<IPendingAssetListResponse>('GET', `/api/pending-assets?status=${status}`);
    }

    private async confirmPendingAsset(recordId: string): Promise<IPendingAssetRecord> {
        return this.requestApi<IPendingAssetRecord>('POST', `/api/pending-assets/${recordId}/confirm`, {});
    }

    private async revokePendingAsset(recordId: string, reason: string): Promise<IPendingAssetRecord> {
        return this.requestApi<IPendingAssetRecord>('POST', `/api/pending-assets/${recordId}/revoke`, {
            reason,
        });
    }

    private async requestApi<T>(
        method: 'GET' | 'POST',
        path: string,
        body?: unknown,
    ): Promise<T> {
        const config = this.facade.getRuntimeConfig();
        const token = this.facade.getAuthSnapshot().token;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await this.transport.request<IApiEnvelope<T>>({
            method,
            path,
            body,
            headers,
            timeoutMs: config.timeoutMs,
            baseUrl: config.baseUrl,
        });

        return this.unwrapResponse(response, `${method} ${path}`);
    }

    private unwrapResponse<T>(
        response: IHttpTransportResponse<IApiEnvelope<T>>,
        context: string,
    ): T {
        if (response.status < 200 || response.status >= 300) {
            throw new Error(this.extractEnvelopeError(response.data, `${context} failed.`));
        }

        const envelope = response.data;
        if (!envelope?.success) {
            throw new Error(this.extractEnvelopeError(envelope, `${context} failed.`));
        }

        if (envelope.data === undefined || envelope.data === null) {
            throw new Error(`${context} returned empty data.`);
        }

        return envelope.data;
    }

    private extractEnvelopeError(
        envelope: IApiEnvelope<unknown> | undefined,
        fallback: string,
    ): string {
        if (!envelope) {
            return fallback;
        }

        if (envelope.message) {
            return String(envelope.message);
        }

        if (envelope.error) {
            return String(envelope.error);
        }

        return fallback;
    }

    private async requireLatestPendingRecord(): Promise<IPendingAssetRecord> {
        if (this.latestPendingAssets.length === 0) {
            const refreshed = await this.fetchPendingAssets('pending_verify');
            this.latestPendingAssets = refreshed.records;
        }

        const record = this.latestPendingAssets[0];
        if (!record) {
            throw new Error('No pending_verify record found.');
        }

        return record;
    }

    private async runGuarded(task: () => Promise<void>): Promise<void> {
        if (this.inFlight) {
            this.appendLog('Request ignored: another test flow is running.');
            this.refreshView();
            return;
        }

        this.inFlight = true;
        try {
            await task();
        } catch (error) {
            this.appendLog(`Operation failed: ${this.stringifyError(error)}`);
        } finally {
            this.inFlight = false;
            this.refreshView();
        }
    }

    private refreshView(): void {
        if (this.runtimeLabel) {
            this.runtimeLabel.string = this.prettyStringify(this.facade.getRuntimeConfig());
        }
        if (this.authLabel) {
            this.authLabel.string = this.prettyStringify(this.facade.getAuthSnapshot());
        }
        if (this.queueLabel) {
            this.queueLabel.string = this.prettyStringify(this.facade.getQueueSnapshot());
        }
        if (this.pendingAssetsLabel) {
            this.pendingAssetsLabel.string = this.prettyStringify(this.latestPendingAssets);
        }
        if (this.logLabel) {
            this.logLabel.string = this.logs.join('\n');
        }
    }

    private appendLog(message: string): void {
        const timestamp = new Date().toISOString().slice(11, 19);
        this.logs.unshift(`[${timestamp}] ${message}`);
        if (this.logs.length > 20) {
            this.logs.length = 20;
        }
    }

    private prettyStringify(value: unknown): string {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }

    private stringifyError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    private getResolvedDevUserId(): string {
        const configured = this.devUserIdInput?.string?.trim();
        if (configured) {
            return configured;
        }

        const fallback = this.makeDefaultDevUserId();
        if (this.devUserIdInput) {
            this.devUserIdInput.string = fallback;
        }
        return fallback;
    }

    private summarizePendingAssets(result: IPendingAssetListResponse): string {
        return `total=${result.summary.total}, pending=${result.summary.pendingVerifyCount}, owned=${result.summary.ownedCount}, revoked=${result.summary.revokedCount}`;
    }

    private makeDefaultDevUserId(): string {
        return `test_user_${Date.now()}`;
    }

    private bindButton(
        button: Button | null,
        handler: () => void | Promise<void>,
    ): void {
        button?.node.on(Button.EventType.CLICK, handler, this);
    }

    private unbindButton(
        button: Button | null,
        handler: () => void | Promise<void>,
    ): void {
        button?.node.off(Button.EventType.CLICK, handler, this);
    }
}
