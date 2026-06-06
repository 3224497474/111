import { GameContext, type IHomeSaveData, type IEconomySaveData, type IRuneSystemSaveData, type ISoulsSaveData } from '../data/GameContext';
import type { IProgressSaveData } from './facades/ProgressFacade';

export interface ILegacyRuntimeSnapshot {
    economy: IEconomySaveData;
    home: IHomeSaveData | null;
    souls: ISoulsSaveData;
    runeSystem: IRuneSystemSaveData;
    progress: IProgressSaveData;
}

export class LegacyGameContextBridge {
    public hasLocalSave(): boolean {
        return GameContext.instance.hasLocalSave();
    }

    public load(): ILegacyRuntimeSnapshot | null {
        const gameContext = GameContext.instance;
        if (!gameContext.loadFromLocal()) {
            return null;
        }

        return this.createSnapshot(gameContext);
    }

    public sync(snapshot: ILegacyRuntimeSnapshot, persistToLocal = false): void {
        const gameContext = GameContext.instance;
        gameContext.userData.economy = snapshot.economy;
        gameContext.userData.home = snapshot.home;
        gameContext.userData.souls = snapshot.souls;
        gameContext.userData.runeSystem = snapshot.runeSystem;
        gameContext.userData.formation = snapshot.progress.formation;
        gameContext.userData.heroBuild = snapshot.progress.heroBuild;
        gameContext.userData.runes = snapshot.progress.runes;
        gameContext.userData.dateSelection = snapshot.progress.dateSelection;
        gameContext.battleContext = snapshot.progress.battleContext;

        if (persistToLocal) {
            gameContext.saveToLocal();
        }
    }

    private createSnapshot(gameContext: GameContext): ILegacyRuntimeSnapshot {
        return {
            economy: gameContext.userData.economy,
            home: gameContext.userData.home,
            souls: gameContext.userData.souls,
            runeSystem: gameContext.userData.runeSystem,
            progress: {
                formation: gameContext.userData.formation,
                heroBuild: gameContext.userData.heroBuild,
                runes: gameContext.userData.runes,
                dateSelection: gameContext.userData.dateSelection,
                battleContext: gameContext.battleContext,
            },
        };
    }
}
