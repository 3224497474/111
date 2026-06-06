import { GameFacade } from '../../../scripts/app/GameFacade';
import { EventBus, EVENT_FORCE_RELOAD_UI } from '../EventBus';
import type { LocalQueue } from '../sync/LocalQueue';

export interface IServerSnapshot {
    revision?: number | string;
    hash?: string;
    state?: Record<string, unknown>;
}

export interface ISnapshotHooks {
    applySnapshot?: (snapshot: IServerSnapshot) => void;
    notifyRollback?: (reason: string) => void;
}

export class SnapshotManager {
    private readonly localQueue: LocalQueue;
    private latestSnapshot: IServerSnapshot | null = null;
    private hooks: ISnapshotHooks = {};

    constructor(localQueue: LocalQueue) {
        this.localQueue = localQueue;
    }

    public installHooks(hooks: ISnapshotHooks): void {
        this.hooks = {
            ...this.hooks,
            ...hooks,
        };
    }

    public updateSnapshot(snapshot: IServerSnapshot | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.latestSnapshot = {
            ...snapshot,
            state: snapshot.state ? { ...snapshot.state } : undefined,
        };
    }

    public forceRollback(snapshot: IServerSnapshot | null | undefined, reason: string): void {
        if (snapshot) {
            this.updateSnapshot(snapshot);
        }

        if (this.latestSnapshot) {
            this.hooks.applySnapshot?.(this.latestSnapshot);
        }
        this.hooks.notifyRollback?.(reason);
    }

    public handleDataDesync(serverSnapshot: any): void {
        this.localQueue.clearAll();
        this.updateSnapshot(serverSnapshot);

        GameFacade.instance.restoreFromServerSnapshot(serverSnapshot);

        this.hooks.applySnapshot?.(serverSnapshot);
        this.hooks.notifyRollback?.('Data desync detected.');
        EventBus.emit(EVENT_FORCE_RELOAD_UI, serverSnapshot);
    }

    public getLatestSnapshot(): IServerSnapshot | null {
        if (!this.latestSnapshot) {
            return null;
        }

        return {
            ...this.latestSnapshot,
            state: this.latestSnapshot.state ? { ...this.latestSnapshot.state } : undefined,
        };
    }
}
