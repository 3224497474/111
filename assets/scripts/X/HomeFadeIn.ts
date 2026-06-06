//在 home 场景淡入（黑屏→渐显 或 UI 弹出）
 import { _decorator, Component, Node, UIOpacity, tween } from 'cc';
  const { ccclass, property } = _decorator;

  @ccclass('HomeFadeIn')
  export class HomeFadeIn extends Component {

      @property({ type: Node, tooltip: '淡入遮罩（可留空，默认当前节点）' })
      public fadeMask: Node | null = null;

      start() {
          const node = this.fadeMask || this.node;

          let opacity = node.getComponent(UIOpacity);
          if (!opacity) {
              opacity = node.addComponent(UIOpacity);
          }

          // 起始为全黑（不透明）
          opacity.opacity = 255;
          node.active = true;

          // 0.4 秒从黑色淡到透明
          tween(opacity)
              .to(0.4, { opacity: 0 })
              .call(() => {
                  node.active = false; // 淡完就关掉遮罩节点
              })
              .start();
      }
  }


// 2）在 home 场景里使用
//    有两种简单用法：

//   - 方式 A：单独做一个全屏黑色遮罩节点
//       - 在 home.scene 的 Canvas 下新建一个节点，比如叫 FadeMask；
//       - 挂一个 Sprite，颜色设为黑色，UITransform 尺寸填满屏幕；
//       - 给这个 FadeMask 节点挂上 HomeFadeIn 脚本（fadeMask 字段可以留空）；
//       - 运行时，Home 场景加载出来先是全黑，然后 0.4 秒淡出露出真实画面。
//   - 方式 B：直接挂在 Canvas 上
//       - 在 Canvas 节点上挂 HomeFadeIn；
//       - 但这时需要确保 Canvas 自己有一个全屏的黑色背景（否则只是 Canvas 的透明度在淡）。

//   > 建议用方式 A：视觉和逻辑都更清晰。