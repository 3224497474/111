/**
 * 增强版经济系统类型定义
 * 
 * 支持：
 * - 多货币系统
 * - 物品品质/稀有度
 * - 物品效果
 * - 背包容量限制
 * - 物品堆叠上限
 */

// ==================== 货币系统 ====================

/**
 * 货币类型枚举
 */
export enum CurrencyType {
    Gold = 'gold',           // 金币（免费货币）
    Diamond = 'diamond',     // 钻石（付费货币）
    Stamina = 'stamina',     // 体力
    Exp = 'exp',             // 经验
    GuildCoin = 'guildCoin', // 公会币
    ArenaCoin = 'arenaCoin', // 竞技场币
    EventCoin = 'eventCoin', // 活动代币
}

/**
 * 货币配置
 */
export interface ICurrencyConfig {
    id: CurrencyType;
    name: string;
    icon: string;
    maxAmount: number;       // 最大持有数量
    isPremium: boolean;      // 是否为付费货币
    dailyLimit?: number;     // 每日获取上限
}

/**
 * 货币变化数据
 */
export interface ICurrencyChange {
    type: CurrencyType;
    oldValue: number;
    newValue: number;
    delta: number;
    reason: string;          // 变化原因
    timestamp: number;
}

// ==================== 物品系统 ====================

/**
 * 物品类型枚举
 */
export enum ItemType {
    Consumable = 'consumable',   // 消耗品
    Equipment = 'equipment',     // 装备
    Material = 'material',       // 材料
    Key = 'key',                 // 关键道具
    Gift = 'gift',               // 礼物
    Box = 'box',                 // 宝箱
    Fragment = 'fragment',       // 碎片
}

/**
 * 物品品质/稀有度
 */
export enum ItemRarity {
    Common = 1,      // 白色 - 普通
    Uncommon = 2,    // 绿色 - 优秀
    Rare = 3,        // 蓝色 - 稀有
    Epic = 4,        // 紫色 - 史诗
    Legendary = 5,   // 橙色 - 传说
    Mythic = 6,      // 红色 - 神话
}

/**
 * 品质颜色映射
 */
export const RARITY_COLORS: Record<ItemRarity, string> = {
    [ItemRarity.Common]: '#FFFFFF',
    [ItemRarity.Uncommon]: '#00FF00',
    [ItemRarity.Rare]: '#0080FF',
    [ItemRarity.Epic]: '#B040FF',
    [ItemRarity.Legendary]: '#FF8000',
    [ItemRarity.Mythic]: '#FF0040',
};

/**
 * 物品效果类型
 */
export enum ItemEffectType {
    HealHP = 'healHP',               // 恢复生命
    HealMP = 'healMP',               // 恢复魔法
    AddExp = 'addExp',               // 增加经验
    AddCurrency = 'addCurrency',     // 增加货币
    AddBuff = 'addBuff',             // 添加Buff
    RandomBox = 'randomBox',         // 随机宝箱
    GachaTicket = 'gachaTicket',     // 抽卡券
}

/**
 * 物品效果配置
 */
export interface IItemEffect {
    type: ItemEffectType;
    value: number;
    params?: Record<string, any>;
}

/**
 * 物品基础配置
 */
export interface IItemConfig {
    id: string;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    icon: string;
    description: string;
    maxStack: number;        // 单格堆叠上限
    sellPrice: number;       // 出售价格
    buyPrice: number;        // 购买价格（0表示不可购买）
    isTradable: boolean;     // 是否可交易
    effects?: IItemEffect[]; // 使用效果
    level?: number;          // 等级要求
    quality?: number;        // 品质（0-100）
}

/**
 * 背包物品数据
 */
export interface IInventoryItem {
    itemId: string;
    count: number;
    quality?: number;        // 品质
    enchantLevel?: number;   // 强化等级
    expireTime?: number;     // 过期时间戳
    extraData?: Record<string, any>;
}

/**
 * 背包配置
 */
export interface IInventoryConfig {
    maxSlots: number;        // 最大格子数
    maxStackBonus: number;   // 堆叠上限加成
}

// ==================== 商店系统 ====================

/**
 * 商品折扣类型
 */
export enum DiscountType {
    None = 'none',
    Percentage = 'percentage',   // 百分比折扣
    Fixed = 'fixed',             // 固定减免
    BuyOneGetOne = 'bogo',       // 买一送一
}

/**
 * 商品折扣配置
 */
export interface IDiscountConfig {
    type: DiscountType;
    value: number;
    startTime?: number;
    endTime?: number;
    minVIPLevel?: number;
}

/**
 * 商店商品配置
 */
export interface IShopItemConfig {
    itemId: string;
    price: number;
    currencyType: CurrencyType;
    initialStock: number;     // -1表示无限
    dailyLimit: number;       // 每日限购，0表示不限
    refreshType: 'none' | 'daily' | 'weekly';
    discount?: IDiscountConfig;
    unlockCondition?: string;
}

/**
 * 商店配置
 */
export interface IShopConfig {
    id: string;
    name: string;
    refreshType: 'none' | 'daily' | 'weekly' | 'manual';
    refreshCost?: { type: CurrencyType; amount: number };
    items: IShopItemConfig[];
}

// ==================== 交易系统 ====================

/**
 * 交易类型
 */
export enum TransactionType {
    Buy = 'buy',
    Sell = 'sell',
    Use = 'use',
    Drop = 'drop',
    Gift = 'gift',
    System = 'system',
}

/**
 * 交易记录
 */
export interface ITransactionRecord {
    id: string;
    type: TransactionType;
    itemType: 'currency' | 'item';
    itemId: string;
    amount: number;
    currencyType?: CurrencyType;
    currencyAmount?: number;
    timestamp: number;
    reason: string;
}

// ==================== 事件系统 ====================

/**
 * 经济事件类型
 */
export enum EconomyEventType {
    CurrencyChanged = 'currencyChanged',
    ItemAdded = 'itemAdded',
    ItemRemoved = 'itemRemoved',
    ItemUsed = 'itemUsed',
    TransactionComplete = 'transactionComplete',
    InventoryFull = 'inventoryFull',
    ShopRefreshed = 'shopRefreshed',
}

/**
 * 经济事件数据
 */
export interface IEconomyEvent {
    type: EconomyEventType;
    data: any;
    timestamp: number;
}

// ==================== 回调类型 ====================

export type CurrencyChangeCallback = (event: ICurrencyChange) => void;
export type ItemChangeCallback = (itemId: string, oldCount: number, newCount: number) => void;
export type TransactionCallback = (record: ITransactionRecord) => void;
