import { _decorator, Animation, AnimationClip, Component, Node, Vec3, sp } from 'cc';
import { BattleEventBus } from './BattleEventBus';
import { BattleUnit } from './BattleUnit';

const { ccclass, property } = _decorator;

const _targetPosition = new Vec3();
const _delta = new Vec3();
const _facingDelta = new Vec3();
const _euler = new Vec3();

export const AnimName = {
    IDLE: 'idle',
    MOVE: 'move',
    RUN: 'run',
    ATTACK: 'attack',
    HIT: 'hit',
    DIE: 'die',
} as const;

type UnitViewState = 'idle' | 'move' | 'attack' | 'hit' | 'die';
type BattleAnimName = typeof AnimName[keyof typeof AnimName];
type UnitViewReuseArgs = {
    unitId?: string;
    useXZPlane?: boolean;
    planeY?: number;
    coordinateScale2D?: number;
};

type BattleUnitEventSource = BattleUnit & {
    on?: (eventName: string, callback: (...args: unknown[]) => void, target?: unknown) => void;
    off?: (eventName: string, callback: (...args: unknown[]) => void, target?: unknown) => void;
    subscribe?: (eventName: string, callback: (...args: unknown[]) => void, target?: unknown) => void;
    unsubscribe?: (eventName: string, callback: (...args: unknown[]) => void, target?: unknown) => void;
};

const ANIM_ALIASES: Record<UnitViewState, string[]> = {
    idle: [AnimName.IDLE, 'idle_01'],
    move: [AnimName.RUN, AnimName.MOVE, 'move_01', 'run_01'],
    attack: [AnimName.ATTACK, 'attack_01'],
    hit: [AnimName.HIT, 'hurt', 'hurt_01'],
    die: [AnimName.DIE, 'death', 'death_01'],
};

@ccclass('BattleUnitView')
export class BattleUnitView extends Component {
    @property(Node)
    public visualRoot: Node | null = null;

    @property
    public useXZPlane = true;

    @property
    public planeY = 0;

    @property
    public coordinateScale2D = 120;

    @property
    public movementThreshold = 0.01;

    @property
    public rotateWithMovement = false;

    @property
    public flipWithMovement = true;

    @property
    public faceRightWhenPositiveX = true;

    private spine: sp.Skeleton | null = null;
    private anim: Animation | null = null;
    private unit: BattleUnit | null = null;
    private battleEventBus: BattleEventBus | null = null;
    private unitId = '';
    private currentState: UnitViewState = 'idle';
    private currentAnim = '';
    private currentLoop = true;
    private attackLockRemaining = 0;
    private hitLockRemaining = 0;
    private initialized = false;
    private hasDied = false;
    private lastPosition = new Vec3();
    private readonly baseNodeScale = new Vec3();
    private readonly baseVisualScale = new Vec3();
    private readonly baseVisualEuler = new Vec3();
    private baseTransformsInitialized = false;
    private readonly unitEventUnbinds: Array<() => void> = [];

    private readonly onBasicAttackFired = (payload?: { source?: BattleUnit; missed?: boolean }) => {
        if (!payload?.source || payload.missed || payload.source.unitId !== this.unitId) {
            return;
        }

        this.handleAttack();
    };

    private readonly onSkillCast = (payload?: { caster?: BattleUnit }) => {
        if (payload?.caster?.unitId !== this.unitId) {
            return;
        }

        this.handleAttack();
    };

    private readonly onBuiltinSkillTriggered = (payload?: { unit?: BattleUnit }) => {
        if (payload?.unit?.unitId !== this.unitId) {
            return;
        }

        this.handleAttack();
    };

    private readonly onUnitHitReactRequested = (payload?: { target?: BattleUnit }) => {
        if (payload?.target?.unitId !== this.unitId) {
            return;
        }

        this.handleHit();
    };

    private readonly onUnitDied = (payload?: { unit?: BattleUnit }) => {
        if (payload?.unit?.unitId !== this.unitId) {
            return;
        }

        this.handleDeath();
    };

    protected onLoad(): void {
        this.captureBaseTransforms();
        this.resolveAnimationComponents();
    }

    protected onDestroy(): void {
        this.detachUnitEvents();
        this.detachBattleEvents();
    }

    protected update(deltaSeconds: number): void {
        if (!this.unit) {
            return;
        }

        if (this.attackLockRemaining > 0) {
            this.attackLockRemaining = Math.max(0, this.attackLockRemaining - deltaSeconds);
        }
        if (this.hitLockRemaining > 0) {
            this.hitLockRemaining = Math.max(0, this.hitLockRemaining - deltaSeconds);
        }
    }

    public bind(unit: BattleUnit, eventBus?: BattleEventBus): void {
        this.captureBaseTransforms();
        this.resolveAnimationComponents();
        this.detachUnitEvents();
        this.detachBattleEvents();
        this.resetRuntimeState();

        this.unit = unit;
        this.unitId = unit.unitId;
        this.syncPositionFromUnit(1);
        this.lastPosition.set(this.node.position);
        this.initialized = true;

        this.attachUnitEvents(unit);
        if (eventBus) {
            this.attachBattleEvents(eventBus);
        }

        if (!unit.isAlive()) {
            this.handleDeath();
            return;
        }

        this.currentState = 'idle';
        this.playAnim(AnimName.IDLE, true);
    }

    public getUnitId(): string {
        return this.unitId;
    }

    public reuse(args?: UnitViewReuseArgs): void {
        this.captureBaseTransforms();
        this.resolveAnimationComponents();
        this.detachUnitEvents();
        this.detachBattleEvents();
        this.resetRuntimeState();
        if (args?.useXZPlane !== undefined) {
            this.useXZPlane = args.useXZPlane;
        }
        if (args?.planeY !== undefined) {
            this.planeY = args.planeY;
        }
        if (args?.coordinateScale2D !== undefined) {
            this.coordinateScale2D = args.coordinateScale2D;
        }
        if (args?.unitId) {
            this.unitId = args.unitId;
        }

        this.node.active = true;
        this.restoreVisualTransform();
    }

    public unuse(): void {
        this.detachUnitEvents();
        this.detachBattleEvents();
        this.stopCurrentAnimation();
        this.resetRuntimeState();
        this.restoreVisualTransform();
        this.node.active = false;
    }

    public playAttack(lockSeconds: number = 0.18): void {
        this.handleAttack(lockSeconds);
    }

    public playSkill(lockSeconds: number = 0.24): void {
        this.handleAttack(lockSeconds);
    }

    public playHurt(lockSeconds: number = 0.16): void {
        this.handleHit(lockSeconds);
    }

    public playDeath(): void {
        this.handleDeath();
    }

    public sync(unit: BattleUnit, alpha: number): void {
        this.unit = unit;
        this.syncPositionFromUnit(alpha);

        if (!this.initialized) {
            this.lastPosition.set(this.node.position);
            this.initialized = true;
        }

        if (!unit.isAlive()) {
            this.handleDeath();
            this.lastPosition.set(this.node.position);
            return;
        }

        Vec3.subtract(_delta, this.node.position, this.lastPosition);
        const moved = _delta.lengthSqr() > this.movementThreshold * this.movementThreshold;

        this.updateFacing(this.resolveFacingDelta(unit, _delta));

        if (this.hitLockRemaining > 0) {
            this.currentState = 'hit';
            this.playAnim(AnimName.HIT, false);
            this.lastPosition.set(this.node.position);
            return;
        }

        if (this.attackLockRemaining > 0) {
            this.currentState = 'attack';
            this.playAnim(AnimName.ATTACK, false);
            this.lastPosition.set(this.node.position);
            return;
        }

        if (moved) {
            if (this.currentState !== 'move') {
                this.handleMoveStart();
            }
        } else if (this.currentState === 'move') {
            this.handleMoveStop();
        } else if (this.currentState !== 'idle') {
            this.currentState = 'idle';
            this.playAnim(AnimName.IDLE, true);
        }

        this.lastPosition.set(this.node.position);
    }

    private resolveAnimationComponents(): void {
        const root = this.visualRoot ?? this.node;
        this.spine = root.getComponentInChildren(sp.Skeleton) ?? this.getComponentInChildren(sp.Skeleton);
        this.anim = root.getComponentInChildren(Animation) ?? this.getComponentInChildren(Animation);
    }

    private playAnim(animName: BattleAnimName, loop: boolean = true): void {
        if (this.hasDied && animName !== AnimName.DIE) {
            return;
        }

        const candidates = this.resolveAnimCandidates(animName);
        for (const candidate of candidates) {
            if (this.spine && this.canPlaySpineAnim(candidate)) {
                try {
                    if (this.currentAnim === candidate && this.currentLoop === loop) {
                        return;
                    }

                    this.spine.setAnimation(0, candidate, loop);
                    this.currentAnim = candidate;
                    this.currentLoop = loop;
                    return;
                } catch (error) {
                    console.warn(`[BattleUnitView] Failed to play spine animation: ${candidate}`, error);
                }
            }

            if (this.anim) {
                const state = this.anim.getState(candidate);
                if (!state) {
                    continue;
                }

                state.wrapMode = loop ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;
                state.repeatCount = loop ? Infinity : 1;
                this.anim.play(candidate);
                this.currentAnim = candidate;
                this.currentLoop = loop;
                return;
            }
        }
    }

    private handleMoveStart(): void {
        if (this.hasDied) {
            return;
        }

        this.currentState = 'move';
        this.playAnim(AnimName.MOVE, true);
    }

    private handleMoveStop(): void {
        if (this.hasDied) {
            return;
        }

        this.currentState = 'idle';
        this.playAnim(AnimName.IDLE, true);
    }

    private handleAttack(lockSeconds: number = 0.18): void {
        if (this.hasDied) {
            return;
        }

        this.attackLockRemaining = Math.max(this.attackLockRemaining, lockSeconds);
        this.currentState = 'attack';
        this.playAnim(AnimName.ATTACK, false);
    }

    private handleHit(lockSeconds: number = 0.16): void {
        if (this.hasDied) {
            return;
        }

        this.hitLockRemaining = Math.max(this.hitLockRemaining, lockSeconds);
        this.currentState = 'hit';
        this.playAnim(AnimName.HIT, false);
    }

    private handleDeath(): void {
        if (this.hasDied) {
            return;
        }

        this.hasDied = true;
        this.attackLockRemaining = 0;
        this.hitLockRemaining = 0;
        this.currentState = 'die';
        this.playAnim(AnimName.DIE, false);
    }

    private updateFacing(delta: Vec3): void {
        const target = this.visualRoot ?? this.node;
        const axis = this.useXZPlane ? delta.x : delta.x;
        if (Math.abs(axis) <= this.movementThreshold) {
            return;
        }

        if (this.flipWithMovement) {
            const forwardSign = axis >= 0
                ? (this.faceRightWhenPositiveX ? 1 : -1)
                : (this.faceRightWhenPositiveX ? -1 : 1);
            const scaleX = Math.abs(this.baseVisualScale.x) * forwardSign;
            target.setScale(scaleX, this.baseVisualScale.y, this.baseVisualScale.z);
            return;
        }

        if (!this.rotateWithMovement) {
            return;
        }

        if (this.useXZPlane) {
            const yaw = Math.atan2(delta.x, delta.z) * 180 / Math.PI;
            _euler.set(0, yaw, 0);
        } else {
            const yaw = Math.atan2(delta.y, delta.x) * 180 / Math.PI;
            _euler.set(0, yaw, 0);
        }
        target.eulerAngles = _euler;
    }

    private resolveFacingDelta(unit: BattleUnit, movementDelta: Vec3): Vec3 {
        if (Math.abs(movementDelta.x) > this.movementThreshold) {
            return movementDelta;
        }

        const trackedTarget = unit.getTrackedTarget();
        if (!trackedTarget || !trackedTarget.isAlive()) {
            return movementDelta;
        }

        const selfPosition = unit.pos;
        const targetPosition = trackedTarget.pos;
        if (this.useXZPlane) {
            _facingDelta.set(
                targetPosition.x - selfPosition.x,
                0,
                targetPosition.y - selfPosition.y,
            );
            return _facingDelta;
        }

        _facingDelta.set(
            (targetPosition.x - selfPosition.x) * this.coordinateScale2D,
            (targetPosition.y - selfPosition.y) * this.coordinateScale2D,
            0,
        );
        return _facingDelta;
    }

    private syncPositionFromUnit(alpha: number): void {
        if (!this.unit) {
            return;
        }

        const previousPosition = this.unit.getPreviousPosition();
        const currentPosition = this.unit.getPosition();
        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        const x = previousPosition.x + (currentPosition.x - previousPosition.x) * clampedAlpha;
        const y = previousPosition.y + (currentPosition.y - previousPosition.y) * clampedAlpha;
        if (this.useXZPlane) {
            _targetPosition.set(x, this.planeY, y);
        } else {
            _targetPosition.set(
                x * this.coordinateScale2D,
                y * this.coordinateScale2D,
                0,
            );
        }

        this.node.setPosition(_targetPosition);
    }

    private attachBattleEvents(eventBus: BattleEventBus): void {
        this.battleEventBus = eventBus;
        eventBus.subscribe('BasicAttackFired', this.onBasicAttackFired, this);
        eventBus.subscribe('SkillCast', this.onSkillCast, this);
        eventBus.subscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
        eventBus.subscribe('UnitHitReactRequested', this.onUnitHitReactRequested, this);
        eventBus.subscribe('UnitDied', this.onUnitDied, this);
    }

    private detachBattleEvents(): void {
        if (!this.battleEventBus) {
            return;
        }

        this.battleEventBus.unsubscribe('BasicAttackFired', this.onBasicAttackFired, this);
        this.battleEventBus.unsubscribe('SkillCast', this.onSkillCast, this);
        this.battleEventBus.unsubscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
        this.battleEventBus.unsubscribe('UnitHitReactRequested', this.onUnitHitReactRequested, this);
        this.battleEventBus.unsubscribe('UnitDied', this.onUnitDied, this);
        this.battleEventBus = null;
    }

    private attachUnitEvents(unit: BattleUnit): void {
        const eventSource = unit as BattleUnitEventSource;
        this.tryBindUnitEvent(eventSource, 'MoveStart', this.handleMoveStart);
        this.tryBindUnitEvent(eventSource, 'MoveStop', this.handleMoveStop);
        this.tryBindUnitEvent(eventSource, 'Attack', this.handleAttack);
        this.tryBindUnitEvent(eventSource, 'Hit', this.handleHit);
        this.tryBindUnitEvent(eventSource, 'Die', this.handleDeath);
    }

    private detachUnitEvents(): void {
        for (const unbind of this.unitEventUnbinds) {
            unbind();
        }
        this.unitEventUnbinds.length = 0;
    }

    private tryBindUnitEvent(
        eventSource: BattleUnitEventSource,
        eventName: string,
        handler: () => void,
    ): void {
        const boundHandler = handler.bind(this);
        if (typeof eventSource.on === 'function' && typeof eventSource.off === 'function') {
            eventSource.on(eventName, boundHandler, this);
            this.unitEventUnbinds.push(() => {
                eventSource.off?.(eventName, boundHandler, this);
            });
            return;
        }

        if (typeof eventSource.subscribe === 'function' && typeof eventSource.unsubscribe === 'function') {
            eventSource.subscribe(eventName, boundHandler, this);
            this.unitEventUnbinds.push(() => {
                eventSource.unsubscribe?.(eventName, boundHandler, this);
            });
        }
    }

    private canPlaySpineAnim(animName: string): boolean {
        const skeletonData = this.spine?.skeletonData as (sp.SkeletonData & {
            getRuntimeData?: () => { findAnimation?: (name: string) => unknown };
        }) | null;
        const runtimeData = skeletonData?.getRuntimeData?.();
        if (!runtimeData?.findAnimation) {
            return true;
        }

        return !!runtimeData.findAnimation(animName);
    }

    private resolveAnimCandidates(animName: BattleAnimName): string[] {
        if (animName === AnimName.IDLE) {
            return ANIM_ALIASES.idle;
        }
        if (animName === AnimName.MOVE || animName === AnimName.RUN) {
            return ANIM_ALIASES.move;
        }
        if (animName === AnimName.ATTACK) {
            return ANIM_ALIASES.attack;
        }
        if (animName === AnimName.HIT) {
            return ANIM_ALIASES.hit;
        }

        return ANIM_ALIASES.die;
    }

    private stopCurrentAnimation(): void {
        this.spine?.clearTrack(0);
        this.anim?.stop();
    }

    private restoreVisualTransform(): void {
        this.node.setScale(this.baseNodeScale);
        const target = this.visualRoot ?? this.node;
        target.setScale(this.baseVisualScale);
        target.eulerAngles = this.baseVisualEuler;
    }

    private captureBaseTransforms(): void {
        if (this.baseTransformsInitialized) {
            return;
        }

        this.baseNodeScale.set(this.node.scale);
        const target = this.visualRoot ?? this.node;
        this.baseVisualScale.set(target.scale);
        this.baseVisualEuler.set(target.eulerAngles);
        this.baseTransformsInitialized = true;
    }

    private resetRuntimeState(): void {
        this.unit = null;
        this.unitId = '';
        this.currentState = 'idle';
        this.currentAnim = '';
        this.currentLoop = true;
        this.attackLockRemaining = 0;
        this.hitLockRemaining = 0;
        this.initialized = false;
        this.hasDied = false;
        this.lastPosition.set(Vec3.ZERO);
    }
}
