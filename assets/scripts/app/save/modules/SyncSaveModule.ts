import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';
import type { IPlayerAction } from '../../../network/protocol/Types';
import { SyncManager } from '../../../network/sync/SyncManager';

export class SyncSaveModule extends DirtySaveModule<IPlayerAction[]> {
    public readonly key = 'sync_queue';

    constructor(private readonly syncManager: SyncManager) {
        super();
        this.syncManager.onChanged(this.handleChanged);
    }

    public capture(): IPlayerAction[] {
        return this.syncManager.getPendingActionsSnapshot();
    }

    public restore(snapshot: IPlayerAction[] | null | undefined): void {
        this.syncManager.restorePendingActionsSnapshot(snapshot);
        void this.syncManager.trySyncToServer();
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}
