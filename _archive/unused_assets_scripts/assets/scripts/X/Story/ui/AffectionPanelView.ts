/**
 * 角色好感度面板控制器
 * 
 * 功能：
 * - 显示角色好感度数值和等级
 * - 显示好感度进度条
 * - 实时更新好感度变化
 * - 显示角色支线解锁状态
 * 
 * 节点结构：
 * AffectionPanelView
 * ├── Background (Sprite)                // 背景图
 * ├── Title (Label)                      // 标题
 * ├── CharacterList (ScrollView)         // 角色列表
 * │   └── Content (Node)
 * │       └── CharacterItem (Prefab)     // 角色项预制体
 * ├── CharacterDetail (Node)             // 角色详情面板
 * │   ├── CharacterAvatar (Sprite)       // 角色头像
 * │   ├── CharacterName (Label)          // 角色名称
 * │   ├── AffectionLevel (Label)         // 好感度等级
 * │   ├── AffectionProgress (ProgressBar)// 好感度进度条
 * │   ├── AffectionValue (Label)         // 好感度数值
 * │   ├── StageList (Node)               // 阶段列表
 * │   └── UnlockTip (Label)              // 解锁提示
 * └── CloseButton (Button)               // 关闭按钮
 * 
 * 角色项预制体结构：
 * CharacterItem
 * ├── Background (Sprite)
 * ├── Avatar (Sprite)                    // 头像
 * ├── Name (Label)                       // 名称
 * ├── LevelIcon (Sprite)                 // 等级图标
 * └── RedDot (Node)                      // 红点提示
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
import { AffectionManager } from '../AffectionManager';
import { StoryFlagManager } from '../StoryFlagManager';
import {
    ICharacterAffection,
    AffectionLevel,
    ICharacterRoute,
} from '../StoryTypes';
import { resourceUtil } from '../../client/Script/easyFramework/mgr/resourceUtil';

const { ccclass, property } = _decorator;

/**
 * 角色显示数据
 */
interface ICharacterDisplay {
    characterId: string;
    name: string;
    avatarPath: string;
    affection: ICharacterAffection;
    route?: ICharacterRoute;
    hasNewEvent: boolean;
}

@ccclass('AffectionPanelView')
export class AffectionPanelView extends Component {
    // ==================== UI节点绑定 ====================

    /**
     * 标题Label
     */
    @property(Label)
    titleLabel: Label = null!;

    /**
     * 角色列表ScrollView
     */
    @property(ScrollView)
    characterList: ScrollView = null!;

    /**
     * 角色项预制体
     * 需要包含头像Sprite、名称Label、等级图标等
     */
    @property(Prefab)
    characterItemPrefab: Prefab = null!;

    /**
     * 角色详情面板
     */
    @property(Node)
    characterDetail: Node = null!;

    /**
     * 角色头像Sprite
     */
    @property(Sprite)
    detailAvatar: Sprite = null!;

    /**
     * 角色名称Label
     */
    @property(Label)
    detailName: Label = null!;

    /**
     * 好感度等级Label
     */
    @property(Label)
    affectionLevelLabel: Label = null!;

    /**
     * 好感度进度条
     */
    @property(ProgressBar)
    affectionProgress: ProgressBar = null!;

    /**
     * 好感度数值Label
     */
    @property(Label)
    affectionValueLabel: Label = null!;

    /**
     * 阶段列表容器
     */
    @property(Node)
    stageListContainer: Node = null!;

    /**
     * 解锁提示Label
     */
    @property(Label)
    unlockTipLabel: Label = null!;

    /**
     * 关闭按钮
     */
    @property(Button)
    closeButton: Button = null!;

    // ==================== 配置属性 ====================

    /**
     * 好感度等级颜色配置
     */
    @property
    levelColors: Color[] = [
        new Color(150, 150, 150, 255), // 陌生人 - 灰色
        new Color(100, 200, 100, 255), // 熟人 - 绿色
        new Color(100, 150, 255, 255), // 朋友 - 蓝色
        new Color(200, 100, 255, 255), // 挚友 - 紫色
        new Color(255, 100, 150, 255), // 恋人 - 粉色
        new Color(255, 200, 50, 255),  // 灵魂伴侣 - 金色
    ];

    /**
     * 好感度等级名称
     */
    @property
    levelNames: string[] = [
        '陌生人',
        '熟人',
        '朋友',
        '挚友',
        '恋人',
        '灵魂伴侣',
    ];

    // ==================== 私有状态 ====================

    /** 角色数据列表 */
    private _characterList: ICharacterDisplay[] = [];

    /** 当前选中的角色索引 */
    private _selectedIndex: number = -1;

    /** 角色项节点列表 */
    private _itemNodes: Node[] = [];

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

        // 监听好感度变化
        AffectionManager.instance.onAffectionChange(this.onAffectionChanged.bind(this));
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
     * 显示好感度面板
     * @param characterIds 要显示的角色ID列表（可选，默认显示所有）
     * 
     * 示例：
     * ```typescript
     * // 显示所有角色
     * affectionPanel.show();
     * 
     * // 只显示指定角色
     * affectionPanel.show(['alice', 'bob']);
     * ```
     */
    public show(characterIds?: string[]): void {
        this.node.active = true;
        this.loadCharacterData(characterIds);
        this.refreshCharacterList();
        this.refreshDetailPanel();

        // 默认选中第一个角色
        if (this._characterList.length > 0 && this._selectedIndex === -1) {
            this.selectCharacter(0);
        }
    }

    /**
     * 隐藏面板
     */
    public hide(): void {
        this.node.active = false;
    }

    /**
     * 刷新面板数据
     */
    public refreshPanel(): void {
        this.loadCharacterData();
        this.refreshCharacterList();
        this.refreshDetailPanel();
    }

    /**
     * 强制刷新指定角色显示
     * @param characterId 角色ID
     */
    public refreshCharacter(characterId: string): void {
        const index = this._characterList.findIndex(c => c.characterId === characterId);
        if (index !== -1) {
            // 重新加载该角色数据
            const affection = AffectionManager.instance.getAffection(characterId);
            this._characterList[index].affection = affection;

            // 刷新UI
            this.refreshCharacterItem(index);
            if (this._selectedIndex === index) {
                this.refreshDetailPanel();
            }
        }
    }

    // ==================== 数据加载 ====================

    /**
     * 加载角色数据
     */
    private loadCharacterData(characterIds?: string[]): void {
        this._characterList = [];

        // 获取所有角色好感度
        const allAffections = AffectionManager.instance.getAllAffections();

        for (const affection of allAffections) {
            // 过滤指定角色
            if (characterIds && !characterIds.includes(affection.characterId)) {
                continue;
            }

            // 检查是否有新事件可解锁
            const hasNewEvent = this.checkNewEvent(affection.characterId);

            this._characterList.push({
                characterId: affection.characterId,
                name: this.getCharacterName(affection.characterId),
                avatarPath: this.getCharacterAvatar(affection.characterId),
                affection: affection,
                hasNewEvent: hasNewEvent,
            });
        }

        // 按好感度排序
        this._characterList.sort((a, b) => b.affection.value - a.affection.value);
    }

    /**
     * 检查是否有新事件
     */
    private checkNewEvent(characterId: string): boolean {
        const affection = AffectionManager.instance.getAffection(characterId);
        // 检查已解锁但未完成的事件
        return affection.unlockedEvents.some(
            eventId => !affection.completedEvents.includes(eventId)
        );
    }

    /**
     * 获取角色名称（可从配置表获取）
     */
    private getCharacterName(characterId: string): string {
        // TODO: 从配置表获取角色名称
        const nameMap: Record<string, string> = {
            'alice': 'Alice',
            'bob': 'Bob',
            'charlie': 'Charlie',
        };
        return nameMap[characterId] || characterId;
    }

    /**
     * 获取角色头像路径
     */
    private getCharacterAvatar(characterId: string): string {
        // TODO: 从配置表获取头像路径
        return `avatar/${characterId}`;
    }

    // ==================== UI刷新 ====================

    /**
     * 刷新角色列表
     */
    private refreshCharacterList(): void {
        if (!this.characterList?.content) return;

        // 清空列表
        this.characterList.content.removeAllChildren();
        this._itemNodes = [];

        // 生成角色项
        for (let i = 0; i < this._characterList.length; i++) {
            const item = this.createCharacterItem(this._characterList[i], i);
            if (item) {
                this.characterList.content.addChild(item);
                this._itemNodes.push(item);
            }
        }
    }

    /**
     * 刷新单个角色项
     */
    private refreshCharacterItem(index: number): void {
        if (index < 0 || index >= this._itemNodes.length) return;

        const data = this._characterList[index];
        const itemNode = this._itemNodes[index];

        // 更新头像
        const avatar = itemNode.getChildByName('Avatar')?.getComponent(Sprite);
        if (avatar && data.avatarPath) {
            resourceUtil.setSpriteFrame(data.avatarPath, avatar, () => {});
        }

        // 更新名称
        const name = itemNode.getChildByName('Name')?.getComponent(Label);
        if (name) {
            name.string = data.name;
        }

        // 更新等级图标颜色
        const levelIcon = itemNode.getChildByName('LevelIcon')?.getComponent(Sprite);
        if (levelIcon) {
            const levelIndex = Math.min(
                data.affection.level,
                this.levelColors.length - 1
            );
            levelIcon.color = this.levelColors[levelIndex];
        }

        // 更新红点
        const redDot = itemNode.getChildByName('RedDot');
        if (redDot) {
            redDot.active = data.hasNewEvent;
        }
    }

    /**
     * 创建角色项
     */
    private createCharacterItem(data: ICharacterDisplay, index: number): Node | null {
        if (!this.characterItemPrefab) return null;

        const itemNode = instantiate(this.characterItemPrefab);
        if (!itemNode) return null;

        // 设置头像
        const avatar = itemNode.getChildByName('Avatar')?.getComponent(Sprite);
        if (avatar && data.avatarPath) {
            resourceUtil.setSpriteFrame(data.avatarPath, avatar, () => {});
        }

        // 设置名称
        const name = itemNode.getChildByName('Name')?.getComponent(Label);
        if (name) {
            name.string = data.name;
        }

        // 设置等级图标
        const levelIcon = itemNode.getChildByName('LevelIcon')?.getComponent(Sprite);
        if (levelIcon) {
            const levelIndex = Math.min(
                data.affection.level,
                this.levelColors.length - 1
            );
            levelIcon.color = this.levelColors[levelIndex];
        }

        // 设置红点
        const redDot = itemNode.getChildByName('RedDot');
        if (redDot) {
            redDot.active = data.hasNewEvent;
        }

        // 绑定点击事件
        const button = itemNode.getComponent(Button) || itemNode.addComponent(Button);
        button.node.on(
            Node.EventType.TOUCH_END,
            () => this.selectCharacter(index),
            this
        );

        return itemNode;
    }

    /**
     * 刷新详情面板
     */
    private refreshDetailPanel(): void {
        if (!this.characterDetail) return;

        if (this._selectedIndex < 0 || this._selectedIndex >= this._characterList.length) {
            this.characterDetail.active = false;
            return;
        }

        this.characterDetail.active = true;

        const data = this._characterList[this._selectedIndex];
        const affection = data.affection;

        // 更新头像
        if (this.detailAvatar && data.avatarPath) {
            resourceUtil.setSpriteFrame(data.avatarPath, this.detailAvatar, () => {});
        }

        // 更新名称
        if (this.detailName) {
            this.detailName.string = data.name;
        }

        // 更新好感度等级
        if (this.affectionLevelLabel) {
            const levelIndex = Math.min(affection.level, this.levelNames.length - 1);
            this.affectionLevelLabel.string = this.levelNames[levelIndex];
            this.affectionLevelLabel.color = this.levelColors[levelIndex];
        }

        // 更新进度条
        if (this.affectionProgress) {
            this.affectionProgress.progress = affection.value / 100;
        }

        // 更新数值
        if (this.affectionValueLabel) {
            this.affectionValueLabel.string = `${affection.value} / 100`;
        }

        // 更新解锁提示
        this.updateUnlockTip(data);

        // 更新阶段列表
        this.updateStageList(data);
    }

    /**
     * 更新解锁提示
     */
    private updateUnlockTip(data: ICharacterDisplay): void {
        if (!this.unlockTipLabel) return;

        const affection = data.affection;
        const nextThreshold = this.getNextThreshold(affection.level);

        if (nextThreshold > 0) {
            const remaining = nextThreshold - affection.value;
            if (remaining > 0) {
                this.unlockTipLabel.string = `再增加 ${remaining} 好感度解锁下一阶段`;
            } else {
                this.unlockTipLabel.string = '可解锁新剧情！';
                this.unlockTipLabel.color = new Color(255, 200, 50, 255);
            }
        } else {
            this.unlockTipLabel.string = '已达到最高等级';
            this.unlockTipLabel.color = new Color(255, 200, 50, 255);
        }
    }

    /**
     * 获取下一等级阈值
     */
    private getNextThreshold(currentLevel: AffectionLevel): number {
        const thresholds = [11, 31, 51, 71, 91, 101];
        return thresholds[currentLevel] || -1;
    }

    /**
     * 更新阶段列表
     */
    private updateStageList(data: ICharacterDisplay): void {
        if (!this.stageListContainer) return;

        // 清空列表
        this.stageListContainer.removeAllChildren();

        // TODO: 根据角色支线配置显示阶段
        // 这里显示已完成的事件
        const affection = data.affection;

        for (const eventId of affection.completedEvents) {
            const stageNode = new Node('StageItem');
            const label = stageNode.addComponent(Label);
            label.string = `✓ ${eventId}`;
            label.color = new Color(100, 200, 100, 255);
            this.stageListContainer.addChild(stageNode);
        }

        for (const eventId of affection.unlockedEvents) {
            if (!affection.completedEvents.includes(eventId)) {
                const stageNode = new Node('StageItem');
                const label = stageNode.addComponent(Label);
                label.string = `○ ${eventId} (可解锁)`;
                label.color = new Color(255, 200, 50, 255);
                this.stageListContainer.addChild(stageNode);
            }
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 选择角色
     */
    private selectCharacter(index: number): void {
        if (index < 0 || index >= this._characterList.length) return;

        // 更新选中状态
        for (let i = 0; i < this._itemNodes.length; i++) {
            const item = this._itemNodes[i];
            const background = item.getChildByName('Background')?.getComponent(Sprite);
            if (background) {
                background.color = i === index
                    ? new Color(100, 150, 255, 255)
                    : new Color(255, 255, 255, 255);
            }
        }

        this._selectedIndex = index;

        // 显示详情
        this.refreshDetailPanel();

        // 播放选中动画
        const selectedItem = this._itemNodes[index];
        if (selectedItem) {
            tween(selectedItem)
                .to(0.1, { scale: new Vec3(1.05, 1.05, 1) })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        }
    }

    /**
     * 好感度变化回调
     */
    private onAffectionChanged(characterId: string, oldValue: number, newValue: number): void {
        console.log(`[AffectionPanel] ${characterId} 好感度变化: ${oldValue} -> ${newValue}`);

        // 刷新角色显示
        this.refreshCharacter(characterId);

        // 显示变化动画
        if (this._selectedIndex >= 0) {
            const currentData = this._characterList[this._selectedIndex];
            if (currentData.characterId === characterId) {
                this.showAffectionChangeAnimation(oldValue, newValue);
            }
        }
    }

    /**
     * 显示好感度变化动画
     */
    private showAffectionChangeAnimation(oldValue: number, newValue: number): void {
        if (!this.affectionValueLabel) return;

        const delta = newValue - oldValue;
        const deltaText = delta > 0 ? `+${delta}` : `${delta}`;

        // 创建临时Label显示变化量
        const deltaNode = new Node('DeltaLabel');
        const deltaLabel = deltaNode.addComponent(Label);
        deltaLabel.string = deltaText;
        deltaLabel.color = delta > 0
            ? new Color(100, 255, 100, 255)
            : new Color(255, 100, 100, 255);

        deltaNode.parent = this.affectionValueLabel.node;
        deltaNode.setPosition(0, 20, 0);

        // 动画
        tween(deltaNode)
            .by(0.5, { position: new Vec3(0, 30, 0) })
            .call(() => deltaNode.destroy())
            .start();
    }

    /**
     * 点击关闭
     */
    private onClickClose(): void {
        this.hide();
    }
}
