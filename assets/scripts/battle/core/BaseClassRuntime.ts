import type { BattleUnit } from '../BattleUnit';

export abstract class BaseClassRuntime {
    protected readonly owner: BattleUnit;

    constructor(owner: BattleUnit) {
        this.owner = owner;
    }

    public onInit(): void {}

    public onEnterBattle(): void {}

    public onUpdate(_dt: number): void {}

    public onLogicUpdate(_dt: number): void {}

    public onDeath(): void {}

    public onDestroy(): void {}
}
