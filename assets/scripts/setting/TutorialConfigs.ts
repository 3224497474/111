// TutorialConfigs.ts
  // 这里只存“数据”：每一步文字、位置/大小或 UI key，不直接引用 Node

  // 配置层的步骤数据
  export interface GuideStepData {
    message: string;

    // 使用 position + size 高亮一个矩形区域（相对于 GuideOverlay 本地坐标）
    position?: { x: number; y: number };
    size?: { width: number; height: number };

    // 或者用 uiKey，让具体 UI 在运行时映射到 Node
    uiKey?: string;

    padding?: number;
  }

  // 商店多步引导配置（示例：两步）
  export const SHOP_TUTORIAL_STEPS: GuideStepData[] = [
    {
      message:
        "第一步：这里是主商品区域。\n\n你可以在这里看到可购买的道具。",
      // 这里用 position + size 高亮商品区域（数值根据你的实际界面微调）
      position: { x: 300, y: 300 },
      size: { width: 260, height: 120 },
    },
    {
      message:
        "第二步：这里是确认购买的按钮。\n\n点击它可以购买当前选择的商品。",
      // 这里用 uiKey，在 ShopUI 中映射到 mainBuyButton
      uiKey: "mainBuyButton",
      padding: 10,
    },
  ];