export * from './EconomicTypes';

export { CurrencySystem } from './CurrencySystem';
export { InventorySystem } from './InventorySystem';
export { ShopSystem } from './ShopSystem';

import { CurrencySystem } from './CurrencySystem';
import { InventorySystem } from './InventorySystem';
import { ShopSystem } from './ShopSystem';
import { GameContext, type IEconomySaveData } from '../data/GameContext';
import { CurrencyType } from './EconomicTypes';

export const Economy = {
    currency: CurrencySystem.instance,
    inventory: InventorySystem.instance,
    shop: ShopSystem.instance,
    _syncBound: false,
    _listeners: new Set<() => void>(),

    init(options?: { bindLegacyGameContextSync?: boolean }): void {
        this.shop.checkCurrency = (type, amount) => this.currency.canAfford(type, amount);
        this.shop.deductCurrency = (type, amount, reason) => this.currency.changeBalance(type, -amount, reason);
        this.shop.addCurrency = (type, amount, reason) => {
            this.currency.changeBalance(type, amount, reason);
        };
        this.shop.checkInventorySpace = (itemId) => {
            return !(this.inventory.isFull() && this.inventory.getItemCount(itemId) === 0);
        };
        this.shop.checkItem = (itemId, count) => this.inventory.hasItem(itemId, count);
        this.shop.giveItem = (itemId, count) => this.inventory.addItem(itemId, count);
        this.shop.takeItem = (itemId, count) => this.inventory.removeItem(itemId, count);

        if (options?.bindLegacyGameContextSync) {
            this.bindGameContextSync();
        }

        console.log('[Economy] Initialized');
    },

    bindGameContextSync(): void {
        if (this._syncBound) {
            return;
        }

        this.currency.onChange(() => {
            this.saveToGameContext();
            this.notifyStateChanged();
        });
        this.inventory.onChange(() => {
            this.saveToGameContext();
            this.notifyStateChanged();
        });
        this.shop.onChange(() => {
            this.saveToGameContext();
            this.notifyStateChanged();
        });
        this._syncBound = true;
    },

    onStateChanged(listener: () => void): void {
        this._listeners.add(listener);
    },

    offStateChanged(listener: () => void): void {
        this._listeners.delete(listener);
    },

    canBuy(shopId: string, itemId: string, count: number = 1): boolean {
        return this.shop.canBuyItem(shopId, itemId, 0, count).success;
    },

    buy(shopId: string, itemId: string, count: number = 1): boolean {
        const success = this.shop.buyItem(shopId, itemId, count);
        if (success) {
            this.saveToGameContext();
            this.notifyStateChanged();
        }
        return success;
    },

    sell(itemId: string, count: number = 1): boolean {
        const success = this.shop.sellItem(itemId, count);
        if (success) {
            this.saveToGameContext();
            this.notifyStateChanged();
        }
        return success;
    },

    useItem(inventoryIndex: number): boolean {
        const success = this.inventory.useItem(inventoryIndex);
        if (success) {
            this.saveToGameContext();
            this.notifyStateChanged();
        }
        return success;
    },

    getGold(): number {
        return this.currency.getBalance(CurrencyType.Gold);
    },

    getDiamond(): number {
        return this.currency.getBalance(CurrencyType.Diamond);
    },

    getStamina(): number {
        return this.currency.getBalance(CurrencyType.Stamina);
    },

    addGold(amount: number, reason: string = 'add'): boolean {
        return this.currency.changeBalance(CurrencyType.Gold, amount, reason);
    },

    spendGold(amount: number, reason: string = 'spend'): boolean {
        return this.currency.changeBalance(CurrencyType.Gold, -amount, reason);
    },

    addDiamond(amount: number, reason: string = 'add'): boolean {
        return this.currency.changeBalance(CurrencyType.Diamond, amount, reason);
    },

    spendDiamond(amount: number, reason: string = 'spend'): boolean {
        return this.currency.changeBalance(CurrencyType.Diamond, -amount, reason);
    },

    addItem(itemId: string, count: number): number {
        return this.inventory.addItem(itemId, count);
    },

    removeItem(itemId: string, count: number): boolean {
        return this.inventory.removeItem(itemId, count);
    },

    getItemCount(itemId: string): number {
        return this.inventory.getItemCount(itemId);
    },

    save(): IEconomySaveData {
        return {
            currency: this.currency.exportSave(),
            inventory: this.inventory.exportSave(),
            shop: this.shop.exportSave(),
            timestamp: Date.now(),
        };
    },

    load(data: IEconomySaveData): void {
        if (data.currency) {
            this.currency.importSave(data.currency);
        }
        if (data.inventory) {
            this.inventory.importSave(data.inventory);
        }
        if (data.shop) {
            this.shop.importSave(data.shop);
        }
    },

    saveToGameContext(options?: { persistToLocal?: boolean }): void {
        GameContext.instance.userData.economy = this.save();
        if (options?.persistToLocal) {
            GameContext.instance.saveToLocal();
        }
    },

    loadFromGameContext(): void {
        this.load(GameContext.instance.userData.economy);
    },

    reset(): void {
        this.currency.reset();
        this.inventory.reset();

        for (const shop of this.shop.getAllShops()) {
            this.shop.refreshShop(shop.id);
        }

        this.saveToGameContext();
        this.notifyStateChanged();
    },

    notifyStateChanged(): void {
        this._listeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.error('[Economy] listener error:', error);
            }
        });
    },
};
