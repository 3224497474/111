import {
    type IDiscountConfig,
    type IItemConfig,
    type IShopConfig,
    type IShopItemConfig,
    CurrencyType,
    DiscountType,
} from './EconomicTypes';

export interface IShopItemView {
    shopId: string;
    itemId: string;
    itemConfig: IItemConfig;
    originalPrice: number;
    currentPrice: number;
    currencyType: CurrencyType;
    stock: number | null;
    dailyBought: number;
    dailyLimit: number;
    discount: IDiscountConfig | null;
    canBuy: boolean;
    buyFailReason?: string;
}

type ShopChangeListener = () => void;

export class ShopSystem {
    private static _instance: ShopSystem | null = null;

    public static get instance(): ShopSystem {
        if (!this._instance) {
            this._instance = new ShopSystem();
        }
        return this._instance;
    }

    private _shops: Map<string, IShopConfig> = new Map();
    private _stocks: Map<string, Map<string, number | null>> = new Map();
    private _dailyBought: Map<string, Map<string, number>> = new Map();
    private _lastRefreshTime: Map<string, number> = new Map();
    private _getItemConfig: ((itemId: string) => IItemConfig | undefined) | null = null;
    private readonly _changeListeners: Set<ShopChangeListener> = new Set();

    public checkCurrency?: (type: CurrencyType, amount: number) => boolean;
    public deductCurrency?: (type: CurrencyType, amount: number, reason: string) => boolean;
    public addCurrency?: (type: CurrencyType, amount: number, reason: string) => void;
    public checkInventorySpace?: (itemId: string) => boolean;
    public checkItem?: (itemId: string, count: number) => boolean;
    public giveItem?: (itemId: string, count: number) => number;
    public takeItem?: (itemId: string, count: number) => boolean;

    private constructor() {}

    public setItemConfigGetter(getter: (itemId: string) => IItemConfig | undefined): void {
        this._getItemConfig = getter;
    }

    public registerShop(config: IShopConfig): void {
        this._shops.set(config.id, config);

        const stockMap = new Map<string, number | null>();
        const boughtMap = new Map<string, number>();

        for (const item of config.items) {
            stockMap.set(item.itemId, item.initialStock < 0 ? null : item.initialStock);
            boughtMap.set(item.itemId, 0);
        }

        this._stocks.set(config.id, stockMap);
        this._dailyBought.set(config.id, boughtMap);
        this._lastRefreshTime.set(config.id, Date.now());
        this.notifyChange();
    }

    public getShop(shopId: string): IShopConfig | undefined {
        return this._shops.get(shopId);
    }

    public getAllShops(): IShopConfig[] {
        return Array.from(this._shops.values());
    }

    public listShopItems(shopId: string, vipLevel: number = 0): IShopItemView[] {
        const shop = this._shops.get(shopId);
        if (!shop) {
            return [];
        }

        const stockMap = this._stocks.get(shopId);
        const boughtMap = this._dailyBought.get(shopId);
        const result: IShopItemView[] = [];

        for (const itemConfig of shop.items) {
            const itemCfg = this._getItemConfig?.(itemConfig.itemId);
            if (!itemCfg) {
                continue;
            }

            const stock = stockMap?.get(itemConfig.itemId) ?? null;
            const dailyBought = boughtMap?.get(itemConfig.itemId) ?? 0;
            const currentPrice = this.calculatePrice(itemConfig, vipLevel);
            const discount = this.getEffectiveDiscount(itemConfig, vipLevel);
            const canBuy = this.canBuyItem(shopId, itemConfig.itemId, vipLevel);

            result.push({
                shopId,
                itemId: itemConfig.itemId,
                itemConfig: itemCfg,
                originalPrice: itemConfig.price,
                currentPrice,
                currencyType: itemConfig.currencyType,
                stock,
                dailyBought,
                dailyLimit: itemConfig.dailyLimit,
                discount,
                canBuy: canBuy.success,
                buyFailReason: canBuy.reason,
            });
        }

        return result;
    }

    public calculatePrice(itemConfig: IShopItemConfig, vipLevel: number = 0): number {
        let price = itemConfig.price;
        const discount = this.getEffectiveDiscount(itemConfig, vipLevel);

        if (discount) {
            switch (discount.type) {
                case DiscountType.Percentage:
                    price = Math.floor(price * (1 - discount.value / 100));
                    break;
                case DiscountType.Fixed:
                    price = Math.max(0, price - discount.value);
                    break;
            }
        }

        return price;
    }

    private getEffectiveDiscount(itemConfig: IShopItemConfig, vipLevel: number): IDiscountConfig | null {
        if (!itemConfig.discount) {
            return null;
        }

        const discount = itemConfig.discount;
        if (discount.minVIPLevel && vipLevel < discount.minVIPLevel) {
            return null;
        }

        const now = Date.now();
        if (discount.startTime && now < discount.startTime) {
            return null;
        }
        if (discount.endTime && now > discount.endTime) {
            return null;
        }

        return discount;
    }

    public canBuyItem(
        shopId: string,
        itemId: string,
        vipLevel: number = 0,
        count: number = 1,
    ): { success: boolean; reason?: string } {
        const normalizedCount = Math.floor(count);
        if (!Number.isFinite(count) || normalizedCount <= 0) {
            return { success: false, reason: '购买数量无效' };
        }

        const shop = this._shops.get(shopId);
        if (!shop) {
            return { success: false, reason: '商店不存在' };
        }

        const itemConfig = shop.items.find((item) => item.itemId === itemId);
        if (!itemConfig) {
            return { success: false, reason: '商品不存在' };
        }

        const stockMap = this._stocks.get(shopId);
        const stock = stockMap?.get(itemId);
        if (stock !== null && stock !== undefined && stock < normalizedCount) {
            return { success: false, reason: '库存不足' };
        }

        if (itemConfig.dailyLimit > 0) {
            const boughtMap = this._dailyBought.get(shopId);
            const dailyBought = boughtMap?.get(itemId) ?? 0;
            if (dailyBought + normalizedCount > itemConfig.dailyLimit) {
                return { success: false, reason: '今日限购已满' };
            }
        }

        const price = this.calculatePrice(itemConfig, vipLevel) * normalizedCount;
        if (!this.checkCurrency || !this.checkCurrency(itemConfig.currencyType, price)) {
            return { success: false, reason: '货币不足' };
        }

        if (!this.checkInventorySpace || !this.checkInventorySpace(itemId)) {
            return { success: false, reason: '背包已满' };
        }

        return { success: true };
    }

    public buyItem(shopId: string, itemId: string, count: number = 1, vipLevel: number = 0): boolean {
        const normalizedCount = Math.floor(count);
        if (!Number.isFinite(count) || normalizedCount <= 0) {
            return false;
        }

        const shop = this._shops.get(shopId);
        if (!shop) {
            return false;
        }

        const itemConfig = shop.items.find((item) => item.itemId === itemId);
        if (!itemConfig) {
            return false;
        }

        const canBuy = this.canBuyItem(shopId, itemId, vipLevel, normalizedCount);
        if (!canBuy.success) {
            console.warn(`[ShopSystem] Cannot buy: ${canBuy.reason}`);
            return false;
        }
        if (!this.deductCurrency || !this.giveItem) {
            return false;
        }

        const unitPrice = this.calculatePrice(itemConfig, vipLevel);
        const totalPrice = unitPrice * normalizedCount;
        if (!this.deductCurrency(itemConfig.currencyType, totalPrice, `buy_${itemId}`)) {
            return false;
        }

        const actualAdded = this.giveItem(itemId, normalizedCount);
        if (actualAdded < normalizedCount) {
            const refund = unitPrice * (normalizedCount - actualAdded);
            this.addCurrency?.(itemConfig.currencyType, refund, `refund_${itemId}`);
        }

        const stockMap = this._stocks.get(shopId);
        if (stockMap) {
            const stock = stockMap.get(itemId);
            if (stock !== null && stock !== undefined) {
                stockMap.set(itemId, Math.max(0, stock - actualAdded));
            }
        }

        const boughtMap = this._dailyBought.get(shopId);
        if (boughtMap) {
            const bought = boughtMap.get(itemId) ?? 0;
            boughtMap.set(itemId, bought + actualAdded);
        }

        this.notifyChange();
        return true;
    }

    public sellItem(itemId: string, count: number = 1, priceRate: number = 0.5): boolean {
        const normalizedCount = Math.floor(count);
        if (!Number.isFinite(count) || normalizedCount <= 0) {
            return false;
        }

        const itemConfig = this._getItemConfig?.(itemId);
        if (!itemConfig || !this.checkItem || !this.takeItem || !this.addCurrency) {
            return false;
        }

        if (!this.checkItem(itemId, normalizedCount)) {
            return false;
        }
        if (!this.takeItem(itemId, normalizedCount)) {
            return false;
        }

        const gain = Math.floor(itemConfig.sellPrice * priceRate * normalizedCount);
        this.addCurrency(CurrencyType.Gold, gain, `sell_${itemId}`);
        this.notifyChange();
        return true;
    }

    public refreshShop(shopId: string): boolean {
        const shop = this._shops.get(shopId);
        if (!shop) {
            return false;
        }

        if (shop.refreshCost) {
            if (!this.checkCurrency || !this.checkCurrency(shop.refreshCost.type, shop.refreshCost.amount)) {
                return false;
            }
            if (!this.deductCurrency || !this.deductCurrency(shop.refreshCost.type, shop.refreshCost.amount, `refresh_${shopId}`)) {
                return false;
            }
        }

        const stockMap = this._stocks.get(shopId);
        if (stockMap) {
            for (const item of shop.items) {
                stockMap.set(item.itemId, item.initialStock < 0 ? null : item.initialStock);
            }
        }

        const boughtMap = this._dailyBought.get(shopId);
        if (boughtMap) {
            for (const item of shop.items) {
                boughtMap.set(item.itemId, 0);
            }
        }

        this._lastRefreshTime.set(shopId, Date.now());
        this.notifyChange();
        return true;
    }

    public checkAutoRefresh(): void {
        const now = Date.now();

        for (const [shopId, shop] of this._shops) {
            if (shop.refreshType === 'none') {
                continue;
            }

            const lastRefresh = this._lastRefreshTime.get(shopId) ?? 0;
            const lastDate = new Date(lastRefresh);
            const nowDate = new Date(now);

            let needRefresh = false;
            if (shop.refreshType === 'daily') {
                needRefresh =
                    lastDate.getDate() !== nowDate.getDate() ||
                    lastDate.getMonth() !== nowDate.getMonth();
            } else if (shop.refreshType === 'weekly') {
                const lastWeek = Math.floor(lastDate.getTime() / (7 * 24 * 60 * 60 * 1000));
                const nowWeek = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
                needRefresh = lastWeek !== nowWeek;
            }

            if (needRefresh) {
                this.refreshShop(shopId);
            }
        }
    }

    public resetDailyLimits(): void {
        for (const boughtMap of this._dailyBought.values()) {
            for (const key of boughtMap.keys()) {
                boughtMap.set(key, 0);
            }
        }
        this.notifyChange();
    }

    public onChange(listener: ShopChangeListener): void {
        this._changeListeners.add(listener);
    }

    public offChange(listener: ShopChangeListener): void {
        this._changeListeners.delete(listener);
    }

    public exportSave(): Record<string, any> {
        const stocks: Record<string, Record<string, number | null>> = {};
        const dailyBought: Record<string, Record<string, number>> = {};
        const lastRefreshTime: Record<string, number> = {};

        for (const [shopId, stockMap] of this._stocks) {
            stocks[shopId] = {};
            for (const [itemId, stock] of stockMap) {
                stocks[shopId][itemId] = stock;
            }
        }

        for (const [shopId, boughtMap] of this._dailyBought) {
            dailyBought[shopId] = {};
            for (const [itemId, count] of boughtMap) {
                dailyBought[shopId][itemId] = count;
            }
        }

        for (const [shopId, time] of this._lastRefreshTime) {
            lastRefreshTime[shopId] = time;
        }

        return { stocks, dailyBought, lastRefreshTime };
    }

    public importSave(data: Record<string, any>): void {
        if (data.stocks) {
            for (const [shopId, stockMap] of Object.entries(data.stocks)) {
                const map = new Map<string, number | null>();
                for (const [itemId, stock] of Object.entries(stockMap as Record<string, number | null>)) {
                    map.set(itemId, stock);
                }
                this._stocks.set(shopId, map);
            }
        }

        if (data.dailyBought) {
            for (const [shopId, boughtMap] of Object.entries(data.dailyBought)) {
                const map = new Map<string, number>();
                for (const [itemId, count] of Object.entries(boughtMap as Record<string, number>)) {
                    map.set(itemId, count);
                }
                this._dailyBought.set(shopId, map);
            }
        }

        if (data.lastRefreshTime) {
            for (const [shopId, time] of Object.entries(data.lastRefreshTime)) {
                this._lastRefreshTime.set(shopId, time as number);
            }
        }
    }

    private notifyChange(): void {
        for (const listener of this._changeListeners) {
            try {
                listener();
            } catch (error) {
                console.error('[ShopSystem] Listener error:', error);
            }
        }
    }
}
