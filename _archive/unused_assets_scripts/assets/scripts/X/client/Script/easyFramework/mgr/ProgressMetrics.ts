// 公共进度计数中心：任务与成就共享的 metric 存储

export class ProgressMetrics {
    private static _instance: ProgressMetrics | null = null;

    public static get instance(): ProgressMetrics {
        if (!this._instance) {
            this._instance = new ProgressMetrics();
        }
        return this._instance;
    }

    private _values: Record<string, number> = {};

    /** 清空所有计数（例如开发调试或强制重置时使用） */
    public clear(): void {
        this._values = {};
    }

    /** 在当前值基础上增加 delta，返回新值 */
    public update(metricKey: string, delta: number): number {
        const current = this.get(metricKey);
        const next = current + delta;
        this._values[metricKey] = next;
        return next;
    }

    /** 直接设置某个 metric 的值 */
    public set(metricKey: string, value: number): void {
        this._values[metricKey] = value;
    }

    /** 获取某个 metric 的当前值（不存在时返回 0） */
    public get(metricKey: string): number {
        const value = this._values[metricKey];
        return typeof value === 'number' ? value : 0;
    }
}

