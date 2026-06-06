import { SoulInventory } from './SoulInventory';
import { SOUL_SLOT_ORDER, SoulSlotType, type ISoulData, type ISoulOperationResult } from './SoulTypes';

type LoadoutListener = () => void;

export class SoulLoadout {
    private static _instance: SoulLoadout | null = null;

    public static get instance(): SoulLoadout {
        if (!this._instance) {
            this._instance = new SoulLoadout();
        }
        return this._instance;
    }

    private readonly _slots: Record<SoulSlotType, ISoulData | null> = {
        [SoulSlotType.Main]: null,
        [SoulSlotType.Sub1]: null,
        [SoulSlotType.Sub2]: null,
    };
    private readonly _listeners = new Set<LoadoutListener>();

    private constructor() {}

    public getSlots(): Record<SoulSlotType, ISoulData | null> {
        return {
            [SoulSlotType.Main]: this.cloneSoul(this._slots[SoulSlotType.Main]),
            [SoulSlotType.Sub1]: this.cloneSoul(this._slots[SoulSlotType.Sub1]),
            [SoulSlotType.Sub2]: this.cloneSoul(this._slots[SoulSlotType.Sub2]),
        };
    }

    public getSlotSoul(slot: SoulSlotType): ISoulData | null {
        return this.cloneSoul(this._slots[slot]);
    }

    public equipSoul(slot: SoulSlotType, soulId: string): ISoulOperationResult {
        const soul = SoulInventory.instance.getSoulById(soulId);
        if (!soul) {
            return { success: false, message: `Soul ${soulId} not found in inventory.` };
        }

        const occupiedSlot = this.findEquippedSlotBySoulId(soulId);
        if (occupiedSlot && occupiedSlot !== slot) {
            this._slots[occupiedSlot] = null;
        }

        this._slots[slot] = soul;
        this.emitChanged();
        return { success: true, message: `Equipped soul ${soulId} to slot ${slot}.` };
    }

    public unequipSoul(slot: SoulSlotType): ISoulOperationResult {
        if (!this._slots[slot]) {
            return { success: false, message: `Slot ${slot} is already empty.` };
        }

        this._slots[slot] = null;
        this.emitChanged();
        return { success: true, message: `Unequipped soul from slot ${slot}.` };
    }

    public clear(): void {
        let changed = false;
        for (const slot of SOUL_SLOT_ORDER) {
            if (!this._slots[slot]) {
                continue;
            }
            this._slots[slot] = null;
            changed = true;
        }

        if (changed) {
            this.emitChanged();
        }
    }

    public subscribe(listener: LoadoutListener): void {
        this._listeners.add(listener);
    }

    public unsubscribe(listener: LoadoutListener): void {
        this._listeners.delete(listener);
    }

    private emitChanged(): void {
        for (const listener of this._listeners) {
            listener();
        }
    }

    private findEquippedSlotBySoulId(soulId: string): SoulSlotType | null {
        for (const slot of SOUL_SLOT_ORDER) {
            if (this._slots[slot]?.soulId === soulId) {
                return slot;
            }
        }
        return null;
    }

    private cloneSoul(soul: ISoulData | null): ISoulData | null {
        if (!soul) {
            return null;
        }

        return {
            ...soul,
            attributes: { ...soul.attributes },
            tags: soul.tags ? [...soul.tags] : undefined,
            metadata: soul.metadata ? { ...soul.metadata } : undefined,
        };
    }
}
