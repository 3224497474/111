import { ConfigManager } from '../../config/ConfigManager';
import { CurrencyType } from '../../EconomicSystem/EconomicTypes';
import { SoulSystem } from '../../Souls/SoulSystem';
import { SoulRarity, type ISoulData } from '../../Souls/SoulTypes';
import { EconomyFacade } from './EconomyFacade';
import { ProgressFacade, type ICommerceRewardItem, type IGachaPoolState } from './ProgressFacade';

type PoolIdLike = string | number;

type SoulRow = {
    id: string | number;
    name?: string;
    cost?: number | string;
    tags?: string | string[];
};

export class GachaFacade {
    private static readonly DEFAULT_POOL_ID = 'standard';
    private static readonly DEFAULT_TICKET_ITEM_ID = 'gacha_ticket';
    private static readonly SINGLE_PULL_DIAMOND_COST = 100;
    private static readonly TEN_PULL_DIAMOND_COST = 900;
    private static readonly PITY_THRESHOLD = 30;
    private rewardSequence = 0;

    constructor(
        private readonly economyFacade: EconomyFacade,
        private readonly progressFacade: ProgressFacade,
        private readonly soulSystem: SoulSystem,
    ) {}

    public getPoolState(poolId: PoolIdLike): IGachaPoolState {
        return this.progressFacade.getGachaPoolState(this.normalizePoolId(poolId));
    }

    public gachaSummon(poolId: PoolIdLike, isTenPull: boolean): ICommerceRewardItem[] {
        const normalizedPoolId = this.normalizePoolId(poolId);
        const pullCount = isTenPull ? 10 : 1;
        const soulPool = this.getSoulPool(normalizedPoolId);
        if (soulPool.length === 0) {
            console.error(`[GachaFacade] Soul pool is empty: ${normalizedPoolId}`);
            return [];
        }

        if (!this.consumeSummonCost(pullCount)) {
            return [];
        }

        const rolledRows = this.rollSoulRows(normalizedPoolId, soulPool, pullCount);
        if (rolledRows.length === 0) {
            return [];
        }

        const rewards = rolledRows.map((row) => this.grantSoulReward(row));
        this.progressFacade.recordGachaSummon(normalizedPoolId, rewards, pullCount);
        return rewards;
    }

    private consumeSummonCost(pullCount: number): boolean {
        if (this.economyFacade.hasItem(GachaFacade.DEFAULT_TICKET_ITEM_ID, pullCount)) {
            return this.economyFacade.consumeItem(
                GachaFacade.DEFAULT_TICKET_ITEM_ID,
                pullCount,
                'gacha_ticket_consume',
            );
        }

        const diamondCost = pullCount >= 10
            ? GachaFacade.TEN_PULL_DIAMOND_COST
            : GachaFacade.SINGLE_PULL_DIAMOND_COST * pullCount;
        return this.economyFacade.spendCurrency(CurrencyType.Diamond, diamondCost, 'gacha_summon');
    }

    private getSoulPool(poolId: string): SoulRow[] {
        const soulTable = (ConfigManager.tables as unknown as {
            TbSoul?: { getDataList?: () => SoulRow[] };
        } | undefined)?.TbSoul;
        const soulRows = soulTable?.getDataList?.() ?? [];
        if (soulRows.length === 0) {
            return [];
        }

        // 当前项目还没有正式卡池配置，这里先用全 TbSoul 作为标准池。
        if (poolId !== GachaFacade.DEFAULT_POOL_ID) {
            console.warn(`[GachaFacade] Pool ${poolId} has no dedicated config, fallback to standard pool.`);
        }

        return soulRows.filter((row) => String(row.id).trim().length > 0);
    }

    private rollSoulRows(poolId: string, soulPool: readonly SoulRow[], pullCount: number): SoulRow[] {
        const rewards: SoulRow[] = [];
        const rarePool = soulPool.filter((row) => this.isRareSoul(row));
        let pityCounter = this.progressFacade.getGachaPoolState(poolId).pityCounter;

        for (let index = 0; index < pullCount; index++) {
            let rolled: SoulRow;
            if (pityCounter >= GachaFacade.PITY_THRESHOLD && rarePool.length > 0) {
                rolled = this.pickWeightedSoul(rarePool);
            } else {
                rolled = this.pickWeightedSoul(soulPool);
            }

            rewards.push(rolled);
            pityCounter = this.isRareSoul(rolled)
                ? 0
                : pityCounter + 1;
        }

        if (pullCount >= 10 && rarePool.length > 0 && !rewards.some((row) => this.isRareSoul(row))) {
            rewards[rewards.length - 1] = this.pickWeightedSoul(rarePool);
        }

        return rewards;
    }

    private pickWeightedSoul(soulPool: readonly SoulRow[]): SoulRow {
        const totalWeight = soulPool.reduce((sum, row) => sum + this.getSoulWeight(row), 0);
        if (totalWeight <= 0) {
            return soulPool[0];
        }

        let cursor = Math.random() * totalWeight;
        for (const row of soulPool) {
            cursor -= this.getSoulWeight(row);
            if (cursor <= 0) {
                return row;
            }
        }

        return soulPool[soulPool.length - 1];
    }

    private getSoulWeight(row: SoulRow): number {
        const cost = this.getSoulCost(row);
        if (cost >= 3) {
            return 5;
        }
        if (cost >= 2) {
            return 25;
        }
        return 70;
    }

    private isRareSoul(row: SoulRow): boolean {
        return this.getSoulCost(row) >= 2;
    }

    private getSoulCost(row: SoulRow): number {
        const parsed = Number(row.cost ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private grantSoulReward(row: SoulRow): ICommerceRewardItem {
        const templateId = String(row.id).trim();
        const soulId = `gacha_${templateId}_${Date.now()}_${this.rewardSequence++}`;
        const rarity = this.resolveSoulRarity(row);
        const name = row.name?.trim() || `Soul ${templateId}`;
        const soulData: ISoulData = {
            soulId,
            templateId: Number(templateId),
            monsterId: Number(templateId),
            rarity,
            name,
            attributes: {},
            tags: this.parseTags(row.tags),
            metadata: {
                source: 'gacha',
                poolId: templateId,
            },
        };
        const result = this.soulSystem.addSoul(soulData);
        if (!result.success) {
            throw new Error(`[GachaFacade] Failed to grant soul reward: ${result.message}`);
        }

        return {
            kind: 'soul',
            id: soulId,
            amount: 1,
            name,
            rarity,
            templateId,
        };
    }

    private resolveSoulRarity(row: SoulRow): SoulRarity {
        const cost = this.getSoulCost(row);
        if (cost >= 3) {
            return SoulRarity.LEGENDARY;
        }
        if (cost >= 2) {
            return SoulRarity.BOSS;
        }
        return SoulRarity.COMMON;
    }

    private parseTags(tags: SoulRow['tags']): string[] {
        if (Array.isArray(tags)) {
            return tags.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0);
        }
        if (typeof tags === 'string') {
            return tags
                .split(/[|,;]/)
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);
        }
        return [];
    }

    private normalizePoolId(poolId: PoolIdLike): string {
        const normalized = String(poolId).trim();
        return normalized || GachaFacade.DEFAULT_POOL_ID;
    }
}
