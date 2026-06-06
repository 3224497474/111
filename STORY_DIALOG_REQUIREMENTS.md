# 剧情与对话系统需求说明

---

## 一、系统概述

### 1.1 系统定位

剧情与对话系统是游戏叙事的核心，负责管理：
- 章节/关卡剧情推进
- 角色对话展示（含分支选择）
- 剧情触发条件与解锁机制
- 过场动画与CG展示
- 剧情进度持久化

### 1.2 现有系统分析

| 已有系统 | 状态 | 需要扩展 |
|----------|------|----------|
| DialogSystem | ✅ 可用 | 扩展触发时机控制 |
| DialogView | ✅ 可用 | 添加动画效果、特殊演出 |
| TaskSystem | ✅ 可用 | 对接剧情任务链 |
| TimeSystem | ✅ 可用 | 对接剧情时间条件 |
| BattleSystem | ✅ 可用 | 对接战斗剧情联动 |
| CharacterSystem | ✅ 可用 | 对接角色好感度剧情 |

---

## 二、核心功能需求

### 2.1 剧情管理器（StoryManager）

**职责：** 统一管理所有剧情节点的注册、触发、进度跟踪

```typescript
// 核心接口设计
interface IStoryNode {
    id: string;                    // 剧情节点唯一ID
    chapterId: string;            // 所属章节ID
    type: StoryNodeType;          // 节点类型
    name: string;                 // 剧情名称
    description: string;          // 剧情简介

    // 触发条件
    triggers: IStoryTrigger[];    // 触发条件组（AND/OR）
    unlockCondition?: string;     // 解锁表达式

    // 内容
    dialogs?: string[];           // 对话ID列表（可串行播放）
    cgPath?: string;             // CG资源路径
    bgmPath?: string;            // 背景音乐路径
    sceneTransition?: SceneTransitionConfig; // 场景切换配置

    // 分支
    branches?: IStoryBranch[];    // 剧情分支选项
    nextNodeId?: string;         // 默认下一节点ID

    // 奖励
    rewards?: IStoryReward[];     // 剧情完成奖励

    // 状态
    isRepeatable: boolean;        // 是否可重复触发
    isSkippable: boolean;         // 是否可跳过
}

enum StoryNodeType {
    Dialog = 'dialog',           // 纯对话
    CG = 'cg',                  // CG演出
    Battle = 'battle',          // 战斗剧情
    Choice = 'choice',          // 选择分支
    Transition = 'transition',  // 场景过渡
    Event = 'event',            // 特殊事件
    ChapterEnd = 'chapterEnd',  // 章节结束
}

interface IStoryTrigger {
    type: TriggerType;
    params: Record<string, any>;
}

enum TriggerType {
    Location = 'location',       // 到达指定位置
    Time = 'time',              // 时间条件（TimeSystem）
    Task = 'task',              // 任务完成
    Level = 'level',            // 等级条件
    Item = 'item',              // 拥有道具
    Battle = 'battle',          // 战斗胜利
    Character = 'character',    // 角色好感度
    Chapter = 'chapter',        // 章节进度
    Manual = 'manual',          // 手动触发（代码调用）
}

interface IStoryBranch {
    text: string;               // 选项文字
    targetNodeId: string;       // 跳转节点ID
    condition?: string;         // 显示条件
    consequence?: IStoryConsequence; // 选择后果
}

interface IStoryConsequence {
    relationshipChange?: Record<string, number>; // 好感度变化
    itemChanges?: IItemChange[];                  // 道具变化
    flagChanges?: Record<string, boolean>;        // 标记变化
}

interface IStoryReward {
    type: 'gold' | 'diamond' | 'item' | 'exp' | 'unlock';
    id?: string;
    amount?: number;
}
```

### 2.2 章节管理（ChapterManager）

**职责：** 管理游戏章节的进度、解锁、统计

```typescript
interface IChapter {
    id: string;
    name: string;
    description: string;
    order: number;              // 章节序号

    // 解锁条件
    unlockCondition?: string;
    previousChapterId?: string;

    // 内容
    storyNodes: string[];       // 包含的剧情节点ID列表
    totalNodes: number;         // 总剧情节点数
    bossNodeId?: string;        // Boss战剧情节点

    // 美术资源
    bgPath: string;            // 章节背景
    iconPath: string;          // 章节图标

    // 奖励
    firstClearRewards: IStoryReward[];
}

interface IChapterProgress {
    chapterId: string;
    completedNodeIds: Set<string>;
    currentNodeId: string | null;
    isCompleted: boolean;
    completedTimes: number;
    bestScore?: number;
    starRating: number;         // 0-3星
}
```

### 2.3 剧情触发系统（StoryTrigger）

**职责：** 监听游戏事件，自动触发对应剧情

```typescript
class StoryTriggerSystem {
    // 注册触发器监听
    registerTrigger(trigger: IStoryTrigger, nodeId: string): void;

    // 移除触发器
    unregisterTrigger(nodeId: string): void;

    // 检查并触发符合条件的剧情
    checkAndTrigger(context: ITriggerContext): void;

    // 特定场景进入时检查
    onSceneEnter(sceneName: string): void;

    // 战斗胜利后检查
    onBattleVictory(battleId: string): void;

    // 任务完成时检查
    onTaskComplete(taskId: number): void;

    // 位置到达时检查
    onLocationReached(locationId: string): void;
}
```

---

## 三、数据结构设计

### 3.1 剧情配置数据（JSON格式）

```json
{
    "chapters": [
        {
            "id": "chapter_1",
            "name": "序章：觉醒",
            "description": "主角在陌生的环境中醒来...",
            "order": 1,
            "previousChapterId": null,
            "storyNodes": ["story_1_1", "story_1_2", "story_1_3"],
            "bgPath": "bg/chapter1",
            "iconPath": "icon/chapter1",
            "firstClearRewards": [
                { "type": "gold", "amount": 1000 },
                { "type": "exp", "amount": 500 }
            ]
        }
    ],
    "storyNodes": [
        {
            "id": "story_1_1",
            "chapterId": "chapter_1",
            "type": "dialog",
            "name": "苏醒",
            "triggers": [
                { "type": "manual", "params": {} }
            ],
            "dialogs": ["intro_1", "intro_2"],
            "nextNodeId": "story_1_2",
            "isRepeatable": false,
            "isSkippable": false
        },
        {
            "id": "story_1_2",
            "chapterId": "chapter_1",
            "type": "choice",
            "name": "初次选择",
            "triggers": [],
            "dialogs": ["choice_intro"],
            "branches": [
                {
                    "text": "向前探索",
                    "targetNodeId": "story_1_3a",
                    "consequence": {
                        "flagChanges": { "explore_path": true }
                    }
                },
                {
                    "text": "原地等待",
                    "targetNodeId": "story_1_3b",
                    "consequence": {
                        "relationshipChange": { "companion": 10 }
                    }
                }
            ],
            "isRepeatable": false,
            "isSkippable": true
        },
        {
            "id": "story_1_3",
            "chapterId": "chapter_1",
            "type": "battle",
            "name": "首次战斗",
            "triggers": [],
            "dialogs": ["battle_intro", "battle_outro"],
            "nextNodeId": "story_1_end",
            "isRepeatable": true,
            "isSkippable": false
        }
    ]
}
```

### 3.2 剧情存档数据

```typescript
interface IStorySaveData {
    // 章节进度
    chapters: Record<string, IChapterProgress>;

    // 已完成的剧情节点
    completedStoryNodes: string[];

    // 当前进行中的剧情
    currentStoryNodeId: string | null;

    // 剧情标记（用于分支判断）
    storyFlags: Record<string, boolean>;

    // 角色好感度
    characterRelations: Record<string, number>;

    // 已解锁的CG
    unlockedCGs: string[];

    // 已播放的对话
    playedDialogs: string[];

    // 选择历史（用于回溯）
    choiceHistory: IChoiceRecord[];
}

interface IChoiceRecord {
    nodeId: string;
    choiceIndex: number;
    timestamp: number;
}
```

---

## 四、UI需求

### 4.1 剧情对话界面增强

在现有 `DialogView` 基础上扩展：

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 角色立绘展示 | 全身/半身立绘，支持多角色同屏 | P0 |
| 表情变化 | 角色立绘支持表情切换 | P1 |
| 演出动画 | 角色入场/退场动画、镜头移动 | P1 |
| 背景切换 | 对话过程中背景渐变切换 | P0 |
| 特殊效果 | 回忆滤镜、震动、闪白等 | P2 |
| 打字机音效 | 文字出现时的音效 | P1 |
| 自动播放 | 可开关的自动推进模式 | P1 |
| 历史回顾 | 可回看已播放的对话 | P2 |

### 4.2 CG展示界面

```typescript
interface ICGView {
    // 显示CG
    showCG(cgPath: string, options?: {
        fadeIn?: boolean;
        duration?: number;
        onComplete?: () => void;
    }): void;

    // 隐藏CG
    hideCG(fadeOut?: boolean): void;

    // CG缩放/平移动画
    playKenBurnsEffect(config: {
        startScale: number;
        endScale: number;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        duration: number;
    }): void;
}
```

### 4.3 章节选择界面

```
ChapterSelectView
├── ChapterList (ScrollView)
│   └── ChapterItem (Prefab)
│       ├── ChapterIcon (Sprite)
│       ├── ChapterName (Label)
│       ├── ChapterDesc (Label)
│       ├── ProgressBar
│       └── LockIcon (未解锁时显示)
├── ChapterDetail (选中章节后显示)
│   ├── StoryNodeList
│   ├── Rewards
│   └── EnterButton
└── BackButton
```

### 4.4 剧情回顾界面

```
StoryReviewView
├── ChapterTabs (TabView)
├── StoryNodeList (ScrollView)
│   └── StoryNodeItem
│       ├── NodeName
│       ├── CompletedIcon
│       ├── ChoicesMade (显示做过的分支选择)
│       └── ReplayButton
└── TotalProgress (Label: "已完成 15/30 剧情节点")
```

---

## 五、与其他系统集成

### 5.1 与战斗系统集成

```typescript
// 战斗前剧情
BattleManager.onBattleStart((battleId) => {
    const storyNodeId = `battle_pre_${battleId}`;
    if (StoryManager.canTrigger(storyNodeId)) {
        StoryManager.playStory(storyNodeId, () => {
            BattleManager.startActualBattle(battleId);
        });
    }
});

// 战斗胜利后剧情
BattleManager.onBattleVictory((battleId) => {
    const storyNodeId = `battle_post_${battleId}`;
    if (StoryManager.canTrigger(storyNodeId)) {
        StoryManager.playStory(storyNodeId);
    }
});
```

### 5.2 与任务系统集成

```typescript
// 剧情节点完成后触发任务
StoryManager.onStoryComplete((nodeId) => {
    const relatedTasks = StoryConfig.getRelatedTasks(nodeId);
    for (const taskId of relatedTasks) {
        taskManager.acceptTask(taskId);
    }
});

// 任务完成触发后续剧情
taskManager.onTaskComplete((taskId) => {
    const storyNodeId = TaskConfig.getStoryNodeId(taskId);
    if (storyNodeId) {
        StoryManager.triggerStory(storyNodeId);
    }
});
```

### 5.3 与角色系统集成

```typescript
// 好感度达到阈值触发专属剧情
CharacterStateManager.onRelationChange((characterId, newValue) => {
    const storyNodes = StoryConfig.getCharacterStories(characterId);
    for (const node of storyNodes) {
        if (newValue >= node.requiredRelation && !StoryManager.isCompleted(node.id)) {
            StoryManager.triggerStory(node.id);
        }
    }
});
```

### 5.4 与时间系统集成

```typescript
// 特定时间触发剧情
TimeSystem.onTimeChanged((timeState) => {
    StoryTriggerSystem.checkTimeTriggers(timeState);
});

// 示例：晚上触发特殊剧情
const nightStoryTrigger: IStoryTrigger = {
    type: TriggerType.Time,
    params: { timeSlot: 'evening' }
};
```

---

## 六、技术要求

### 6.1 性能要求

| 指标 | 要求 |
|------|------|
| 剧情加载时间 | < 500ms（本地）< 2s（远程） |
| 对话切换延迟 | < 100ms |
| CG显示延迟 | < 300ms |
| 存档写入时间 | < 200ms |
| 内存占用 | 剧情数据 < 10MB |

### 6.2 数据格式

- **配置数据：** JSON格式，支持外部加载和热更新
- **存档数据：** 使用现有 GameStorage 系统
- **资源管理：** 使用现有 resourceUtil + Bundle 加载

### 6.3 多语言支持

- 对话文本支持多语言（利用现有 LocaleManager）
- CG资源路径可按语言区分
- 剧情名称、描述支持多语言

### 6.4 调试支持

```typescript
// 调试命令
StoryDebug.skipToNode('story_3_5');      // 跳转到指定剧情
StoryDebug.completeAllInChapter('chapter_1'); // 完成章节所有剧情
StoryDebug.resetProgress('chapter_1');    // 重置章节进度
StoryDebug.showAllFlags();                // 显示所有剧情标记
StoryDebug.setFlag('explore_path', true); // 设置剧情标记
```

---

## 七、使用示例

### 7.1 基础剧情播放

```typescript
import { StoryManager } from '../X/Story/StoryManager';

// 手动触发剧情
StoryManager.playStory('story_1_1', () => {
    console.log('序章第一段剧情结束');
});

// 带参数的剧情
StoryManager.playStory('story_meet_npc', () => {}, {
    params: { npcName: '张三' },
    skipIfPlayed: true,  // 如果已播放过则跳过
});
```

### 7.2 注册触发器

```typescript
// 场景进入触发
StoryTriggerSystem.registerTrigger({
    type: TriggerType.Location,
    params: { locationId: 'village_entrance' }
}, 'story_2_1');

// 战斗胜利触发
StoryTriggerSystem.registerTrigger({
    type: TriggerType.Battle,
    params: { battleId: 'boss_chapter1' }
}, 'story_1_boss_victory');
```

### 7.3 查询剧情状态

```typescript
// 检查剧情是否已完成
const isCompleted = StoryManager.isCompleted('story_1_1');

// 获取章节完成度
const progress = StoryManager.getChapterProgress('chapter_1');
console.log(`章节进度: ${progress.completedCount}/${progress.totalCount}`);

// 获取当前可触发的剧情
const availableStories = StoryManager.getAvailableStories();
```

---

## 八、开发优先级

### Phase 1：核心剧情管理（1周）
- [ ] StoryManager 核心逻辑
- [ ] 剧情节点数据结构
- [ ] 基础触发系统
- [ ] 与 DialogSystem 集成
- [ ] 剧情存档/读档

### Phase 2：UI增强（1周）
- [ ] 角色立绘展示
- [ ] 背景切换效果
- [ ] CG展示界面
- [ ] 章节选择界面

### Phase 3：高级功能（1周）
- [ ] 剧情分支系统
- [ ] 好感度剧情联动
- [ ] 战斗剧情联动
- [ ] 剧情回顾功能

### Phase 4：优化与调试（3天）
- [ ] 性能优化
- [ ] 调试工具
- [ ] 热更新支持
- [ ] 文档完善

---

## 九、文件结构规划

```
assets/scripts/X/Story/
├── StoryManager.ts          # 剧情管理器核心
├── StoryConfig.ts           # 剧情配置加载
├── StoryTrigger.ts          # 触发系统
├── StoryTypes.ts            # 类型定义
├── StorySave.ts             # 存档管理
├── ChapterManager.ts        # 章节管理
├── StoryDebugger.ts         # 调试工具
└── StoryUI/
    ├── StoryDialogView.ts   # 增强对话界面
    ├── CGView.ts            # CG展示
    ├── ChapterSelectView.ts # 章节选择
    └── StoryReviewView.ts   # 剧情回顾

assets/resources/
├── story/
│   ├── chapters.json        # 章节配置
│   └── nodes/               # 剧情节点配置
│       ├── chapter1.json
│       └── chapter2.json
├── cg/                      # CG资源
├── illustration/            # 角色立绘
└── bg/                      # 背景图
```

---

## 十、验收标准

1. **功能完整性**
   - 剧情节点可正常触发和播放
   - 分支选择可正确跳转
   - 进度可正确保存和读取

2. **性能达标**
   - 满足上述性能要求指标

3. **稳定性**
   - 连续播放50段剧情无崩溃
   - 存档读档100次无数据丢失

4. **用户体验**
   - 对话流畅无卡顿
   - 跳过功能正常
   - 历史回顾可正常使用

---

*文档版本：v1.0*
*最后更新：2026-03-26*
