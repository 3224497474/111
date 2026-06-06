import {
    _decorator,
    Component,
    Node,
    Label,
    Button,
    UITransform,
    Vec3,
    Size,
  } from "cc";
  const { ccclass, property } = _decorator;

  /**
   * 运行时使用的单步引导配置：
   * - message: 提示文字
   * - target: 高亮的目标节点（可选）
   * - position/size: 直接指定高亮框的位置和尺寸（可选）
   *   如果同时存在 position/size，则优先使用 position/size；
   *   否则退回使用 target + padding 方式。
   */
  export interface GuideStepConfig {
    message: string;
    target?: Node;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    padding?: number; // 仅在 target 模式下生效
  }

  /**
   * 通用多步引导 UI：
   * - 带全屏遮罩 + 高亮区域 + 提示文本 + “下一步”按钮
   * - 支持一次性传入多个步骤，内部按顺序播放
   * - 外部可以调用 nextStep() 在特定时机推进（例如按钮点击）
   */
  @ccclass("GuideOverlay")
  export class GuideOverlay extends Component {
    @property(Node)
    public maskBg: Node = null!; // 全屏遮罩（Sprite + BlockInputEvents）

    @property(Node)
    public highlight: Node = null!; // 高亮框/箭头节点

    @property(Node)
    public tipPanel: Node = null!; // 提示面板

    @property(Label)
    public tipLabel: Label = null!; // 提示文字

    @property(Button)
    public btnNext: Button = null!; // “下一步 / 知道了”按钮

    private _steps: GuideStepConfig[] = [];
    private _index: number = -1;
    private _active: boolean = false;

    /** 引导是否处于激活状态（正在播放某个步骤） */
    public get isActive(): boolean {
      return this._active;
    }

    onLoad() {
      this.node.active = false;

      if (this.btnNext) {
        this.btnNext.node.on(Button.EventType.CLICK, this.onClickNext, this);
      }
    }

    /**
     * 一次性传入多个步骤，按顺序执行
     */
    public startGuide(steps: GuideStepConfig[]): void {
      if (!steps || steps.length === 0) {
        return;
      }
      this._steps = steps;
      this._index = 0;
      this._active = true;
      this.node.active = true;
      this.showCurrentStep();
    }

    /**
     * 单步引导的快捷方法：等价于 startGuide([step])
     */
    public showStep(step: GuideStepConfig): void {
      this.startGuide([step]);
    }

    /**
     * 外部调用：跳到下一步（例如在按钮点击后调用）
     */
    public nextStep(): void {
      if (!this._active) return;

      this._index++;
      if (this._index >= this._steps.length) {
        this.finishGuide();
      } else {
        this.showCurrentStep();
      }
    }

    /** Button 的点击事件，默认也是走 nextStep */
    private onClickNext(): void {
      this.nextStep();
    }

    /** 引导结束，隐藏引导层 */
    private finishGuide(): void {
      this._active = false;
      this._steps = [];
      this._index = -1;
      this.node.active = false;
    }

    /** 显示当前步骤 */
    private showCurrentStep(): void {
      if (this._index < 0 || this._index >= this._steps.length) {
        this.finishGuide();
        return;
      }

      const step = this._steps[this._index];

      if (this.tipLabel) {
        this.tipLabel.string = step.message;
      }

      // 优先使用 position + size（绝对控制高亮区域）
      if (step.position && step.size && this.highlight) {
        this.highlight.active = true;
        this.setHighlightByRect(step.position, step.size);
        return;
      }

      // 否则退回 target 模式
      if (step.target && this.highlight) {
        this.highlight.active = true;
        this.moveHighlightToTarget(step.target, step.padding ?? 10);
      } else if (this.highlight) {
        this.highlight.active = false;
      }
    }

    /**
     * 指定坐标 + 大小来设置高亮区域（相对于 GuideOverlay 的本地坐标）
     */
    private setHighlightByRect(
      pos: { x: number; y: number },
      size: { width: number; height: number },
    ): void {
      const overlayTrans = this.node.getComponent(UITransform);
      const highlightTrans = this.highlight.getComponent(UITransform);
      if (!overlayTrans || !highlightTrans) return;

      this.highlight.setPosition(new Vec3(pos.x, pos.y, 0));
      highlightTrans.setContentSize(new Size(size.width, size.height));
    }

    /**
     * 将高亮节点移动到目标节点中心，并根据目标大小 + padding 调整尺寸
     */
    private moveHighlightToTarget(target: Node, padding: number): void {
      const targetTrans = target.getComponent(UITransform);
      const overlayTrans = this.node.getComponent(UITransform);
      const highlightTrans = this.highlight.getComponent(UITransform);

      if (!overlayTrans || !highlightTrans || !targetTrans) {
        this.highlight.worldPosition = target.worldPosition;
        return;
      }

      const targetWorldPos = target.worldPosition;
      const localPos = overlayTrans.convertToNodeSpaceAR(targetWorldPos);
      this.highlight.setPosition(new Vec3(localPos.x, localPos.y, 0));

      const targetSize = targetTrans.contentSize;
      const newSize = new Size(
        targetSize.width + padding * 2,
        targetSize.height + padding * 2,
      );
      highlightTrans.setContentSize(new Size(newSize.width, newSize.height));
    }
  }


  
// ## 1. 通用引导组件：GuideOverlay

//   ### 1.1 UI 结构（一次搭好，全局复用）

//   在某个通用场景或预制里（例如 GuideOverlay 预制），搭结构：

//   Canvas
//     └── GuideOverlay   （挂 GuideOverlay.ts，初始 active = false）
//         ├── MaskBg     （全屏半透明遮罩，Sprite + BlockInputEvents）
//         ├── Highlight  （高亮框或箭头：Sprite）
//         └── TipPanel
//             ├── TipLabel   （Label，用于提示文字）
//             └── BtnNext    （Button + Label：“知道了 / 下一步”）

//   - GuideOverlay 节点：
//       - 大小铺满屏幕（UITransform 匹配 Canvas）。
//   - MaskBg 节点：
//       - Sprite：黑色、Alpha 约 150~200，覆盖全屏。
//       - BlockInputEvents：阻止点击穿透到底层 UI。
//   - Highlight 节点：
//       - Sprite：可以用半透明框、箭头或光圈。
//       - 大小和位置由脚本动态调整。
//   - TipPanel：
//       - 自己设计对话框样式，放在屏幕底部或上方即可。
