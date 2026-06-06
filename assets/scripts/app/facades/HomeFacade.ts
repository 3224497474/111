import { HomeStatusModel, type HomeStatusSnapshot } from '../../home/HomeStatusModel';
import { RuneSystem } from '../../Runes/RuneSystem';
import { SoulSystem } from '../../Souls/SoulSystem';
import type { IHomeSaveData, IRuneSystemSaveData, ISoulsSaveData } from '../../data/GameContext';

export class HomeFacade {
    constructor(
        private readonly homeStatusModel: HomeStatusModel,
        private readonly soulSystem: SoulSystem,
        private readonly runeSystem: RuneSystem,
    ) {}

    public getHomeSnapshot(): HomeStatusSnapshot {
        return this.homeStatusModel.getSnapshot();
    }

    public onHomeChanged(listener: (snapshot: HomeStatusSnapshot) => void): void {
        this.homeStatusModel.onStatusChanged(listener);
    }

    public offHomeChanged(listener: (snapshot: HomeStatusSnapshot) => void): void {
        this.homeStatusModel.offStatusChanged(listener);
    }

    public exportHomeSave(): IHomeSaveData {
        return this.homeStatusModel.exportData() as IHomeSaveData;
    }

    public importHomeSave(snapshot: IHomeSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.homeStatusModel.importData(snapshot);
    }

    public exportSoulSave(): ISoulsSaveData {
        return this.soulSystem.exportToSave();
    }

    public importSoulSave(snapshot: ISoulsSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.soulSystem.importFromSave(snapshot);
    }

    public exportRuneSave(): IRuneSystemSaveData {
        return this.runeSystem.exportToSave();
    }

    public importRuneSave(snapshot: IRuneSystemSaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.runeSystem.importFromSave(snapshot);
    }

    public collectEquippedRuneIds(heroId: string): number[] {
        const loadout = this.runeSystem.getLoadout(this.getPlayerRuneRoleId(heroId));
        const equippedRuneIds: number[] = [];

        for (const slot of loadout.getAllSlots()) {
            if (slot.runeId !== null) {
                equippedRuneIds.push(slot.runeId);
            }
        }

        return equippedRuneIds;
    }

    private getPlayerRuneRoleId(heroId: string): string {
        return `character_${heroId}`;
    }
}
