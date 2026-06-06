import { RUNE_SLOT_COUNT, RuneSlotType, type IRuneSlotState } from './RuneTypes';

type SlotList = Array<number | null>;

/**
 * 单个角色的符纹槽方案。
 * 一个 roleId 对应一个 RuneLoadout。
 */
export class RuneLoadout {
    private readonly slots: Record<RuneSlotType, SlotList> = {
        [RuneSlotType.ATTRIBUTE]: new Array<number | null>(RUNE_SLOT_COUNT.attribute).fill(null),
        [RuneSlotType.CHARGE]: new Array<number | null>(RUNE_SLOT_COUNT.charge).fill(null),
        [RuneSlotType.SKILL]: new Array<number | null>(RUNE_SLOT_COUNT.skill).fill(null),
        [RuneSlotType.ULTIMATE]: new Array<number | null>(RUNE_SLOT_COUNT.ultimate).fill(null),
    };

    /** 获取某类槽位总数。 */
    public getSlotCount(slotType: RuneSlotType): number {
        return this.slots[slotType].length;
    }

    /** 获取某个槽位当前装着的 runeId。 */
    public getSlotRune(slotType: RuneSlotType, slotIndex: number): number | null {
        if (slotIndex < 0 || slotIndex >= this.slots[slotType].length) return null;
        return this.slots[slotType][slotIndex];
    }

    /** 设置槽位上的 runeId。 */
    public setSlotRune(slotType: RuneSlotType, slotIndex: number, runeId: number | null): boolean {
        if (slotIndex < 0 || slotIndex >= this.slots[slotType].length) return false;
        this.slots[slotType][slotIndex] = runeId;
        return true;
    }

    /** 清空指定槽位。 */
    public clearSlot(slotType: RuneSlotType, slotIndex: number): boolean {
        return this.setSlotRune(slotType, slotIndex, null);
    }

    /** 找到第一个空槽，用于自动装备。 */
    public findFirstEmptySlot(slotType: RuneSlotType): number {
        return this.slots[slotType].findIndex((value) => value === null);
    }

    /** 返回某类槽位的只读数组。 */
    public getSlots(slotType: RuneSlotType): ReadonlyArray<number | null> {
        return this.slots[slotType];
    }

    /** 取出完整槽位快照，便于存档或调试。 */
    public getAllSlots(): IRuneSlotState[] {
        const result: IRuneSlotState[] = [];
        const slotTypes = [
            RuneSlotType.ATTRIBUTE,
            RuneSlotType.CHARGE,
            RuneSlotType.SKILL,
            RuneSlotType.ULTIMATE,
        ];

        for (const slotType of slotTypes) {
            const list = this.slots[slotType];
            for (let i = 0; i < list.length; i++) {
                result.push({
                    slotType,
                    slotIndex: i,
                    runeId: list[i],
                });
            }
        }

        return result;
    }
}
