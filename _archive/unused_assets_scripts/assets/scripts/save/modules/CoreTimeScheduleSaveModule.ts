import { ScheduleSystem, type IScheduleSnapshot } from '../../X/core/ScheduleSystem';
import { TimeSystem, type IGameTimeState } from '../../X/core/TimeSystem';
import type { ISaveModule } from './SaveModule';

export interface ICoreTimeScheduleSnapshot {
  time: IGameTimeState;
  schedule: IScheduleSnapshot;
}

export class CoreTimeScheduleSaveModule implements ISaveModule<ICoreTimeScheduleSnapshot> {
  public readonly key = 'core_time_schedule';

  public capture(): ICoreTimeScheduleSnapshot {
    return {
      time: TimeSystem.instance.exportSnapshot(),
      schedule: ScheduleSystem.instance.exportSnapshot(),
    };
  }

  public restore(snapshot: ICoreTimeScheduleSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }

    TimeSystem.instance.loadFromSnapshot(snapshot.time);
    ScheduleSystem.instance.loadFromSnapshot(snapshot.schedule);
  }
}
