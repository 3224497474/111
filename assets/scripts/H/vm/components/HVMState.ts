import { _decorator, Enum, Node } from 'cc';
import { HVMBase } from './HVMBase';

const { ccclass, property } = _decorator;

/**
 * VM 状态判断条件。
 */
export enum HVMStateCondition {
    Truthy = 0,
    Falsy = 1,
    Equal = 2,
    NotEqual = 3,
    Greater = 4,
    GreaterEqual = 5,
    Less = 6,
    LessEqual = 7,
    In = 8,
    NotIn = 9,
    Empty = 10,
    NotEmpty = 11,
}

export const HVMStateConditionEnum = Enum(HVMStateCondition);

/**
 * HVMState 根据 VM 字段控制节点显示隐藏。
 *
 * 常见用途：
 * - 红点显示
 * - 未解锁遮罩
 * - 按钮是否可见
 * - 状态图标切换
 */
@ccclass('HVMState')
export class HVMState extends HVMBase<unknown> {
    @property({ type: Node, tooltip: '要控制显隐的节点。不填时控制当前节点。' })
    public targetNode: Node | null = null;

    @property({ type: HVMStateConditionEnum, tooltip: '显示条件。' })
    public condition: HVMStateCondition = HVMStateCondition.Truthy;

    @property({ tooltip: '比较值。Equal/Greater/In 等条件会使用。' })
    public compareValue = '';

    @property({ tooltip: '条件成立时节点是否显示。关闭后表示条件成立时隐藏。' })
    public activeWhenTrue = true;

    /**
     * VM 值变化时刷新节点 active。
     *
     * @param value 类型 unknown，作用是 VM 当前字段值。
     */
    protected refreshValue(value: unknown): void {
        const node = this.targetNode || this.node;
        const matched = this.match(value);
        node.active = this.activeWhenTrue ? matched : !matched;
    }

    private match(value: unknown): boolean {
        switch (this.condition) {
            case HVMStateCondition.Truthy:
                return !!value;
            case HVMStateCondition.Falsy:
                return !value;
            case HVMStateCondition.Equal:
                return this.toComparable(value) === this.compareValue;
            case HVMStateCondition.NotEqual:
                return this.toComparable(value) !== this.compareValue;
            case HVMStateCondition.Greater:
                return Number(value) > Number(this.compareValue);
            case HVMStateCondition.GreaterEqual:
                return Number(value) >= Number(this.compareValue);
            case HVMStateCondition.Less:
                return Number(value) < Number(this.compareValue);
            case HVMStateCondition.LessEqual:
                return Number(value) <= Number(this.compareValue);
            case HVMStateCondition.In:
                return this.parseList().includes(this.toComparable(value));
            case HVMStateCondition.NotIn:
                return !this.parseList().includes(this.toComparable(value));
            case HVMStateCondition.Empty:
                return this.isEmpty(value);
            case HVMStateCondition.NotEmpty:
                return !this.isEmpty(value);
            default:
                return !!value;
        }
    }

    private toComparable(value: unknown): string {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value);
    }

    private parseList(): string[] {
        return this.compareValue
            .split(',')
            .map((item) => item.trim())
            .filter((item) => !!item);
    }

    private isEmpty(value: unknown): boolean {
        if (value === undefined || value === null || value === '') {
            return true;
        }
        if (Array.isArray(value)) {
            return value.length <= 0;
        }
        if (typeof value === 'object') {
            return Object.keys(value as Record<string, unknown>).length <= 0;
        }
        return false;
    }
}
