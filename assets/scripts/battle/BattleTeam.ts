import type { BattleUnit } from './BattleUnit';
import { TeamType, type IPoint } from './Types';

const FORMATION_OFFSETS: IPoint[] = [
    { x: 0, y: 0 },
    { x: -0.8, y: 0.4 },
    { x: 0.8, y: 0.4 },
    { x: -0.4, y: -0.6 },
    { x: 0.4, y: -0.6 },
];

export class BattleTeam {
    public readonly units: BattleUnit[];
    public readonly teamId: string;
    public readonly teamType: TeamType;
    public readonly isPlayerTeam: boolean;
    public anchorPosition: IPoint;
    public moveTarget: IPoint | null = null;

    private readonly aliveUnits = new Set<BattleUnit>();
    private opponentTeam: BattleTeam | null = null;

    constructor(teamId: string, teamType: TeamType, units: BattleUnit[], anchorPosition: IPoint) {
        this.teamId = teamId;
        this.teamType = teamType;
        this.isPlayerTeam = teamType === TeamType.Player;
        this.units = units;
        this.anchorPosition = { ...anchorPosition };
        this.rebuildAliveUnits();
    }

    public bindOpponentTeam(opponentTeam: BattleTeam): void {
        this.opponentTeam = opponentTeam;
    }

    public getOpponentTeam(): BattleTeam | null {
        return this.opponentTeam;
    }

    public hasUnit(unit: BattleUnit): boolean {
        return this.units.includes(unit);
    }

    public hasAliveUnit(unit: BattleUnit): boolean {
        return this.aliveUnits.has(unit);
    }

    public getAliveUnitSet(): ReadonlySet<BattleUnit> {
        return this.aliveUnits;
    }

    public getAliveUnits(): BattleUnit[] {
        return Array.from(this.aliveUnits);
    }

    public rebuildAliveUnits(): void {
        this.aliveUnits.clear();
        for (const unit of this.units) {
            if (unit.isAlive()) {
                this.aliveUnits.add(unit);
            }
        }
    }

    public addUnit(unit: BattleUnit): void {
        if (!this.units.includes(unit)) {
            this.units.push(unit);
        }
        if (unit.isAlive()) {
            this.aliveUnits.add(unit);
        }
    }

    public markUnitDead(unit: BattleUnit): void {
        this.aliveUnits.delete(unit);
    }

    public isAllDead(): boolean {
        return this.aliveUnits.size === 0;
    }

    public getAverageMoveSpeed(): number {
        if (this.aliveUnits.size === 0) {
            return 0;
        }

        let total = 0;
        for (const unit of this.aliveUnits) {
            total += unit.speed;
        }
        return total / this.aliveUnits.size;
    }

    public setMoveTarget(target: IPoint | null): void {
        this.moveTarget = target ? { ...target } : null;
    }

    public getFormationOffset(index: number): IPoint {
        const offset = FORMATION_OFFSETS[index] ?? { x: 0, y: 0 };
        return this.isPlayerTeam ? offset : { x: -offset.x, y: offset.y };
    }

    public getCenterPosition(): IPoint {
        if (this.aliveUnits.size === 0) {
            return { ...this.anchorPosition };
        }

        let x = 0;
        let y = 0;
        for (const unit of this.aliveUnits) {
            const position = unit.getPosition();
            x += position.x;
            y += position.y;
        }

        return {
            x: x / this.aliveUnits.size,
            y: y / this.aliveUnits.size,
        };
    }
}
