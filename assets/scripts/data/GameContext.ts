import { sys } from 'cc';
import type { IUnitAttributes, IUnitConfig } from '../battle/Types';
import type { IInventoryItem } from '../EconomicSystem/EconomicTypes';
import type { ISoulData } from '../Souls/SoulTypes';
import type { IRuneInventoryStack, IRoleRuneProfile, IRuneSlotState } from '../Runes/RuneTypes';

export interface IPlayerFormation {
    heroId: string;
    equippedSoulIds: string[];
}

export interface IHeroBuild {
    equippedSkillIds: number[];
    builtinSkillId: number | null;
}

export interface IRuneLoadout {
    equippedRuneIds: number[];
}

export interface IDateSelectionSaveData {
    text: string;
    month: number;
    day: number;
    dateStr: string;
    timestamp: number;
}

export interface IUserData {
    formation: IPlayerFormation;
    heroBuild: IHeroBuild;
    runes: IRuneLoadout;
    economy: IEconomySaveData;
    souls: ISoulsSaveData;
    runeSystem: IRuneSystemSaveData;
    home: IHomeSaveData | null;
    dateSelection: IDateSelectionSaveData | null;
}

export interface ISoulsSaveData {
    inventory: ISoulData[];
    loadout: Record<string, string | null>;
}

export interface IRuneSystemSaveData {
    bagCapacity: number;
    inventory: IRuneInventoryStack[];
    roleProfiles: IRoleRuneProfile[];
    loadouts: Record<string, IRuneSlotState[]>;
}

export interface IHomeSaveData {
    character: Record<string, any>;
    stamina: number;
    maxStamina: number;
    mood: number;
    maxMood: number;
    money: number;
    attributes: Record<string, any>;
    states: Record<string, any>;
}

export interface IEconomyCurrencySaveData {
    balances: Record<string, number>;
    dailyGained: Record<string, number>;
}

export interface IEconomyShopSaveData {
    stocks: Record<string, Record<string, number | null>>;
    dailyBought: Record<string, Record<string, number>>;
    lastRefreshTime: Record<string, number>;
}

export interface IEconomySaveData {
    currency: IEconomyCurrencySaveData;
    inventory: IInventoryItem[];
    shop: IEconomyShopSaveData;
    timestamp: number;
}

export type PreparedBattleUnitKind = 'character' | 'monster' | 'soul';

export interface IPreparedBattleUnitConfig extends Omit<IUnitConfig, 'baseAttributes'> {
    unitKind: PreparedBattleUnitKind;
    masterRoleId?: string;
    baseAttributes: IUnitAttributes;
}

export interface IPreparedBattleData {
    playerUnits: IPreparedBattleUnitConfig[];
    enemyUnits: IPreparedBattleUnitConfig[];
}

export interface IBattleContext {
    currentLevelEnemyIds: string[];
    randomSeed: number;
    preparedBattle: IPreparedBattleData;
}

interface IGameContextSavePayload {
    version: number;
    savedAt: number;
    userData: IUserData;
    battleContext: IBattleContext;
}

export class GameContext {
    private static readonly STORAGE_KEY = 'game_context_v1';
    private static readonly STORAGE_VERSION = 1;
    public static readonly instance = new GameContext();

    public userData: IUserData;
    public battleContext: IBattleContext;

    private constructor() {
        this.userData = this.createDefaultUserData();
        this.battleContext = this.createDefaultBattleContext();
    }

    public hasLocalSave(): boolean {
        if (!sys?.localStorage) {
            return false;
        }
        return !!sys.localStorage.getItem(GameContext.STORAGE_KEY);
    }

    public saveToLocal(): void {
        if (!sys?.localStorage) {
            console.warn('[GameContext] localStorage is not available.');
            return;
        }

        const payload: IGameContextSavePayload = {
            version: GameContext.STORAGE_VERSION,
            savedAt: Date.now(),
            userData: this.cloneUserData(this.userData),
            battleContext: this.cloneBattleContext(this.battleContext),
        };

        try {
            sys.localStorage.setItem(GameContext.STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.error('[GameContext] saveToLocal failed:', error);
        }
    }

    public loadFromLocal(): boolean {
        if (!sys?.localStorage) {
            console.warn('[GameContext] localStorage is not available.');
            return false;
        }

        const raw = sys.localStorage.getItem(GameContext.STORAGE_KEY);
        if (!raw) {
            return false;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<IGameContextSavePayload> | Partial<IUserData>;
            const payload = this.normalizePayload(parsed);
            this.userData = payload.userData;
            this.battleContext = payload.battleContext;
            return true;
        } catch (error) {
            console.error('[GameContext] loadFromLocal failed:', error);
            return false;
        }
    }

    private createDefaultUserData(): IUserData {
        return {
            formation: {
                heroId: '000001',
                equippedSoulIds: [],
            },
            heroBuild: {
                equippedSkillIds: [],
                builtinSkillId: null,
            },
            runes: {
                equippedRuneIds: [],
            },
            economy: {
                currency: {
                    balances: {},
                    dailyGained: {},
                },
                inventory: [],
                shop: {
                    stocks: {},
                    dailyBought: {},
                    lastRefreshTime: {},
                },
                timestamp: 0,
            },
            souls: {
                inventory: [],
                loadout: {},
            },
            runeSystem: {
                bagCapacity: 12,
                inventory: [],
                roleProfiles: [],
                loadouts: {},
            },
            home: null,
            dateSelection: null,
        };
    }

    private createDefaultBattleContext(): IBattleContext {
        return {
            currentLevelEnemyIds: [],
            randomSeed: 1,
            preparedBattle: {
                playerUnits: [],
                enemyUnits: [],
            },
        };
    }

    private normalizePayload(
        parsed: Partial<IGameContextSavePayload> | Partial<IUserData>,
    ): IGameContextSavePayload {
        const maybePayload = parsed as Partial<IGameContextSavePayload>;
        const userDataSource = maybePayload.userData ?? (parsed as Partial<IUserData>);
        const battleContextSource = maybePayload.battleContext;

        return {
            version: maybePayload.version ?? GameContext.STORAGE_VERSION,
            savedAt: maybePayload.savedAt ?? 0,
            userData: this.normalizeUserData(userDataSource),
            battleContext: this.normalizeBattleContext(battleContextSource),
        };
    }

    private normalizeUserData(data?: Partial<IUserData>): IUserData {
        const defaults = this.createDefaultUserData();
        return {
            formation: {
                heroId: data?.formation?.heroId ?? defaults.formation.heroId,
                equippedSoulIds: [...(data?.formation?.equippedSoulIds ?? defaults.formation.equippedSoulIds)],
            },
            heroBuild: {
                equippedSkillIds: [...(data?.heroBuild?.equippedSkillIds ?? defaults.heroBuild.equippedSkillIds)],
                builtinSkillId: data?.heroBuild?.builtinSkillId ?? defaults.heroBuild.builtinSkillId,
            },
            runes: {
                equippedRuneIds: [...(data?.runes?.equippedRuneIds ?? defaults.runes.equippedRuneIds)],
            },
            economy: {
                currency: {
                    balances: { ...(data?.economy?.currency?.balances ?? defaults.economy.currency.balances) },
                    dailyGained: { ...(data?.economy?.currency?.dailyGained ?? defaults.economy.currency.dailyGained) },
                },
                inventory: (data?.economy?.inventory ?? defaults.economy.inventory).map(item => ({
                    ...item,
                    extraData: item.extraData ? { ...item.extraData } : item.extraData,
                })),
                shop: {
                    stocks: { ...(data?.economy?.shop?.stocks ?? defaults.economy.shop.stocks) },
                    dailyBought: { ...(data?.economy?.shop?.dailyBought ?? defaults.economy.shop.dailyBought) },
                    lastRefreshTime: {
                        ...(data?.economy?.shop?.lastRefreshTime ?? defaults.economy.shop.lastRefreshTime),
                    },
                },
                timestamp: data?.economy?.timestamp ?? defaults.economy.timestamp,
            },
            souls: {
                inventory: (data?.souls?.inventory ?? defaults.souls.inventory).map(item => ({ ...item })),
                loadout: { ...(data?.souls?.loadout ?? defaults.souls.loadout) },
            },
            runeSystem: {
                bagCapacity: data?.runeSystem?.bagCapacity ?? defaults.runeSystem.bagCapacity,
                inventory: (data?.runeSystem?.inventory ?? defaults.runeSystem.inventory).map(item => ({ ...item })),
                roleProfiles: (data?.runeSystem?.roleProfiles ?? defaults.runeSystem.roleProfiles).map(item => ({
                    ...item,
                    exclusiveSkillIds: [...item.exclusiveSkillIds],
                })),
                loadouts: Object.fromEntries(
                    Object.entries(data?.runeSystem?.loadouts ?? defaults.runeSystem.loadouts).map(([roleId, slots]) => [
                        roleId,
                        slots.map(slot => ({ ...slot })),
                    ]),
                ),
            },
            home: data?.home
                ? {
                    ...data.home,
                    character: { ...data.home.character },
                    attributes: { ...data.home.attributes },
                    states: { ...data.home.states },
                }
                : defaults.home,
            dateSelection: data?.dateSelection
                ? {
                    ...data.dateSelection,
                }
                : defaults.dateSelection,
        };
    }

    private normalizeBattleContext(data?: Partial<IBattleContext>): IBattleContext {
        const defaults = this.createDefaultBattleContext();
        return {
            currentLevelEnemyIds: [...(data?.currentLevelEnemyIds ?? defaults.currentLevelEnemyIds)],
            randomSeed: this.normalizeBattleSeed(data?.randomSeed ?? defaults.randomSeed),
            preparedBattle: {
                playerUnits: (data?.preparedBattle?.playerUnits ?? defaults.preparedBattle.playerUnits).map(unit => ({
                    ...unit,
                    baseAttributes: { ...unit.baseAttributes },
                })),
                enemyUnits: (data?.preparedBattle?.enemyUnits ?? defaults.preparedBattle.enemyUnits).map(unit => ({
                    ...unit,
                    baseAttributes: { ...unit.baseAttributes },
                })),
            },
        };
    }

    private normalizeBattleSeed(seed: number): number {
        if (!Number.isFinite(seed)) {
            return 1;
        }

        const normalized = Math.floor(seed) >>> 0;
        return normalized === 0 ? 1 : normalized;
    }

    private cloneUserData(data: IUserData): IUserData {
        return this.normalizeUserData(data);
    }

    private cloneBattleContext(data: IBattleContext): IBattleContext {
        return this.normalizeBattleContext(data);
    }
}
