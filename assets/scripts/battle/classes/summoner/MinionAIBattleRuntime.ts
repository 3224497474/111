import { BattleUnit } from '../../BattleUnit';
import { BaseClassRuntime } from '../../core/BaseClassRuntime';

export class MinionAIBattleRuntime extends BaseClassRuntime {
    private static readonly FOLLOW_DISTANCE = 2.8;
    private static readonly FOLLOW_DISTANCE_SQUARED =
        MinionAIBattleRuntime.FOLLOW_DISTANCE * MinionAIBattleRuntime.FOLLOW_DISTANCE;

    private readonly master: BattleUnit;
    private _enraged = false;

    constructor(owner: BattleUnit, master: BattleUnit) {
        super(owner);
        this.master = master;
    }

    public override onLogicUpdate(dt: number): void {
        if (dt <= 0 || !this.owner.isAlive()) {
            return;
        }

        this.syncMasterTarget();
        this.followMaster(dt);
        this.tryEnterEnrageState();
    }

    private syncMasterTarget(): void {
        const masterTarget = this.master.getTrackedTarget();
        if (!masterTarget || !masterTarget.isAlive() || masterTarget === this.owner) {
            return;
        }

        this.owner.resolveTrackedTarget(masterTarget);
    }

    private followMaster(dt: number): void {
        const ownerPos = this.owner.pos;
        const masterPos = this.master.pos;
        const dx = masterPos.x - ownerPos.x;
        const dy = masterPos.y - ownerPos.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared <= MinionAIBattleRuntime.FOLLOW_DISTANCE_SQUARED) {
            return;
        }

        const distance = Math.sqrt(distanceSquared);
        if (distance <= 0.0001) {
            return;
        }

        const maxStep = Math.max(0.2, this.owner.speed * dt);
        const ratio = Math.min(1, maxStep / distance);
        this.owner.setPosition({
            x: ownerPos.x + dx * ratio,
            y: ownerPos.y + dy * ratio,
        });
    }

    private tryEnterEnrageState(): void {
        if (this._enraged || this.master.isAlive()) {
            return;
        }

        this.owner.addBuff({
            definition: {
                buffId: 'summoner_minion_enrage',
                durationSeconds: Number.POSITIVE_INFINITY,
                maxStacks: 1,
                tags: ['enrage'],
                modifiers: [
                    { attribute: 'attack', percent: 0.35 },
                    { attribute: 'speed', percent: 0.2 },
                    { attribute: 'attackSpeed', percent: 0.15 },
                ],
            },
            sourceUnitId: this.owner.unitId,
        });
        this._enraged = true;
    }
}
