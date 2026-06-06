import { ConfigManager } from '../../config/ConfigManager';
import { CurrencyType } from '../../EconomicSystem/EconomicTypes';
import type { IBattleContext } from '../../data/GameContext';
import { EconomyFacade } from './EconomyFacade';
import {
    ProgressFacade,
    type IBattleSettlement,
    type ICommerceRewardItem,
    type IPrepareBattleOptions,
    type TBattleOutcome,
} from './ProgressFacade';

export interface IBattleStartOptions extends IPrepareBattleOptions {
    levelId: string;
    staminaCost?: number;
}

export interface IBattleStartCheckResult {
    success: boolean;
    staminaCost: number;
    reason?: string;
}

export interface IBattleResultInput {
    levelId: string;
    outcome: TBattleOutcome;
    starCount?: number;
    durationSeconds?: number;
    enemyCount?: number;
    rewards?: ICommerceRewardItem[];
}

export class BattleFacade {
    private static readonly DEFAULT_STAMINA_COST = 10;
    private static readonly DEFAULT_GOLD_REWARD_PER_ENEMY = 100;
    private settlementSequence = 0;

    constructor(
        private readonly economyFacade: EconomyFacade,
        private readonly progressFacade: ProgressFacade,
    ) {}

    public canStartBattle(options: IBattleStartOptions): IBattleStartCheckResult {
        const normalizedLevelId = options.levelId.trim();
        const normalizedHeroId = options.heroId.trim();
        const normalizedEnemyIds = options.enemyIds.map((enemyId) => enemyId.trim()).filter((enemyId) => enemyId.length > 0);
        const staminaCost = this.resolveStaminaCost(options.staminaCost);
        const battleProgress = this.progressFacade.getBattleProgress();

        if (!normalizedLevelId) {
            return { success: false, staminaCost, reason: 'Invalid level id' };
        }
        if (!normalizedHeroId) {
            return { success: false, staminaCost, reason: 'Invalid hero config' };
        }
        if (normalizedEnemyIds.length === 0) {
            return { success: false, staminaCost, reason: 'Enemy config is empty' };
        }
        if (battleProgress.activeLevelId) {
            return { success: false, staminaCost, reason: 'Another battle is still active' };
        }
        if (!this.economyFacade.hasCurrency(CurrencyType.Stamina, staminaCost)) {
            return { success: false, staminaCost, reason: 'Not enough stamina' };
        }

        return { success: true, staminaCost };
    }

    public async startBattle(options: IBattleStartOptions): Promise<boolean> {
        const checkResult = this.canStartBattle(options);
        if (!checkResult.success) {
            console.warn('[BattleFacade] startBattle blocked by pre-check.', {
                reason: checkResult.reason ?? 'unknown',
                staminaCost: checkResult.staminaCost,
                activeLevelId: this.progressFacade.getBattleProgress().activeLevelId,
                requestedLevelId: options.levelId,
                heroId: options.heroId,
                enemyIds: options.enemyIds,
                currentStamina: this.economyFacade.getCurrencyBalance(CurrencyType.Stamina),
            });
            return false;
        }

        const pendingSettlement = this.progressFacade.getPendingBattleSettlement();
        if (pendingSettlement && !pendingSettlement.claimed) {
            const claimed = this.claimBattleReward(pendingSettlement.settlementId);
            if (!claimed) {
                console.warn('[BattleFacade] Failed to auto-claim previous settlement.');
                return false;
            }
        }

        try {
            await ConfigManager.loadAllConfigs();
        } catch (error) {
            console.error('[BattleFacade] prepare battle failed:', error);
            return false;
        }

        const spent = this.economyFacade.spendCurrency(
            CurrencyType.Stamina,
            checkResult.staminaCost,
            'battle_start',
        );
        if (!spent) {
            return false;
        }

        try {
            this.progressFacade.prepareBattle({
                heroId: options.heroId,
                equippedSoulIds: [...options.equippedSoulIds],
                equippedSkillIds: [...options.equippedSkillIds],
                builtinSkillId: options.builtinSkillId,
                equippedRuneIds: [...options.equippedRuneIds],
                enemyIds: [...options.enemyIds],
            });
            this.progressFacade.setActiveBattleLevel(options.levelId);
            return true;
        } catch (error) {
            this.economyFacade.addCurrency(
                CurrencyType.Stamina,
                checkResult.staminaCost,
                'battle_start_refund',
            );
            console.error('[BattleFacade] build battle context failed:', error);
            return false;
        }
    }

    public getCurrentBattleContext(): IBattleContext {
        return this.progressFacade.getBattleContext();
    }

    public getPendingSettlement(): IBattleSettlement | null {
        return this.progressFacade.getPendingBattleSettlement();
    }

    public settleBattle(result: IBattleResultInput): IBattleSettlement {
        const normalizedLevelId = result.levelId.trim();
        if (!normalizedLevelId) {
            throw new Error('[BattleFacade] settleBattle requires a valid levelId.');
        }

        const outcome = result.outcome;
        const resolvedAt = Date.now();
        const starCount = outcome === 'victory'
            ? Math.max(1, Math.min(3, this.normalizePositiveInt(result.starCount || 1)))
            : 0;
        const rewards = this.resolveSettlementRewards(result, outcome);
        const settlement: IBattleSettlement = {
            settlementId: `battle_settlement_${resolvedAt}_${this.settlementSequence++}`,
            levelId: normalizedLevelId,
            outcome,
            starCount,
            claimed: false,
            resolvedAt,
            rewards,
        };

        this.progressFacade.recordBattleSettlement(settlement);
        return settlement;
    }

    public claimBattleReward(settlementId: string): boolean {
        const pendingSettlement = this.progressFacade.getPendingBattleSettlement();
        if (!pendingSettlement || pendingSettlement.settlementId !== settlementId.trim()) {
            return false;
        }
        if (pendingSettlement.claimed) {
            return false;
        }

        for (const reward of pendingSettlement.rewards) {
            if (!this.grantReward(reward)) {
                return false;
            }
        }

        return this.progressFacade.markBattleSettlementClaimed(pendingSettlement.settlementId);
    }

    public abortBattle(levelId?: string): void {
        const activeLevelId = this.progressFacade.getBattleProgress().activeLevelId;
        const targetLevelId = levelId?.trim() || activeLevelId;
        if (!targetLevelId) {
            return;
        }

        this.progressFacade.recordBattleSettlement({
            settlementId: `battle_abort_${Date.now()}_${this.settlementSequence++}`,
            levelId: targetLevelId,
            outcome: 'abort',
            starCount: 0,
            claimed: true,
            resolvedAt: Date.now(),
            rewards: [],
        });
    }

    private resolveSettlementRewards(result: IBattleResultInput, outcome: TBattleOutcome): ICommerceRewardItem[] {
        if (outcome !== 'victory') {
            return [];
        }

        if (result.rewards && result.rewards.length > 0) {
            return result.rewards
                .map((reward) => this.normalizeRewardItem(reward))
                .filter((reward): reward is ICommerceRewardItem => reward !== null);
        }

        const enemyCount = Math.max(
            1,
            this.normalizePositiveInt(result.enemyCount)
                || this.progressFacade.getBattleContext().currentLevelEnemyIds.length,
        );
        return [{
            kind: 'currency',
            id: CurrencyType.Gold,
            amount: enemyCount * BattleFacade.DEFAULT_GOLD_REWARD_PER_ENEMY,
            name: 'Gold',
        }];
    }

    private grantReward(reward: ICommerceRewardItem): boolean {
        switch (reward.kind) {
            case 'currency':
                return this.economyFacade.addCurrency(reward.id as CurrencyType, reward.amount, 'battle_reward');
            case 'item':
                return this.economyFacade.grantItem(reward.id, reward.amount, 'battle_reward');
            default:
                return false;
        }
    }

    private normalizeRewardItem(reward: ICommerceRewardItem | Partial<ICommerceRewardItem> | null | undefined): ICommerceRewardItem | null {
        const kind = reward?.kind;
        if (kind !== 'currency' && kind !== 'item' && kind !== 'soul') {
            return null;
        }

        const id = reward.id?.trim();
        if (!id) {
            return null;
        }

        const amount = this.normalizePositiveInt(reward.amount);
        if (amount <= 0) {
            return null;
        }

        return {
            kind,
            id,
            amount,
            name: reward.name?.trim() || undefined,
            rarity: reward.rarity?.trim() || undefined,
            templateId: reward.templateId?.trim() || undefined,
        };
    }

    private resolveStaminaCost(cost?: number): number {
        const normalized = this.normalizePositiveInt(cost);
        return normalized > 0 ? normalized : BattleFacade.DEFAULT_STAMINA_COST;
    }

    private normalizePositiveInt(value: number | null | undefined): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.floor(value));
    }
}
