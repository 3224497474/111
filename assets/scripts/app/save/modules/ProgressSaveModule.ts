import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';
import { ProgressFacade, type IProgressSaveData } from '../../facades/ProgressFacade';

export class ProgressSaveModule extends DirtySaveModule<IProgressSaveData> {
    public readonly key = 'progress';

    constructor(private readonly progressFacade: ProgressFacade) {
        super();
        this.progressFacade.onChanged(this.handleChanged);
    }

    public capture(): IProgressSaveData {
        return this.progressFacade.exportSave();
    }

    public restore(snapshot: IProgressSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.progressFacade.importSave(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

