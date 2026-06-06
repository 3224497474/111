import type { INetworkRuntimeConfig } from '../NetworkConfig';
import { HttpClient } from '../http/HttpClient';
import type {
    IActionSubmitResponseData,
    IActionSyncSummary,
    IApiEnvelope,
    IQueuedAction,
    IQueueSnapshot,
} from '../protocol/Types';
import { NetworkKV } from '../storage/NetworkKV';

const ACTION_QUEUE_KEY = 'action_queue';
const ACTION_SEQ_KEY = 'action_seq';

export class ActionQueueService {
    private queue: IQueuedAction[] = [];
    private nextSeqNo = 1;

    constructor(
        private readonly httpClient: HttpClient,
        private readonly kv: NetworkKV,
        private readonly getCurrentUid: () => string | null,
        private readonly getConfig: () => INetworkRuntimeConfig,
    ) {}

    public restore(): void {
        const storedQueue = this.kv.getJson<IQueuedAction[]>(ACTION_QUEUE_KEY, []);
        this.queue = Array.isArray(storedQueue)
            ? storedQueue
                .filter((item) => item && typeof item === 'object')
                .map((item) => this.normalizeAction(item))
            : [];
        this.nextSeqNo = Math.max(1, Math.floor(this.kv.getNumber(ACTION_SEQ_KEY, 1)));
        this.persist();
    }

    public enqueue(actionType: string, payload: Record<string, unknown>): IQueuedAction {
        const normalizedActionType = actionType.trim();
        if (!normalizedActionType) {
            throw new Error('[ActionQueueService] actionType is required.');
        }

        const config = this.getConfig();
        const seqNo = this.nextSeqNo++;
        const uid = this.getCurrentUid()?.trim() || 'anonymous';
        const action: IQueuedAction = {
            actionId: `${uid}-${seqNo}`,
            seqNo,
            actionType: normalizedActionType,
            payload: { ...payload },
            createdAt: Date.now(),
            clientVersion: config.clientVersion,
            protocolVersion: config.protocolVersion,
            status: 'pending',
        };

        this.queue = [...this.queue, action];
        this.persist();
        return this.cloneAction(action);
    }

    public async submitPending(): Promise<IActionSyncSummary> {
        const pendingActions = this.queue
            .filter((action) => action.status === 'pending')
            .map((action) => this.cloneAction(action));

        if (pendingActions.length === 0) {
            return {
                submitted: 0,
                remaining: 0,
                accepted: [],
                rejected: [],
                duplicates: [],
            };
        }

        const pendingActionIds = new Set<string>(pendingActions.map((action) => action.actionId));
        this.queue = this.queue.map((action) => (
            pendingActionIds.has(action.actionId)
                ? { ...action, status: 'submitting' }
                : action
        ));
        this.persist();

        try {
            const response = await this.httpClient.post<IActionSubmitResponseData>(
                '/api/actions/submit',
                {
                    actions: pendingActions,
                },
                true,
            );
            const data = this.requireData(response);
            const removableActionIds = new Set<string>([
                ...data.accepted.map((item) => item.actionId),
                ...data.duplicates.map((item) => item.actionId),
            ]);

            this.queue = this.queue
                .filter((action) => !removableActionIds.has(action.actionId))
                .map((action) => (
                    action.status === 'submitting'
                        ? { ...action, status: 'pending' }
                        : action
                ));
            this.persist();

            return {
                submitted: pendingActions.length,
                remaining: this.queue.length,
                accepted: data.accepted.map((item) => ({ ...item })),
                rejected: data.rejected.map((item) => ({ ...item })),
                duplicates: data.duplicates.map((item) => ({ ...item })),
            };
        } catch (error) {
            this.queue = this.queue.map((action) => (
                action.status === 'submitting'
                    ? { ...action, status: 'pending' }
                    : action
            ));
            this.persist();
            throw error;
        }
    }

    public clearQueue(): void {
        this.queue = [];
        this.nextSeqNo = 1;
        this.persist();
    }

    public getSnapshot(): IQueueSnapshot {
        const pending = this.queue.filter((action) => action.status === 'pending').length;
        const submitting = this.queue.filter((action) => action.status === 'submitting').length;
        return {
            nextSeqNo: this.nextSeqNo,
            total: this.queue.length,
            pending,
            submitting,
            actions: this.queue.map((action) => this.cloneAction(action)),
        };
    }

    private persist(): void {
        this.kv.setJson(ACTION_QUEUE_KEY, this.queue);
        this.kv.setNumber(ACTION_SEQ_KEY, this.nextSeqNo);
    }

    private requireData(
        response: IApiEnvelope<IActionSubmitResponseData>,
    ): IActionSubmitResponseData {
        if (!response.data) {
            throw new Error('[ActionQueueService] Submit response data is empty.');
        }

        return response.data;
    }

    private normalizeAction(action: IQueuedAction): IQueuedAction {
        return {
            actionId: String(action.actionId ?? ''),
            seqNo: Math.max(1, Math.floor(Number(action.seqNo ?? 0) || 0)),
            actionType: String(action.actionType ?? '').trim(),
            payload: action.payload && typeof action.payload === 'object'
                ? { ...action.payload }
                : {},
            createdAt: Math.max(0, Math.floor(Number(action.createdAt ?? 0) || 0)),
            clientVersion: String(action.clientVersion ?? ''),
            protocolVersion: Math.max(1, Math.floor(Number(action.protocolVersion ?? 1) || 1)),
            status: 'pending',
        };
    }

    private cloneAction(action: IQueuedAction): IQueuedAction {
        return {
            ...action,
            payload: { ...action.payload },
        };
    }
}
