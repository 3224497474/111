import { _decorator, Component, Label, ProgressBar } from "cc";
import { HomeStatusModel, HomeStatusSnapshot } from "./HomeStatusModel";

const { ccclass, property } = _decorator;

/**
 * HOME-INFO：
 * Home 场景中用于展示“等级 / 经验 / 体力 / 心情 / 金钱 / 关键属性”的 UI 组件。
 *
 * 使用方式：
 * - 将脚本挂在 Home 场景中的某个状态面板节点上；
 * - 在编辑器中把对应的 Label / ProgressBar 拖到属性上；
 * - 不需要手动更新，HomeStatusModel 状态变化时会自动刷新 UI。
 */
@ccclass("HomeStatusView")
export class HomeStatusView extends Component {
    /** 等级文本（例如：Lv.5） */
    @property(Label)
    public levelLabel: Label | null = null;

    /** 经验文本（例如：120 / 300） */
    @property(Label)
    public expLabel: Label | null = null;

    /** 经验进度条（0~1） */
    @property(ProgressBar)
    public expProgressBar: ProgressBar | null = null;

    /** 体力文本（例如：体力 80 / 100） */
    @property(Label)
    public staminaLabel: Label | null = null;

    /** 心情文本（例如：心情 60 / 100） */
    @property(Label)
    public moodLabel: Label | null = null;

    /** 金钱文本（例如：¥ 123） */
    @property(Label)
    public moneyLabel: Label | null = null;

    /** 力量属性展示标签 */
    @property(Label)
    public strengthLabel: Label | null = null;

    /** 智力属性展示标签 */
    @property(Label)
    public intelligenceLabel: Label | null = null;

    /** 魅力属性展示标签 */
    @property(Label)
    public charmLabel: Label | null = null;

    /** 善良属性展示标签 */
    @property(Label)
    public kindnessLabel: Label | null = null;

    /** Home 状态模型单例引用 */
    private model: HomeStatusModel | null = null;

    /** 状态变化回调引用（用于取消订阅） */
    private onStatusChangedCallback:
        | ((snapshot: HomeStatusSnapshot) => void)
        | null = null;

    /**
     * 生命周期：组件加载。
     * - 获取 HomeStatusModel 单例；
     * - 注册状态变化回调；
     * - 立即刷新一次当前状态。
     */
    onLoad() {
        this.model = HomeStatusModel.instance;
        this.onStatusChangedCallback = this.onStatusChanged.bind(this);
        this.model.onStatusChanged(this.onStatusChangedCallback);

        const snapshot = this.model.getSnapshot();
        this.refresh(snapshot);
    }

    /**
     * 生命周期：组件销毁。
     * - 取消订阅状态回调，避免内存泄漏。
     */
    onDestroy() {
        if (this.model && this.onStatusChangedCallback) {
            this.model.offStatusChanged(this.onStatusChangedCallback);
        }
        this.model = null;
        this.onStatusChangedCallback = null;
    }

    /**
     * 订阅回调：当 HomeStatusModel 状态变化时被调用。
     */
    private onStatusChanged(snapshot: HomeStatusSnapshot): void {
        this.refresh(snapshot);
    }

    /**
     * 刷新 UI 展示，使其与快照数据保持同步。
     */
    private refresh(snapshot: HomeStatusSnapshot): void {
        if (this.levelLabel) {
            this.levelLabel.string = "Lv." + snapshot.level;
        }

        if (this.expLabel) {
            this.expLabel.string =
                snapshot.currentExp + " / " + snapshot.expForNextLevel;
        }

        if (this.expProgressBar) {
            if (snapshot.expForNextLevel > 0) {
                this.expProgressBar.progress =
                    snapshot.currentExp / snapshot.expForNextLevel;
            } else {
                this.expProgressBar.progress = 1;
            }
        }

        if (this.staminaLabel) {
            this.staminaLabel.string =
                "体力 " + snapshot.stamina + " / " + snapshot.maxStamina;
        }

        if (this.moodLabel) {
            this.moodLabel.string =
                "心情 " + snapshot.mood + " / " + snapshot.maxMood;
        }

        if (this.moneyLabel) {
            this.moneyLabel.string = "¥ " + snapshot.money;
        }

        if (this.strengthLabel) {
            this.strengthLabel.string = "力量 " + snapshot.strength;
        }

        if (this.intelligenceLabel) {
            this.intelligenceLabel.string = "智力 " + snapshot.intelligence;
        }

        if (this.charmLabel) {
            this.charmLabel.string = "魅力 " + snapshot.charm;
        }

        if (this.kindnessLabel) {
            this.kindnessLabel.string = "善良 " + snapshot.kindness;
        }
    }
}

