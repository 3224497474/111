import { GameContext, type IHomeSaveData } from '../../../data/GameContext';
import { Economy } from '../../../EconomicSystem';
import { HomeStatusModel } from '../../../home/HomeStatusModel';
import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';

export class HomeSaveModule extends DirtySaveModule<IHomeSaveData> {
    public readonly key = 'home';

    constructor(private readonly homeStatusModel: HomeStatusModel) {
        super();
        this.homeStatusModel.onStatusChanged(this.handleChanged);
    }

    public capture(): IHomeSaveData {
        return this.homeStatusModel.exportData() as IHomeSaveData;
    }

    public restore(snapshot: IHomeSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        GameContext.instance.userData.economy = Economy.save();
        this.homeStatusModel.importData(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

