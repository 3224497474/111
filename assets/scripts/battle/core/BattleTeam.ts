import type { BattleUnit } from './BattleUnit';
import type { IPoint } from '../data/Types';

// `battle/core` 下的队伍逻辑定义。
// 与上层 `battle/BattleTeam.ts` 对应，主要为分层目录结构提供独立引用路径。
const FORMATION_OFFSETS: IPoint[] = [
    { x: 0, y: 0 },
    { x: -0.8, y: 0.4 },
    { x: 0.8, y: 0.4 },
    { x: -0.4, y: -0.6 },
    { x: 0.4, y: -0.6 },
];

export class BattleTeam {
    // 队伍内全部单位，包含已死亡单位。
    public readonly units: BattleUnit[];
    // 是否为玩家队伍。
    public readonly isPlayerTeam: boolean;
    // 队伍唯一标识。
    public readonly teamId: string;
    // 阵型锚点。
    public anchorPosition: IPoint;
    // 目标移动点。
    public moveTarget: IPoint | null = null;

    // 【新增】保存动态传入的阵型偏移
    private readonly formationOffsets: IPoint[];

    constructor(teamId: string, isPlayerTeam: boolean, units: BattleUnit[], anchorPosition: IPoint, formationOffsets: IPoint[]) {
        this.teamId = teamId;
        this.isPlayerTeam = isPlayerTeam;
        this.units = units;
        this.anchorPosition = { ...anchorPosition };
      // 默认保底阵型
        this.formationOffsets = formationOffsets ?? [
            { x: 0, y: 0 }, { x: -0.8, y: 0.4 }, { x: 0.8, y: 0.4 },
            { x: -0.4, y: -0.6 }, { x: 0.4, y: -0.6 }
        ];
    }



    public getAliveUnits(): BattleUnit[] {
        return this.units.filter((unit) => unit.isAlive());
    }

    public isAllDead(): boolean {
        return this.getAliveUnits().length === 0;
    }

    public getAverageMoveSpeed(): number {
        const alive = this.getAliveUnits();
        if (alive.length === 0) return 0;

        let total = 0;
        for (const unit of alive) {
            total += unit.speed;
        }
        return total / alive.length;
    }

    public setMoveTarget(target: IPoint | null): void {
        this.moveTarget = target ? { ...target } : null;
    }

    public getFormationOffset(index: number): IPoint {
        // 敌方队伍做镜像偏移，保证默认站位朝向相对。
    const offset = this.formationOffsets[index] ?? { x: 0, y: 0 };
        return this.isPlayerTeam ? offset : { x: -offset.x, y: offset.y };
    }

    public getCenterPosition(): IPoint {
        const alive = this.getAliveUnits();
        if (alive.length === 0) {
            return { ...this.anchorPosition };
        }

        let x = 0;
        let y = 0;
        for (const unit of alive) {
            const position = unit.getPosition();
            x += position.x;
            y += position.y;
        }

        return {
            x: x / alive.length,
            y: y / alive.length,
        };
    }
}
