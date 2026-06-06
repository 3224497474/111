import { _decorator, Component, Vec3 } from 'cc';
import type { IProjectileState } from './Types';

const { ccclass, property } = _decorator;

const _position = new Vec3();

type ProjectileReuseArgs = {
    projectileId?: string;
    useXZPlane?: boolean;
    planeY?: number;
    coordinateScale2D?: number;
};

@ccclass('BattleProjectileView')
export class BattleProjectileView extends Component {
    @property
    public useXZPlane = true;

    @property
    public planeY = 0;

    @property
    public coordinateScale2D = 120;

    @property
    public skillProjectileScaleMultiplier = 1.2;

    private projectileId = '';
    private readonly baseScale = new Vec3(1, 1, 1);
    private baseScaleInitialized = false;

    public bindProjectile(projectileId: string): void {
        this.projectileId = projectileId;
    }

    public getProjectileId(): string {
        return this.projectileId;
    }

    public reuse(args?: ProjectileReuseArgs): void {
        this.captureBaseScale();
        this.projectileId = args?.projectileId ?? '';
        if (args?.useXZPlane !== undefined) {
            this.useXZPlane = args.useXZPlane;
        }
        if (args?.planeY !== undefined) {
            this.planeY = args.planeY;
        }
        if (args?.coordinateScale2D !== undefined) {
            this.coordinateScale2D = args.coordinateScale2D;
        }
        this.node.setScale(this.baseScale);
        this.node.active = true;
    }

    public unuse(): void {
        this.captureBaseScale();
        this.projectileId = '';
        this.node.setScale(this.baseScale);
        this.node.active = false;
    }

    public sync(projectile: IProjectileState, alpha: number): void {
        this.captureBaseScale();

        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        const x = projectile.previousPosition.x
            + (projectile.currentPosition.x - projectile.previousPosition.x) * clampedAlpha;
        const y = projectile.previousPosition.y
            + (projectile.currentPosition.y - projectile.previousPosition.y) * clampedAlpha;

        if (this.useXZPlane) {
            _position.set(x, this.planeY, y);
        } else {
            _position.set(
                x * this.coordinateScale2D,
                y * this.coordinateScale2D,
                0,
            );
        }

        this.node.setPosition(_position);

        const scaleMultiplier = projectile.sourceSkillId ? this.skillProjectileScaleMultiplier : 1;
        _position.set(
            this.baseScale.x * scaleMultiplier,
            this.baseScale.y * scaleMultiplier,
            this.baseScale.z * scaleMultiplier,
        );
        this.node.setScale(_position);
    }

    private captureBaseScale(): void {
        if (this.baseScaleInitialized) {
            return;
        }

        this.baseScale.set(this.node.scale);
        this.baseScaleInitialized = true;
    }
}
