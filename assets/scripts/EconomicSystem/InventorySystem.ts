/**
 * 增强版背包系统
 * 
 * 功能：
 * - 背包容量限制
 * - 物品堆叠上限
 * - 物品品质/强化
 * - 物品排序
 * - 物品变化事件
 * - 数据持久化
 */

import {
    IInventoryItem,
    IItemConfig,
    IInventoryConfig,
    ItemRarity,
    ItemType,
    ItemChangeCallback,
} from './EconomicTypes';

export class InventorySystem {
    private static _instance: InventorySystem | null = null;

    public static get instance(): InventorySystem {
        if (!this._instance) {
            this._instance = new InventorySystem();
        }
        return this._instance;
    }

    // 背包配置
    private _config: IInventoryConfig = {
        maxSlots: 100,
        maxStackBonus: 0,
    };

    // 物品列表（每个格子一个物品）
    private _items: IInventoryItem[] = [];

    // 物品数量缓存：O(1) 查询总数量
    private _itemCountCache: Map<string, number> = new Map();

    // 物品配置获取函数
    private _getItemConfig: ((itemId: string) => IItemConfig | undefined) | null = null;

    // 变化监听器
    private _changeListeners: Set<ItemChangeCallback> = new Set();

    private constructor() {}

    /**
     * 设置物品配置获取函数
     */
    public setItemConfigGetter(getter: (itemId: string) => IItemConfig | undefined): void {
        this._getItemConfig = getter;
    }

    /**
     * 设置背包配置
     */
    public setConfig(config: Partial<IInventoryConfig>): void {
        this._config = { ...this._config, ...config };
    }

    /**
     * 获取背包配置
     */
    public getConfig(): IInventoryConfig {
        return { ...this._config };
    }

    /**
     * 获取所有物品
     */
    public getItems(): IInventoryItem[] {
        return [...this._items];
    }

    /**
     * 获取指定类型的物品
     */
    public getItemsByType(type: ItemType): IInventoryItem[] {
        if (!this._getItemConfig) return [];

        return this._items.filter(item => {
            const config = this._getItemConfig!(item.itemId);
            return config?.type === type;
        });
    }

    /**
     * 获取指定品质的物品
     */
    public getItemsByRarity(rarity: ItemRarity): IInventoryItem[] {
        if (!this._getItemConfig) return [];

        return this._items.filter(item => {
            const config = this._getItemConfig!(item.itemId);
            return config?.rarity === rarity;
        });
    }

    /**
     * 查询物品总数量
     */
    public getItemCount(itemId: string): number {
        return this._itemCountCache.get(itemId) ?? 0;
    }

    /**
     * 查询背包已用格子数
     */
    public getUsedSlots(): number {
        return this._items.length;
    }

    /**
     * 查询背包空闲格子数
     */
    public getFreeSlots(): number {
        return this._config.maxSlots - this._items.length;
    }

    /**
     * 检查背包是否已满
     */
    public isFull(): boolean {
        return this._items.length >= this._config.maxSlots;
    }

    /**
     * 计算物品最大堆叠数
     */
    private getMaxStack(itemId: string): number {
        const config = this._getItemConfig?.(itemId);
        return (config?.maxStack ?? 99) + this._config.maxStackBonus;
    }

    /**
     * 添加物品
     * @returns 实际添加的数量
     */
    public addItem(
        itemId: string,
        count: number,
        options?: {
            quality?: number;
            enchantLevel?: number;
            expireTime?: number;
            extraData?: Record<string, any>;
        }
    ): number {
        if (count <= 0) return 0;

        const maxStack = this.getMaxStack(itemId);
        let remaining = count;
        const oldCount = this.getItemCount(itemId);

        // 先尝试堆叠到现有格子
        for (const item of this._items) {
            if (item.itemId !== itemId) continue;
            if (item.count >= maxStack) continue;
            if (options?.quality !== undefined && item.quality !== options.quality) continue;
            if (options?.enchantLevel !== undefined && item.enchantLevel !== options.enchantLevel) continue;

            const canAdd = Math.min(remaining, maxStack - item.count);
            item.count += canAdd;
            remaining -= canAdd;

            if (remaining <= 0) break;
        }

        // 再尝试添加新格子
        while (remaining > 0 && !this.isFull()) {
            const addCount = Math.min(remaining, maxStack);
            this._items.push({
                itemId,
                count: addCount,
                quality: options?.quality,
                enchantLevel: options?.enchantLevel,
                expireTime: options?.expireTime,
                extraData: options?.extraData,
            });
            remaining -= addCount;
        }

        const actualAdded = count - remaining;
        if (actualAdded > 0) {
            this._itemCountCache.set(itemId, oldCount + actualAdded);
            this.notifyChange(itemId, oldCount, oldCount + actualAdded);
        }

        return actualAdded;
    }

    /**
     * 移除物品
     * @returns 是否成功
     */
    public removeItem(itemId: string, count: number): boolean {
        if (count <= 0) return true;

        const oldCount = this.getItemCount(itemId);
        if (oldCount < count) return false;

        let remaining = count;

        // 从后往前移除
        for (let i = this._items.length - 1; i >= 0; i--) {
            if (remaining <= 0) break;

            const item = this._items[i];
            if (item.itemId !== itemId) continue;

            const removeCount = Math.min(remaining, item.count);
            item.count -= removeCount;
            const cachedCount = this._itemCountCache.get(itemId) ?? 0;
            const newCachedCount = Math.max(0, cachedCount - removeCount);
            if (newCachedCount > 0) {
                this._itemCountCache.set(itemId, newCachedCount);
            } else {
                this._itemCountCache.delete(itemId);
            }
            remaining -= removeCount;

            if (item.count <= 0) {
                this._items.splice(i, 1);
            }
        }

        this.notifyChange(itemId, oldCount, oldCount - count);
        return true;
    }

    /**
     * 检查是否有足够物品
     */
    public hasItem(itemId: string, count: number): boolean {
        return this.getItemCount(itemId) >= count;
    }

    /**
     * 批量检查
     */
    public hasItems(requirements: Array<{ itemId: string; count: number }>): boolean {
        return requirements.every(req => this.hasItem(req.itemId, req.count));
    }

    /**
     * 批量移除
     */
    public removeItems(requirements: Array<{ itemId: string; count: number }>): boolean {
        if (!this.hasItems(requirements)) return false;

        for (const req of requirements) {
            this.removeItem(req.itemId, req.count);
        }

        return true;
    }

    /**
     * 使用物品
     * @returns 是否成功
     */
    public useItem(index: number): boolean {
        const item = this._items[index];
        if (!item) return false;

        // 检查是否过期
        if (item.expireTime && Date.now() > item.expireTime) {
            const cachedCount = this._itemCountCache.get(item.itemId) ?? 0;
            const newCachedCount = Math.max(0, cachedCount - item.count);
            if (newCachedCount > 0) {
                this._itemCountCache.set(item.itemId, newCachedCount);
            } else {
                this._itemCountCache.delete(item.itemId);
            }
            this._items.splice(index, 1);
            return false;
        }

        // 获取物品配置
        const config = this._getItemConfig?.(item.itemId);
        if (!config) return false;

        // 检查是否可使用
        if (config.type === ItemType.Material || config.type === ItemType.Key) {
            return false;
        }

        // 执行使用效果
        if (config.effects) {
            // TODO: 应用物品效果
            console.log('[InventorySystem] Apply effects:', config.effects);
        }

        // 减少数量
        item.count--;
        const cachedCount = this._itemCountCache.get(item.itemId) ?? 0;
        const newCachedCount = Math.max(0, cachedCount - 1);
        if (newCachedCount > 0) {
            this._itemCountCache.set(item.itemId, newCachedCount);
        } else {
            this._itemCountCache.delete(item.itemId);
        }
        if (item.count <= 0) {
            this._items.splice(index, 1);
        }

        return true;
    }

    /**
     * 物品排序
     */
    public sortItems(compareFn?: (a: IInventoryItem, b: IInventoryItem) => number): void {
        const defaultCompare = (a: IInventoryItem, b: IInventoryItem): number => {
            const configA = this._getItemConfig?.(a.itemId);
            const configB = this._getItemConfig?.(b.itemId);

            // 按类型排序
            if (configA?.type !== configB?.type) {
                const typeOrder = [ItemType.Equipment, ItemType.Consumable, ItemType.Material, ItemType.Key];
                return typeOrder.indexOf(configA?.type ?? ItemType.Material) -
                       typeOrder.indexOf(configB?.type ?? ItemType.Material);
            }

            // 按品质排序
            if (configA?.rarity !== configB?.rarity) {
                return (configB?.rarity ?? 0) - (configA?.rarity ?? 0);
            }

            // 按数量排序
            return b.count - a.count;
        };

        this._items.sort(compareFn ?? defaultCompare);
    }

    /**
     * 清理过期物品
     */
    public cleanupExpired(): number {
        const now = Date.now();
        const before = this._items.length;

        this._items = this._items.filter(item => {
            if (item.expireTime && now > item.expireTime) {
                return false;
            }
            return true;
        });

        this.rebuildCache();

        return before - this._items.length;
    }

    /**
     * 监听变化
     */
    public onChange(callback: ItemChangeCallback): void {
        this._changeListeners.add(callback);
    }

    /**
     * 取消监听
     */
    public offChange(callback: ItemChangeCallback): void {
        this._changeListeners.delete(callback);
    }

    /**
     * 通知变化
     */
    private notifyChange(itemId: string, oldCount: number, newCount: number): void {
        for (const listener of this._changeListeners) {
            try {
                listener(itemId, oldCount, newCount);
            } catch (e) {
                console.error('[InventorySystem] Listener error:', e);
            }
        }
    }

    // ==================== 存档 ====================

    /**
     * 导出存档数据
     */
    public exportSave(): IInventoryItem[] {
        return this._items.map(item => ({ ...item }));
    }

    /**
     * 导入存档数据
     */
    public importSave(data: IInventoryItem[]): void {
        this._items = data.map(item => ({ ...item }));
        this.rebuildCache();
    }

    /**
     * 重置背包
     */
    public reset(): void {
        this._items = [];
        this.rebuildCache();
    }

    /**
     * 重建物品数量缓存
     */
    private rebuildCache(): void {
        this._itemCountCache.clear();

        for (const item of this._items) {
            const currentCount = this._itemCountCache.get(item.itemId) ?? 0;
            this._itemCountCache.set(item.itemId, currentCount + item.count);
        }
    }
}
