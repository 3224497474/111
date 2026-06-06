# 剧情系统需求文档 - 多分支多结局

---

## 一、系统概述

### 1.1 核心特性

| 特性 | 说明 |
|------|------|
| 多分支剧情 | 玩家选择影响剧情走向 |
| 多结局系统 | 根据累计选择和条件达成不同结局 |
| 主线剧情 | 推动游戏核心故事发展 |
| 角色支线 | 独立的角色个人故事线 |
| 好感度系统 | 影响角色支线解锁和结局 |
| 剧情标记 | 记录玩家所有选择和状态 |
| 结局判定 | 综合多项条件触发最终结局 |

### 1.2 剧情结构图

```
游戏剧情
├── 主线剧情 (Main Story)
│   ├── 序章：觉醒
│   ├── 第一章：初遇
│   ├── 第二章：危机
│   ├── 第三章：抉择
│   └── 终章：结局
│       ├── 结局A：英雄之路
│       ├── 结局B：和平结局
│       ├── 结局C：悲剧结局
│       └── 隐藏结局：真结局
│
├── 角色支线 (Character Routes)
│   ├── 角色A支线
│   │   ├── 相识
│   │   ├── 了解
│   │   ├── 羁绊
│   │   └── 告白/结局
│   ├── 角色B支线
│   └── 角色C支线
│
└── 特殊剧情
    ├── 隐藏剧情
    ├── 节日剧情
    └── 彩蛋剧情
```

---

## 二、核心数据结构

### 2.1 剧情节点 (StoryNode)

```typescript
/**
 * 剧情节点类型
 */
export enum StoryNodeType {
    Dialog = 'dialog',           // 对话节点
    Choice = 'choice',          // 选择节点
    Battle = 'battle',          // 战斗节点
    CG = 'cg',                  // CG演出节点
    Branch = 'branch',          // 条件分支节点
    Event = 'event',            // 特殊事件节点
    Ending = 'ending',          // 结局节点
}

/**
 * 剧情节点
 */
export interface IStoryNode {
    id: string;                    // 唯一ID
    chapterId: string;            // 所属章节
    type: StoryNodeType;          // 节点类型
    name: string;                 // 节点名称

    // 对话内容
    dialogId?: string;            // 对话配置ID

    // 选择分支
    choices?: IStoryChoice[];     // 选择项列表

    // 条件分支
    branches?: IConditionalBranch[];  // 条件分支列表

    // 流程控制
    nextNodeId?: string;          // 默认下一节点
    isSkippable: boolean;         // 是否可跳过
    isOnceOnly: boolean;          // 是否只能触发一次

    // 触发条件
    unlockCondition?: string;     // 解锁条件表达式

    // 奖励/效果
    rewards?: IStoryReward[];     // 节点完成奖励
    effects?: IStoryEffect[];     // 剧情效果
}

/**
 * 剧情选择项
 */
export interface IStoryChoice {
    id: string;                   // 选择ID
    text: string;                 // 显示文字
    targetNodeId: string;         // 跳转目标节点
    condition?: string;           // 显示条件

    // 选择后果
    affection?: Record<string, number>;  // 好感度变化 { roleId: delta }
    flags?: Record<string, boolean>;     // 标记变化
    items?: IItemChange[];               // 道具变化
    attributes?: IAttributeChange[];     // 属性变化

    // 结局影响
    endingPoints?: Record<string, number>;  // 结局点数
}

/**
 * 条件分支
 */
export interface IConditionalBranch {
    condition: string;            // 条件表达式
    targetNodeId: string;         // 满足条件时跳转
}

/**
 * 剧情效果
 */
export interface IStoryEffect {
    type: 'affection' | 'flag' | 'item' | 'attribute' | 'ending';
    target?: string;              // 目标（角色ID等）
    key?: string;                 // 键名
    value: number | boolean | string;  // 值
}
```

### 2.2 章节配置 (Chapter)

```typescript
/**
 * 章节类型
 */
export enum ChapterType {
    Main = 'main',               // 主线章节
    Character = 'character',     // 角色支线章节
    Special = 'special',         // 特殊章节
}

/**
 * 章节配置
 */
export interface IChapter {
    id: string;                   // 章节ID
    type: ChapterType;            // 章节类型
    order: number;                // 章节顺序
    name: string;                 // 章节名称
    description: string;          // 章节描述

    // 角色支线专用
    characterId?: string;         // 关联角色ID

    // 解锁条件
    unlockCondition?: string;     // 解锁表达式
    previousChapterId?: string;   // 前置章节

    // 剧情节点
    startNodeId: string;          // 起始节点ID
    nodeIds: string[];            // 包含的节点ID列表

    // 美术资源
    bgPath?: string;              // 章节背景
    iconPath?: string;            // 章节图标
    bgmPath?: string;             // 背景音乐

    // 奖励
    clearRewards?: IStoryReward[];
}
```

### 2.3 结局配置 (Ending)

```typescript
/**
 * 结局类型
 */
export enum EndingType {
    True = 'true',               // 真结局
    Good = 'good',               // 好结局
    Normal = 'normal',           // 普通结局
    Bad = 'bad',                 // 坏结局
    Character = 'character',     // 角色专属结局
    Hidden = 'hidden',           // 隐藏结局
}

/**
 * 结局配置
 */
export interface IEnding {
    id: string;                   // 结局ID
    type: EndingType;             // 结局类型
    name: string;                 // 结局名称
    description: string;          // 结局描述

    // 角色结局专用
    characterId?: string;         // 关联角色ID

    // 解锁条件（AND关系）
    conditions: IEndingCondition[];

    // 结局内容
    endingNodeId: string;         // 结局剧情节点
    cgPath?: string;              // 结局CG

    // 是否已解锁
    isUnlocked: boolean;
}

/**
 * 结局解锁条件
 */
export interface IEndingCondition {
    type: 'chapter' | 'affection' | 'flag' | 'attribute' | 'ending_points';
    target?: string;              // 目标（章节ID、角色ID等）
    operator: '==' | '>=' | '<=' | '>' | '<';
    value: number | boolean | string;
}

/**
 * 结局点数类型
 */
export interface IEndingPoints {
    [endingId: string]: number;   // 各结局累计点数
}
```

### 2.4 角色好感度 (Affection)

```typescript
/**
 * 好感度等级
 */
export enum AffectionLevel {
    Stranger = 0,      // 陌生人 (0-10)
    Acquaintance = 1,  // 熟人 (11-30)
    Friend = 2,        // 朋友 (31-50)
    Close = 3,         // 挚友 (51-70)
    Lover = 4,         // 恋人 (71-90)
    Soulmate = 5,      // 灵魂伴侣 (91-100)
}

/**
 * 角色好感度数据
 */
export interface ICharacterAffection {
    characterId: string;          // 角色ID
    value: number;                // 好感度值 (0-100)
    level: AffectionLevel;        // 好感度等级

    // 剧情解锁
    unlockedEvents: string[];     // 已解锁的剧情事件
    completedEvents: string[];    // 已完成的剧情事件

    // 选择历史
    choiceHistory: {
        nodeId: string;
        choiceId: string;
        affectionChange: number;
    }[];
}
```

### 2.5 剧情存档 (SaveData)

```typescript
/**
 * 剧情存档数据
 */
export interface IStorySaveData {
    // 当前进度
    currentChapterId: string | null;
    currentNodeId: string | null;

    // 已完成内容
    completedChapters: string[];       // 已完成章节
    completedNodes: Set<string>;       // 已完成节点

    // 剧情标记（影响分支）
    storyFlags: Record<string, boolean | number | string>;

    // 角色好感度
    affection: Record<string, ICharacterAffection>;

    // 结局相关
    endingPoints: IEndingPoints;       // 结局点数
    unlockedEndings: string[];         // 已解锁结局
    achievedEndings: string[];         // 已达成结局

    // 选择历史（用于回溯和存档）
    choiceHistory: {
        chapterId: string;
        nodeId: string;
        choiceId: string;
        timestamp: number;
    }[];

    // 已播放对话
    playedDialogs: Set<string>;

    // 已解锁CG
    unlockedCGs: string[];
}
```

---

## 三、结局判定逻辑

### 3.1 结局触发时机

```typescript
/**
 * 结局触发时机
 */
enum EndingTriggerTiming {
    ChapterEnd = 'chapter_end',       // 章节结束时
    FinalChapter = 'final_chapter',   // 终章结束时
    AffectionMax = 'affection_max',   // 好感度满时
    SpecialEvent = 'special_event',   // 特殊事件触发
}
```

### 3.2 结局优先级判定

```
结局判定流程（优先级从高到低）：

1. 检查隐藏结局条件
   └── 满足所有隐藏条件 → 触发隐藏结局

2. 检查真结局条件
   └── 完成所有主线 + 关键支线 → 触发真结局

3. 检查角色专属结局
   └── 好感度 >= 90 + 完成所有角色事件 → 触发角色结局

4. 检查好结局条件
   └── 结局点数 >= 阈值A → 触发好结局

5. 检查普通结局条件
   └── 结局点数 >= 阈值B → 触发普通结局

6. 默认坏结局
   └── 以上都不满足 → 触发坏结局
```

### 3.3 结局点数计算

```typescript
/**
 * 结局点数来源
 */
interface IEndingPointSource {
    // 主线选择
    mainChoices: {
        good: number;      // 善良选择 +2
        neutral: number;   // 中立选择 +1
        evil: number;      // 邪恶选择 -2
    };

    // 角色互动
    characterInteraction: {
        [characterId: string]: number;  // 该角色相关点数
    };

    // 任务完成
    questCompletion: {
        total: number;
        completed: number;
        rate: number;      // 完成率影响结局
    };

    // 战斗表现
    battlePerformance: {
        victories: number;
        defeats: number;
        perfectWins: number;  // 完美胜利
    };
}
```

---

## 四、角色支线系统

### 4.1 角色支线结构

```
角色支线 (Character Route)
├── 第一阶段：相识
│   ├── 触发条件：主线进度 >= X 或 地点触发
│   ├── 剧情内容：初次相遇对话
│   └── 完成效果：好感度 +10
│
├── 第二阶段：了解
│   ├── 触发条件：好感度 >= 30
│   ├── 剧情内容：深入了解角色背景
│   ├── 选择分支：影响后续剧情
│   └── 完成效果：好感度 +15，解锁特殊对话
│
├── 第三阶段：羁绊
│   ├── 触发条件：好感度 >= 60 + 完成前置事件
│   ├── 剧情内容：共同经历危机
│   ├── 选择分支：影响结局走向
│   └── 完成效果：好感度 +20，解锁角色技能
│
├── 第四阶段：抉择
│   ├── 触发条件：好感度 >= 80 + 主线进度
│   ├── 剧情内容：角色告白/重大选择
│   └── 分支：接受/拒绝 → 不同结局
│
└── 最终阶段：结局
    ├── 好感度 >= 90 → 角色好结局
    ├── 好感度 < 90 → 角色普通结局
    └── 特定选择 → 角色隐藏结局
```

### 4.2 角色支线配置

```typescript
/**
 * 角色支线配置
 */
export interface ICharacterRoute {
    characterId: string;              // 角色ID
    name: string;                     // 支线名称

    // 阶段配置
    stages: ICharacterStage[];

    // 结局配置
    endings: IEnding[];

    // 好感度阈值
    affectionThresholds: {
        stage1: number;   // 相识: 10
        stage2: number;   // 了解: 30
        stage3: number;   // 羁绊: 60
        stage4: number;   // 抉择: 80
        ending: number;   // 结局: 90
    };
}

/**
 * 角色阶段
 */
export interface ICharacterStage {
    id: string;
    order: number;
    name: string;

    // 解锁条件
    requiredAffection: number;
    requiredFlags?: string[];
    requiredChapter?: string;

    // 剧情节点
    eventNodeIds: string[];

    // 完成奖励
    rewards?: IStoryReward[];
}
```

---

## 五、剧情标记系统

### 5.1 标记类型

```typescript
/**
 * 剧情标记类型
 */
export enum FlagType {
    Boolean = 'boolean',     // 布尔标记
    Counter = 'counter',     // 计数标记
    String = 'string',       // 字符串标记
}

/**
 * 预定义标记
 */
export const STORY_FLAGS = {
    // 主线标记
    CHAPTER_1_COMPLETE: 'chapter_1_complete',
    CHAPTER_2_COMPLETE: 'chapter_2_complete',
    MET_VILLAIN: 'met_villain',
    DEFEATED_BOSS_1: 'defeated_boss_1',

    // 选择标记
    HELPED_STRANGER: 'helped_stranger',
    TRUSTED_ALLY: 'trusted_ally',
    REVENGE_PATH: 'revenge_path',
    MERCY_PATH: 'mercy_path',

    // 角色标记
    CHARACTER_A_TRUSTED: 'character_a_trusted',
    CHARACTER_B_SECRET_KNOWN: 'character_b_secret',
    CHARACTER_C_SAVED: 'character_c_saved',

    // 结局影响
    ENDING_POINT_HERO: 'ending_point_hero',
    ENDING_POINT_VILLAIN: 'ending_point_villain',
    ENDING_POINT_PEACE: 'ending_point_peace',
} as const;
```

### 5.2 标记操作

```typescript
/**
 * 标记管理器接口
 */
export interface IFlagManager {
    // 设置标记
    setFlag(key: string, value: boolean | number | string): void;

    // 获取标记
    getFlag(key: string): boolean | number | string | undefined;

    // 检查标记
    hasFlag(key: string): boolean;

    // 增加计数
    incrementFlag(key: string, delta?: number): number;

    // 检查条件表达式
    evaluateCondition(expr: string): boolean;

    // 重置标记
    resetFlag(key: string): void;
    resetAll(): void;
}
```

---

## 六、条件表达式语法

### 6.1 表达式格式

```
基本格式：
  flag_name operator value

操作符：
  ==  等于
  !=  不等于
  >=  大于等于
  >   大于
  <=  小于等于
  <   小于

逻辑运算：
  &&  AND
  ||  OR

示例：
  chapter_1_complete == true
  affection_character_a >= 60
  ending_point_hero >= 10 && met_villain == true
  help_count >= 3 || trust_level >= 50
```

### 6.2 特殊变量

```
系统变量：
  $affection.{characterId}    // 角色好感度
  $chapter.{chapterId}       // 章节完成状态
  $ending.{endingId}         // 结局解锁状态
  $choice.{nodeId}.{choiceId} // 选择历史

示例：
  $affection.character_a >= 80
  $chapter.chapter_2 == true
  $choice.node_1.choice_good == true
```

---

## 七、使用示例

### 7.1 定义主线剧情

```typescript
// 主线第一章配置
const chapter1Config: IChapter = {
    id: 'main_chapter_1',
    type: ChapterType.Main,
    order: 1,
    name: '序章：觉醒',
    description: '主角在陌生的环境中醒来...',
    startNodeId: 'ch1_node_1',
    nodeIds: ['ch1_node_1', 'ch1_node_2', 'ch1_node_3'],
};

// 剧情节点配置
const storyNodes: IStoryNode[] = [
    {
        id: 'ch1_node_1',
        chapterId: 'main_chapter_1',
        type: StoryNodeType.Dialog,
        name: '苏醒',
        dialogId: 'ch1_dialog_1',
        nextNodeId: 'ch1_node_2',
        isSkippable: false,
        isOnceOnly: true,
    },
    {
        id: 'ch1_node_2',
        chapterId: 'main_chapter_1',
        type: StoryNodeType.Choice,
        name: '初次选择',
        dialogId: 'ch1_dialog_choice',
        choices: [
            {
                id: 'choice_explore',
                text: '向前探索',
                targetNodeId: 'ch1_node_3a',
                flags: { 'explore_path': true },
                endingPoints: { 'hero': 2 },
            },
            {
                id: 'choice_wait',
                text: '原地等待',
                targetNodeId: 'ch1_node_3b',
                affection: { 'companion': 10 },
                endingPoints: { 'peace': 2 },
            },
        ],
        isSkippable: false,
        isOnceOnly: true,
    },
];
```

### 7.2 定义角色支线

```typescript
// 角色A的支线配置
const characterARoute: ICharacterRoute = {
    characterId: 'character_a',
    name: '月光下的誓言',
    affectionThresholds: {
        stage1: 10,
        stage2: 30,
        stage3: 60,
        stage4: 80,
        ending: 90,
    },
    stages: [
        {
            id: 'chara_stage_1',
            order: 1,
            name: '初次相遇',
            requiredAffection: 0,
            eventNodeIds: ['chara_1_event_1', 'chara_1_event_2'],
        },
        {
            id: 'chara_stage_2',
            order: 2,
            name: '了解彼此',
            requiredAffection: 30,
            eventNodeIds: ['chara_2_event_1'],
        },
    ],
    endings: [
        {
            id: 'chara_ending_good',
            type: EndingType.Character,
            name: '永远的约定',
            description: '与角色A的幸福结局',
            characterId: 'character_a',
            conditions: [
                { type: 'affection', target: 'character_a', operator: '>=', value: 90 },
                { type: 'flag', target: 'chara_stage_4_complete', operator: '==', value: true },
            ],
            endingNodeId: 'chara_ending_good_node',
        },
    ],
};
```

### 7.3 触发剧情

```typescript
// 播放剧情
StoryManager.playNode('ch1_node_1', () => {
    console.log('剧情播放完成');
});

// 检查结局
const endings = EndingManager.checkAvailableEndings();
console.log('可触发结局:', endings);

// 触发结局
EndingManager.triggerEnding('chara_ending_good', () => {
    console.log('角色结局播放完成');
});
```

---

## 八、文件结构

```
assets/scripts/X/Story/
├── StoryTypes.ts           # 类型定义
├── StoryManager.ts         # 剧情管理器
├── StoryConfig.ts          # 剧情配置加载
├── StoryFlagManager.ts     # 标记管理器
├── AffectionManager.ts     # 好感度管理器
├── EndingManager.ts        # 结局管理器
├── StorySaveManager.ts     # 存档管理器
└── StoryCondition.ts       # 条件表达式解析

assets/resources/story/
├── chapters.json           # 章节配置
├── nodes/                  # 剧情节点配置
│   ├── main/
│   │   ├── chapter1.json
│   │   └── chapter2.json
│   └── characters/
│       ├── character_a.json
│       └── character_b.json
├── dialogs/                # 对话配置
└── endings.json            # 结局配置
```

---

*文档版本：v2.0*
*最后更新：2026-03-26*
*适用于：多分支多结局剧情游戏*
