export type TimeSlotId = "morning" | "afternoon" | "evening";

export interface IGameTimeState {
  year: number;
  weekIndex: number; // 从 1 开始计数
  dayIndex: number; // 1-7，对应一周中的第几天
  timeSlot: TimeSlotId;
}

type TimeListener = (time: Readonly<IGameTimeState>) => void;

/**
 * SYS-TIME：时间与日期系统
 * - 管理年 / 周 / 日 / 时间段，作为其他系统的时间单一数据源
 * - 不直接依赖 Cocos，只提供纯逻辑和回调，方便测试与复用
 */
export class TimeSystem {
  private static _instance: TimeSystem | null = null;

  public static get instance(): TimeSystem {
    if (!this._instance) {
      this._instance = new TimeSystem();
    }
    return this._instance;
  }

  private _state: IGameTimeState = {
    year: 1,
    weekIndex: 1,
    dayIndex: 1,
    timeSlot: "morning",
  };

  private listeners: Set<TimeListener> = new Set();

  private constructor() {}

  public get state(): Readonly<IGameTimeState> {
    return this._state;
  }

  public exportSnapshot(): IGameTimeState {
    return { ...this._state };
  }

  public initialize(state?: Partial<IGameTimeState>): void {
    if (state) {
      this._state = {
        year: state.year ?? this._state.year,
        weekIndex: state.weekIndex ?? this._state.weekIndex,
        dayIndex: state.dayIndex ?? this._state.dayIndex,
        timeSlot: state.timeSlot ?? this._state.timeSlot,
      };
    }
    this.emit();
  }

  public loadFromSnapshot(state?: Partial<IGameTimeState> | null): void {
    this.initialize(state ?? undefined);
  }

  public onTimeChanged(listener: TimeListener): void {
    this.listeners.add(listener);
  }

  public offTimeChanged(listener: TimeListener): void {
    this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) {
      l(this._state);
    }
  }

  public advanceToNextTimeSlot(): void {
    const order: TimeSlotId[] = ["morning", "afternoon", "evening"];
    const idx = order.indexOf(this._state.timeSlot);
    if (idx < order.length - 1) {
      this._state = { ...this._state, timeSlot: order[idx + 1] };
      this.emit();
      return;
    }
    this.advanceToNextDay(true);
  }

  public advanceToNextDay(resetTimeSlot = true): void {
    let dayIndex = this._state.dayIndex + 1;
    let weekIndex = this._state.weekIndex;
    let year = this._state.year;

    if (dayIndex > 7) {
      dayIndex = 1;
      weekIndex += 1;
      if (weekIndex > 52) {
        weekIndex = 1;
        year += 1;
      }
    }

    this._state = {
      year,
      weekIndex,
      dayIndex,
      timeSlot: resetTimeSlot ? "morning" : this._state.timeSlot,
    };
    this.emit();
  }

  public advanceToNextWeek(): void {
    let weekIndex = this._state.weekIndex + 1;
    let year = this._state.year;
    if (weekIndex > 52) {
      weekIndex = 1;
      year += 1;
    }
    this._state = {
      year,
      weekIndex,
      dayIndex: 1,
      timeSlot: "morning",
    };
    this.emit();
  }
}
