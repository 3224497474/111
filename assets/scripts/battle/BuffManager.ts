import type { BattleUnit } from './BattleUnit';
import type {
    IAppliedBuffConfig,
    IBuffControlFlags,
    IBuffRuntimeState,
    IBuffTickPayload,
    TModifiableUnitAttribute,
} from './Types';

export class BuffManager {
    private nextInstanceId = 0;
    private readonly activeBuffs: IBuffRuntimeState[] = [];

    constructor(private readonly owner: BattleUnit) {}

    public update(
        deltaSeconds: number,
        onBuffTick?: (payload: IBuffTickPayload) => void,
    ): void {
        if (deltaSeconds <= 0 || this.activeBuffs.length === 0) {
            return;
        }

        for (let i = this.activeBuffs.length - 1; i >= 0; i--) {
            const runtime = this.activeBuffs[i];
            const periodicDamage = runtime.definition.periodicDamage;

            if (periodicDamage && periodicDamage.intervalSeconds > 0) {
                runtime.tickAccumulator += deltaSeconds;
                while (runtime.tickAccumulator >= periodicDamage.intervalSeconds) {
                    runtime.tickAccumulator -= periodicDamage.intervalSeconds;
                    onBuffTick?.({
                        definition: runtime.definition,
                        sourceUnitId: runtime.sourceUnitId,
                        sourceSkillId: runtime.sourceSkillId,
                        sourceRuneId: runtime.sourceRuneId,
                        snapshotAttack: runtime.snapshotAttack ?? 0,
                        periodicDamage,
                    });
                }
            }

            if (!Number.isFinite(runtime.remainingSeconds)) {
                continue;
            }

            runtime.remainingSeconds -= deltaSeconds;
            if (runtime.remainingSeconds > 0) {
                continue;
            }

            this.activeBuffs.splice(i, 1);
        }
    }

    public addBuff(buff: IAppliedBuffConfig): boolean {
        const definition = this.normalizeControlBuff(buff);
        if (!definition) {
            return false;
        }

        const maxStacks = Math.max(1, definition.definition.maxStacks ?? 1);
        const sameBuffs = this.activeBuffs.filter((runtime) => runtime.definition.buffId === definition.definition.buffId);
        if (sameBuffs.length >= maxStacks) {
            if (maxStacks === 1) {
                const existing = sameBuffs[0];
                existing.definition = definition.definition;
                existing.remainingSeconds = definition.definition.durationSeconds;
                existing.tickAccumulator = 0;
                existing.sourceUnitId = definition.sourceUnitId;
                existing.sourceSkillId = definition.sourceSkillId;
                existing.sourceRuneId = definition.sourceRuneId;
                existing.snapshotAttack = definition.snapshotAttack;
                return true;
            }

            const oldest = sameBuffs[0];
            const index = this.activeBuffs.indexOf(oldest);
            if (index >= 0) {
                this.activeBuffs.splice(index, 1);
            }
        }

        this.nextInstanceId += 1;
        this.activeBuffs.push({
            ...definition,
            instanceId: `${definition.definition.buffId}_${this.nextInstanceId}`,
            remainingSeconds: definition.definition.durationSeconds,
            tickAccumulator: 0,
        });
        return true;
    }

    public hasControlFlag(flag: keyof IBuffControlFlags): boolean {
        for (const runtime of this.activeBuffs) {
            if (runtime.definition.controlFlags?.[flag]) {
                return true;
            }
        }

        return false;
    }

    public hasTag(tag: string): boolean {
        for (const runtime of this.activeBuffs) {
            if (runtime.definition.tags?.includes(tag)) {
                return true;
            }
        }

        return false;
    }

    public getAttributeModifier(attribute: TModifiableUnitAttribute): { flat: number; percent: number } {
        let flat = 0;
        let percent = 0;

        for (const runtime of this.activeBuffs) {
            const modifiers = runtime.definition.modifiers;
            if (!modifiers) {
                continue;
            }

            for (const modifier of modifiers) {
                if (modifier.attribute !== attribute) {
                    continue;
                }

                flat += modifier.flat ?? 0;
                percent += modifier.percent ?? 0;
            }
        }

        return { flat, percent };
    }

    public getBuffs(): readonly IBuffRuntimeState[] {
        return this.activeBuffs;
    }

    private normalizeControlBuff(buff: IAppliedBuffConfig): IAppliedBuffConfig | null {
        const controlFlags = buff.definition.controlFlags;
        if (!controlFlags || !this.hasControlFlag('immuneControl')) {
            return buff;
        }

        const sanitizedFlags: IBuffControlFlags = {
            immuneControl: controlFlags.immuneControl,
        };
        const hasControlEffect = !!(controlFlags.preventMove || controlFlags.preventAttack || controlFlags.preventSkill);
        const hasOtherEffects = !!(
            buff.definition.modifiers?.length
            || buff.definition.periodicDamage
            || buff.definition.tags?.length
        );

        if (!hasOtherEffects && hasControlEffect) {
            return null;
        }

        return {
            ...buff,
            definition: {
                ...buff.definition,
                controlFlags: sanitizedFlags,
            },
        };
    }
}
