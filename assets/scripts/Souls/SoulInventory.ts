import type { ISoulData } from './SoulTypes';

type InventoryListener = () => void;

export class SoulInventory {
    private static _instance: SoulInventory | null = null;

    public static get instance(): SoulInventory {
        if (!this._instance) {
            this._instance = new SoulInventory();
        }
        return this._instance;
    }

    private readonly _souls = new Map<string, ISoulData>();
    private readonly _listeners = new Set<InventoryListener>();

    private constructor() {}

    public addSoul(soul: ISoulData): void {
        this._souls.set(soul.soulId, this.cloneSoul(soul));
        this.emitChanged();
    }

    public getSouls(): ISoulData[] {
        return Array.from(this._souls.values(), (soul) => this.cloneSoul(soul));
    }

    public getSoulById(soulId: string): ISoulData | null {
        const soul = this._souls.get(soulId);
        return soul ? this.cloneSoul(soul) : null;
    }

    public hasSoul(soulId: string): boolean {
        return this._souls.has(soulId);
    }

    public removeSoul(soulId: string): boolean {
        const removed = this._souls.delete(soulId);
        if (removed) {
            this.emitChanged();
        }
        return removed;
    }

    public clear(): void {
        if (this._souls.size === 0) {
            return;
        }
        this._souls.clear();
        this.emitChanged();
    }

    public subscribe(listener: InventoryListener): void {
        this._listeners.add(listener);
    }

    public unsubscribe(listener: InventoryListener): void {
        this._listeners.delete(listener);
    }

    private emitChanged(): void {
        for (const listener of this._listeners) {
            listener();
        }
    }

    private cloneSoul(soul: ISoulData): ISoulData {
        return {
            ...soul,
            attributes: { ...soul.attributes },
            tags: soul.tags ? [...soul.tags] : undefined,
            metadata: soul.metadata ? { ...soul.metadata } : undefined,
        };
    }
}
