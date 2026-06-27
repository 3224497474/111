import { ScheduleSystem, type IScheduleSnapshot } from '../../X/core/ScheduleSystem';
import { TimeSystem, type IGameTimeState } from '../../X/core/TimeSystem';

export interface ITimeScheduleSnapshot {
  time: IGameTimeState;
  schedule: IScheduleSnapshot;
}

export class TimeScheduleSnapshotExporter {
  public static exportSnapshot(): ITimeScheduleSnapshot {
    return {
      time: TimeSystem.instance.exportSnapshot(),
      schedule: ScheduleSystem.instance.exportSnapshot(),
    };
  }

  public static loadSnapshot(snapshot: ITimeScheduleSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }

    TimeSystem.instance.loadFromSnapshot(snapshot.time);
    ScheduleSystem.instance.loadFromSnapshot(snapshot.schedule);
  }
}
