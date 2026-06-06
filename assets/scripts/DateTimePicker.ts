import { _decorator, Component, Node, Button, Label, Vec3, Color } from "cc";
import { ScrollSelector } from "./ScrollSelector";
const { ccclass, property } = _decorator;

export interface DateTimePickerResult {
    month: number;  // 1-12
    day: number;    // 1-31
    monthStr: string;
    dayStr: string;
}

export type DateTimePickerCallback = (result: DateTimePickerResult | null) => void;

@ccclass
export class DateTimePicker extends Component {
    @property({
        type: Node
    })
    monthSelectorNode: Node = null!;

    @property({
        type: Node
    })
    daySelectorNode: Node = null!;

    @property({
        type: Button
    })
    confirmButton: Button = null!;

    @property({
        type: Button
    })
    cancelButton: Button = null!;

    @property({
        type: Label
    })
    titleLabel: Label = null!;

    private monthSelector: ScrollSelector | null = null;
    private daySelector: ScrollSelector | null = null;
    private callback: DateTimePickerCallback | null = null;
    private monthData: string[] = [];
    private dayData: string[] = [];

    onLoad() {
        this.initSelectors();
        this.setupButtons();
    }

    /**
     * 初始化选择器
     */
    private initSelectors() {
        this.monthSelector = this.monthSelectorNode?.getComponent(ScrollSelector) ?? null;
        this.daySelector = this.daySelectorNode?.getComponent(ScrollSelector) ?? null;

        if (!this.monthSelector || !this.daySelector) {
            console.error("DateTimePicker: Missing ScrollSelector components");
            return;
        }

        // 初始化月份数据 (1-12)
        this.monthData = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const monthStr = month < 10 ? '0' + month : '' + month;
            return `${monthStr} 月`;
        });

        // 初始化日期数据 (1-31)
        this.generateDayData(31);

        // 设置初始值
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate() - 1;

        this.monthSelector.setData(this.monthData, currentMonth);
        this.daySelector.setData(this.dayData, Math.min(currentDay, 30));
    }

    /**
     * 生成日期数据
     * @param maxDays 最大天数
     */
    private generateDayData(maxDays: number) {
        this.dayData = Array.from({ length: maxDays }, (_, i) => {
            const day = i + 1;
            const dayStr = day < 10 ? '0' + day : '' + day;
            return `${dayStr} 日`;
        });
    }

    /**
     * 设置按钮事件
     */
    private setupButtons() {
        if (this.confirmButton) {
            this.confirmButton.node.on(Button.EventType.CLICK, this.onConfirm, this);
        }
        if (this.cancelButton) {
            this.cancelButton.node.on(Button.EventType.CLICK, this.onCancel, this);
        }
    }

    /**
     * 确认按钮点击
     */
    private onConfirm() {
        if (!this.monthSelector || !this.daySelector) return;

        const monthIndex = this.monthSelector.getSelectedIndex();
        const dayIndex = this.daySelector.getSelectedIndex();

        const result: DateTimePickerResult = {
            month: monthIndex + 1,
            day: dayIndex + 1,
            monthStr: this.monthSelector.getSelectedValue(),
            dayStr: this.daySelector.getSelectedValue(),
        };

        if (this.callback) {
            this.callback(result);
        }

        // 关闭选择器
        this.close();
    }

    /**
     * 取消按钮点击
     */
    private onCancel() {
        if (this.callback) {
            this.callback(null);
        }
        this.close();
    }

    /**
     * 打开日期选择器
     * @param callback 回调函数
     * @param initialMonth 初始月份 (1-12)
     * @param initialDay 初始日期 (1-31)
     */
    public open(callback: DateTimePickerCallback, initialMonth?: number, initialDay?: number) {
        this.callback = callback;
        this.node.active = true;

        if (this.monthSelector && initialMonth) {
            this.monthSelector.setData(this.monthData, Math.max(0, initialMonth - 1));
        }

        if (this.daySelector && initialDay) {
            this.daySelector.setData(this.dayData, Math.max(0, initialDay - 1));
        }
    }

    /**
     * 关闭日期选择器
     */
    public close() {
        this.node.active = false;
        this.callback = null;
    }

    /**
     * 获取当前选中的日期
     */
    public getCurrentSelection(): DateTimePickerResult | null {
        if (!this.monthSelector || !this.daySelector) return null;

        return {
            month: this.monthSelector.getSelectedIndex() + 1,
            day: this.daySelector.getSelectedIndex() + 1,
            monthStr: this.monthSelector.getSelectedValue(),
            dayStr: this.daySelector.getSelectedValue(),
        };
    }

    onDestroy() {
        if (this.confirmButton) {
            this.confirmButton.node.off(Button.EventType.CLICK, this.onConfirm, this);
        }
        if (this.cancelButton) {
            this.cancelButton.node.off(Button.EventType.CLICK, this.onCancel, this);
        }
    }
}
