import { ScheduleSystem, type IScheduleSnapshot } from '../../ScheduleSystem';
import { TimeSystem, type IGameTimeState } from '../../TimeSystem';

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
