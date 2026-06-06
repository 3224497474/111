import { TimeSystem } from './TimeSystem';
import { ScheduleSystem } from './ScheduleSystem';
import { SaveSystem } from './SaveSystem';
import { GlobalProgressionSystem } from './globalProgress/GlobalProgressionSystem';

export interface IGameLoopOptions {
  resumeFromAutoSave?: boolean;
}

export class GameLoop {
  private static _instance: GameLoop | null = null;

  public static get instance(): GameLoop {
    if (!this._instance) {
      this._instance = new GameLoop();
    }
    return this._instance;
  }

  private initialized = false;

  private constructor() {}

  public initialize(options?: IGameLoopOptions): void {
    if (this.initialized) {
      return;
    }

    GlobalProgressionSystem.instance.load();

    const resume = options?.resumeFromAutoSave ?? true;
    if (resume) {
      const save = SaveSystem.instance.loadAutoSave();
      if (save) {
        const restoredModules = SaveSystem.instance.restoreModules(save);
        if (!restoredModules.includes('core_time_schedule')) {
          TimeSystem.instance.initialize(save.time);
          ScheduleSystem.instance.initializeWeek(save.time.weekIndex);
        }
        this.initialized = true;
        return;
      }
    }

    TimeSystem.instance.initialize({
      year: 1,
      weekIndex: 1,
      dayIndex: 1,
      timeSlot: 'morning',
    });
    ScheduleSystem.instance.initializeWeek(1);
    this.initialized = true;
  }

  public startWeek(): void {
    if (!this.initialized) {
      this.initialize();
    }

    const time = TimeSystem.instance.state;
    if (!ScheduleSystem.instance.getWeeklySchedule()) {
      ScheduleSystem.instance.initializeWeek(time.weekIndex);
    }
  }

  public executeCurrentDayTimeSlot(): string | null {
    const time = TimeSystem.instance.state;
    const activityId = ScheduleSystem.instance.getActivityForTime(time);

    TimeSystem.instance.advanceToNextTimeSlot();
    SaveSystem.instance.createAutoSave(TimeSystem.instance.state);
    return activityId;
  }

  public endWeekAndStartNext(): void {
    TimeSystem.instance.advanceToNextWeek();
    const time = TimeSystem.instance.state;
    ScheduleSystem.instance.initializeWeek(time.weekIndex);
    SaveSystem.instance.createAutoSave(time);
  }
}
