// 条件表达式解析与评估工具

export type LogicOp = 'AND' | 'OR';

export type CompareOp = '>' | '>=' | '<' | '<=' | '==' | '!=';

export interface MetricCondition {
    key: string;
    op: CompareOp;
    value: number;
}

export interface ParsedExpression {
    logic: LogicOp;
    conditions: MetricCondition[];
}

/** 从任务系统外部拿 metric 值的函数类型 */
export type MetricGetter = (key: string) => number;

/**
 * 任务/成就条件表达式工具。
 * 语法示例：
 *   "kill_monster>=10 && level>=5"
 *   "login_days>=3 || vip_level>=1"
 *
 * 约束：
 * - 不支持括号
 * - 不支持同时混用 && 和 ||
 * - 每个原子条件必须是：标识符 + 比较符 + 整数
 */
export class TaskExpression {
    public static evaluate(expr: string | undefined, getMetric: MetricGetter): boolean {
        if (!expr || !expr.trim()) {
            // 空表达式视为“恒真”
            return true;
        }

        const parsed = TaskExpression.parse(expr);
        if (!parsed) {
            // 解析失败时，出于安全考虑，视为未达成
            return false;
        }

        const results = parsed.conditions.map((cond) => {
            const value = getMetric(cond.key);
            switch (cond.op) {
                case '>':  return value > cond.value;
                case '>=': return value >= cond.value;
                case '<':  return value < cond.value;
                case '<=': return value <= cond.value;
                case '==': return value === cond.value;
                case '!=': return value !== cond.value;
                default:
                    return false;
            }
        });

        if (parsed.logic === 'AND') {
            return results.every((flag) => flag);
        } else {
            return results.some((flag) => flag);
        }
    }

    public static parse(expr: string): ParsedExpression | null {
        const trimmed = expr.replace(/\s+/g, '');
        if (!trimmed) {
            return { logic: 'AND', conditions: [] };
        }

        let logic: LogicOp = 'AND';
        let parts: string[] = [];

        if (trimmed.indexOf('||') >= 0) {
            logic = 'OR';
            parts = trimmed.split('||');
        } else if (trimmed.indexOf('&&') >= 0) {
            logic = 'AND';
            parts = trimmed.split('&&');
        } else {
            parts = [trimmed];
        }

        const conditions: MetricCondition[] = [];
        const regex = /^([A-Za-z0-9_]+)(>=|<=|==|!=|>|<)(-?\d+)$/;

        for (const part of parts) {
            const match = regex.exec(part);
            if (!match) {
                console.warn('[TaskExpression] Unsupported condition segment:', part, 'in expr:', expr);
                return null;
            }
            const key = match[1];
            const op = match[2] as CompareOp;
            const value = Number(match[3]);

            conditions.push({ key, op, value });
        }

        return { logic, conditions };
    }
}

