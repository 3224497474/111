import { AttackType, type IPoint, type IUnitAttributes, type IUnitConfig } from '../data/Types';

// `battle/core` 下的逻辑单位定义。
// 与上层 `battle/BattleUnit.ts` 对应，主要服务于分层目录结构中的纯逻辑引用。
const DEFAULT_ATTRIBUTES: IUnitAttributes = {
    hp: 100,
    maxHp: 100,
    mp: 0,
    maxMp: 100,
    attack: 20,
    defense: 5,
    speed: 4,
    attackSpeed: 1,
    attackRange: 1.2,
    critRate: 0.05,
    critDamage: 1.5,
    hitRate: 1,
    dodgeRate: 0,
    mpGainPerAttack: 20,
};

export class BattleUnit {
    // 单位唯一 ID。
    public readonly unitId: string;
    // 角色或怪物的资源/配置角色 ID。
    public readonly roleId: string;
    // 配置表主键。
    public readonly configId: number;
    // 是否属于玩家侧。
    public readonly isPlayer: boolean;
    // 编队位次。
    public readonly position: number;
    // 等级。
    public readonly level: number;
    // 展示名称。
    public readonly name: string;
    // 元素类型。
    public readonly element: IUnitConfig['element'];
    // 可拥有的技能 ID 列表。
    public readonly skillIds: number[];
    // 自动释放的内置技能 ID。
    public readonly builtinSkillId: number | null;
    // 攻击类型，区分近战/远程。
    public readonly attackType: AttackType;
    // 投射物飞行速度。
    public readonly projectileSpeed: number;
    // 投射物表现资源 ID。
    public readonly projectileEffectId: string | undefined;
    // 命中特效资源 ID。
    public readonly impactEffectId: string | undefined;
    // 近战命中特效资源 ID。
    public readonly meleeEffectId: string | undefined;

    // 运行期属性快照。
    private attributes: IUnitAttributes;
    // 战斗平面中的逻辑坐标。
    private logicalPosition: IPoint;
    // 普攻剩余冷却。
    private attackCooldownRemaining = 0;
    // 内置技能剩余冷却。
    private builtinSkillCooldownRemaining = 0;
    // 被控剩余时间。
    private controlRemaining = 0;
    // 死亡标记。
    private dead = false;

    constructor(config: IUnitConfig) {
        this.unitId = config.unitId;
        this.roleId = config.roleId || config.unitId;
        this.configId = config.configId;
        this.isPlayer = config.isPlayer;
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

        // 合并默认值与配置，得到运行期稳定属性快照。
        const merged = {
            ...DEFAULT_ATTRIBUTES,
            ...config.baseAttributes,
        };
        merged.hp = Math.min(merged.hp, merged.maxHp);
        merged.mp = Math.min(merged.mp, merged.maxMp);
        if (this.attackType === AttackType.RANGED && !config.baseAttributes?.attackRange) {
            merged.attackRange = 6;
        }
        this.attributes = merged;
        this.logicalPosition = config.spawnPosition ? { ...config.spawnPosition } : { x: 0, y: 0 };
    }

    public get hp(): number {
        return this.attributes.hp;
    }

    public get maxHp(): number {
        return this.attributes.maxHp;
    }

    public get mp(): number {
        return this.attributes.mp;
    }

    public get maxMp(): number {
        return this.attributes.maxMp;
    }

    public get attack(): number {
        return this.attributes.attack;
    }

    public get defense(): number {
        return this.attributes.defense;
    }

    public get speed(): number {
        return this.attributes.speed;
    }

    public get attackSpeed(): number {
        return this.attributes.attackSpeed;
    }

    public get attackRange(): number {
        return this.attributes.attackRange;
    }

    public get critRate(): number {
        return this.attributes.critRate;
    }

    public get critDamage(): number {
        return this.attributes.critDamage;
    }

    public get hitRate(): number {
        return this.attributes.hitRate;
    }

    public get dodgeRate(): number {
        return this.attributes.dodgeRate;
    }

    public get mpGainPerAttack(): number {
        return this.attributes.mpGainPerAttack;
    }

    public getPosition(): IPoint {
        return { ...this.logicalPosition };
    }

    public setPosition(position: IPoint): void {
        this.logicalPosition.x = position.x;
        this.logicalPosition.y = position.y;
    }

    public getAttributes(): IUnitAttributes {
        return { ...this.attributes };
    }

    public setAttributes(attributes: IUnitAttributes): void {
        this.attributes = {
            ...attributes,
            hp: Math.max(0, Math.min(attributes.hp, attributes.maxHp)),
            mp: Math.max(0, Math.min(attributes.mp, attributes.maxMp)),
        };
        this.dead = this.attributes.hp <= 0;
    }

    public isAlive(): boolean {
        return !this.dead && this.attributes.hp > 0;
    }

    public canMove(): boolean {
        return this.isAlive() && this.controlRemaining <= 0;
    }

    public isControlled(): boolean {
        return this.controlRemaining > 0;
    }

    public tick(deltaSeconds: number): void {
        if (deltaSeconds <= 0) return;

        // 统一推进所有时间型状态，避免冷却和控制分散到外部维护。
        this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - deltaSeconds);
        this.builtinSkillCooldownRemaining = Math.max(0, this.builtinSkillCooldownRemaining - deltaSeconds);
        this.controlRemaining = Math.max(0, this.controlRemaining - deltaSeconds);
    }

    public applyControl(durationSeconds: number): void {
        if (durationSeconds <= 0) return;
        this.controlRemaining = Math.max(this.controlRemaining, durationSeconds);
    }

    public canAttack(): boolean {
        return this.isAlive() && this.attackCooldownRemaining <= 0;
    }

    public beginAttackCooldown(): void {
        const attackSpeed = Math.max(0.1, this.attackSpeed);
        this.attackCooldownRemaining = 1 / attackSpeed;
    }

    public canCastBuiltinSkill(): boolean {
        return (
            this.isAlive() &&
            this.builtinSkillId !== null &&
            // 当前内置技能的触发条件仍然是 MP 满。
            this.attributes.maxMp > 0 &&
            this.attributes.mp >= this.attributes.maxMp &&
            this.builtinSkillCooldownRemaining <= 0
        );
    }

    public beginBuiltinSkillCooldown(durationSeconds: number): void {
        this.builtinSkillCooldownRemaining = Math.max(0, durationSeconds);
    }

    public resetMp(): void {
        this.attributes.mp = 0;
    }

    public gainMp(amount: number): void {
        if (amount <= 0 || !this.isAlive()) return;
        this.attributes.mp = Math.min(this.attributes.maxMp, this.attributes.mp + amount);
    }

    public takeDamage(amount: number): boolean {
        if (amount <= 0 || !this.isAlive()) return false;
        this.attributes.hp = Math.max(0, this.attributes.hp - amount);
        if (this.attributes.hp <= 0) {
            this.dead = true;
            return true;
        }
        return false;
    }

    public heal(amount: number): void {
        if (amount <= 0 || !this.isAlive()) return;
        this.attributes.hp = Math.min(this.attributes.maxHp, this.attributes.hp + amount);
    }
}
