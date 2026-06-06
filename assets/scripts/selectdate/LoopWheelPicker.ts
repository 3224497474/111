// import { _decorator, Component, Node, ScrollView, Vec2, Label, UITransform, Vec3, instantiate, Layers, UIOpacity } from 'cc';
// const { ccclass, property } = _decorator;

// @ccclass('VirtualLoopPicker')
// export class VirtualLoopPicker extends Component {
//     @property(ScrollView) scrollView: ScrollView = null!;
//     @property(Node) content: Node = null!;
//     @property(Node) itemTemplate: Node = null!;

//     @property(Number) itemHeight: number = 100;
//     @property(Number) visibleItems: number = 5;

//     @property(Number) spacingY: number = 40;   // 额外的垂直间距
//     private _data: string[] = [];
//     private _items: Node[] = [];
//     private _spawnCount: number = 0; // 实际创建的节点数
//     private _buffer: number = 2;    // 上下预留缓冲节点
//     private _callback: ((index: number) => void) | null = null;
    
//     // 虚拟滚轮的总逻辑高度（设为一个很大的值实现无限感，或者用跳转法）
//     private _virtualHeight: number = 100000; 

//     private get slotHeight(): number {
//         return this.itemHeight + this.spacingY;
//     }

//     private getViewHeight(): number {
//         return this.scrollView.node.getComponent(UITransform)!.height;
//     }

//     private getCenterCorrect(viewHeight: number): number {
//         return (viewHeight - this.slotHeight) / 2;
//     }

//     onLoad() {
//         this.itemTemplate.active = false;
//         this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this);
//         this.scrollView.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
//     }

//     init(data: string[], defaultIdx: number, callback: (index: number) => void) {
//         this._data = data;
//         this._callback = callback;
        
//         // 1. 初始化节点池（仅创建少量节点）
//         if (this._items.length === 0) {
//             this._spawnCount = this.visibleItems + this._buffer;
//             for (let i = 0; i < this._spawnCount; i++) {
//                 let node = instantiate(this.itemTemplate);
//                 node.active = true;
//                 node.layer = Layers.Enum.UI_2D;
//                 node.parent = this.content;
//                 this._items.push(node);
//             }
//         }

//         // 2. 设置 Content 尺寸（虚拟高度）
//         const contentTrans = this.content.getComponent(UITransform)!;
//         contentTrans.setContentSize(contentTrans.contentSize.width, this._virtualHeight);

//         // 3. 定位到虚拟列表的中心位置附近
//         const halfHeight = this._virtualHeight / 2;
//         const loopHeight = data.length * this.slotHeight;
//         const startY = halfHeight - (halfHeight % loopHeight) + (defaultIdx * this.slotHeight);
        
//         // 初始对齐
//         this.scrollToIndex(startY);
//         this.updateItems();
//     }

//     private scrollToIndex(y: number) {
//         const viewHeight = this.getViewHeight();
//         const centerCorrect = this.getCenterCorrect(viewHeight);
//         this.scrollView.scrollToOffset(new Vec2(0, y - centerCorrect), 0);
//     }

//     private onScrolling() {
//         this.updateItems();
//     }

//     private updateItems() {
//         if (this._data.length === 0) return;

//         const scrollY = this.scrollView.getScrollOffset().y;
//         const viewHeight = this.getViewHeight();
//         const centerLine = scrollY + viewHeight / 2;

//         // 计算当前视口第一个 Item 的逻辑索引
//         let startIdx = Math.floor(scrollY / this.slotHeight);
//         for (let i = 0; i < this._items.length; i++) {
//             const item = this._items[i];
//             const logicIdx = startIdx + i - 1; // 缓冲一个位置
            
//             // 计算该节点在 Content 中的 Y 坐标
//             const itemY = logicIdx * this.slotHeight;
//             item.setPosition(0, -itemY - this.slotHeight / 2, 0);

//             // 计算对应的数据索引（无限循环取模）
//             const dataIdx = ((logicIdx % this._data.length) + this._data.length) % this._data.length;
            
//             // 更新文本
//             const label = item.getComponent(Label) || item.getComponentInChildren(Label)!;
//             label.string = this._data[dataIdx];

//             // 视觉特效：缩放和透明度
//             const itemCenterY = itemY + this.slotHeight / 2;
//             const dist = Math.abs(itemCenterY - centerLine);
//             const ratio = Math.max(0, 1 - dist / (viewHeight / 2));
            
//             item.setScale(new Vec3(0.8 + ratio * 0.4, 0.8 + ratio * 0.4, 1));
//             let opac = item.getComponent(UIOpacity) || item.addComponent(UIOpacity);
//             opac.opacity = 100 + ratio * 155;
//         }
//     }

//     private onScrollEnd() {
//         if (this._data.length === 0) return;

//         this.scrollView.stopAutoScroll();
//         const scrollY = this.scrollView.getScrollOffset().y;
//         const viewHeight = this.getViewHeight();
//         const centerCorrect = this.getCenterCorrect(viewHeight);
        
//         // 吸附对齐
//         const currY = scrollY + centerCorrect;
//         const targetIdx = Math.round(currY / this.slotHeight);
//         const finalY = targetIdx * this.slotHeight - centerCorrect;
        
//         this.scrollView.scrollToOffset(new Vec2(0, finalY), 0.1);

//         if (this._callback) {
//             const dataIdx = ((targetIdx % this._data.length) + this._data.length) % this._data.length;
//             this._callback(dataIdx);
//         }
//     }

//     // 提供给 DatePicker 获取当前索引的方法
//     getSelectedIndex(): number {
//         if (this._data.length === 0) return 0;

//         const scrollY = this.scrollView.getScrollOffset().y;
//         const viewHeight = this.getViewHeight();
//         const centerCorrect = this.getCenterCorrect(viewHeight);
//         const targetIdx = Math.round((scrollY + centerCorrect) / this.slotHeight);
//         return ((targetIdx % this._data.length) + this._data.length) % this._data.length;
//     }
// }



import { _decorator, Component, Node, ScrollView, Vec2, Label, UITransform, instantiate, Layers, UIOpacity, sys } from
  'cc';
  const { ccclass, property } = _decorator;

  type WheelItemRef = {
      node: Node;
      label: Label;
      opacity: UIOpacity;
      logicIdx: number;
      lastScale?: number;
      lastOpacity?: number;
  };

  @ccclass('VirtualLoopPicker')
  export class VirtualLoopPicker extends Component {
      @property(ScrollView) scrollView: ScrollView = null!;
      @property(Node) content: Node = null!;
      @property(Node) itemTemplate: Node = null!;

      @property(Number) itemHeight: number = 100;
      @property(Number) visibleItems: number = 5;
      @property(Number) spacingY: number = 40;

      private _data: string[] = [];
      private _items: WheelItemRef[] = [];
      private _buffer: number = 2;
      private _callback: ((index: number) => void) | null = null;
      private _virtualHeight: number = 10000000;
      private _viewTransform: UITransform = null!;
      private _lastStartIdx: number = Number.MIN_SAFE_INTEGER;
      private _lastTickIdx: number = Number.MIN_SAFE_INTEGER;

      private get slotHeight(): number {
          return this.itemHeight + this.spacingY;
      }

      private get viewHeight(): number {
          return this._viewTransform.height;
      }

      private get centerCorrect(): number {
          return (this.viewHeight - this.slotHeight) / 2;
      }

      onLoad() {
          this._viewTransform = this.scrollView.node.getComponent(UITransform)!;
          this.itemTemplate.active = false;

          this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this);
          this.scrollView.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
      }

      onDestroy() {
          if (!this.scrollView) return;
          this.scrollView.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this);
          this.scrollView.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
      }

      init(data: string[], defaultIdx: number, callback: (index: number) => void) {
          this._data = data;
          this._callback = callback;
          this._lastStartIdx = Number.MIN_SAFE_INTEGER;

          if (data.length === 0) {
              return;
          }

          this.ensureItemPool();

          const contentTrans = this.content.getComponent(UITransform)!;
          contentTrans.setContentSize(contentTrans.width, this._virtualHeight);

          const halfHeight = this._virtualHeight * 0.5;
          const loopHeight = data.length * this.slotHeight;
          const startY = halfHeight - (halfHeight % loopHeight) + defaultIdx * this.slotHeight;

          // 在初始化时先停止任何未完成的自动滚动，立即定位到目标索引，避免使用旧的滚动偏移量
          try {
              this.scrollView.stopAutoScroll();
          } catch (e) {
              // 某些运行时环境可能不支持，忽略错误
          }

          this.scrollToIndex(startY, 0);
          this.updateItems(true);
      }

      private ensureItemPool() {
          if (this._items.length > 0) return;

          const spawnCount = this.visibleItems + this._buffer * 2;
          for (let i = 0; i < spawnCount; i++) {
              const node = instantiate(this.itemTemplate);
              node.active = true;
              node.layer = Layers.Enum.UI_2D;
              node.parent = this.content;

              const label = node.getComponent(Label) || node.getComponentInChildren(Label)!;
              let opacity = node.getComponent(UIOpacity);
              if (!opacity) {
                  opacity = node.addComponent(UIOpacity);
              }

              this._items.push({
                  node,
                  label,
                  opacity,
                  logicIdx: 0,
              });
          }
      }

      private getDataIndex(logicIdx: number): number {
          return ((logicIdx % this._data.length) + this._data.length) % this._data.length;
      }

      private scrollToIndex(y: number, duration: number) {
          this.scrollView.scrollToOffset(new Vec2(0, y - this.centerCorrect), duration);
      }

      private onScrolling() {
          this.updateItems(false);
      }

      private updateItems(force: boolean) {
          if (this._data.length === 0) return;

          const scrollY = this.scrollView.getScrollOffset().y;
          const centerLine = scrollY + this.viewHeight * 0.5;
          const startIdx = Math.floor(scrollY / this.slotHeight);
          const currentTickIdx = Math.round((this.scrollView.getScrollOffset().y + this.centerCorrect) / this.slotHeight);

          if (currentTickIdx !== this._lastTickIdx) {
              this._lastTickIdx = currentTickIdx;
              if (!force) {
                  this.triggerHaptic();
              }
          }

          if (force || startIdx !== this._lastStartIdx) {
              for (let i = 0; i < this._items.length; i++) {
                  const item = this._items[i];
                  const logicIdx = startIdx + i - this._buffer;
                  const itemY = logicIdx * this.slotHeight;
                  const dataIdx = this.getDataIndex(logicIdx);

                  item.logicIdx = logicIdx;
                  item.node.setPosition(0, -itemY - this.slotHeight * 0.5, 0);

                  const nextText = this._data[dataIdx];
                  if (item.label.string !== nextText) {
                      item.label.string = nextText;
                  }
              }

              this._lastStartIdx = startIdx;
          }

          for (let i = 0; i < this._items.length; i++) {
              const item = this._items[i];
              const itemCenterY = item.logicIdx * this.slotHeight + this.slotHeight * 0.5;
              const dist = Math.abs(itemCenterY - centerLine);
              const ratio = Math.max(0, 1 - dist / (this.viewHeight * 0.5));
             // const scale = 0.85 + ratio * 0.3;
              const smoothRatio = this.easeOutCubic(ratio);
              const scale = 0.85 + smoothRatio * 0.3;
              const opacity = Math.round(100 + ratio * 155);

              if (item.lastScale !== scale) {
                  item.node.setScale(scale, scale, 1);
                  item.lastScale = scale;
              }

              if (item.lastOpacity !== opacity) {
                  item.opacity.opacity = opacity;
                  item.lastOpacity = opacity;
              }
          }
      }

      private onScrollEnd() {
          if (this._data.length === 0) return;

          this.scrollView.stopAutoScroll();

          const scrollY = this.scrollView.getScrollOffset().y;
          const targetIdx = Math.round((scrollY + this.centerCorrect) / this.slotHeight);
          const finalY = targetIdx * this.slotHeight;

          this.scrollToIndex(finalY, 0.12);


          // 触发触觉震动

          if (this._callback) {
              this._callback(this.getDataIndex(targetIdx));
          }
      }
      private triggerHaptic() {
    if (sys.platform === sys.Platform.WECHAT_GAME) {
        const wx = (window as any).wx;
        wx?.vibrateShort?.({ fail: () => {} });
    }
}
   private easeOutCubic(t: number): number {
          return 1 - Math.pow(1 - t, 3);
      }

      getSelectedIndex(): number {
          if (this._data.length === 0) return 0;

          const scrollY = this.scrollView.getScrollOffset().y;
          const targetIdx = Math.round((scrollY + this.centerCorrect) / this.slotHeight);
          return this.getDataIndex(targetIdx);
      }
  }
