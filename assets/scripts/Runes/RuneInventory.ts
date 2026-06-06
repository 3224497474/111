import { DEFAULT_RUNE_BAG_CAPACITY, type IRuneDefinition, type IRuneInventoryStack } from './RuneTypes';

/**
 * 符纹背包数据层。
 * 只负责堆叠和容量计算，不负责 UI，也不关心角色槽位。
 */
export class RuneInventory {
    private capacity: number;
    private readonly stacks: IRuneInventoryStack[] = [];

    constructor(
        /** 通过外部回调获取符纹定义，避免这里持有完整系统。 */
        private readonly getDefinition: (runeId: number) => IRuneDefinition | undefined,
        initialCapacity: number = DEFAULT_RUNE_BAG_CAPACITY,
    ) {
        this.capacity = Math.max(1, initialCapacity);
    }

    /** 获取背包总容量。 */
    public getCapacity(): number {
        return this.capacity;
    }

    /** 直接设置背包容量。 */
    public setCapacity(nextCapacity: number): void {
        this.capacity = Math.max(1, nextCapacity);
    }

    /** 扩容接口，后续可以接奖励、商店或成长系统。 */
    public expandCapacity(extraSlots: number): void {
        if (extraSlots <= 0) return;
        this.capacity += extraSlots;
    }

    /** 已占用的格子数。一个堆叠占一个格子。 */
    public getUsedSlots(): number {
        return this.stacks.length;
    }

    /** 返回拷贝，避免外部直接修改内部数组。 */
    public getStacks(): IRuneInventoryStack[] {
        return this.stacks.map((stack) => ({ ...stack }));
    }

    public replaceStacks(stacks: readonly IRuneInventoryStack[]): void {
        this.stacks.length = 0;
        for (const stack of stacks) {
            this.stacks.push({
                runeId: stack.runeId,
                count: stack.count,
            });
        }
    }

    public clear(): void {
        this.stacks.length = 0;
    }

    /** 统计某个 runeId 在背包中的总数量。 */
    public getRuneCount(runeId: number): number {
        return this.stacks
            .filter((stack) => stack.runeId === runeId)
            .reduce((sum, stack) => sum + stack.count, 0);
    }

    /** 判断背包是否还能放入指定数量的符纹。 */
    public canAddRune(runeId: number, count: number = 1): boolean {
        if (count <= 0) return true;

        const definition = this.getDefinition(runeId);
        if (!definition) return false;

        let remaining = count;
        for (const stack of this.stacks) {
            if (stack.runeId !== runeId) continue;
            const room = definition.maxStack - stack.count;
            if (room <= 0) continue;
            remaining -= Math.min(room, remaining);
            if (remaining <= 0) {
                return true;
            }
        }

        const extraStacks = Math.ceil(remaining / definition.maxStack);
        return this.stacks.length + extraStacks <= this.capacity;
    }

    /**
     * 加入背包。
     * 会优先往已有堆叠里补，补不下时再新开格子。
     */
    public addRune(runeId: number, count: number = 1): boolean {
        if (count <= 0) return true;
        if (!this.canAddRune(runeId, count)) return false;

        const definition = this.getDefinition(runeId);
        if (!definition) return false;

        let remaining = count;
        for (const stack of this.stacks) {
            if (stack.runeId !== runeId || remaining <= 0) continue;
            const room = definition.maxStack - stack.count;
            if (room <= 0) continue;
            const addCount = Math.min(room, remaining);
            stack.count += addCount;
            remaining -= addCount;
        }

        while (remaining > 0) {
            const addCount = Math.min(definition.maxStack, remaining);
            this.stacks.push({ runeId, count: addCount });
            remaining -= addCount;
        }

        return true;
    }

    /** 从背包扣除指定数量。 */
    public removeRune(runeId: number, count: number = 1): boolean {
        if (count <= 0) return true;
        if (this.getRuneCount(runeId) < count) return false;

        let remaining = count;
        for (let i = this.stacks.length - 1; i >= 0 && remaining > 0; i--) {
            const stack = this.stacks[i];
            if (stack.runeId !== runeId) continue;
            const removeCount = Math.min(stack.count, remaining);
            stack.count -= removeCount;
            remaining -= removeCount;
            if (stack.count <= 0) {
                this.stacks.splice(i, 1);
            }
        }

        return remaining === 0;
    }
}
