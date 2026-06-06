/**
 * 结局展示界面控制器
 * 
 * 功能：
 * - 显示结局信息（名称、描述、CG）
 * - 结局动画演出
 * - 结局图鉴查看
 * - 结局统计信息
 * 
 * 节点结构：
 * EndingDisplayView
 * ├── Background (Sprite)            // 背景（可显示CG）
 * ├── EndingPanel (Node)             // 结局面板
 * │   ├── CGContainer (Node)         // CG图片容器
 * │   │   └── CGSprite (Sprite)      // CG图片
 * │   ├── EndingTitle (Label)        // 结局标题
 * │   ├── EndingType (Label)         // 结局类型
 * │   ├── EndingDesc (Label)         // 结局描述
 * │   └── ContinueButton (Button)    // 继续按钮
 * ├── EndingGallery (Node)           // 结局图鉴面板
 * │   ├── GalleryList (ScrollView)   // 结局列表
 * │   │   └── Content (Node)
 * │   │       └── EndingItem (Prefab)// 结局项预制体
 * │   └── StatsLabel (Label)         // 统计信息
 * ├── ViewModeButton (Button)        // 查看图鉴按钮
 * └── CloseButton (Button)           // 关闭按钮
 * 
 * 结局项预制体结构：
 * EndingItem
 * ├── Background (Sprite)
 * ├── EndingName (Label)             // 结局名称
 * ├── EndingTypeIcon (Sprite)        // 结局类型图标
 * ├── LockOverlay (Node)             // 锁定遮罩
 * └── AchievedIcon (Sprite)          // 达成标记
 */

import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    Button,
    ScrollView,
    Prefab,
    instantiate,
    Color,
    tween,
    Vec3,
    UIOpacity,
    SpriteFrame,
} from 'cc';
import { EndingManager } from '../EndingManager';
import { IEnding, EndingType } from '../StoryTypes';
import { resourceUtil } from '../../client/Script/easyFramework/mgr/resourceUtil';

const { ccclass, property } = _decorator;

/**
 * 结局显示数据
 */
interface IEndingDisplay {
    ending: IEnding;
    isUnlocked: boolean;
    isAchieved: boolean;
}

/**
 * 显示模式
 */
enum ViewMode {
    Ending = 'ending',      // 结局展示模式
    Gallery = 'gallery',    // 图鉴模式
}

@ccclass('EndingDisplayView')
export class EndingDisplayView extends Component {
    // ==================== UI节点绑定 ====================

    /**
     * 背景Sprite
     */
    @property(Sprite)
    backgroundSprite: Sprite = null!;

    /**
     * 结局面板
     */
    @property(Node)
    endingPanel: Node = null!;

    /**
     * CG容器节点
     */
    @property(Node)
    cgContainer: Node = null!;

    /**
     * CG图片Sprite
     */
    @property(Sprite)
    cgSprite: Sprite = null!;

    /**
     * 结局标题Label
     */
    @property(Label)
    endingTitle: Label = null!;

    /**
     * 结局类型Label
     */
    @property(Label)
    endingType: Label = null!;

    /**
     * 结局描述Label
     */
    @property(Label)
    endingDesc: Label = null!;

    /**
     * 继续按钮
     */
    @property(Button)
    continueButton: Button = null!;

    /**
     * 结局图鉴面板
     */
    @property(Node)
    endingGallery: Node = null!;

    /**
     * 图鉴列表ScrollView
     */
    @property(ScrollView)
    galleryList: ScrollView = null!;

    /**
     * 结局项预制体
     */
    @property(Prefab)
    endingItemPrefab: Prefab = null!;

    /**
     * 统计信息Label
     */
    @property(Label)
    statsLabel: Label = null!;

    /**
     * 查看图鉴按钮
     */
    @property(Button)
    viewModeButton: Button = null!;

    /**
     * 关闭按钮
     */
    @property(Button)
    closeButton: Button = null!;

    // ==================== 配置属性 ====================

    /**
     * 结局类型名称
     */
    @property
    endingTypeNames: string[] = [
        '真结局',
        '好结局',
        '普通结局',
        '坏结局',
        '角色结局',
        '隐藏结局',
    ];

    /**
     * 结局类型颜色
     */
    @property
    endingTypeColors: Color[] = [
        new Color(255, 215, 0, 255),   // 真结局 - 金色
        new Color(100, 200, 100, 255), // 好结局 - 绿色
        new Color(150, 150, 150, 255), // 普通 - 灰色
        new Color(200, 100, 100, 255), // 坏结局 - 红色
        new Color(255, 150, 200, 255), // 角色 - 粉色
        new Color(200, 100, 255, 255), // 隐藏 - 紫色
    ];

    /**
     * 动画持续时间
     */
    @property
    animationDuration: number = 1.0;

    // ==================== 私有状态 ====================

    /** 当前显示模式 */
    private _viewMode: ViewMode = ViewMode.Ending;

    /** 当前显示的结局 */
    private _currentEnding: IEnding | null = null;

    /** 结局数据列表 */
    private _endingList: IEndingDisplay[] = [];

    /** 图鉴项节点列表 */
    private _galleryItemNodes: Node[] = [];

    /** 完成回调 */
    private _onComplete: (() => void) | null = null;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initEventListeners();
    }

    onDestroy() {
        this.removeEventListeners();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化事件监听
     */
    private initEventListeners(): void {
        // 关闭按钮
        if (this.closeButton) {
            this.closeButton.node.on(
                Node.EventType.TOUCH_END,
                this.onClickClose,
                this
            );
        }

        // 继续按钮
        if (this.continueButton) {
            this.continueButton.node.on(
                Node.EventType.TOUCH_END,
                this.onClickContinue,
                this
            );
        }

        // 模式切换按钮
        if (this.viewModeButton) {
            this.viewModeButton.node.on(
                Node.EventType.TOUCH_END,
                this.toggleViewMode,
                this
            );
        }
    }

    /**
     * 移除事件监听
     */
    private removeEventListeners(): void {
        if (this.closeButton) {
            this.closeButton.node.off(
                Node.EventType.TOUCH_END,
                this.onClickClose,
                this
            );
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 显示结局
     * @param endingId 结局ID
     * @param onComplete 完成回调
     * 
     * 示例：
     * ```typescript
     * // 显示特定结局
     * endingView.showEnding('ending_hero', () => {
     *     console.log('结局展示完成');
     *     // 返回主菜单或继续游戏
     * });
     * 
     * // 显示最佳可用结局
     * const bestEnding = EndingManager.instance.getBestAvailableEnding();
     * if (bestEnding) {
     *     endingView.showEnding(bestEnding.id);
     * }
     * ```
     */
    public showEnding(endingId: string, onComplete?: () => void): void {
        const ending = EndingManager.instance.getEnding(endingId);
        if (!ending) {
            console.error(`[EndingDisplayView] Ending not found: ${endingId}`);
            return;
        }

        this._currentEnding = ending;
        this._onComplete = onComplete || null;
        this._viewMode = ViewMode.Ending;

        // 触发结局
        EndingManager.instance.triggerEnding(endingId);

        // 显示界面
        this.node.active = true;
        this.showEndingPanel();
        this.playEndingAnimation();
    }

    /**
     * 显示结局图鉴
     * 
     * 示例：
     * ```typescript
     * endingView.showGallery();
     * ```
     */
    public showGallery(): void {
        this._viewMode = ViewMode.Gallery;
        this._currentEnding = null;

        this.node.active = true;
        this.showGalleryPanel();
    }

    /**
     * 隐藏界面
     */
    public hide(): void {
        this.node.active = false;
        this._currentEnding = null;
        this._onComplete = null;
    }

    // ==================== 面板显示 ====================

    /**
     * 显示结局面板
     */
    private showEndingPanel(): void {
        if (this.endingPanel) {
            this.endingPanel.active = true;
        }
        if (this.endingGallery) {
            this.endingGallery.active = false;
        }

        // 更新图鉴按钮文本
        this.updateViewModeButton();
    }

    /**
     * 显示图鉴面板
     */
    private showGalleryPanel(): void {
        if (this.endingPanel) {
            this.endingPanel.active = false;
        }
        if (this.endingGallery) {
            this.endingGallery.active = true;
        }

        // 加载图鉴数据
        this.loadGalleryData();
        this.refreshGalleryList();
        this.updateStatsLabel();

        // 更新图鉴按钮文本
        this.updateViewModeButton();
    }

    /**
     * 更新模式切换按钮
     */
    private updateViewModeButton(): void {
        if (!this.viewModeButton) return;

        const label = this.viewModeButton.node.getComponentInChildren(Label);
        if (label) {
            label.string = this._viewMode === ViewMode.Ending ? '查看图鉴' : '返回';
        }
    }

    // ==================== 结局展示 ====================

    /**
     * 播放结局动画
     */
    private playEndingAnimation(): void {
        if (!this._currentEnding) return;

        const ending = this._currentEnding;

        // 设置结局类型
        if (this.endingType) {
            const typeIndex = this.getEndingTypeIndex(ending.type);
            this.endingType.string = this.endingTypeNames[typeIndex];
            this.endingType.color = this.endingTypeColors[typeIndex];
        }

        // 设置结局标题
        if (this.endingTitle) {
            this.endingTitle.string = '';
            this.typewriterEffect(this.endingTitle, ending.name);
        }

        // 设置结局描述
        if (this.endingDesc) {
            this.endingDesc.string = '';
            this.scheduleOnce(() => {
                this.typewriterEffect(this.endingDesc, ending.description);
            }, 0.5);
        }

        // 加载CG
        this.loadCG(ending.cgPath);

        // 入场动画
        this.playEnterAnimation();
    }

    /**
     * 获取结局类型索引
     */
    private getEndingTypeIndex(type: EndingType): number {
        const typeMap: Record<EndingType, number> = {
            [EndingType.True]: 0,
            [EndingType.Good]: 1,
            [EndingType.Normal]: 2,
            [EndingType.Bad]: 3,
            [EndingType.Character]: 4,
            [EndingType.Hidden]: 5,
        };
        return typeMap[type] ?? 2;
    }

    /**
     * 加载CG图片
     */
    private loadCG(cgPath?: string): void {
        if (!this.cgSprite) return;

        if (cgPath) {
            resourceUtil.setSpriteFrame(cgPath, this.cgSprite, (err) => {
                if (err) {
                    console.warn('[EndingDisplayView] CG load failed:', cgPath);
                    // 使用默认CG或隐藏
                }
            });
        }
    }

    /**
     * 打字机效果
     */
    private typewriterEffect(label: Label, text: string): void {
        if (!label) return;

        let index = 0;
        label.string = '';

        const update = () => {
            if (index < text.length) {
                label.string += text[index];
                index++;
                this.scheduleOnce(update, 0.05);
            }
        };

        update();
    }

    /**
     * 入场动画
     */
    private playEnterAnimation(): void {
        if (!this.endingPanel) return;

        // 初始状态
        this.endingPanel.setScale(0.8, 0.8, 1);
        const opacity = this.endingPanel.getComponent(UIOpacity) ||
                       this.endingPanel.addComponent(UIOpacity);
        opacity.opacity = 0;

        // 动画
        tween(this.endingPanel)
            .to(this.animationDuration, { scale: new Vec3(1, 1, 1) })
            .start();

        tween(opacity)
            .to(this.animationDuration, { opacity: 255 })
            .start();
    }

    // ==================== 图鉴模式 ====================

    /**
     * 加载图鉴数据
     */
    private loadGalleryData(): void {
        this._endingList = [];

        const allEndings = EndingManager.instance.getAllEndings();

        for (const ending of allEndings) {
            const isUnlocked = EndingManager.instance.isEndingUnlocked(ending.id);
            const isAchieved = EndingManager.instance.isEndingAchieved(ending.id);

            this._endingList.push({
                ending,
                isUnlocked,
                isAchieved,
            });
        }

        // 按类型和优先级排序
        this._endingList.sort((a, b) => {
            if (a.isAchieved !== b.isAchieved) {
                return a.isAchieved ? -1 : 1;
            }
            return a.ending.priority - b.ending.priority;
        });
    }

    /**
     * 刷新图鉴列表
     */
    private refreshGalleryList(): void {
        if (!this.galleryList?.content) return;

        // 清空列表
        this.galleryList.content.removeAllChildren();
        this._galleryItemNodes = [];

        // 生成结局项
        for (let i = 0; i < this._endingList.length; i++) {
            const item = this.createEndingItem(this._endingList[i], i);
            if (item) {
                this.galleryList.content.addChild(item);
                this._galleryItemNodes.push(item);
            }
        }
    }

    /**
     * 创建结局项
     */
    private createEndingItem(data: IEndingDisplay, index: number): Node | null {
        if (!this.endingItemPrefab) return null;

        const itemNode = instantiate(this.endingItemPrefab);
        if (!itemNode) return null;

        const ending = data.ending;

        // 设置结局名称
        const name = itemNode.getChildByName('EndingName')?.getComponent(Label);
        if (name) {
            name.string = data.isUnlocked ? ending.name : '???';
        }

        // 设置结局类型图标
        const typeIcon = itemNode.getChildByName('EndingTypeIcon')?.getComponent(Sprite);
        if (typeIcon) {
            const typeIndex = this.getEndingTypeIndex(ending.type);
            typeIcon.color = this.endingTypeColors[typeIndex];
        }

        // 设置锁定遮罩
        const lockOverlay = itemNode.getChildByName('LockOverlay');
        if (lockOverlay) {
            lockOverlay.active = !data.isUnlocked;
        }

        // 设置达成标记
        const achievedIcon = itemNode.getChildByName('AchievedIcon');
        if (achievedIcon) {
            achievedIcon.active = data.isAchieved;
        }

        // 设置背景
        const background = itemNode.getChildByName('Background')?.getComponent(Sprite);
        if (background) {
            background.color = data.isAchieved
                ? new Color(255, 215, 0, 255)
                : new Color(255, 255, 255, 255);
        }

        // 绑定点击事件
        const button = itemNode.getComponent(Button) || itemNode.addComponent(Button);
        button.node.on(
            Node.EventType.TOUCH_END,
            () => this.selectEnding(index),
            this
        );

        return itemNode;
    }

    /**
     * 更新统计信息
     */
    private updateStatsLabel(): void {
        if (!this.statsLabel) return;

        const stats = EndingManager.instance.getEndingStats();

        this.statsLabel.string = 
            `已达成: ${stats.achieved}/${stats.total}\n` +
            `真结局: ${stats.byType[EndingType.True].achieved}/${stats.byType[EndingType.True].total}\n` +
            `好结局: ${stats.byType[EndingType.Good].achieved}/${stats.byType[EndingType.Good].total}\n` +
            `角色结局: ${stats.byType[EndingType.Character].achieved}/${stats.byType[EndingType.Character].total}\n` +
            `隐藏结局: ${stats.byType[EndingType.Hidden].achieved}/${stats.byType[EndingType.Hidden].total}`;
    }

    // ==================== 事件处理 ====================

    /**
     * 选择结局（图鉴模式）
     */
    private selectEnding(index: number): void {
        if (index < 0 || index >= this._endingList.length) return;

        const data = this._endingList[index];

        if (!data.isUnlocked) {
            console.log('[EndingDisplayView] Ending locked');
            return;
        }

        // 显示结局详情
        this._currentEnding = data.ending;
        this._viewMode = ViewMode.Ending;
        this.showEndingPanel();
        this.playEndingAnimation();
    }

    /**
     * 切换查看模式
     */
    private toggleViewMode(): void {
        if (this._viewMode === ViewMode.Ending) {
            this._viewMode = ViewMode.Gallery;
            this.showGalleryPanel();
        } else {
            if (this._currentEnding) {
                this._viewMode = ViewMode.Ending;
                this.showEndingPanel();
            } else {
                this.onClickClose();
            }
        }
    }

    /**
     * 点击继续
     */
    private onClickContinue(): void {
        if (this._onComplete) {
            const callback = this._onComplete;
            this._onComplete = null;
            callback();
        }
        this.hide();
    }

    /**
     * 点击关闭
     */
    private onClickClose(): void {
        this.hide();
    }
}
