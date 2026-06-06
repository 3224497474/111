// 帮助与说明系统：
// 提供简单的帮助条目数据，供 UI 展示。
// 目前写死在代码中，后续可以改为从本地化或配置表加载。

export type HelpTopicId =
  | "basic_controls" // 基础操作
  | "schedule_system" // 日程与时间系统
  | "economy_system" // 经济与商店/背包
  | "battle_system"; // 冒险与战斗系统（占位）

export interface IHelpTopic {
  id: HelpTopicId;
  title: string;
  content: string;
}

const HELP_TOPICS: Record<HelpTopicId, IHelpTopic> = {
  basic_controls: {
    id: "basic_controls",
    title: "基础操作",
    content:
      "通过主界面按钮进入不同系统：日程安排、Home、商店、背包等。" +
      "在对话界面中点击或按键可以推进文本，长按或使用设置中的跳过功能可以加速。",
  },
  schedule_system: {
    id: "schedule_system",
    title: "日程与时间系统",
    content:
      "每周被拆分为多天，每天包含早/午/晚等时间段。" +
      "你可以在日程界面安排上课、自习、打工、社团等活动，" +
      "这些活动会影响角色属性、体力、好感等，并在周末进行总结。",
  },
  economy_system: {
    id: "economy_system",
    title: "经济与商店/背包",
    content:
      "通过打工等方式可以获得金钱，在商店中购买道具、礼物和学习用品。" +
      "背包会记录你当前拥有的物品，部分物品可以在 Home 或特定系统中使用，" +
      "产生恢复、提升属性或改变事件走向的效果。",
  },
  battle_system: {
    id: "battle_system",
    title: "冒险与战斗系统",
    content:
      "在冒险模式中，你可以探索地图、触发事件并进入战斗。" +
      "战斗采用回合制系统，支持技能、状态、元素克制等机制，" +
      "详细内容可参考战斗模块的专门说明文档。",
  },
};

// 获取全部帮助条目列表（用于生成帮助菜单）
export function getAllHelpTopics(): IHelpTopic[] {
  const result: IHelpTopic[] = [];
  for (const key in HELP_TOPICS) {
    if (Object.prototype.hasOwnProperty.call(HELP_TOPICS, key)) {
      const id = key as HelpTopicId; // 将 string 强制收窄为 HelpTopicId
      result.push(HELP_TOPICS[id]);
    }
  }
  return result;
}



// 根据 ID 获取单个帮助条目
export function getHelpTopic(id: HelpTopicId): IHelpTopic | undefined {
  return HELP_TOPICS[id];
}

