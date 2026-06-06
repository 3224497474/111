 3. Home 状态展示 UI（HOME-INFO）

  assets/scripts/HomeStatusView.ts

  - 挂在 Home 场景里一个面板节点上，属性如下：
      - levelLabel（Label）
      - expLabel（Label）
      - expProgressBar（ProgressBar，可选）
      - staminaLabel / moodLabel / moneyLabel（Label）
      - strengthLabel / intelligenceLabel / charmLabel / kindnessLabel（Label）
  - 生命周期：
      - onLoad()：
          - 获取 HomeStatusModel.instance；
          - 注册 onStatusChanged，立即刷新一次；
      - onDestroy()：
          - 取消订阅，防止内存泄漏。
  - 刷新逻辑：
      - 等级显示：Lv.<level>
      - 经验：currentExp / expForNextLevel
      - 经验条：progress = currentExp / expForNextLevel
      - 体力/心情："体力 80 / 100"、"心情 60 / 100" 这种格式
      - 金钱："¥ 123"
      - 属性："力量 50" 等。

  ———

  4. Home 场景节点视图搭建建议

  接下来你在 Cocos Creator 里需要做的，是把逻辑和 UI“接起来”，让 Phase 2 闭环真正跑起来。建议结构示例：

  - 场景结构（关键部分）：
      - HomeScene（场景根，挂 HomeScene 脚本）
          - Home（prefab/Home 实例，挂 HomeUI 等）
              - StatusPanel（新建节点，挂 HomeStatusView）
                  - LevelLabel（Label）
                  - ExpLabel（Label）
                  - ExpProgress（ProgressBar，可选）
                  - StaminaLabel（Label）
                  - MoodLabel（Label）
                  - MoneyLabel（Label）
                  - StrengthLabel（Label）
                  - IntelligenceLabel（Label）
                  - CharmLabel（Label）
                  - KindnessLabel（Label）

  在编辑器里的操作：

  1. 打开 prefab/Home 或 Home 场景，创建 StatusPanel 节点，放在 UI 的合适位置。
  2. 在 StatusPanel 下创建上述 Label / ProgressBar 子节点。
  3. 在 StatusPanel 上添加脚本组件 HomeStatusView。
  4. 把子节点上的组件拖到 HomeStatusView 的对应属性槽里。
  5. 运行游戏后，HomeStatusModel 默认会创建一个 Lv.1 的主角，体力/心情/金钱满值，StatusPanel 会显示对应的数值。

  ———

  5. 下一步：把 Home 行为挂到按钮上（可选，但建议）

  现在系统逻辑已经具备，你可以在 Home 场景的按钮点击事件里直接用：

  import { HomeActions, HomeActionType } from "./home/HomeActions";

  public onClickRest() {
      HomeActions.perform(HomeActionType.Rest);
  }

  public onClickStudy() {
      HomeActions.perform(HomeActionType.Study);
  }

  // 等等

  可以选择把这些方法加在：

  - HomeUI.ts 上作为按钮回调，或
  - 单独建一个 HomeActionsPanel.ts 挂在某个按钮面板节点上。