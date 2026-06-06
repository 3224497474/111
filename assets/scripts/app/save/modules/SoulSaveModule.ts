import type { ISoulsSaveData } from '../../../data/GameContext';
import { SoulSystem } from '../../../Souls/SoulSystem';
import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';

export class SoulSaveModule extends DirtySaveModule<ISoulsSaveData> {
    public readonly key = 'souls';

    constructor(private readonly soulSystem: SoulSystem) {
        super();
        this.soulSystem.subscribe(this.handleChanged);
    }

    public capture(): ISoulsSaveData {
        return this.soulSystem.exportToSave();
    }

    public restore(snapshot: ISoulsSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.soulSystem.importFromSave(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

