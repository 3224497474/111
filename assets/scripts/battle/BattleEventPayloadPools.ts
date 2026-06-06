import type { IRuneDefinition } from '../Runes/RuneTypes';
import type { BattleUnit } from './BattleUnit';
import { AttackType, type IBattleInstance, type IPoint, type ISkillConfig } from './Types';

type DamageCause = 'attack' | 'skill' | 'rune';
type PooledPayload<T extends object> = T & IPooledEventPayload;

// 所有池化事件载荷都必须实现 recycle。
// 警告：BattleEventBus.emit 返回后会立刻调用 recycle，
// 监听器绝对禁止异步持有 payload 引用，也不能把它缓存到成员变量中。
// 如需延迟处理，必须在同步回调里先复制基础数据，例如 unitId / x / y。
export interface IPooledEventPayload {
    recycle(): void;
}

class EventPayloadPool<T extends object> {
    private readonly items: Array<PooledPayload<T>> = [];

    constructor(private readonly factory: () => PooledPayload<T>) {}

    public get(): PooledPayload<T> {
        const payload = this.items.pop();
        if (payload) {
            return payload;
        }

        return this.factory();
    }

    public put(payload: PooledPayload<T>): void {
        this.items.push(payload);
    }
}

function createEventPayloadPool<T extends object>(
    createState: () => T,
    reset: (payload: PooledPayload<T>) => void,
): EventPayloadPool<T> {
    let pool: EventPayloadPool<T>;

    const recycle = function (this: PooledPayload<T>): void {
        reset(this);
        pool.put(this);
    };

    pool = new EventPayloadPool<T>(() => {
        const payload = createState() as PooledPayload<T>;
        payload.recycle = recycle;
        return payload;
    });

    return pool;
}

export interface IBattleStartedEventPayload {
    battle: IBattleInstance | null;
}

export const BattleStartedEventPool = createEventPayloadPool<IBattleStartedEventPayload>(
    () => ({
        battle: null,
    }),
    (payload) => {
        payload.battle = null;
    },
);

export interface ISquadMoveTargetChangedEventPayload {
    target: IPoint | null;
}

export const SquadMoveTargetChangedEventPool = createEventPayloadPool<ISquadMoveTargetChangedEventPayload>(
    () => ({
        target: null,
    }),
    (payload) => {
        payload.target = null;
    },
);

export interface IUnitSpawnedEventPayload {
    unit: BattleUnit | null;
}

export const UnitSpawnedEventPool = createEventPayloadPool<IUnitSpawnedEventPayload>(
    () => ({
        unit: null,
    }),
    (payload) => {
        payload.unit = null;
    },
);

export interface IControlAppliedEventPayload {
    unit: BattleUnit | null;
    durationSeconds: number;
    source: BattleUnit | null;
    skillId: number | undefined;
}

export const ControlAppliedEventPool = createEventPayloadPool<IControlAppliedEventPayload>(
    () => ({
        unit: null,
        durationSeconds: 0,
        source: null,
        skillId: undefined,
    }),
    (payload) => {
        payload.unit = null;
        payload.durationSeconds = 0;
        payload.source = null;
        payload.skillId = undefined;
    },
);

export interface IBasicAttackFiredEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    attackType: AttackType;
    missed: boolean;
}

export const BasicAttackFiredEventPool = createEventPayloadPool<IBasicAttackFiredEventPayload>(
    () => ({
        source: null,
        target: null,
        attackType: AttackType.MELEE,
        missed: false,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.attackType = AttackType.MELEE;
        payload.missed = false;
    },
);

export interface IMeleeHitEffectRequestedEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    effectId: string | undefined;
}

export const MeleeHitEffectRequestedEventPool = createEventPayloadPool<IMeleeHitEffectRequestedEventPayload>(
    () => ({
        source: null,
        target: null,
        effectId: undefined,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.effectId = undefined;
    },
);

export interface IBuiltinSkillTriggeredEventPayload {
    unit: BattleUnit | null;
    skillConfig: ISkillConfig | null;
    targets: ReadonlyArray<BattleUnit> | null;
}

export const BuiltinSkillTriggeredEventPool = createEventPayloadPool<IBuiltinSkillTriggeredEventPayload>(
    () => ({
        unit: null,
        skillConfig: null,
        targets: null,
    }),
    (payload) => {
        payload.unit = null;
        payload.skillConfig = null;
        payload.targets = null;
    },
);

export interface IHealAppliedEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    amount: number;
    skillId: number;
    sourceRuneId: number | undefined;
}

export const HealAppliedEventPool = createEventPayloadPool<IHealAppliedEventPayload>(
    () => ({
        source: null,
        target: null,
        amount: 0,
        skillId: 0,
        sourceRuneId: undefined,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.amount = 0;
        payload.skillId = 0;
        payload.sourceRuneId = undefined;
    },
);

export interface ISkillEffectRequestedEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    effectId: string | undefined;
    skillId: number;
    sourceRuneId: number | undefined;
}

export const SkillEffectRequestedEventPool = createEventPayloadPool<ISkillEffectRequestedEventPayload>(
    () => ({
        source: null,
        target: null,
        effectId: undefined,
        skillId: 0,
        sourceRuneId: undefined,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.effectId = undefined;
        payload.skillId = 0;
        payload.sourceRuneId = undefined;
    },
);

export interface ISkillCastEventPayload {
    caster: BattleUnit | null;
    skillConfig: ISkillConfig | null;
    targets: ReadonlyArray<BattleUnit> | null;
    sourceRuneId: number | undefined;
}

export const SkillCastEventPool = createEventPayloadPool<ISkillCastEventPayload>(
    () => ({
        caster: null,
        skillConfig: null,
        targets: null,
        sourceRuneId: undefined,
    }),
    (payload) => {
        payload.caster = null;
        payload.skillConfig = null;
        payload.targets = null;
        payload.sourceRuneId = undefined;
    },
);

export interface IDamageAppliedEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    amount: number;
    cause: DamageCause;
    skillId: number | undefined;
    sourceRuneId: number | undefined;
    isCritical: boolean;
}

export const DamageAppliedEventPool = createEventPayloadPool<IDamageAppliedEventPayload>(
    () => ({
        source: null,
        target: null,
        amount: 0,
        cause: 'attack' as DamageCause,
        skillId: undefined,
        sourceRuneId: undefined,
        isCritical: false,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.amount = 0;
        payload.cause = 'attack';
        payload.skillId = undefined;
        payload.sourceRuneId = undefined;
        payload.isCritical = false;
    },
);

export interface IUnitHitReactRequestedEventPayload {
    source: BattleUnit | null;
    target: BattleUnit | null;
    amount: number;
    cause: DamageCause;
    skillId: number | undefined;
    sourceRuneId: number | undefined;
    isCritical: boolean;
}

export const UnitHitReactRequestedEventPool = createEventPayloadPool<IUnitHitReactRequestedEventPayload>(
    () => ({
        source: null,
        target: null,
        amount: 0,
        cause: 'attack' as DamageCause,
        skillId: undefined,
        sourceRuneId: undefined,
        isCritical: false,
    }),
    (payload) => {
        payload.source = null;
        payload.target = null;
        payload.amount = 0;
        payload.cause = 'attack';
        payload.skillId = undefined;
        payload.sourceRuneId = undefined;
        payload.isCritical = false;
    },
);

export interface IUnitDiedEventPayload {
    unit: BattleUnit | null;
    killer: BattleUnit | null;
    cause: DamageCause;
    skillId: number | undefined;
    sourceRuneId: number | undefined;
}

export const UnitDiedEventPool = createEventPayloadPool<IUnitDiedEventPayload>(
    () => ({
        unit: null,
        killer: null,
        cause: 'attack' as DamageCause,
        skillId: undefined,
        sourceRuneId: undefined,
    }),
    (payload) => {
        payload.unit = null;
        payload.killer = null;
        payload.cause = 'attack';
        payload.skillId = undefined;
        payload.sourceRuneId = undefined;
    },
);

export interface IBattleEndedEventPayload {
    battle: IBattleInstance | null;
    winner: 'player' | 'enemy' | null;
}

export const BattleEndedEventPool = createEventPayloadPool<IBattleEndedEventPayload>(
    () => ({
        battle: null,
        winner: null,
    }),
    (payload) => {
        payload.battle = null;
        payload.winner = null;
    },
);

export interface IRuneChargeChangedEventPayload {
    unit: BattleUnit | null;
    rune: IRuneDefinition | null;
    currentCharge: number;
}

export const RuneChargeChangedEventPool = createEventPayloadPool<IRuneChargeChangedEventPayload>(
    () => ({
        unit: null,
        rune: null,
        currentCharge: 0,
    }),
    (payload) => {
        payload.unit = null;
        payload.rune = null;
        payload.currentCharge = 0;
    },
);

export interface IRuneSkillTriggeredEventPayload {
    unit: BattleUnit | null;
    rune: IRuneDefinition | null;
    targets: ReadonlyArray<BattleUnit> | null;
}

export const RuneSkillTriggeredEventPool = createEventPayloadPool<IRuneSkillTriggeredEventPayload>(
    () => ({
        unit: null,
        rune: null,
        targets: null,
    }),
    (payload) => {
        payload.unit = null;
        payload.rune = null;
        payload.targets = null;
    },
);
