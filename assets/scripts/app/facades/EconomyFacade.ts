import { Economy } from '../../EconomicSystem';
import { CurrencySystem } from '../../EconomicSystem/CurrencySystem';
import { InventorySystem } from '../../EconomicSystem/InventorySystem';
import { ShopSystem } from '../../EconomicSystem/ShopSystem';
import { CurrencyType, type CurrencyChangeCallback, type ItemChangeCallback } from '../../EconomicSystem/EconomicTypes';
import type { IEconomySaveData } from '../../data/GameContext';

export class EconomyFacade {
    private readonly listeners = new Set<() => void>();
    private notifyScheduled = false;
    private readonly handleEconomyChanged = (): void => {
        this.scheduleNotify();
    };
    private readonly handleCurrencyChanged: CurrencyChangeCallback = () => {
        this.scheduleNotify();
    };
    private readonly handleInventoryChanged: ItemChangeCallback = () => {
        this.scheduleNotify();
    };
    private readonly handleShopChanged = (): void => {
        this.scheduleNotify();
    };

    constructor() {
        Economy.onStateChanged(this.handleEconomyChanged);
        CurrencySystem.instance.onChange(this.handleCurrencyChanged);
        InventorySystem.instance.onChange(this.handleInventoryChanged);
        ShopSystem.instance.onChange(this.handleShopChanged);
    }

    public getSnapshot(): IEconomySaveData {
        return Economy.save();
    }

    public getCurrencyBalance(type: CurrencyType): number {
        return Economy.currency.getBalance(type);
    }

    public hasCurrency(type: CurrencyType, amount: number): boolean {
        if (amount <= 0) {
            return true;
        }

        return Economy.currency.canAfford(type, amount);
    }

    public spendCurrency(type: CurrencyType, amount: number, reason: string = 'spend'): boolean {
        if (amount <= 0) {
            return true;
        }

        return Economy.currency.changeBalance(type, -amount, reason);
    }

    public addCurrency(type: CurrencyType, amount: number, reason: string = 'add'): boolean {
        if (amount <= 0) {
            return true;
        }

        return Economy.currency.changeBalance(type, amount, reason);
    }

    public getItemCount(itemId: string): number {
        return Economy.inventory.getItemCount(itemId);
    }

    public hasItem(itemId: string, count: number = 1): boolean {
        if (count <= 0) {
            return true;
        }

        return Economy.inventory.hasItem(itemId, count);
    }

    public consumeItem(itemId: string, count: number, reason: string = 'consume_item'): boolean {
        if (count <= 0) {
            return true;
        }

        const removed = Economy.inventory.removeItem(itemId, count);
        if (!removed) {
            return false;
        }

        Economy.notifyStateChanged();
        console.log(`[EconomyFacade] ${reason}: ${itemId} x${count}`);
        return true;
    }

    public grantItem(itemId: string, count: number, reason: string = 'grant_item'): boolean {
        if (count <= 0) {
            return true;
        }

        const added = Economy.inventory.addItem(itemId, count);
        const success = added >= count;
        if (!success && added > 0) {
            Economy.inventory.removeItem(itemId, added);
        }

        if (success) {
            Economy.notifyStateChanged();
            console.log(`[EconomyFacade] ${reason}: ${itemId} x${count}`);
        }

        return success;
    }

    public importSnapshot(snapshot: IEconomySaveData | null | undefined): void {
        if (!snapshot) {
            return;
        }

        Economy.load(snapshot);
    }

    public onChanged(listener: () => void): void {
        this.listeners.add(listener);
    }

    public offChanged(listener: () => void): void {
        this.listeners.delete(listener);
    }

    private scheduleNotify(): void {
        if (this.notifyScheduled) {
            return;
        }

        this.notifyScheduled = true;
        setTimeout(() => {
            this.notifyScheduled = false;
            for (const listener of this.listeners) {
                try {
                    listener();
                } catch (error) {
                    console.error('[EconomyFacade] listener error:', error);
                }
            }
        }, 0);
    }
}
