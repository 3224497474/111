import type { BattleTeam } from './BattleTeam';
import { BuffManager } from './BuffManager';
import {
    AttackType,
    TeamType,
    type IAppliedBuffConfig,
    type IBuffTickPayload,
    type IPoint,
    type IUnitAttributes,
    type IUnitBaseAttributes,
    type IUnitConfig,
    type IUnitCurrentAttributes,
    type TModifiableUnitAttribute,
} from './Types';
import { BaseClassRuntime } from './core/BaseClassRuntime';

const REQUIRED_ATTRIBUTE_KEYS: Array<keyof IUnitAttributes> = [
    'hp',
    'maxHp',
    'attack',
    'defense',
    'speed',
    'attackSpeed',
    'attackRange',
    'critRate',
    'critDamage',
    'hitRate',
    'dodgeRate',
];

export class BattleUnit {
    public readonly unitId: string;
    public readonly roleId: string;
    public readonly configId: number;
    public readonly isPlayer: boolean;
    public readonly position: number;
    public readonly level: number;
    public readonly name: string;
    public readonly element: IUnitConfig['element'];
    public readonly skillIds: number[];
    public readonly builtinSkillId: number | null;
    public readonly attackType: AttackType;
    public readonly projectileSpeed: number;
    public readonly projectileEffectId: string | undefined;
    public readonly impactEffectId: string | undefined;
    public readonly meleeEffectId: string | undefined;

    private readonly baseAttributes: IUnitBaseAttributes;
    private readonly currentAttributes: IUnitCurrentAttributes;
    private readonly buffManager: BuffManager;
    private previousLogicalPosition: IPoint;
    private logicalPosition: IPoint;
    private _teamType: TeamType;
    private team: BattleTeam | null = null;
    private opposingTeam: BattleTeam | null = null;
    private attackCooldownRemaining = 0;
    private builtinSkillCooldownRemaining = 0;
    private targetRefreshPending = true;
    private trackedTarget: BattleUnit | null = null;
    private _classRuntimes: BaseClassRuntime[] = [];
    private dead = false;

    constructor(config: IUnitConfig) {
        this.unitId = config.unitId;
        this.roleId = config.roleId || config.unitId;
        this.configId = config.configId;
        this.isPlayer = config.isPlayer;
        this._teamType = config.teamType ?? (config.isPlayer ? TeamType.Player : TeamType.Monster);
        this.position = config.position;
        this.level = config.level;
        this.name = config.name;
        this.element = config.element;
        this.skillIds = [...config.skillIds];
        this.builtinSkillId = config.builtinSkillId ?? null;
        this.attackType = config.attackType ?? AttackType.MELEE;
        this.projectileSpeed = config.projectileSpeed ?? 12;
        this.projectileEffectId = config.projectileEffectId;
        this.impactEffectId = config.impactEffectId;
        this.meleeEffectId = config.meleeEffectId;

        const resolved = BattleUnit.resolveAttributes(config.unitId, config.baseAttributes);
        this.baseAttributes = {
            maxHp: resolved.maxHp,
            attack: resolved.attack,
            defense: resolved.defense,
            speed: resolved.speed,
            attackSpeed: resolved.attackSpeed,
            attackRange: resolved.attackRange,
            critRate: resolved.critRate,
            critDamage: resolved.critDamage,
            hitRate: resolved.hitRate,
            dodgeRate: resolved.dodgeRate,
        };
        this.currentAttributes = {
            hp: Math.min(resolved.hp, resolved.maxHp),
        };
        this.buffManager = new BuffManager(this);
        this.logicalPosition = config.spawnPosition ? { ...config.spawnPosition } : { x: 0, y: 0 };
        this.previousLogicalPosition = { ...this.logicalPosition };
        this.reconcileCurrentAttributes();
    }

    public get hp(): number {
        return this.currentAttributes.hp;
    }

    public get maxHp(): number {
        return this.getModifiedAttributeValue('maxHp');
    }

    public get attack(): number {
        return this.getModifiedAttributeValue('attack');
    }

    public get defense(): number {
        return this.getModifiedAttributeValue('defense');
    }

    public get speed(): number {
        return this.getModifiedAttributeValue('speed');
    }

    public get attackSpeed(): number {
        return this.getModifiedAttributeValue('attackSpeed');
    }

    public get attackRange(): number {
        return this.getModifiedAttributeValue('attackRange');
    }

    public get critRate(): number {
        return this.getModifiedAttributeValue('critRate');
    }

    public get critDamage(): number {
        return this.getModifiedAttributeValue('critDamage');
    }

    public get hitRate(): number {
        return this.getModifiedAttributeValue('hitRate');
    }

    public get dodgeRate(): number {
        return this.getModifiedAttributeValue('dodgeRate');
    }

    public get pos(): Readonly<IPoint> {
        return this.logicalPosition;
    }

    public get teamType(): TeamType {
        return this._teamType;
    }

    public getTeam(): BattleTeam | null {
        return this.team;
    }

    public getOpponentTeam(): BattleTeam | null {
        return this.opposingTeam;
    }

    public bindBattleTeams(team: BattleTeam, opposingTeam: BattleTeam): void {
        this.team = team;
        this.opposingTeam = opposingTeam;
        this._teamType = team.teamType;
    }

    public isAllyOf(unit: BattleUnit): boolean {
        if (this.team && unit.team) {
            return this.team === unit.team;
        }

        return this._teamType === unit._teamType;
    }

    public isEnemyOf(unit: BattleUnit): boolean {
        if (this.team && unit.team) {
            return this.team !== unit.team;
        }

        return this._teamType !== unit._teamType;
    }

    public getPreviousPosition(): IPoint {
        return { ...this.previousLogicalPosition };
    }

    public getPosition(): IPoint {
        return { ...this.logicalPosition };
    }

    public capturePrevState(): void {
        this.previousLogicalPosition.x = this.logicalPosition.x;
        this.previousLogicalPosition.y = this.logicalPosition.y;
    }

    public setPosition(position: IPoint): void {
        this.logicalPosition.x = position.x;
        this.logicalPosition.y = position.y;
    }

    public getBaseAttributes(): IUnitBaseAttributes {
        return { ...this.baseAttributes };
    }

    public getCurrentAttributes(): IUnitCurrentAttributes {
        return { ...this.currentAttributes };
    }

    public getAttributes(): IUnitAttributes {
        return {
            ...this.baseAttributes,
            hp: this.hp,
            maxHp: this.maxHp,
            attack: this.attack,
            defense: this.defense,
            speed: this.speed,
            attackSpeed: this.attackSpeed,
            attackRange: this.attackRange,
            critRate: this.critRate,
            critDamage: this.critDamage,
            hitRate: this.hitRate,
            dodgeRate: this.dodgeRate,
        };
    }

    public addBuff(buff: IAppliedBuffConfig): boolean {
        const added = this.buffManager.addBuff(buff);
        if (added) {
            this.reconcileCurrentAttributes();
        }
        return added;
    }

    public hasBuffTag(tag: string): boolean {
        return this.buffManager.hasTag(tag);
    }

    public isControlImmune(): boolean {
        return this.buffManager.hasControlFlag('immuneControl');
    }

    public isAlive(): boolean {
        return !this.dead && this.currentAttributes.hp > 0;
    }

    public canMove(): boolean {
        return this.isAlive() && !this.buffManager.hasControlFlag('preventMove');
    }

    public addClassRuntime(runtime: BaseClassRuntime): void {
        this._classRuntimes.push(runtime);
        runtime.onInit();
    }

    public onEnterBattle(): void {
        for (const runtime of this._classRuntimes) {
            runtime.onEnterBattle();
        }
    }

    public update(
        deltaSeconds: number,
        onBuffTick?: (target: BattleUnit, payload: IBuffTickPayload) => void,
    ): void {
        if (deltaSeconds <= 0) return;

        this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - deltaSeconds);
        this.builtinSkillCooldownRemaining = Math.max(0, this.builtinSkillCooldownRemaining - deltaSeconds);
        this.buffManager.update(deltaSeconds, (payload) => {
            onBuffTick?.(this, payload);
        });
        this.reconcileCurrentAttributes();

        for (const runtime of this._classRuntimes) {
            runtime.onUpdate(deltaSeconds);
        }
    }

    public logicUpdate(deltaSeconds: number): void {
        if (deltaSeconds <= 0 || !this.isAlive()) return;

        if (this.trackedTarget && !this.trackedTarget.isAlive()) {
            this.trackedTarget = null;
        }
        this.targetRefreshPending = true;

        for (const runtime of this._classRuntimes) {
            runtime.onLogicUpdate(deltaSeconds);
        }
    }

    public needsTargetRefresh(): boolean {
        return this.targetRefreshPending;
    }

    public getTrackedTarget(): BattleUnit | null {
        return this.trackedTarget;
    }

    public resolveTrackedTarget(target: BattleUnit | null): void {
        this.trackedTarget = target;
        this.targetRefreshPending = false;
    }

    public applyControl(durationSeconds: number): void {
        if (durationSeconds <= 0) return;
        this.addBuff({
            definition: {
                buffId: 'legacy_control',
                durationSeconds,
                maxStacks: 1,
                tags: ['control'],
                controlFlags: {
                    preventMove: true,
                    preventAttack: true,
                    preventSkill: true,
                },
            },
        });
    }

    public canAttack(): boolean {
        return this.isAlive()
            && this.attackCooldownRemaining <= 0
            && !this.buffManager.hasControlFlag('preventAttack');
    }

    public beginAttackCooldown(): void {
        const attackSpeed = Math.max(0.1, this.attackSpeed);
        this.attackCooldownRemaining = 1 / attackSpeed;
    }

    public canCastBuiltinSkill(): boolean {
        return (
            this.isAlive()
            && this.builtinSkillId !== null
            && this.builtinSkillCooldownRemaining <= 0
            && !this.buffManager.hasControlFlag('preventSkill')
        );
    }

    public beginBuiltinSkillCooldown(durationSeconds: number): void {
        this.builtinSkillCooldownRemaining = Math.max(0, durationSeconds);
    }

    public takeDamage(amount: number): boolean {
        if (amount <= 0 || !this.isAlive()) return false;
        this.currentAttributes.hp = Math.max(0, this.currentAttributes.hp - amount);
        if (this.currentAttributes.hp <= 0) {
            this.dead = true;
            this.notifyDeath();
            return true;
        }
        return false;
    }

    public heal(amount: number): void {
        if (amount <= 0 || !this.isAlive()) return;
        this.currentAttributes.hp = Math.min(this.maxHp, this.currentAttributes.hp + amount);
    }

    public destroy(): void {
        for (const runtime of this._classRuntimes) {
            runtime.onDestroy();
        }
        this._classRuntimes.length = 0;
    }

    private notifyDeath(): void {
        for (const runtime of this._classRuntimes) {
            runtime.onDeath();
        }
    }

    private reconcileCurrentAttributes(): void {
        this.currentAttributes.hp = Math.max(0, Math.min(this.currentAttributes.hp, this.maxHp));
        this.dead = this.currentAttributes.hp <= 0;
    }

    private getModifiedAttributeValue(attribute: TModifiableUnitAttribute): number {
        const baseValue = this.baseAttributes[attribute];
        const modifier = this.buffManager.getAttributeModifier(attribute);
        const value = baseValue * (1 + modifier.percent) + modifier.flat;

        if (attribute === 'critRate' || attribute === 'hitRate' || attribute === 'dodgeRate') {
            return Math.max(0, value);
        }

        return Math.max(0, value);
    }

    private static resolveAttributes(
        unitId: string,
        baseAttributes?: Partial<IUnitAttributes>,
    ): IUnitAttributes {
        if (!baseAttributes) {
            throw new Error(`[BattleUnit] Missing baseAttributes for unit ${unitId}.`);
        }

        const missingKeys = REQUIRED_ATTRIBUTE_KEYS.filter((key) => {
            const value = baseAttributes[key];
            return typeof value !== 'number' || Number.isNaN(value);
        });
        if (missingKeys.length > 0) {
            throw new Error(`[BattleUnit] Incomplete baseAttributes for unit ${unitId}: ${missingKeys.join(', ')}.`);
        }

        const hp = baseAttributes.hp;
        if (typeof hp !== 'number' || Number.isNaN(hp)) {
            throw new Error(`[BattleUnit] Missing current attributes for unit ${unitId}.`);
        }

        return {
            hp,
            maxHp: baseAttributes.maxHp!,
            attack: baseAttributes.attack!,
            defense: baseAttributes.defense!,
            speed: baseAttributes.speed!,
            attackSpeed: baseAttributes.attackSpeed!,
            attackRange: baseAttributes.attackRange!,
            critRate: baseAttributes.critRate!,
            critDamage: baseAttributes.critDamage!,
            hitRate: baseAttributes.hitRate!,
            dodgeRate: baseAttributes.dodgeRate!,
        };
    }
}
