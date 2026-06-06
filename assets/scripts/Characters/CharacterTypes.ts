/**
 * 角色系统类型定义
 * CHAR-BASE: 基础信息与档案
 * CHAR-ATTR: 属性结构定义
 * CHAR-STATE: 状态（心情、体力等）
 */

export enum CharacterGender {
    Female = "female",
    Male = "male"
}

export enum AttributeType {
    // 能力属性
    Strength = "strength",      // 力量
    Defense = "defense",        // 防御
    Speed = "speed",            // 速度
    Intelligence = "intelligence", // 智力
    Luck = "luck",              // 幸运

    // 性格属性
    Kindness = "kindness",      // 善良度
    Courage = "courage",        // 勇气
    Wisdom = "wisdom",          // 智慧
    Charm = "charm",            // 魅力
}

export enum StateType {
    // 心情状态
    Happy = "happy",            // 开心
    Sad = "sad",                // 伤心
    Angry = "angry",            // 愤怒
    Calm = "calm",              // 平静

    // 生理状态
    Healthy = "healthy",        // 康健
    Tired = "tired",            // 疲劳
    Injured = "injured",        // 受伤
    Poisoned = "poisoned",      // 中毒

    // 特殊状态
    Blessed = "blessed",        // 祝福
    Cursed = "cursed",          // 诅咒
}

export interface IAttribute {
    type: AttributeType;
    baseValue: number;          // 基础值
    currentValue: number;       // 当前值
    maxValue: number;           // 最大值
    growth: number;             // 成长率 (0-1)
}

export interface ICharacterState {
    type: StateType;
    duration: number;           // 持续时间（回合数），-1 表示永久
    intensity: number;          // 强度（0-100）
    source?: string;            // 来源（活动、事件等）
}

export interface ICharacterProfile {
    id: string;                 // 唯一ID
    name: string;               // 名字
    age: number;                // 年龄
    gender: CharacterGender;    // 性别
    background: string;         // 背景故事
    avatar: string;             // 头像路径
    illustration: string;       // 立绘路径
    description: string;        // 描述
    createdDate: Date;          // 创建日期
}

export interface IAttributeChange {
    attributeType: AttributeType;
    deltaValue: number;         // 变化值（可正可负）
    reason: string;             // 变化原因
    timestamp?: Date;           // 时间戳
}

export interface IStateChange {
    stateType: StateType;
    action: "add" | "remove";   // 添加还是移除
    duration?: number;          // 如果是添加，持续时间
    intensity?: number;         // 强度
    source?: string;            // 来源
}
