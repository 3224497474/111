export interface IPlayerAttributes {
  study: number;
  charm: number;
  stamina: number;
  fatigue: number;
  mood: number;
  money: number;
}

export interface IPlayerStateSnapshot {
  attrs: IPlayerAttributes;
}

/**
 * Phase 1 用的简化玩家状态
 * 后续可以替换为正式的角色/属性系统实现
 */
export class PlayerState {
  public attrs: IPlayerAttributes;

  constructor(initial?: Partial<IPlayerAttributes>) {
    this.attrs = {
      study: initial?.study ?? 0,
      charm: initial?.charm ?? 0,
      stamina: initial?.stamina ?? 10,
      fatigue: initial?.fatigue ?? 0,
      mood: initial?.mood ?? 0,
      money: initial?.money ?? 0,
    };

    if (this.attrs.fatigue < 0) this.attrs.fatigue = 0;
    if (this.attrs.fatigue > this.attrs.stamina) {
      this.attrs.fatigue = this.attrs.stamina;
    }
  }

  public changeAttribute(attrId: string, delta: number): void {
    if (!(attrId in this.attrs)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyAttrs: any = this.attrs as any;
    const current = anyAttrs[attrId] ?? 0;
    anyAttrs[attrId] = current + delta;
  }

  public changeMoney(delta: number): void {
    this.attrs.money += delta;
  }

  public changeFatigue(delta: number): void {
    this.attrs.fatigue += delta;
    if (this.attrs.fatigue < 0) this.attrs.fatigue = 0;
    if (this.attrs.fatigue > this.attrs.stamina) {
      this.attrs.fatigue = this.attrs.stamina;
    }
  }

  public changeMood(delta: number): void {
    this.attrs.mood += delta;
    if (this.attrs.mood < -100) this.attrs.mood = -100;
    if (this.attrs.mood > 100) this.attrs.mood = 100;
  }

  public exportSnapshot(): IPlayerStateSnapshot {
    return {
      attrs: { ...this.attrs },
    };
  }

  public loadFromSnapshot(snapshot: IPlayerStateSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }

    this.attrs = {
      study: snapshot.attrs?.study ?? 0,
      charm: snapshot.attrs?.charm ?? 0,
      stamina: snapshot.attrs?.stamina ?? 10,
      fatigue: snapshot.attrs?.fatigue ?? 0,
      mood: snapshot.attrs?.mood ?? 0,
      money: snapshot.attrs?.money ?? 0,
    };

    if (this.attrs.fatigue < 0) this.attrs.fatigue = 0;
    if (this.attrs.fatigue > this.attrs.stamina) {
      this.attrs.fatigue = this.attrs.stamina;
    }
    if (this.attrs.mood < -100) this.attrs.mood = -100;
    if (this.attrs.mood > 100) this.attrs.mood = 100;
  }
}
