import { BattleUnitFactory } from '../../battle/core/BattleUnitFactory';
import type {
    IBattleContext,
    IDateSelectionSaveData,
    IHeroBuild,
    IPlayerFormation,
    IRuneLoadout,
} from '../../data/GameContext';

export type TCommerceRewardKind = 'currency' | 'item' | 'soul';
export type TBattleOutcome = 'victory' | 'defeat' | 'abort';

export interface ICommerceRewardItem {
    kind: TCommerceRewardKind;
    id: string;
    amount: number;
    name?: string;
    rarity?: string;
    templateId?: string;
}

export interface IDailyRewardState {
    cycleKey: string;
    lastClaimDateKey: string | null;
    claimedDayIndices: number[];
}

export interface IGachaPoolState {
    totalPulls: number;
    pityCounter: number;
    lastSummonAt: number;
}

export interface IGachaHistoryEntry {
    poolId: string;
    pullCount: number;
    timestamp: number;
    rewards: ICommerceRewardItem[];
}

export interface IGachaSaveData {
    poolStates: Record<string, IGachaPoolState>;
    history: IGachaHistoryEntry[];
}

export interface ILevelBattleRecord {
    levelId: string;
    cleared: boolean;
    bestStarCount: number;
    totalAttempts: number;
    totalWins: number;
    lastOutcome: TBattleOutcome | null;
    lastCompletedAt: number;
}

export interface IBattleSettlement {
    settlementId: string;
    levelId: string;
    outcome: TBattleOutcome;
    starCount: number;
    claimed: boolean;
    resolvedAt: number;
    rewards: ICommerceRewardItem[];
}

export interface IBattleProgressState {
    activeLevelId: string | null;
    pendingSettlement: IBattleSettlement | null;
    records: Record<string, ILevelBattleRecord>;
}

export interface IProgressSaveData {
    formation: IPlayerFormation;
    heroBuild: IHeroBuild;
    runes: IRuneLoadout;
    dateSelection: IDateSelectionSaveData | null;
    battleContext: IBattleContext;
    dailyReward?: IDailyRewardState;
    gacha?: IGachaSaveData;
    battle?: IBattleProgressState;
}

export interface IPrepareBattleOptions {
    heroId: string;
    equippedSoulIds: string[];
    equippedSkillIds: number[];
    builtinSkillId: number | null;
    equippedRuneIds: number[];
    enemyIds: string[];
}

export interface IDateSelectionInput {
    text: string;
    month: number;
    day: number;
    dateStr: string;
}

export class ProgressFacade {
    private static readonly MAX_GACHA_HISTORY = 20;

    private readonly listeners = new Set<() => void>();
    private formation: IPlayerFormation = {
        heroId: '000001',
        equippedSoulIds: [],
    };
    private heroBuild: IHeroBuild = {
        equippedSkillIds: [],
        builtinSkillId: null,
    };
    private runes: IRuneLoadout = {
        equippedRuneIds: [],
    };
    private dateSelection: IDateSelectionSaveData | null = null;
    private battleContext: IBattleContext = {
        currentLevelEnemyIds: [],
        randomSeed: 1,
        preparedBattle: {
            playerUnits: [],
            enemyUnits: [],
        },
    };
    private dailyReward: IDailyRewardState = {
        cycleKey: '',
        lastClaimDateKey: null,
        claimedDayIndices: [],
    };
    private gacha: IGachaSaveData = {
        poolStates: {},
        history: [],
    };
    private battle: IBattleProgressState = {
        activeLevelId: null,
        pendingSettlement: null,
        records: {},
    };

    public exportSave(): IProgressSaveData {
        return {
            formation: {
                heroId: this.formation.heroId,
                equippedSoulIds: [...this.formation.equippedSoulIds],
            },
            heroBuild: {
                equippedSkillIds: [...this.heroBuild.equippedSkillIds],
                builtinSkillId: this.heroBuild.builtinSkillId,
            },
            runes: {
                equippedRuneIds: [...this.runes.equippedRuneIds],
            },
            dateSelection: this.dateSelection
                ? { ...this.dateSelection }
                : null,
            battleContext: {
                currentLevelEnemyIds: [...this.battleContext.currentLevelEnemyIds],
                randomSeed: this.normalizeBattleSeed(this.battleContext.randomSeed),
                preparedBattle: {
                    playerUnits: this.battleContext.preparedBattle.playerUnits.map((unit) => ({
                        ...unit,
                        baseAttributes: { ...unit.baseAttributes },
                    })),
                    enemyUnits: this.battleContext.preparedBattle.enemyUnits.map((unit) => ({
                        ...unit,
                        baseAttributes: { ...unit.baseAttributes },
                    })),
                },
            },
            dailyReward: this.cloneDailyRewardState(this.dailyReward),
            gacha: this.cloneGachaSaveData(this.gacha),
            battle: this.cloneBattleProgressState(this.battle),
        };
    }

    public importSave(snapshot: Partial<IProgressSaveData> | null | undefined): void {
        if (!snapshot) {
            return;
        }

        const current = this.exportSave();
        const formation = snapshot.formation ?? current.formation;
        const heroBuild = snapshot.heroBuild ?? current.heroBuild;
        const runes = snapshot.runes ?? current.runes;
        const battleContext = snapshot.battleContext ?? current.battleContext;

        this.formation = {
            heroId: formation.heroId?.trim() || current.formation.heroId,
            equippedSoulIds: [...(formation.equippedSoulIds ?? current.formation.equippedSoulIds)],
        };
        this.heroBuild = {
            equippedSkillIds: [...(heroBuild.equippedSkillIds ?? current.heroBuild.equippedSkillIds)],
            builtinSkillId: heroBuild.builtinSkillId ?? current.heroBuild.builtinSkillId,
        };
        this.runes = {
            equippedRuneIds: [...(runes.equippedRuneIds ?? current.runes.equippedRuneIds)],
        };
        this.dateSelection = snapshot.dateSelection
            ? { ...snapshot.dateSelection }
            : snapshot.dateSelection === null
                ? null
                : current.dateSelection;
        this.battleContext = {
            currentLevelEnemyIds: [...(battleContext.currentLevelEnemyIds ?? current.battleContext.currentLevelEnemyIds)],
            randomSeed: this.normalizeBattleSeed(battleContext.randomSeed ?? current.battleContext.randomSeed),
            preparedBattle: {
                playerUnits: (battleContext.preparedBattle?.playerUnits ?? current.battleContext.preparedBattle.playerUnits)
                    .map((unit) => ({
                        ...unit,
                        baseAttributes: { ...unit.baseAttributes },
                    })),
                enemyUnits: (battleContext.preparedBattle?.enemyUnits ?? current.battleContext.preparedBattle.enemyUnits)
                    .map((unit) => ({
                        ...unit,
                        baseAttributes: { ...unit.baseAttributes },
                    })),
            },
        };
        this.dailyReward = this.normalizeDailyRewardState(snapshot.dailyReward ?? current.dailyReward);
        this.gacha = this.normalizeGachaSaveData(snapshot.gacha ?? current.gacha);
        this.battle = this.normalizeBattleProgressState(snapshot.battle ?? current.battle);
        this.notifyChanged();
    }

    public getFormation(): IPlayerFormation {
        return {
            heroId: this.formation.heroId,
            equippedSoulIds: [...this.formation.equippedSoulIds],
        };
    }

    public getHeroBuild(): IHeroBuild {
        return {
            equippedSkillIds: [...this.heroBuild.equippedSkillIds],
            builtinSkillId: this.heroBuild.builtinSkillId,
        };
    }

    public getBattleContext(): IBattleContext {
        return this.exportSave().battleContext;
    }

    public getBattleProgress(): IBattleProgressState {
        return this.cloneBattleProgressState(this.battle);
    }

    public getPendingBattleSettlement(): IBattleSettlement | null {
        return this.battle.pendingSettlement
            ? this.cloneBattleSettlement(this.battle.pendingSettlement)
            : null;
    }

    public getLevelBattleRecord(levelId: string): ILevelBattleRecord | null {
        const normalizedLevelId = levelId.trim();
        if (!normalizedLevelId) {
            return null;
        }

        const record = this.battle.records[normalizedLevelId];
        return record ? this.cloneLevelBattleRecord(record) : null;
    }

    public setActiveBattleLevel(levelId: string | null): void {
        const normalizedLevelId = levelId?.trim() || null;
        if (this.battle.activeLevelId === normalizedLevelId) {
            return;
        }

        this.battle = {
            ...this.battle,
            activeLevelId: normalizedLevelId,
        };
        this.notifyChanged();
    }

    public recordBattleSettlement(settlement: IBattleSettlement): void {
        const normalizedSettlement = this.normalizeBattleSettlement(settlement);
        const currentRecord = this.battle.records[normalizedSettlement.levelId];
        const nextRecord: ILevelBattleRecord = {
            levelId: normalizedSettlement.levelId,
            cleared: currentRecord?.cleared ?? false,
            bestStarCount: currentRecord?.bestStarCount ?? 0,
            totalAttempts: (currentRecord?.totalAttempts ?? 0) + 1,
            totalWins: currentRecord?.totalWins ?? 0,
            lastOutcome: normalizedSettlement.outcome,
            lastCompletedAt: normalizedSettlement.resolvedAt,
        };

        if (normalizedSettlement.outcome === 'victory') {
            nextRecord.cleared = true;
            nextRecord.totalWins += 1;
            nextRecord.bestStarCount = Math.max(nextRecord.bestStarCount, normalizedSettlement.starCount);
        }

        this.battle = {
            activeLevelId: null,
            pendingSettlement: normalizedSettlement,
            records: {
                ...this.battle.records,
                [normalizedSettlement.levelId]: nextRecord,
            },
        };
        this.notifyChanged();
    }

    public markBattleSettlementClaimed(settlementId: string): boolean {
        const normalizedSettlementId = settlementId.trim();
        const pendingSettlement = this.battle.pendingSettlement;
        if (!normalizedSettlementId || !pendingSettlement || pendingSettlement.settlementId !== normalizedSettlementId) {
            return false;
        }
        if (pendingSettlement.claimed) {
            return false;
        }

        this.battle = {
            ...this.battle,
            pendingSettlement: {
                ...pendingSettlement,
                claimed: true,
                rewards: pendingSettlement.rewards.map((reward) => this.cloneRewardItem(reward)),
            },
        };
        this.notifyChanged();
        return true;
    }

    public clearPendingBattleSettlement(): void {
        if (!this.battle.pendingSettlement) {
            return;
        }

        this.battle = {
            ...this.battle,
            pendingSettlement: null,
        };
        this.notifyChanged();
    }

    public getEquippedRuneIds(): number[] {
        return [...this.runes.equippedRuneIds];
    }

    public hasDateSelection(): boolean {
        return this.dateSelection !== null;
    }

    public getDateSelection(): IDateSelectionSaveData | null {
        return this.dateSelection ? { ...this.dateSelection } : null;
    }

    public getDailyRewardState(): IDailyRewardState {
        return this.cloneDailyRewardState(this.dailyReward);
    }

    public canClaimDailyReward(dayIndex: number, now: number = Date.now()): { success: boolean; reason?: string } {
        const normalizedDayIndex = Math.floor(dayIndex);
        if (!Number.isFinite(dayIndex) || normalizedDayIndex <= 0) {
            return { success: false, reason: '签到天数无效' };
        }

        const dailyRewardState = this.normalizeDailyRewardState(this.dailyReward, now);
        const dateKey = this.getDateKey(now);
        if (dailyRewardState.lastClaimDateKey === dateKey) {
            return { success: false, reason: '今日已领取签到奖励' };
        }
        if (dailyRewardState.claimedDayIndices.includes(normalizedDayIndex)) {
            return { success: false, reason: '该签到奖励已领取' };
        }

        return { success: true };
    }

    public recordDailyRewardClaim(dayIndex: number, now: number = Date.now()): void {
        const normalizedDayIndex = Math.floor(dayIndex);
        if (!Number.isFinite(dayIndex) || normalizedDayIndex <= 0) {
            throw new Error('[ProgressFacade] recordDailyRewardClaim requires a valid dayIndex.');
        }

        const dailyRewardState = this.normalizeDailyRewardState(this.dailyReward, now);
        if (!dailyRewardState.claimedDayIndices.includes(normalizedDayIndex)) {
            dailyRewardState.claimedDayIndices = [...dailyRewardState.claimedDayIndices, normalizedDayIndex]
                .sort((left, right) => left - right);
        }
        dailyRewardState.lastClaimDateKey = this.getDateKey(now);
        this.dailyReward = dailyRewardState;
        this.notifyChanged();
    }

    public getGachaState(): IGachaSaveData {
        return this.cloneGachaSaveData(this.gacha);
    }

    public getGachaPoolState(poolId: string): IGachaPoolState {
        const normalizedPoolId = poolId.trim() || 'default';
        const poolState = this.gacha.poolStates[normalizedPoolId];
        return this.cloneGachaPoolState(poolState);
    }

    public recordGachaSummon(
        poolId: string,
        rewards: readonly ICommerceRewardItem[],
        pullCount: number,
        now: number = Date.now(),
    ): void {
        const normalizedPoolId = poolId.trim() || 'default';
        const normalizedPullCount = Math.floor(pullCount);
        if (!Number.isFinite(pullCount) || normalizedPullCount <= 0) {
            throw new Error('[ProgressFacade] recordGachaSummon requires a valid pullCount.');
        }

        const poolState = this.cloneGachaPoolState(this.gacha.poolStates[normalizedPoolId]);
        const rewardSnapshots = rewards.map((reward) => this.cloneRewardItem(reward));
        const hasRareReward = rewardSnapshots.some((reward) => reward.kind === 'soul' && reward.rarity !== 'common');

        poolState.totalPulls += normalizedPullCount;
        poolState.lastSummonAt = now;
        poolState.pityCounter = hasRareReward
            ? 0
            : poolState.pityCounter + normalizedPullCount;

        this.gacha = {
            poolStates: {
                ...this.gacha.poolStates,
                [normalizedPoolId]: poolState,
            },
            history: [
                {
                    poolId: normalizedPoolId,
                    pullCount: normalizedPullCount,
                    timestamp: now,
                    rewards: rewardSnapshots,
                },
                ...this.gacha.history.map((entry) => ({
                    ...entry,
                    rewards: entry.rewards.map((reward) => this.cloneRewardItem(reward)),
                })),
            ].slice(0, ProgressFacade.MAX_GACHA_HISTORY),
        };
        this.notifyChanged();
    }

    public onChanged(listener: () => void): void {
        this.listeners.add(listener);
    }

    public offChanged(listener: () => void): void {
        this.listeners.delete(listener);
    }

    public saveDateSelection(selection: IDateSelectionInput): IDateSelectionSaveData {
        this.dateSelection = {
            ...selection,
            timestamp: Date.now(),
        };
        this.notifyChanged();
        return { ...this.dateSelection };
    }

    public prepareBattle(options: IPrepareBattleOptions): void {
        const heroId = options.heroId.trim();
        const enemyIds = options.enemyIds.map((enemyId) => enemyId.trim()).filter((enemyId) => enemyId.length > 0);
        if (!heroId) {
            throw new Error('[ProgressFacade] prepareBattle requires a valid heroId.');
        }
        if (enemyIds.length === 0) {
            throw new Error('[ProgressFacade] prepareBattle requires at least one enemyId.');
        }

        this.formation = {
            heroId,
            equippedSoulIds: [...options.equippedSoulIds],
        };
        this.heroBuild = {
            equippedSkillIds: [...options.equippedSkillIds],
            builtinSkillId: options.builtinSkillId,
        };
        this.runes = {
            equippedRuneIds: [...options.equippedRuneIds],
        };
        this.battleContext = {
            currentLevelEnemyIds: enemyIds,
            randomSeed: this.battleContext.randomSeed,
            preparedBattle: {
                playerUnits: BattleUnitFactory.preparePlayerUnitConfigs({
                    heroId,
                    equippedSoulIds: options.equippedSoulIds,
                    equippedSkillIds: options.equippedSkillIds,
                    builtinSkillId: options.builtinSkillId,
                }),
                enemyUnits: BattleUnitFactory.prepareEnemyUnitConfigs(enemyIds),
            },
        };
        this.notifyChanged();
    }

    private cloneDailyRewardState(state: IDailyRewardState | null | undefined): IDailyRewardState {
        const normalized = this.normalizeDailyRewardState(state);
        return {
            cycleKey: normalized.cycleKey,
            lastClaimDateKey: normalized.lastClaimDateKey,
            claimedDayIndices: [...normalized.claimedDayIndices],
        };
    }

    private cloneGachaSaveData(state: IGachaSaveData | null | undefined): IGachaSaveData {
        const normalized = this.normalizeGachaSaveData(state);
        return {
            poolStates: Object.fromEntries(
                Object.entries(normalized.poolStates).map(([poolId, poolState]) => [
                    poolId,
                    this.cloneGachaPoolState(poolState),
                ]),
            ),
            history: normalized.history.map((entry) => ({
                poolId: entry.poolId,
                pullCount: entry.pullCount,
                timestamp: entry.timestamp,
                rewards: entry.rewards.map((reward) => this.cloneRewardItem(reward)),
            })),
        };
    }

    private cloneBattleProgressState(state: IBattleProgressState | null | undefined): IBattleProgressState {
        const normalized = this.normalizeBattleProgressState(state);
        return {
            activeLevelId: normalized.activeLevelId,
            pendingSettlement: normalized.pendingSettlement
                ? this.cloneBattleSettlement(normalized.pendingSettlement)
                : null,
            records: Object.fromEntries(
                Object.entries(normalized.records).map(([levelId, record]) => [
                    levelId,
                    this.cloneLevelBattleRecord(record),
                ]),
            ),
        };
    }

    private cloneBattleSettlement(state: IBattleSettlement | null | undefined): IBattleSettlement {
        const normalized = this.normalizeBattleSettlement(state);
        return {
            settlementId: normalized.settlementId,
            levelId: normalized.levelId,
            outcome: normalized.outcome,
            starCount: normalized.starCount,
            claimed: normalized.claimed,
            resolvedAt: normalized.resolvedAt,
            rewards: normalized.rewards.map((reward) => this.cloneRewardItem(reward)),
        };
    }

    private cloneLevelBattleRecord(state: ILevelBattleRecord | null | undefined): ILevelBattleRecord {
        const normalized = this.normalizeLevelBattleRecord(state);
        return {
            levelId: normalized.levelId,
            cleared: normalized.cleared,
            bestStarCount: normalized.bestStarCount,
            totalAttempts: normalized.totalAttempts,
            totalWins: normalized.totalWins,
            lastOutcome: normalized.lastOutcome,
            lastCompletedAt: normalized.lastCompletedAt,
        };
    }

    private cloneGachaPoolState(state: Partial<IGachaPoolState> | null | undefined): IGachaPoolState {
        return {
            totalPulls: this.normalizePositiveInt(state?.totalPulls),
            pityCounter: this.normalizePositiveInt(state?.pityCounter),
            lastSummonAt: this.normalizePositiveInt(state?.lastSummonAt),
        };
    }

    private cloneRewardItem(reward: ICommerceRewardItem): ICommerceRewardItem {
        return {
            kind: reward.kind,
            id: reward.id,
            amount: reward.amount,
            name: reward.name,
            rarity: reward.rarity,
            templateId: reward.templateId,
        };
    }

    private normalizeDailyRewardState(
        state: Partial<IDailyRewardState> | null | undefined,
        now: number = Date.now(),
    ): IDailyRewardState {
        const cycleKey = this.getCycleKey(now);
        if (!state || state.cycleKey !== cycleKey) {
            return {
                cycleKey,
                lastClaimDateKey: null,
                claimedDayIndices: [],
            };
        }

        const claimedDayIndices = Array.from(new Set((state.claimedDayIndices ?? [])
            .map((dayIndex) => Math.floor(dayIndex))
            .filter((dayIndex) => Number.isFinite(dayIndex) && dayIndex > 0)))
            .sort((left, right) => left - right);

        return {
            cycleKey,
            lastClaimDateKey: typeof state.lastClaimDateKey === 'string'
                ? state.lastClaimDateKey
                : null,
            claimedDayIndices,
        };
    }

    private normalizeGachaSaveData(state: Partial<IGachaSaveData> | null | undefined): IGachaSaveData {
        const poolStates: Record<string, IGachaPoolState> = {};
        for (const [poolId, poolState] of Object.entries(state?.poolStates ?? {})) {
            const normalizedPoolId = poolId.trim();
            if (!normalizedPoolId) {
                continue;
            }

            poolStates[normalizedPoolId] = this.cloneGachaPoolState(poolState);
        }

        const history = (state?.history ?? [])
            .map((entry) => this.normalizeGachaHistoryEntry(entry))
            .filter((entry): entry is IGachaHistoryEntry => entry !== null)
            .slice(0, ProgressFacade.MAX_GACHA_HISTORY);

        return {
            poolStates,
            history,
        };
    }

    private normalizeBattleProgressState(state: Partial<IBattleProgressState> | null | undefined): IBattleProgressState {
        const records: Record<string, ILevelBattleRecord> = {};
        for (const [levelId, record] of Object.entries(state?.records ?? {})) {
            const normalizedLevelId = levelId.trim();
            if (!normalizedLevelId) {
                continue;
            }

            records[normalizedLevelId] = this.normalizeLevelBattleRecord({
                ...record,
                levelId: normalizedLevelId,
            });
        }

        return {
            activeLevelId: state?.activeLevelId?.trim() || null,
            pendingSettlement: state?.pendingSettlement
                ? this.normalizeBattleSettlement(state.pendingSettlement)
                : null,
            records,
        };
    }

    private normalizeBattleSettlement(state: Partial<IBattleSettlement> | null | undefined): IBattleSettlement {
        const outcome = state?.outcome;
        return {
            settlementId: state?.settlementId?.trim() || '',
            levelId: state?.levelId?.trim() || 'unknown_level',
            outcome: outcome === 'victory' || outcome === 'defeat' || outcome === 'abort'
                ? outcome
                : 'abort',
            starCount: Math.max(0, Math.min(3, this.normalizePositiveInt(state?.starCount))),
            claimed: !!state?.claimed,
            resolvedAt: this.normalizePositiveInt(state?.resolvedAt),
            rewards: (state?.rewards ?? [])
                .map((reward) => this.normalizeRewardItem(reward))
                .filter((reward): reward is ICommerceRewardItem => reward !== null),
        };
    }

    private normalizeLevelBattleRecord(state: Partial<ILevelBattleRecord> | null | undefined): ILevelBattleRecord {
        const outcome = state?.lastOutcome;
        return {
            levelId: state?.levelId?.trim() || 'unknown_level',
            cleared: !!state?.cleared,
            bestStarCount: Math.max(0, Math.min(3, this.normalizePositiveInt(state?.bestStarCount))),
            totalAttempts: this.normalizePositiveInt(state?.totalAttempts),
            totalWins: this.normalizePositiveInt(state?.totalWins),
            lastOutcome: outcome === 'victory' || outcome === 'defeat' || outcome === 'abort'
                ? outcome
                : null,
            lastCompletedAt: this.normalizePositiveInt(state?.lastCompletedAt),
        };
    }

    private normalizeGachaHistoryEntry(entry: Partial<IGachaHistoryEntry> | null | undefined): IGachaHistoryEntry | null {
        const poolId = entry?.poolId?.trim();
        if (!poolId) {
            return null;
        }

        return {
            poolId,
            pullCount: this.normalizePositiveInt(entry.pullCount),
            timestamp: this.normalizePositiveInt(entry.timestamp),
            rewards: (entry.rewards ?? [])
                .map((reward) => this.normalizeRewardItem(reward))
                .filter((reward): reward is ICommerceRewardItem => reward !== null),
        };
    }

    private normalizeRewardItem(reward: Partial<ICommerceRewardItem> | null | undefined): ICommerceRewardItem | null {
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

    private normalizeBattleSeed(seed: number): number {
        if (!Number.isFinite(seed)) {
            return 1;
        }

        const normalized = Math.floor(seed) >>> 0;
        return normalized === 0 ? 1 : normalized;
    }

    private normalizePositiveInt(value: number | null | undefined): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.floor(value));
    }

    private getCycleKey(now: number): string {
        const date = new Date(now);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    private getDateKey(now: number): string {
        const date = new Date(now);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    private notifyChanged(): void {
        this.listeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.error('[ProgressFacade] listener error:', error);
            }
        });
    }
}
