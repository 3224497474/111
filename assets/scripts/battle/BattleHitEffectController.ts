import { _decorator, Component, Node, Vec3 } from 'cc';
import { fastRemove } from './ArrayUtils';

const { ccclass, property } = _decorator;

type HitEffectStyle = 'attack' | 'skill' | 'impact';

interface IActiveHitEffect {
    target: Node;
    baseScale: Vec3;
    durationSeconds: number;
    remainingSeconds: number;
    scaleBonus: number;
    effectId?: string;
}

const _scale = new Vec3();

// 最小可用的命中特效控制器。
// 当前不依赖额外资源，先用目标节点的缩放脉冲做占位，后续可替换成真正的粒子/特效预制体。
@ccclass('BattleHitEffectController')
export class BattleHitEffectController extends Component {
    @property
    public attackDurationSeconds = 0.14;

    @property
    public skillDurationSeconds = 0.18;

    @property
    public impactDurationSeconds = 0.16;

    @property
    public attackScaleBonus = 0.08;

    @property
    public skillScaleBonus = 0.14;

    @property
    public impactScaleBonus = 0.11;

    private readonly activeEffects: IActiveHitEffect[] = [];

    public playOnTarget(target: Node | null, style: HitEffectStyle, effectId?: string): void {
        if (!target || !target.isValid) {
            return;
        }

        // 同一目标重复受击时直接覆盖旧脉冲，避免缩放叠乘失控。
        const existingIndex = this.activeEffects.findIndex((entry) => entry.target === target);
        const existingEntry = existingIndex >= 0 ? this.activeEffects[existingIndex] : null;
        const config = this.getStyleConfig(style);
        const entry: IActiveHitEffect = {
            target,
            baseScale: existingEntry?.baseScale.clone() ?? target.scale.clone(),
            durationSeconds: config.durationSeconds,
            remainingSeconds: config.durationSeconds,
            scaleBonus: config.scaleBonus,
            effectId,
        };

        if (existingIndex >= 0) {
            this.activeEffects[existingIndex] = entry;
        } else {
            this.activeEffects.push(entry);
        }

        this.applyScale(entry, 0);
    }

    update(deltaSeconds: number): void {
        if (deltaSeconds <= 0 || this.activeEffects.length === 0) {
            return;
        }

        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const entry = this.activeEffects[i];
            if (!entry.target.isValid) {
                fastRemove(this.activeEffects, i);
                continue;
            }

            entry.remainingSeconds = Math.max(0, entry.remainingSeconds - deltaSeconds);
            if (entry.remainingSeconds <= 0) {
                // 结束时恢复初始缩放，避免节点长期停留在脉冲后的尺寸。
                entry.target.setScale(entry.baseScale);
                fastRemove(this.activeEffects, i);
                continue;
            }

            const progress = 1 - entry.remainingSeconds / entry.durationSeconds;
            this.applyScale(entry, progress);
        }
    }

    private applyScale(entry: IActiveHitEffect, progress: number): void {
        const pulse = Math.sin(progress * Math.PI);
        const multiplier = 1 + entry.scaleBonus * pulse;
        _scale.set(
            entry.baseScale.x * multiplier,
            entry.baseScale.y * multiplier,
            entry.baseScale.z * multiplier,
        );
        entry.target.setScale(_scale);
    }

    private getStyleConfig(style: HitEffectStyle): { durationSeconds: number; scaleBonus: number } {
        switch (style) {
            case 'skill':
                return {
                    durationSeconds: this.skillDurationSeconds,
                    scaleBonus: this.skillScaleBonus,
                };
            case 'impact':
                return {
                    durationSeconds: this.impactDurationSeconds,
                    scaleBonus: this.impactScaleBonus,
                };
            case 'attack':
            default:
                return {
                    durationSeconds: this.attackDurationSeconds,
                    scaleBonus: this.attackScaleBonus,
                };
        }
    }
}
