import type { SnapshotManager } from '../state/SnapshotManager';
import type { ITransport } from '../transport/ITransport';
import type { LocalQueue } from './LocalQueue';
import type { ISyncRequest, ISyncResponse } from './SyncTypes';

export interface ISyncEngineOptions {
    syncUrl?: string;
    maxRetryDelayMs?: number;
}

export class SyncEngine {
    private readonly transport: ITransport;
    private readonly localQueue: LocalQueue;
    private readonly snapshotManager: SnapshotManager;
    private readonly syncUrl: string;
    private readonly maxRetryDelayMs: number;

    private syncTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private isSyncing = false;
    private retryDelayMs = 2000;

    constructor(
        transport: ITransport,
        localQueue: LocalQueue,
        snapshotManager: SnapshotManager,
        options: ISyncEngineOptions = {},
    ) {
        this.transport = transport;
        this.localQueue = localQueue;
        this.snapshotManager = snapshotManager;
        this.syncUrl = options.syncUrl ?? '/api/sync';
        this.maxRetryDelayMs = Math.max(2000, options.maxRetryDelayMs ?? 15000);
    }

    public triggerSync(): void {
        if (this.syncTimer !== null) {
            clearTimeout(this.syncTimer);
        }

        this.syncTimer = setTimeout(() => {
            this.syncTimer = null;
            void this.executeSync();
        }, 1000);
    }

    public async flushNow(): Promise<void> {
        await this.executeSync();
    }

    private async executeSync(): Promise<void> {
        if (this.isSyncing) {
            return;
        }

        this.clearRetryTimer();

        const actions = this.localQueue.getPendingActions();
        if (actions.length === 0) {
            this.retryDelayMs = 2000;
            return;
        }

        this.isSyncing = true;
        try {
            const request: ISyncRequest = {
                actions,
            };
            const response = await this.transport.post<ISyncResponse>(this.syncUrl, request);

            if (response.status === 403) {
                this.snapshotManager.handleDataDesync(response.data?.snapshot);
                return;
            }

            if (response.status === 200) {
                const acceptedIds = Array.isArray(response.data.acceptedIds)
                    ? response.data.acceptedIds
                    : [];
                this.localQueue.dequeueConfirmed(acceptedIds);
                this.snapshotManager.updateSnapshot(response.data.snapshot);
                this.retryDelayMs = 2000;
                return;
            }

            if (!response.ok || response.status >= 500) {
                this.scheduleRetry();
                return;
            }
        } catch {
            this.scheduleRetry();
        } finally {
            this.isSyncing = false;
        }
    }

    public dispose(): void {
        if (this.syncTimer !== null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        this.clearRetryTimer();
    }

    private scheduleRetry(): void {
        if (this.retryTimer !== null) {
            return;
        }

        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.executeSync();
        }, this.retryDelayMs);

        this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
    }

    private clearRetryTimer(): void {
        if (this.retryTimer === null) {
            return;
        }

        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }
}
