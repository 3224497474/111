/**
 * 剧情系统类型定义
 * STORY-TYPES: 核心接口和枚举
 */

// ==================== 剧情节点类型 ====================

export enum StoryNodeType {
    Dialog = 'dialog',           // 对话节点
    Choice = 'choice',          // 选择节点
    Battle = 'battle',          // 战斗节点
    CG = 'cg',                  // CG演出节点
    Branch = 'branch',          // 条件分支节点
    Event = 'event',            // 特殊事件节点
    Ending = 'ending',          // 结局节点
}

// ==================== 章节类型 ====================

export enum ChapterType {
    Main = 'main',               // 主线章节
    Character = 'character',     // 角色支线章节
    Special = 'special',         // 特殊章节
}

// ==================== 结局类型 ====================

export enum EndingType {
    True = 'true',               // 真结局
    Good = 'good',               // 好结局
    Normal = 'normal',           // 普通结局
    Bad = 'bad',                 // 坏结局
    Character = 'character',     // 角色专属结局
    Hidden = 'hidden',           // 隐藏结局
}

// ==================== 好感度等级 ====================

export enum AffectionLevel {
    Stranger = 0,      // 陌生人 (0-10)
    Acquaintance = 1,  // 熟人 (11-30)
    Friend = 2,        // 朋友 (31-50)
    Close = 3,         // 挚友 (51-70)
    Lover = 4,         // 恋人 (71-90)
    Soulmate = 5,      // 灵魂伴侣 (91-100)
}

// ==================== 剧情节点接口 ====================

export interface IStoryNode {
    id: string;
    chapterId: string;
    type: StoryNodeType;
    name: string;
    cgId?: string;
    dialogId?: string;
    choices?: IStoryChoice[];
    branches?: IConditionalBranch[];
    nextNodeId?: string;
    isSkippable: boolean;
    isOnceOnly: boolean;
    unlockCondition?: string;
    rewards?: IStoryReward[];
    effects?: IStoryEffect[];
}

export interface IStoryChoice {
    id: string;
    text: string;
    targetNodeId: string;
    condition?: string;
    affection?: Record<string, number>;
    flags?: Record<string, boolean | number | string>;
    items?: IItemChange[];
    endingPoints?: Record<string, number>;
}

export interface IConditionalBranch {
    condition: string;
    targetNodeId: string;
}

export interface IStoryEffect {
    type: 'affection' | 'flag' | 'item' | 'attribute' | 'ending';
    target?: string;
    key?: string;
    value: number | boolean | string;
}

export interface IStoryReward {
    type: 'gold' | 'diamond' | 'item' | 'exp' | 'unlock';
    id?: string;
    amount?: number;
}

export interface IItemChange {
    itemId: string;
    amount: number;
}

export interface IAttributeChange {
    attributeType: string;
    deltaValue: number;
}

// ==================== 章节接口 ====================

export interface IChapter {
    id: string;
    type: ChapterType;
    order: number;
    name: string;
    description: string;
    characterId?: string;
    unlockCondition?: string;
    previousChapterId?: string;
    startNodeId: string;
    nodeIds: string[];
    bgPath?: string;
    iconPath?: string;
    bgmPath?: string;
    clearRewards?: IStoryReward[];
}

// ==================== 结局接口 ====================

export interface IEnding {
    id: string;
    type: EndingType;
    name: string;
    description: string;
    characterId?: string;
    conditions: IEndingCondition[];
    endingNodeId: string;
    cgPath?: string;
    priority: number;  // 优先级，数字越大优先级越高
    isUnlocked?: boolean;
}

export interface IEndingCondition {
    type: 'chapter' | 'affection' | 'flag' | 'attribute' | 'ending_points' | 'completed_nodes';
    target?: string;
    operator: '==' | '>=' | '<=' | '>' | '<';
    value: number | boolean | string;
}

export interface IEndingPoints {
    [endingId: string]: number;
}

// ==================== 角色好感度 ====================

export interface ICharacterAffection {
    characterId: string;
    value: number;
    level: AffectionLevel;
    unlockedEvents: string[];
    completedEvents: string[];
    choiceHistory: {
        nodeId: string;
        choiceId: string;
        affectionChange: number;
    }[];
}

// ==================== 角色支线 ====================

export interface ICharacterRoute {
    characterId: string;
    name: string;
    stages: ICharacterStage[];
    endings: IEnding[];
    affectionThresholds: {
        stage1: number;
        stage2: number;
        stage3: number;
        stage4: number;
        ending: number;
    };
}

export interface ICharacterStage {
    id: string;
    order: number;
    name: string;
    requiredAffection: number;
    requiredFlags?: string[];
    requiredChapter?: string;
    eventNodeIds: string[];
    rewards?: IStoryReward[];
}

// ==================== 剧情存档 ====================

export interface IStorySaveData {
    currentChapterId: string | null;
    currentNodeId: string | null;
    completedChapters: string[];
    completedNodes: string[];
    storyFlags: Record<string, boolean | number | string>;
    affection: Record<string, ICharacterAffection>;
    endingPoints: IEndingPoints;
    unlockedEndings: string[];
    achievedEndings: string[];
    choiceHistory: {
        chapterId: string;
        nodeId: string;
        choiceId: string;
        timestamp: number;
    }[];
    playedDialogs: string[];
    unlockedCGs: string[];
}

// ==================== 事件回调类型 ====================

export type StoryEventCallback = (nodeId: string) => void;
export type ChoiceCallback = (nodeId: string, choiceId: string) => void;
export type EndingCallback = (endingId: string) => void;
export type AffectionCallback = (characterId: string, oldValue: number, newValue: number) => void;
