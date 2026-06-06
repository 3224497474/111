/**
 * 剧情对话界面控制器
 * 
 * 功能：
 * - 显示角色名称、头像、对话内容
 * - 打字机效果逐字显示
 * - 支持玩家选择分支
 * - 点击推进对话
 * 
 * 节点结构：
 * StoryDialogView
 * ├── Mask (Node)                    // 全屏遮罩，点击推进
 * ├── Panel (Node)                   // 对话面板
 * │   ├── Avatar (Sprite)            // 角色头像
 * │   ├── NameLabel (Label)          // 角色名称
 * │   ├── ContentArea (Node)         // 内容区域
 * │   │   └── ContentLabel (Label)   // 对话内容
 * │   └── ChoiceContainer (Node)     // 选项容器
 * │       └── ChoiceButton (Prefab)  // 选项按钮预制体
 * └── PreviewLabel (Label)           // 选择预览提示
 * 
 * 绑定步骤：
 * 1. 在场景中创建上述节点结构
 * 2. 将此脚本挂载到 StoryDialogView 节点
 * 3. 在Inspector中拖拽绑定各个属性
 * 4. ChoiceButton预制体需要包含Button组件和Label子节点
 */

import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    Button,
    Prefab,
    instantiate,
    UITransform,
    Vec3,
    Color,
    tween,
    UIOpacity,
} from 'cc';
import { StoryManager } from '../StoryManager';
import { IStoryChoice } from '../StoryTypes';
import { DialogConfig } from '../../Dialog/DialogConfig';
import { resourceUtil } from '../../client/Script/easyFramework/mgr/resourceUtil';

const { ccclass, property } = _decorator;

/**
 * 对话参数接口
 */
interface IDialogParams {
    dialogId?: string;          // 对话配置ID
    choices?: IStoryChoice[];   // 选择项
    onComplete?: () => void;    // 完成回调
    onChoice?: (choiceId: string) => void; // 选择回调
}

@ccclass('StoryDialogView')
export class StoryDialogView extends Component {
    // ==================== UI节点绑定 ====================

    /**
     * 全屏遮罩节点
     * 用于接收点击事件推进对话
     */
    @property(Node)
    maskNode: Node = null!;

    /**
     * 对话面板节点
     * 包含头像、名称、内容等UI元素
     */
    @property(Node)
    panelNode: Node = null!;

    /**
     * 角色头像Sprite
     * 显示当前说话角色的头像
     */
    @property(Sprite)
    avatarSprite: Sprite = null!;

    /**
     * 角色名称Label
     * 显示当前说话角色的名字
     */
    @property(Label)
    nameLabel: Label = null!;

    /**
     * 对话内容Label
     * 显示对话文本，建议开启富文本
     */
    @property(Label)
    contentLabel: Label = null!;

    /**
     * 内容点击区域
     * 点击此区域也可推进对话
     */
    @property(Node)
    contentArea: Node = null!;

    /**
     * 选项容器节点
     * 动态生成的选项按钮将放置在此节点下
     */
    @property(Node)
    choiceContainer: Node = null!;

    /**
     * 选项按钮预制体
     * 需要包含Button组件和名为Label的子节点
     */
    @property(Prefab)
    choiceButtonPrefab: Prefab = null!;

    /**
     * 预览提示Label
     * 显示当前可进行的操作提示
     */
    @property(Label)
    previewLabel: Label = null!;

    // ==================== 配置属性 ====================

    /**
     * 打字机速度（每个字间隔秒数）
     */
    @property
    typewriterSpeed: number = 0.03;

    /**
     * 正常文字颜色
     */
    @property
    normalTextColor: Color = new Color(255, 255, 255, 255);

    /**
     * 回忆效果文字颜色
     */
    @property
    flashbackTextColor: Color = new Color(180, 180, 180, 255);

    /**
     * 面板入场动画时间
     */
    @property
    showAnimationDuration: number = 0.3;

    // ==================== 私有状态 ====================

    /** 当前对话配置 */
    private _currentDialogId: string = '';

    /** 当前对话行索引 */
    private _currentLineIndex: number = 0;

    /** 对话行数据 */
    private _dialogLines: any[] = [];

    /** 是否正在打字 */
    private _isTyping: boolean = false;

    /** 完整文本 */
    private _fullText: string = '';

    /** 已显示文本长度 */
    private _shownLength: number = 0;

    /** 是否等待选择 */
    private _waitingChoice: boolean = false;

    /** 当前选择项 */
    private _currentChoices: IStoryChoice[] = [];

    /** 完成回调 */
    private _onComplete: (() => void) | null = null;

    /** 选择回调 */
    private _onChoice: ((choiceId: string) => void) | null = null;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initEventListeners();
        this.hidePanel();
    }

    onDestroy() {
        this.removeEventListeners();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化事件监听
     */
    private initEventListeners(): void {
        // 遮罩点击
        if (this.maskNode) {
            this.maskNode.on(Node.EventType.TOUCH_END, this.onClickNext, this);
        }

        // 内容区域点击
        if (this.contentArea) {
            this.contentArea.on(Node.EventType.TOUCH_END, this.onClickNext, this);
        }
    }

    /**
     * 移除事件监听
     */
    private removeEventListeners(): void {
        if (this.maskNode) {
            this.maskNode.off(Node.EventType.TOUCH_END, this.onClickNext, this);
        }

        if (this.contentArea) {
            this.contentArea.off(Node.EventType.TOUCH_END, this.onClickNext, this);
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 显示对话
     * @param params 对话参数
     * 
     * 示例：
     * ```typescript
     * // 显示指定对话ID的对话
     * dialogView.showDialog({
     *     dialogId: 'intro_1',
     *     onComplete: () => console.log('对话结束'),
     * });
     * 
     * // 显示带选项的对话
     * dialogView.showDialog({
     *     choices: [
     *         { id: 'choice_1', text: '选项1', targetNodeId: 'node_1' },
     *         { id: 'choice_2', text: '选项2', targetNodeId: 'node_2' },
     *     ],
     *     onChoice: (choiceId) => console.log('选择了:', choiceId),
     * });
     * ```
     */
    public showDialog(params: IDialogParams): void {
        this._onComplete = params.onComplete || null;
        this._onChoice = params.onChoice || null;
        this._currentChoices = params.choices || [];
        this._waitingChoice = false;

        // 加载对话配置
        if (params.dialogId) {
            this._currentDialogId = params.dialogId;
            const dialogDef = DialogConfig.getDialog(params.dialogId);

            if (dialogDef && dialogDef.lines) {
                this._dialogLines = dialogDef.lines;
                this._currentLineIndex = 0;
                this.showPanel();
                this.showCurrentLine();
                return;
            } else {
                console.warn(`[StoryDialogView] Dialog not found: ${params.dialogId}`);
            }
        }

        // 没有对话，直接显示选项或完成
        if (this._currentChoices.length > 0) {
            this.showPanel();
            this.showChoices(this._currentChoices);
        } else {
            this.finishDialog();
        }
    }

    /**
     * 隐藏对话面板
     */
    public hideDialog(): void {
        this.hidePanel();
        this.clearState();
    }

    /**
     * 跳过当前打字效果，立即显示完整文本
     */
    public skipTypewriter(): void {
        if (this._isTyping) {
            this._isTyping = false;
            this._shownLength = this._fullText.length;
            this.updateContentLabel();
        }
    }

    // ==================== 显示控制 ====================

    /**
     * 显示面板（带动画）
     */
    private showPanel(): void {
        this.node.active = true;

        if (this.panelNode) {
            // 入场动画
            this.panelNode.setScale(0.8, 0.8, 1);
            const opacity = this.panelNode.getComponent(UIOpacity) || 
                           this.panelNode.addComponent(UIOpacity);
            opacity.opacity = 0;

            tween(this.panelNode)
                .to(this.showAnimationDuration, { scale: new Vec3(1, 1, 1) })
                .start();

            tween(opacity)
                .to(this.showAnimationDuration, { opacity: 255 })
                .start();
        }

        this.updatePreviewLabel('点击继续');
    }

    /**
     * 隐藏面板（带动画）
     */
    private hidePanel(): void {
        if (this.panelNode) {
            tween(this.panelNode)
                .to(this.showAnimationDuration * 0.5, { scale: new Vec3(0.8, 0.8, 1) })
                .call(() => {
                    this.node.active = false;
                })
                .start();
        } else {
            this.node.active = false;
        }
    }

    // ==================== 对话显示 ====================

    /**
     * 显示当前对话行
     */
    private showCurrentLine(): void {
        if (this._currentLineIndex >= this._dialogLines.length) {
            // 对话结束，检查是否有选择项
            if (this._currentChoices.length > 0) {
                this.showChoices(this._currentChoices);
            } else {
                this.finishDialog();
            }
            return;
        }

        const line = this._dialogLines[this._currentLineIndex];

        // 更新角色名称
        if (this.nameLabel) {
            this.nameLabel.string = line.name || '';
        }

        // 更新头像
        this.updateAvatar(line.avatarPath);

        // 设置文字颜色（回忆效果）
        const isFlashback = line.isFlashback;
        if (this.nameLabel) {
            this.nameLabel.color = isFlashback ? this.flashbackTextColor : this.normalTextColor;
        }
        if (this.contentLabel) {
            this.contentLabel.color = isFlashback ? this.flashbackTextColor : this.normalTextColor;
        }

        // 开始打字机效果
        this.startTypewriter(line.text || '');

        // 播放音效
        if (line.voicePath) {
            // TODO: 播放配音
        }
        if (line.sfxPath) {
            // TODO: 播放音效
        }

        // 检查该行是否有选择项
        if (line.choices && line.choices.length > 0) {
            this._currentChoices = line.choices.map((c: any) => ({
                id: c.targetDialogId || `choice_${Math.random()}`,
                text: c.text,
                targetNodeId: c.targetDialogId || '',
                condition: c.condition,
            }));
        }

        this.updatePreviewLabel('点击继续');
    }

    /**
     * 更新头像显示
     */
    private updateAvatar(avatarPath?: string): void {
        if (!this.avatarSprite) return;

        if (avatarPath) {
            resourceUtil.setSpriteFrame(avatarPath, this.avatarSprite, (err) => {
                if (err) {
                    console.warn('[StoryDialogView] Avatar load failed:', avatarPath);
                    this.avatarSprite.spriteFrame = null;
                }
            });
        } else {
            this.avatarSprite.spriteFrame = null;
        }
    }

    // ==================== 打字机效果 ====================

    /**
     * 开始打字机效果
     * @param text 要显示的文本
     */
    private startTypewriter(text: string): void {
        this._fullText = text;
        this._shownLength = 0;
        this._isTyping = true;

        if (this.contentLabel) {
            this.contentLabel.string = '';
        }

        this.unschedule(this.updateTypewriter);
        this.schedule(this.updateTypewriter, this.typewriterSpeed);
    }

    /**
     * 打字机更新回调
     */
    private updateTypewriter = (): void => {
        if (!this._isTyping) {
            this.unschedule(this.updateTypewriter);
            return;
        }

        this._shownLength++;

        if (this._shownLength >= this._fullText.length) {
            this._shownLength = this._fullText.length;
            this._isTyping = false;
            this.unschedule(this.updateTypewriter);

            // 如果有选择项，显示选择
            if (this._currentChoices.length > 0 &&
                this._currentLineIndex >= this._dialogLines.length - 1) {
                this.scheduleOnce(() => this.showChoices(this._currentChoices), 0.3);
            }
        }

        this.updateContentLabel();
    };

    /**
     * 更新内容Label显示
     */
    private updateContentLabel(): void {
        if (this.contentLabel) {
            this.contentLabel.string = this._fullText.slice(0, this._shownLength);
        }
    }

    // ==================== 选择分支 ====================

    /**
     * 显示选择项
     * @param choices 选择项列表
     * 
     * 示例选择项：
     * ```typescript
     * const choices = [
     *     { id: 'choice_1', text: '向前探索', targetNodeId: 'node_explore' },
     *     { id: 'choice_2', text: '原地等待', targetNodeId: 'node_wait' },
     * ];
     * showChoices(choices);
     * ```
     */
    private showChoices(choices: IStoryChoice[]): void {
        if (!this.choiceContainer) {
            console.warn('[StoryDialogView] ChoiceContainer not bound');
            return;
        }

        this._waitingChoice = true;
        this.clearChoiceButtons();

        // 过滤满足条件的选项
        const availableChoices = choices.filter(choice => {
            if (!choice.condition) return true;
            return StoryManager.instance.evaluateCondition?.(choice.condition) ?? true;
        });

        // 生成选项按钮
        for (const choice of availableChoices) {
            const buttonNode = this.createChoiceButton(choice);
            if (buttonNode) {
                this.choiceContainer.addChild(buttonNode);

                // 入场动画
                buttonNode.setScale(0.8, 0.8, 1);
                const opacity = buttonNode.getComponent(UIOpacity) ||
                               buttonNode.addComponent(UIOpacity);
                opacity.opacity = 0;

                const delay = availableChoices.indexOf(choice) * 0.1;
                tween(buttonNode)
                    .delay(delay)
                    .to(0.2, { scale: new Vec3(1, 1, 1) })
                    .start();
                tween(opacity)
                    .delay(delay)
                    .to(0.2, { opacity: 255 })
                    .start();
            }
        }

        this.updatePreviewLabel('请选择...');
    }

    /**
     * 创建选择按钮
     */
    private createChoiceButton(choice: IStoryChoice): Node | null {
        if (!this.choiceButtonPrefab) {
            console.warn('[StoryDialogView] ChoiceButtonPrefab not set');
            return null;
        }

        const buttonNode = instantiate(this.choiceButtonPrefab);
        if (!buttonNode) return null;

        // 设置按钮文字
        const label = buttonNode.getComponentInChildren(Label);
        if (label) {
            label.string = choice.text;
        }

        // 绑定点击事件
        const button = buttonNode.getComponent(Button);
        if (button) {
            button.node.on(
                Node.EventType.TOUCH_END,
                () => this.onChoiceSelected(choice),
                this
            );
        }

        return buttonNode;
    }

    /**
     * 处理选择
     */
    private onChoiceSelected(choice: IStoryChoice): void {
        this._waitingChoice = false;
        this.clearChoiceButtons();

        // 调用选择回调
        if (this._onChoice) {
            this._onChoice(choice.id);
        }

        // 继续剧情
        if (choice.targetNodeId) {
            // 跳转到目标节点
            StoryManager.instance.playNode(choice.targetNodeId, this._onComplete);
            this.hideDialog();
        } else {
            // 继续当前对话
            this._currentLineIndex++;
            this.showCurrentLine();
        }
    }

    /**
     * 清除所有选择按钮
     */
    private clearChoiceButtons(): void {
        if (this.choiceContainer) {
            this.choiceContainer.removeAllChildren();
        }
    }

    // ==================== 点击处理 ====================

    /**
     * 点击下一步
     */
    private onClickNext(): void {
        // 等待选择时不允许点击推进
        if (this._waitingChoice) return;

        // 正在打字时，跳过打字效果
        if (this._isTyping) {
            this.skipTypewriter();
            return;
        }

        // 推进到下一行
        this._currentLineIndex++;
        this.showCurrentLine();
    }

    // ==================== 完成处理 ====================

    /**
     * 完成对话
     */
    private finishDialog(): void {
        this.hidePanel();

        if (this._onComplete) {
            const callback = this._onComplete;
            this._onComplete = null;
            callback();
        }

        this.clearState();
    }

    /**
     * 清除状态
     */
    private clearState(): void {
        this._dialogLines = [];
        this._currentLineIndex = 0;
        this._isTyping = false;
        this._waitingChoice = false;
        this._currentChoices = [];
        this._onComplete = null;
        this._onChoice = null;
        this.unschedule(this.updateTypewriter);
    }

    /**
     * 更新预览提示
     */
    private updatePreviewLabel(text: string): void {
        if (this.previewLabel) {
            this.previewLabel.string = text;
        }
    }

    // ==================== 条件评估 ====================

    /**
     * 评估条件表达式
     * 简化版，支持基本的布尔和数值比较
     */
    public evaluateCondition(expr: string): boolean {
        // 使用StoryFlagManager评估条件
        try {
            // 简单实现：检查标记是否存在
            return StoryManager.instance['evaluateCondition']?.(expr) ?? true;
        } catch {
            return true;
        }
    }
}
