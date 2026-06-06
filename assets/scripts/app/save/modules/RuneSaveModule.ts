import type { IRuneSystemSaveData } from '../../../data/GameContext';
import { RuneSystem } from '../../../Runes/RuneSystem';
import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';

export class RuneSaveModule extends DirtySaveModule<IRuneSystemSaveData> {
    public readonly key = 'runes';

    constructor(private readonly runeSystem: RuneSystem) {
        super();
        this.runeSystem.subscribe(this.handleChanged);
    }

    public capture(): IRuneSystemSaveData {
        return this.runeSystem.exportToSave();
    }

    public restore(snapshot: IRuneSystemSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.runeSystem.importFromSave(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

