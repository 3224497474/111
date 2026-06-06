import { ActionFactory } from './action/ActionFactory';
import type { ActionType, INetAction } from './action/ActionTypes';
import { SnapshotManager, type IServerSnapshot, type ISnapshotHooks } from './state/SnapshotManager';
import { HttpAdapter } from './transport/HttpAdapter';
import type { ITransportResponse } from './transport/ITransport';
import { LocalQueue } from './sync/LocalQueue';
import { SyncEngine } from './sync/SyncEngine';

export interface INetClientOptions {
    baseUrl: string;
    timeoutMs?: number;
    storageKeyPrefix?: string;
    clientVersion: string;
    protocolVersion: number;
    getPlayerId?: () => string | null;
}

export class NetClient {
    private static _instance: NetClient | null = null;

    public static get instance(): NetClient {
        if (!this._instance) {
            this._instance = new NetClient({
                baseUrl: 'http://127.0.0.1:8080',
                clientVersion: '0.1.0-dev',
                protocolVersion: 1,
            });
        }
        return this._instance;
    }

    private authToken: string | null = null;

    private readonly localQueue: LocalQueue;
    private readonly snapshotManager: SnapshotManager;
    private readonly transport: HttpAdapter;
    private readonly actionFactory: ActionFactory;
    private readonly syncEngine: SyncEngine;

    constructor(options: INetClientOptions) {
        this.localQueue = new LocalQueue(options.storageKeyPrefix ?? 'network_v2_');
        this.snapshotManager = new SnapshotManager(this.localQueue);
        this.transport = new HttpAdapter({
            baseUrl: options.baseUrl,
            timeoutMs: options.timeoutMs,
        });
        this.actionFactory = new ActionFactory({
            getNextSeqNo: () => this.localQueue.consumeNextSeqNo(),
            getClientVersion: () => options.clientVersion,
            getProtocolVersion: () => options.protocolVersion,
            getPlayerId: options.getPlayerId,
        });
        this.syncEngine = new SyncEngine(
            this.transport,
            this.localQueue,
            this.snapshotManager,
        );
    }

    public setAuthToken(token: string | null): void {
        this.authToken = token?.trim() || null;
        this.transport.setToken(this.authToken);
    }

    public installSnapshotHooks(hooks: ISnapshotHooks): void {
        this.snapshotManager.installHooks(hooks);
    }

    public dispatch(
        actionType: ActionType | string,
        payload: Record<string, unknown>,
    ): INetAction {
        const action = this.actionFactory.create(actionType, payload);
        this.localQueue.enqueue(action);
        this.syncEngine.triggerSync();
        return action;
    }

    public async flush(): Promise<void> {
        await this.syncEngine.flushNow();
    }

    public getPendingActions(): INetAction[] {
        return this.localQueue.getPendingActions();
    }

    public clearQueue(): void {
        this.localQueue.clearAll();
    }

    public getLatestSnapshot(): IServerSnapshot | null {
        return this.snapshotManager.getLatestSnapshot();
    }

    public requestAsync<T = unknown>(path: string, payload?: unknown): Promise<ITransportResponse<T>> {
        return this.transport.post<T>(path, payload);
    }

    public dispose(): void {
        this.syncEngine.dispose();
    }
}
