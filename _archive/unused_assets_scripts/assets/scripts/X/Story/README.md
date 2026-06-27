# 剧情系统使用指南

## 目录
1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [配置剧情](#配置剧情)
4. [API参考](#api参考)
5. [示例代码](#示例代码)

---

## 快速开始

### 1. 引入剧情系统

```typescript
import { Story, StoryManager, AffectionManager, EndingManager, StoryFlagManager } from './X/Story';
```

### 2. 加载配置

```typescript
import { StoryConfig } from './X/Story';

// 从Bundle加载
StoryConfig.loadFromBundle('resources|story/main_story', (success) => {
    if (success) {
        console.log('剧情配置加载成功');
    }
});

// 或使用示例配置（测试用）
const config = StoryConfig.createExampleConfig();
StoryConfig.loadFromBundle('resources|story/main_story');
```

### 3. 播放剧情

```typescript
// 播放单个节点
Story.play('ch1_start', () => {
    console.log('剧情播放完成');
});

// 开始章节
Story.startChapter('main_chapter_1', () => {
    console.log('章节完成');
});
```

---

## 核心概念

### 剧情节点类型

| 类型 | 说明 | 用途 |
|------|------|------|
| `Dialog` | 对话节点 | 普通对话演出 |
| `Choice` | 选择节点 | 玩家做出选择 |
| `Battle` | 战斗节点 | 战斗剧情 |
| `CG` | CG节点 | CG演出 |
| `Branch` | 条件分支 | 根据条件跳转 |
| `Event` | 特殊事件 | 特殊剧情事件 |
| `Ending` | 结局节点 | 结局演出 |

### 结局类型

| 类型 | 说明 |
|------|------|
| `True` | 真结局 |
| `Good` | 好结局 |
| `Normal` | 普通结局 |
| `Bad` | 坏结局 |
| `Character` | 角色专属结局 |
| `Hidden` | 隐藏结局 |

### 好感度等级

| 等级 | 名称 | 数值范围 |
|------|------|----------|
| 0 | 陌生人 | 0-10 |
| 1 | 熟人 | 11-30 |
| 2 | 朋友 | 31-50 |
| 3 | 挚友 | 51-70 |
| 4 | 恋人 | 71-90 |
| 5 | 灵魂伴侣 | 91-100 |

---

## 配置剧情

### 章节配置

```json
{
  "id": "chapter_1",
  "type": "main",
  "order": 1,
  "name": "序章",
  "description": "故事的开始...",
  "startNodeId": "ch1_node_1",
  "nodeIds": ["ch1_node_1", "ch1_node_2"],
  "unlockCondition": "",
  "clearRewards": [
    { "type": "gold", "amount": 1000 }
  ]
}
```

### 剧情节点配置

```json
{
  "id": "ch1_node_1",
  "chapterId": "chapter_1",
  "type": "dialog",
  "name": "苏醒",
  "dialogId": "ch1_dialog_1",
  "nextNodeId": "ch1_node_2",
  "isSkippable": false,
  "isOnceOnly": true,
  "effects": [
    { "type": "flag", "key": "story_progress", "value": 1 }
  ]
}
```

### 选择节点配置

```json
{
  "id": "ch1_choice",
  "chapterId": "chapter_1",
  "type": "choice",
  "name": "抉择",
  "dialogId": "ch1_dialog_choice",
  "choices": [
    {
      "id": "choice_a",
      "text": "选项A",
      "targetNodeId": "ch1_node_a",
      "affection": { "alice": 10 },
      "flags": { "chose_a": true },
      "endingPoints": { "hero": 2 }
    },
    {
      "id": "choice_b",
      "text": "选项B",
      "targetNodeId": "ch1_node_b",
      "condition": "flag_special == true"
    }
  ],
  "isSkippable": false,
  "isOnceOnly": true
}
```

### 结局配置

```json
{
  "id": "ending_hero",
  "type": "good",
  "name": "英雄之路",
  "description": "你成为了英雄",
  "conditions": [
    { "type": "chapter", "target": "chapter_1_complete", "operator": "==", "value": true },
    { "type": "ending_points", "target": "hero", "operator": ">=", "value": 10 }
  ],
  "endingNodeId": "ending_hero_node",
  "priority": 10
}
```

### 角色支线配置

```json
{
  "characterId": "alice",
  "name": "Alice支线",
  "stages": [
    {
      "id": "alice_stage_1",
      "order": 1,
      "name": "相识",
      "requiredAffection": 0,
      "eventNodeIds": ["alice_1"]
    },
    {
      "id": "alice_stage_2",
      "order": 2,
      "name": "了解",
      "requiredAffection": 30,
      "eventNodeIds": ["alice_2"]
    }
  ],
  "affectionThresholds": {
    "stage1": 10,
    "stage2": 30,
    "stage3": 60,
    "stage4": 80,
    "ending": 90
  }
}
```

---

## API参考

### StoryManager

```typescript
// 注册节点和章节
StoryManager.instance.registerNode(node: IStoryNode);
StoryManager.instance.registerChapter(chapter: IChapter);

// 播放剧情
StoryManager.instance.playNode(nodeId: string, onComplete?: () => void): boolean;
StoryManager.instance.startChapter(chapterId: string, onComplete?: () => void): boolean;

// 状态查询
StoryManager.instance.isNodeCompleted(nodeId: string): boolean;
StoryManager.instance.isChapterCompleted(chapterId: string): boolean;
StoryManager.instance.getChapterProgress(chapterId: string): { completed, total, percentage };

// 存档
StoryManager.instance.exportToSave(): IStorySaveData;
StoryManager.instance.loadFromSave(saveData: IStorySaveData): void;
```

### AffectionManager

```typescript
// 好感度操作
AffectionManager.instance.changeAffection(characterId: string, delta: number): number;
AffectionManager.instance.getAffectionValue(characterId: string): number;
AffectionManager.instance.getAffectionLevel(characterId: string): AffectionLevel;
AffectionManager.instance.getLevelName(characterId: string): string;

// 事件管理
AffectionManager.instance.completeEvent(characterId: string, eventId: string): void;
AffectionManager.instance.isEventCompleted(characterId: string, eventId: string): boolean;
AffectionManager.instance.checkCharacterEnding(characterId: string): boolean;
```

### EndingManager

```typescript
// 结局操作
EndingManager.instance.checkAvailableEndings(): IEnding[];
EndingManager.instance.getBestAvailableEnding(): IEnding | null;
EndingManager.instance.triggerEnding(endingId: string): boolean;
EndingManager.instance.unlockEnding(endingId: string): void;

// 结局点数
EndingManager.instance.addEndingPoint(endingId: string, delta: number): number;
EndingManager.instance.getEndingPoint(endingId: string): number;

// 状态查询
EndingManager.instance.isEndingUnlocked(endingId: string): boolean;
EndingManager.instance.isEndingAchieved(endingId: string): boolean;
EndingManager.instance.getEndingStats(): { total, unlocked, achieved, byType };
```

### StoryFlagManager

```typescript
// 标记操作
StoryFlagManager.instance.setFlag(key: string, value: boolean | number | string): void;
StoryFlagManager.instance.getFlag(key: string): boolean | number | string | undefined;
StoryFlagManager.instance.hasFlag(key: string): boolean;
StoryFlagManager.instance.incrementFlag(key: string, delta?: number): number;

// 条件评估
StoryFlagManager.instance.evaluateCondition(expr: string): boolean;
```

---

## 示例代码

### 播放主线剧情

```typescript
import { Story } from './X/Story';

// 开始第一章
Story.startChapter('main_chapter_1', () => {
    console.log('第一章完成');
    // 解锁第二章
    Story.setFlag('chapter_1_complete', true);
});
```

### 处理选择事件

```typescript
StoryManager.instance.onChoiceMade((nodeId, choiceId) => {
    console.log(`玩家在节点 ${nodeId} 选择了 ${choiceId}`);

    // 根据选择更新UI或触发其他逻辑
    if (choiceId === 'choice_explore') {
        showExploredAnimation();
    }
});
```

### 检查并触发结局

```typescript
// 检查可触发的结局
const availableEndings = Story.checkEndings();

if (availableEndings.length > 0) {
    // 触发最高优先级的结局
    const bestEnding = Story.getBestEnding();
    if (bestEnding) {
        Story.triggerEnding(bestEnding.id, () => {
            console.log(`达成结局: ${bestEnding.name}`);
            showEndingScreen(bestEnding);
        });
    }
}
```

### 好感度系统

```typescript
// 修改好感度
Story.addAffection('alice', 10);

// 获取好感度
const aliceLove = Story.getAffection('alice');
console.log(`Alice好感度: ${aliceLove}`);

// 检查是否满足角色结局条件
if (AffectionManager.instance.checkCharacterEnding('alice')) {
    console.log('可以触发Alice的专属结局');
}
```

### 存档和读档

```typescript
// 保存进度
const saveData = Story.save();
localStorage.setItem('story_save', JSON.stringify(saveData));

// 读取进度
const savedData = JSON.parse(localStorage.getItem('story_save'));
if (savedData) {
    Story.load(savedData);
    console.log('读档成功');
}
```

### 监听事件

```typescript
// 监听节点开始
StoryManager.instance.onNodeStart((nodeId) => {
    console.log(`开始播放节点: ${nodeId}`);
});

// 监听节点完成
StoryManager.instance.onNodeComplete((nodeId) => {
    console.log(`节点完成: ${nodeId}`);
});

// 监听好感度变化
AffectionManager.instance.onAffectionChange((characterId, oldValue, newValue) => {
    console.log(`${characterId} 好感度: ${oldValue} -> ${newValue}`);

    if (newValue >= 80 && oldValue < 80) {
        showToast(`${characterId}对你的好感度大幅提升！`);
    }
});

// 监听结局触发
EndingManager.instance.onEndingTrigger((endingId) => {
    console.log(`触发结局: ${endingId}`);
});
```

### 条件表达式示例

```typescript
// 简单条件
StoryFlagManager.instance.evaluateCondition('chapter_1_complete == true');
StoryFlagManager.instance.evaluateCondition('affection_alice >= 60');

// AND条件
StoryFlagManager.instance.evaluateCondition('chapter_1_complete == true && affection_alice >= 30');

// OR条件
StoryFlagManager.instance.evaluateCondition('path_hero == true || path_peace == true');
```

---

## 调试命令

```typescript
import { StoryManager } from './X/Story';

// 跳转到指定节点（调试用）
StoryManager.instance.debugJumpToNode('ch2_start');

// 完成指定章节（调试用）
StoryManager.instance.debugCompleteChapter('main_chapter_1');

// 设置好感度（调试用）
AffectionManager.instance.changeAffection('alice', 90);

// 设置标记（调试用）
StoryFlagManager.instance.setFlag('chapter_1_complete', true);

// 查看所有结局
console.log(EndingManager.instance.getAllEndings());

// 查看结局统计
console.log(EndingManager.instance.getEndingStats());
```

---

*文档版本：v1.0*
*最后更新：2026-03-26*
