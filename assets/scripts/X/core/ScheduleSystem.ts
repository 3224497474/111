import type { IGameTimeState, TimeSlotId } from './TimeSystem';

export type ActivityId = string;

export interface IActivityConfig {
  id: ActivityId;
  name: string;
  allowedTimeSlots: TimeSlotId[];
}

export interface IDailySchedule {
  dayIndex: number;
  timeSlots: Partial<Record<TimeSlotId, ActivityId>>;
}

export interface IWeeklySchedule {
  weekIndex: number;
  days: IDailySchedule[];
}

export interface IScheduleSnapshot {
  weeklySchedule: IWeeklySchedule | null;
}

export class ScheduleSystem {
  private static _instance: ScheduleSystem | null = null;

  public static get instance(): ScheduleSystem {
    if (!this._instance) {
      this._instance = new ScheduleSystem();
    }
    return this._instance;
  }

  private weeklySchedule: IWeeklySchedule | null = null;
  private activityConfigs: Map<ActivityId, IActivityConfig> = new Map();

  private constructor() {}

  public registerActivity(config: IActivityConfig): void {
    this.activityConfigs.set(config.id, config);
  }

  public getActivityConfig(id: ActivityId): IActivityConfig | undefined {
    return this.activityConfigs.get(id);
  }

  public initializeWeek(weekIndex: number): void {
    const days: IDailySchedule[] = [];
    for (let i = 1; i <= 7; i++) {
      days.push({ dayIndex: i, timeSlots: {} });
    }
    this.weeklySchedule = { weekIndex, days };
  }

  public getWeeklySchedule(): IWeeklySchedule | null {
    return this.weeklySchedule;
  }

  public exportSnapshot(): IScheduleSnapshot {
    return {
      weeklySchedule: this.cloneWeeklySchedule(this.weeklySchedule),
    };
  }

  public loadFromSnapshot(snapshot?: IScheduleSnapshot | null): void {
    this.weeklySchedule = this.cloneWeeklySchedule(snapshot?.weeklySchedule ?? null);
  }

  public setActivity(
    dayIndex: number,
    timeSlot: TimeSlotId,
    activityId: ActivityId | null,
  ): void {
    if (!this.weeklySchedule) return;
    const day = this.weeklySchedule.days.find((item) => item.dayIndex === dayIndex);
    if (!day) return;
    if (activityId === null) {
      if (day.timeSlots[timeSlot]) {
        delete day.timeSlots[timeSlot];
      }
      return;
    }
    day.timeSlots[timeSlot] = activityId;
  }

  public getActivityForTime(time: Readonly<IGameTimeState>): ActivityId | null {
    if (!this.weeklySchedule) return null;
    const day = this.weeklySchedule.days.find((item) => item.dayIndex === time.dayIndex);
    if (!day) return null;
    return day.timeSlots[time.timeSlot] ?? null;
  }

  public validateWeeklySchedule(minActivities: number = 1): boolean {
    if (!this.weeklySchedule) return false;
    let count = 0;
    for (const day of this.weeklySchedule.days) {
      count += Object.keys(day.timeSlots).length;
    }
    return count >= minActivities;
  }

  private cloneWeeklySchedule(schedule: IWeeklySchedule | null): IWeeklySchedule | null {
    if (!schedule) {
      return null;
    }

    return {
      weekIndex: schedule.weekIndex,
      days: schedule.days.map((day) => ({
        dayIndex: day.dayIndex,
        timeSlots: { ...day.timeSlots },
      })),
    };
  }
}
