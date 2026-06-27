/**
 * 章节选择界面控制器
 * 
 * 功能：
 * - 显示章节列表（主线/支线）
 * - 显示章节解锁状态
 * - 显示章节进度
 * - 点击进入章节
 * 
 * 节点结构：
 * ChapterSelectView
 * ├── Background (Sprite)            // 背景
 * ├── Title (Label)                  // 标题
 * ├── TabBar (Node)                  // 标签栏
 * │   ├── MainTab (Button)           // 主线标签
 * │   └── CharacterTab (Button)      // 支线标签
 * ├── ChapterList (ScrollView)       // 章节列表
 * │   └── Content (Node)
 * │       └── ChapterItem (Prefab)   // 章节项预制体
 * ├── ChapterDetail (Node)           // 章节详情
 * │   ├── ChapterName (Label)        // 章节名称
 * │   ├── ChapterDesc (Label)        // 章节描述
 * │   ├── ProgressBar (ProgressBar)  // 进度条
 * │   ├── ProgressText (Label)       // 进度文本
 * │   ├── RewardList (Node)          // 奖励列表
 * │   └── EnterButton (Button)       // 进入按钮
 * └── CloseButton (Button)           // 关闭按钮
 * 
 * 章节项预制体结构：
 * ChapterItem
 * ├── Background (Sprite)
 * ├── ChapterIcon (Sprite)           // 章节图标
 * ├── ChapterName (Label)            // 章节名称
 * ├── ChapterOrder (Label)           // 章节序号
 * ├── ProgressText (Label)           // 进度文本
 * ├── LockIcon (Sprite)              // 锁定图标
 * └── NewIcon (Sprite)               // 新章节标记
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
    ProgressBar,
    Color,
    tween,
    Vec3,
} from 'cc';
import { StoryManager } from '../StoryManager';
import { StoryFlagManager } from '../StoryFlagManager';
import { IChapter, ChapterType } from '../StoryTypes';

const { ccclass, property } = _decorator;

/**
 * 章节显示数据
 */
interface IChapterDisplay {
    chapter: IChapter;
    isUnlocked: boolean;
    isCompleted: boolean;
    progress: { completed: number; total: number; percentage: number };
    isNew: boolean;
}

@ccclass('ChapterSelectView')
export class ChapterSelectView extends Component {
    // ==================== UI节点绑定 ====================

    /**
     * 标题Label
     */
    @property(Label)
    titleLabel: Label = null!;

    /**
     * 主线标签按钮
     */
    @property(Button)
    mainTabButton: Button = null!;

    /**
     * 角色支线标签按钮
     */
    @property(Button)
    characterTabButton: Button = null!;

    /**
     * 章节列表ScrollView
     */
    @property(ScrollView)
    chapterList: ScrollView = null!;

    /**
     * 章节项预制体
     */
    @property(Prefab)
    chapterItemPrefab: Prefab = null!;

    /**
     * 章节详情面板
     */
    @property(Node)
    chapterDetail: Node = null!;

    /**
     * 章节名称Label
     */
    @property(Label)
    detailName: Label = null!;

    /**
     * 章节描述Label
     */
    @property(Label)
    detailDesc: Label = null!;

    /**
     * 章节进度条
     */
    @property(ProgressBar)
    detailProgress: ProgressBar = null!;

    /**
     * 进度文本Label
     */
    @property(Label)
    detailProgressText: Label = null!;

    /**
     * 奖励列表容器
     */
    @property(Node)
    rewardListContainer: Node = null!;

    /**
     * 进入章节按钮
     */
    @property(Button)
    enterButton: Button = null!;

    /**
     * 关闭按钮
     */
    @property(Button)
    closeButton: Button = null!;

    // ==================== 配置属性 ====================

    /**
     * 锁定状态颜色
     */
    @property
    lockedColor: Color = new Color(100, 100, 100, 255);

    /**
     * 解锁状态颜色
     */
    @property
    unlockedColor: Color = new Color(255, 255, 255, 255);

    /**
     * 完成状态颜色
     */
    @property
    completedColor: Color = new Color(100, 200, 100, 255);

    /**
     * 选中状态颜色
     */
    @property
    selectedColor: Color = new Color(100, 150, 255, 255);

    // ==================== 私有状态 ====================

    /** 当前标签页类型 */
    private _currentTab: ChapterType = ChapterType.Main;

    /** 章节数据列表 */
    private _chapterList: IChapterDisplay[] = [];

    /** 当前选中的章节索引 */
    private _selectedIndex: number = -1;

    /** 章节项节点列表 */
    private _itemNodes: Node[] = [];

    /** 章节完成回调 */
    private _onChapterSelect: ((chapterId: string) => void) | null = null;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initEventListeners();
    }

    onDestroy() {
        this.removeEventListeners();
    }

    onEnable() {
        this.refreshPanel();
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

        // 标签按钮
        if (this.mainTabButton) {
            this.mainTabButton.node.on(
                Node.EventType.TOUCH_END,
                () => this.switchTab(ChapterType.Main),
                this
            );
        }

        if (this.characterTabButton) {
            this.characterTabButton.node.on(
                Node.EventType.TOUCH_END,
                () => this.switchTab(ChapterType.Character),
                this
            );
        }

        // 进入按钮
        if (this.enterButton) {
            this.enterButton.node.on(
                Node.EventType.TOUCH_END,
                this.onClickEnter,
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
     * 显示章节选择界面
     * @param callback 选择章节后的回调
     * 
     * 示例：
     * ```typescript
     * chapterSelectView.show((chapterId) => {
     *     console.log('选择了章节:', chapterId);
     *     StoryManager.instance.startChapter(chapterId);
     * });
     * ```
     */
    public show(callback?: (chapterId: string) => void): void {
        this.node.active = true;
        this._onChapterSelect = callback || null;
        this.switchTab(ChapterType.Main);
    }

    /**
     * 隐藏界面
     */
    public hide(): void {
        this.node.active = false;
    }

    /**
     * 刷新面板
     */
    public refreshPanel(): void {
        this.loadChapterData();
        this.refreshChapterList();
        this.refreshDetailPanel();
        this.updateTabButtons();
    }

    // ==================== 数据加载 ====================

    /**
     * 加载章节数据
     */
    private loadChapterData(): void {
        this._chapterList = [];

        // 获取所有章节
        const allChapters = this.getAllChapters();

        for (const chapter of allChapters) {
            // 过滤当前标签类型
            if (chapter.type !== this._currentTab) continue;

            // 检查解锁状态
            const isUnlocked = this.checkChapterUnlocked(chapter);

            // 检查完成状态
            const isCompleted = StoryManager.instance.isChapterCompleted(chapter.id);

            // 获取进度
            const progress = StoryManager.instance.getChapterProgress(chapter.id);

            // 检查是否是新章节
            const isNew = isUnlocked && !isCompleted && progress.completed === 0;

            this._chapterList.push({
                chapter,
                isUnlocked,
                isCompleted,
                progress,
                isNew,
            });
        }

        // 按顺序排序
        this._chapterList.sort((a, b) => a.chapter.order - b.chapter.order);
    }

    /**
     * 获取所有章节（从StoryManager或配置）
     */
    private getAllChapters(): IChapter[] {
        // TODO: 从StoryManager获取所有章节
        // 这里返回空数组，需要实际实现
        return [];
    }

    /**
     * 检查章节是否解锁
     */
    private checkChapterUnlocked(chapter: IChapter): boolean {
        // 检查前置章节
        if (chapter.previousChapterId) {
            if (!StoryManager.instance.isChapterCompleted(chapter.previousChapterId)) {
                return false;
            }
        }

        // 检查解锁条件
        if (chapter.unlockCondition) {
            if (!StoryFlagManager.instance.evaluateCondition(chapter.unlockCondition)) {
                return false;
            }
        }

        return true;
    }

    // ==================== UI刷新 ====================

    /**
     * 刷新章节列表
     */
    private refreshChapterList(): void {
        if (!this.chapterList?.content) return;

        // 清空列表
        this.chapterList.content.removeAllChildren();
        this._itemNodes = [];

        // 生成章节项
        for (let i = 0; i < this._chapterList.length; i++) {
            const item = this.createChapterItem(this._chapterList[i], i);
            if (item) {
                this.chapterList.content.addChild(item);
                this._itemNodes.push(item);
            }
        }
    }

    /**
     * 创建章节项
     */
    private createChapterItem(data: IChapterDisplay, index: number): Node | null {
        if (!this.chapterItemPrefab) return null;

        const itemNode = instantiate(this.chapterItemPrefab);
        if (!itemNode) return null;

        const chapter = data.chapter;

        // 设置章节图标
        const icon = itemNode.getChildByName('ChapterIcon')?.getComponent(Sprite);
        if (icon && chapter.iconPath) {
            // 加载图标
        }

        // 设置章节名称
        const name = itemNode.getChildByName('ChapterName')?.getComponent(Label);
        if (name) {
            name.string = chapter.name;
        }

        // 设置章节序号
        const order = itemNode.getChildByName('ChapterOrder')?.getComponent(Label);
        if (order) {
            order.string = `第${chapter.order}章`;
        }

        // 设置进度文本
        const progressText = itemNode.getChildByName('ProgressText')?.getComponent(Label);
        if (progressText) {
            if (data.isCompleted) {
                progressText.string = '已完成';
                progressText.color = this.completedColor;
            } else if (data.isUnlocked) {
                progressText.string = `${data.progress.completed}/${data.progress.total}`;
                progressText.color = this.unlockedColor;
            } else {
                progressText.string = '未解锁';
                progressText.color = this.lockedColor;
            }
        }

        // 设置锁定图标
        const lockIcon = itemNode.getChildByName('LockIcon');
        if (lockIcon) {
            lockIcon.active = !data.isUnlocked;
        }

        // 设置新章节标记
        const newIcon = itemNode.getChildByName('NewIcon');
        if (newIcon) {
            newIcon.active = data.isNew;
        }

        // 设置背景颜色
        const background = itemNode.getChildByName('Background')?.getComponent(Sprite);
        if (background) {
            if (!data.isUnlocked) {
                background.color = this.lockedColor;
            } else if (data.isCompleted) {
                background.color = this.completedColor;
            } else {
                background.color = this.unlockedColor;
            }
        }

        // 绑定点击事件
        const button = itemNode.getComponent(Button) || itemNode.addComponent(Button);
        button.interactable = data.isUnlocked;
        button.node.on(
            Node.EventType.TOUCH_END,
            () => this.selectChapter(index),
            this
        );

        return itemNode;
    }

    /**
     * 刷新详情面板
     */
    private refreshDetailPanel(): void {
        if (!this.chapterDetail) return;

        if (this._selectedIndex < 0 || this._selectedIndex >= this._chapterList.length) {
            this.chapterDetail.active = false;
            return;
        }

        this.chapterDetail.active = true;

        const data = this._chapterList[this._selectedIndex];
        const chapter = data.chapter;

        // 设置章节名称
        if (this.detailName) {
            this.detailName.string = chapter.name;
        }

        // 设置章节描述
        if (this.detailDesc) {
            this.detailDesc.string = chapter.description;
        }

        // 设置进度条
        if (this.detailProgress) {
            this.detailProgress.progress = data.progress.percentage / 100;
        }

        // 设置进度文本
        if (this.detailProgressText) {
            this.detailProgressText.string = 
                `${data.progress.completed} / ${data.progress.total} (${data.progress.percentage}%)`;
        }

        // 更新奖励列表
        this.updateRewardList(data);

        // 更新进入按钮状态
        if (this.enterButton) {
            this.enterButton.interactable = data.isUnlocked && !data.isCompleted;
            const buttonLabel = this.enterButton.node.getComponentInChildren(Label);
            if (buttonLabel) {
                if (data.isCompleted) {
                    buttonLabel.string = '已完成';
                } else if (!data.isUnlocked) {
                    buttonLabel.string = '未解锁';
                } else {
                    buttonLabel.string = '进入章节';
                }
            }
        }
    }

    /**
     * 更新奖励列表
     */
    private updateRewardList(data: IChapterDisplay): void {
        if (!this.rewardListContainer) return;

        // 清空列表
        this.rewardListContainer.removeAllChildren();

        const rewards = data.chapter.clearRewards;
        if (!rewards || rewards.length === 0) return;

        for (const reward of rewards) {
            const rewardNode = new Node('RewardItem');
            const label = rewardNode.addComponent(Label);

            switch (reward.type) {
                case 'gold':
                    label.string = `💰 ${reward.amount} 金币`;
                    break;
                case 'diamond':
                    label.string = `💎 ${reward.amount} 钻石`;
                    break;
                case 'exp':
                    label.string = `⭐ ${reward.amount} 经验`;
                    break;
                case 'item':
                    label.string = `📦 ${reward.id} x${reward.amount}`;
                    break;
                default:
                    label.string = `${reward.type}: ${reward.amount}`;
            }

            label.color = new Color(255, 200, 100, 255);
            this.rewardListContainer.addChild(rewardNode);
        }
    }

    /**
     * 更新标签按钮状态
     */
    private updateTabButtons(): void {
        if (this.mainTabButton) {
            const mainBg = this.mainTabButton.node.getChildByName('Background')?.getComponent(Sprite);
            if (mainBg) {
                mainBg.color = this._currentTab === ChapterType.Main
                    ? this.selectedColor
                    : this.unlockedColor;
            }
        }

        if (this.characterTabButton) {
            const charBg = this.characterTabButton.node.getChildByName('Background')?.getComponent(Sprite);
            if (charBg) {
                charBg.color = this._currentTab === ChapterType.Character
                    ? this.selectedColor
                    : this.unlockedColor;
            }
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 切换标签页
     */
    private switchTab(tab: ChapterType): void {
        this._currentTab = tab;
        this._selectedIndex = -1;

        // 更新标题
        if (this.titleLabel) {
            this.titleLabel.string = tab === ChapterType.Main ? '主线剧情' : '角色支线';
        }

        this.refreshPanel();

        // 默认选中第一个
        if (this._chapterList.length > 0) {
            this.selectChapter(0);
        }
    }

    /**
     * 选择章节
     */
    private selectChapter(index: number): void {
        if (index < 0 || index >= this._chapterList.length) return;

        const data = this._chapterList[index];
        if (!data.isUnlocked) return;

        // 更新选中状态
        for (let i = 0; i < this._itemNodes.length; i++) {
            const item = this._itemNodes[i];
            const background = item.getChildByName('Background')?.getComponent(Sprite);
            if (background && this._chapterList[i].isUnlocked) {
                background.color = i === index
                    ? this.selectedColor
                    : this.unlockedColor;
            }
        }

        this._selectedIndex = index;
        this.refreshDetailPanel();

        // 播放选中动画
        const selectedItem = this._itemNodes[index];
        if (selectedItem) {
            tween(selectedItem)
                .to(0.1, { scale: new Vec3(1.02, 1.02, 1) })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        }
    }

    /**
     * 点击进入章节
     */
    private onClickEnter(): void {
        if (this._selectedIndex < 0 || this._selectedIndex >= this._chapterList.length) return;

        const data = this._chapterList[this._selectedIndex];

        if (!data.isUnlocked || data.isCompleted) return;

        // 调用回调
        if (this._onChapterSelect) {
            this._onChapterSelect(data.chapter.id);
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
