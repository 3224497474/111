import type { IEconomySaveData } from '../../../data/GameContext';
import { Economy } from '../../../EconomicSystem';
import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';
import { EconomyFacade } from '../../facades/EconomyFacade';

export class EconomySaveModule extends DirtySaveModule<IEconomySaveData> {
    public readonly key = 'economy';

    constructor(private readonly economyFacade: EconomyFacade) {
        super();
        this.economyFacade.onChanged(this.handleChanged);
    }

    public capture(): IEconomySaveData {
        return Economy.save();
    }

    public restore(snapshot: IEconomySaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        Economy.load(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

