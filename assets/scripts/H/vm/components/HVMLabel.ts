import { _decorator, Label } from 'cc';
import { HVMBase } from './HVMBase';

const { ccclass, property } = _decorator;

/**
 * HVMLabel 把 VM 字段自动显示到 Label.string。
 *
 * 常见用途：
 * - 金币数量
 * - 昵称
 * - 等级
 * - 倒计时文案
 */
@ccclass('HVMLabel')
export class HVMLabel extends HVMBase<unknown> {
    @property({ type: Label, tooltip: '目标 Label。不填时默认取当前节点上的 Label。' })
    public targetLabel: Label | null = null;

    @property({ tooltip: '字段不存在时显示的默认文本。' })
    public defaultText = '';

    @property({ tooltip: '显示模板，例如 金币：{value}。' })
    public template = '{value}';

    @property({ tooltip: '数值小数位。-1 表示不处理。' })
    public digits = -1;

    /**
     * 获取默认值。
     *
     * @returns 类型 string，字段不存在时显示 defaultText。
     */
    protected getDefaultValue(): string {
        return this.defaultText;
    }

    /**
     * VM 值变化时刷新 Label。
     *
     * @param value 类型 unknown，作用是 VM 当前字段值。
     */
    protected refreshValue(value: unknown): void {
        const label = this.getLabel();
        if (!label) {
            return;
        }

        label.string = this.formatText(value);
    }

    private getLabel(): Label | null {
        return this.targetLabel || this.node.getComponent(Label);
    }

    private formatText(value: unknown): string {
        let nextValue = value === undefined || value === null ? this.defaultText : value;
        if (typeof nextValue === 'number' && this.digits >= 0) {
            nextValue = nextValue.toFixed(Math.max(0, Math.floor(this.digits)));
        }

        const text = String(nextValue);
        return this.template
            ? this.template.replace(/\{value\}/g, text)
            : text;
    }
}
