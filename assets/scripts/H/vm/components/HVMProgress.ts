import { _decorator, ProgressBar } from 'cc';
import { HVMBase } from './HVMBase';

const { ccclass, property } = _decorator;

/**
 * HVMProgress 把 VM 数值字段绑定到 ProgressBar.progress。
 *
 * 默认把字段值当作 0-1 的进度。
 * 如果字段是 0-100，可以把 maxValue 设置为 100。
 */
@ccclass('HVMProgress')
export class HVMProgress extends HVMBase<unknown> {
    @property({ type: ProgressBar, tooltip: '目标 ProgressBar。不填时默认取当前节点上的 ProgressBar。' })
    public targetProgress: ProgressBar | null = null;

    @property({ tooltip: '最大值。字段值会除以 maxValue 得到 0-1 进度。' })
    public maxValue = 1;

    @property({ tooltip: '字段不存在时使用的默认值。' })
    public defaultValue = 0;

    /**
     * 获取默认值。
     *
     * @returns 类型 number，字段不存在时的默认进度值。
     */
    protected getDefaultValue(): number {
        return this.defaultValue;
    }

    /**
     * VM 值变化时刷新 ProgressBar。
     *
     * @param value 类型 unknown，作用是 VM 当前字段值。
     */
    protected refreshValue(value: unknown): void {
        const progress = this.getProgress();
        if (!progress) {
            return;
        }

        const raw = Number(value ?? this.defaultValue);
        const max = Math.max(0.00001, Number(this.maxValue) || 1);
        progress.progress = this.clamp01(raw / max);
    }

    private getProgress(): ProgressBar | null {
        return this.targetProgress || this.node.getComponent(ProgressBar);
    }

    private clamp01(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(1, value));
    }
}
