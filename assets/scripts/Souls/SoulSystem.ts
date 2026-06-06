import { SoulInventory } from './SoulInventory';
import { SoulLoadout } from './SoulLoadout';
import { GameContext, type ISoulsSaveData } from '../data/GameContext';
import {
    SOUL_SLOT_ORDER,
    SoulRarity,
    SoulSlotType,
    type ISoulData,
    type ISoulOperationResult,
} from './SoulTypes';

type SoulSystemListener = () => void;

export class SoulSystem {
    private static _instance: SoulSystem | null = null;

    public static get instance(): SoulSystem {
        if (!this._instance) {
            this._instance = new SoulSystem();
        }
        return this._instance;
    }

    private readonly _inventory = SoulInventory.instance;
    private readonly _loadout = SoulLoadout.instance;
    private readonly _listeners = new Set<SoulSystemListener>();
    private _captureCounter = 0;
    private _gameContextSyncBound = false;
    private _suspendGameContextSync = false;

    private constructor() {
        this._inventory.subscribe(this.notifyChanged);
        this._loadout.subscribe(this.notifyChanged);
    }

    public getSouls(): ISoulData[] {
        return this._inventory.getSouls();
    }

    public getAvailableSouls(): ISoulData[] {
        const equippedSoulIds = new Set<string>();
        for (const slot of SOUL_SLOT_ORDER) {
            const equipped = this._loadout.getSlotSoul(slot);
            if (equipped) {
                equippedSoulIds.add(equipped.soulId);
            }
        }

        return this._inventory.getSouls().filter((soul) => !equippedSoulIds.has(soul.soulId));
    }

    public getLoadout(): Record<SoulSlotType, ISoulData | null> {
        return this._loadout.getSlots();
    }

    public getSlotSoul(slot: SoulSlotType): ISoulData | null {
        return this._loadout.getSlotSoul(slot);
    }

    public addSoul(soul: ISoulData): ISoulOperationResult {
        if (this._inventory.hasSoul(soul.soulId)) {
            return { success: false, message: `Soul ${soul.soulId} already exists.` };
        }

        this._inventory.addSoul(soul);
        return { success: true, message: `Captured soul ${soul.soulId}.` };
    }

    public captureSoul(monsterId: number, level: number, name?: string): ISoulOperationResult {
        const soulId = `soul_${monsterId}_${Date.now()}_${this._captureCounter++}`;
        const rarity = this.getRarityByLevel(level);
        return this.addSoul({
            soulId,
            templateId: monsterId,
            monsterId,
            rarity,
            name: name ?? `Soul ${monsterId}`,
            attributes: {},
        });
    }

    public equipSoul(slot: SoulSlotType, soulId: string): ISoulOperationResult {
        return this._loadout.equipSoul(slot, soulId);
    }

    public autoEquipSoul(soulId: string): ISoulOperationResult {
        const slot = this.findFirstEmptySlot();
        if (!slot) {
            return { success: false, message: 'No empty soul slot available.' };
        }

        return this._loadout.equipSoul(slot, soulId);
    }

    public unequipSoul(slot: SoulSlotType): ISoulOperationResult {
        return this._loadout.unequipSoul(slot);
    }

    public clearLoadout(): void {
        this._loadout.clear();
    }

    public bindGameContextSync(): void {
        this._gameContextSyncBound = true;
    }

    public saveToGameContext(options?: { persistToLocal?: boolean }): void {
        GameContext.instance.userData.souls = this.exportToSave();
        if (options?.persistToLocal) {
            GameContext.instance.saveToLocal();
        }
    }

    public loadFromGameContext(): void {
        this.importFromSave(GameContext.instance.userData.souls);
    }

    public exportToSave(): ISoulsSaveData {
        const loadout = this._loadout.getSlots();
        return {
            inventory: this._inventory.getSouls(),
            loadout: {
                [SoulSlotType.Main]: loadout[SoulSlotType.Main]?.soulId ?? null,
                [SoulSlotType.Sub1]: loadout[SoulSlotType.Sub1]?.soulId ?? null,
                [SoulSlotType.Sub2]: loadout[SoulSlotType.Sub2]?.soulId ?? null,
            },
        };
    }

    public importFromSave(data: ISoulsSaveData): void {
        this._suspendGameContextSync = true;
        try {
            this._loadout.clear();
            this._inventory.clear();

            for (const soul of data.inventory ?? []) {
                this._inventory.addSoul(soul);
            }

            const loadout = data.loadout ?? {};
            for (const slot of SOUL_SLOT_ORDER) {
                const soulId = loadout[slot];
                if (!soulId) {
                    continue;
                }
                this._loadout.equipSoul(slot, soulId);
            }
        } finally {
            this._suspendGameContextSync = false;
        }
    }

    public subscribe(listener: SoulSystemListener): void {
        this._listeners.add(listener);
    }

    public unsubscribe(listener: SoulSystemListener): void {
        this._listeners.delete(listener);
    }

    private readonly notifyChanged = (): void => {
        if (this._gameContextSyncBound && !this._suspendGameContextSync) {
            this.saveToGameContext();
        }
        for (const listener of this._listeners) {
            listener();
        }
    };

    private findFirstEmptySlot(): SoulSlotType | null {
        for (const slot of SOUL_SLOT_ORDER) {
            if (!this._loadout.getSlotSoul(slot)) {
                return slot;
            }
        }
        return null;
    }

    private getRarityByLevel(level: number): SoulRarity {
        if (level >= 20) {
            return SoulRarity.LEGENDARY;
        }
        if (level >= 10) {
            return SoulRarity.BOSS;
        }
        if (level >= 5) {
            return SoulRarity.ELITE;
        }
        return SoulRarity.COMMON;
    }
}
