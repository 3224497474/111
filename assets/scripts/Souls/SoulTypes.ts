import type { IUnitAttributes } from '../battle/Types';

export enum SoulRarity {
    COMMON = 'common',
    ELITE = 'elite',
    BOSS = 'boss',
    LEGENDARY = 'legendary',
}

export enum SoulSlotType {
    Main = 'main',
    Sub1 = 'sub_1',
    Sub2 = 'sub_2',
}

export interface ISoulData {
    soulId: string;
    templateId: number;
    monsterId: number;
    rarity: SoulRarity;
    name?: string;
    icon?: string;
    attributes: Partial<IUnitAttributes>;
    tags?: string[];
    metadata?: Record<string, string | number | boolean>;
}

export interface ISoulOperationResult {
    success: boolean;
    message: string;
}

export interface ISoulSlotState {
    slotType: SoulSlotType;
    soul: ISoulData | null;
}

export const SOUL_SLOT_ORDER: ReadonlyArray<SoulSlotType> = [
    SoulSlotType.Main,
    SoulSlotType.Sub1,
    SoulSlotType.Sub2,
];
