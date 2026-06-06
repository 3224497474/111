import { BattleUnit } from '../../BattleUnit';
import { BaseClassRuntime } from '../../core/BaseClassRuntime';

export class AuraBattleRuntime extends BaseClassRuntime {
    private _auraRadius: number;
    private _affectedUnits = new Set<BattleUnit>();

    constructor(owner: BattleUnit, auraRadius: number) {
        super(owner);
        this._auraRadius = Math.max(0, auraRadius);
    }

    public override onEnterBattle(): void {
        this.scanAura();
    }

    public override onLogicUpdate(_dt: number): void {
        this.scanAura();
    }

    public override onDeath(): void {
        this.clearAura();
    }

    public override onDestroy(): void {
        this.clearAura();
    }

    private scanAura(): void {
        if (!this.owner.isAlive()) {
            this.clearAura();
            return;
        }

        const allies = this.owner.getTeam()?.getAliveUnitSet();
        if (!allies) {
            this.clearAura();
            return;
        }
        const nextAffectedUnits = new Set<BattleUnit>();
        const radiusSquared = this._auraRadius * this._auraRadius;
        const ownerPos = this.owner.pos;

        for (const ally of allies) {
            if (ally === this.owner) {
                continue;
            }

            const pos = ally.pos;
            const dx = ownerPos.x - pos.x;
            const dy = ownerPos.y - pos.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > radiusSquared) {
                continue;
            }

            nextAffectedUnits.add(ally);
            if (!this._affectedUnits.has(ally)) {
                console.log('[Aura] ally entered aura range', this.owner.unitId, ally.unitId);
            }
        }

        for (const ally of this._affectedUnits) {
            if (nextAffectedUnits.has(ally)) {
                continue;
            }
            console.log('[Aura] ally left aura range', this.owner.unitId, ally.unitId);
        }

        this._affectedUnits = nextAffectedUnits;
    }

    private clearAura(): void {
        for (const ally of this._affectedUnits) {
            console.log('[Aura] ally left aura range', this.owner.unitId, ally.unitId);
        }
        this._affectedUnits.clear();
    }
}
