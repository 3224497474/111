import { StoryManager } from '../../X/Story/StoryManager';
import type { IStorySaveData } from '../../X/Story/StoryTypes';

export class StoryProgressFlagExporter {
  public static exportSnapshot(): IStorySaveData {
    return StoryManager.instance.exportToSave();
  }

  public static loadSnapshot(snapshot: IStorySaveData | null | undefined): void {
    if (!snapshot) {
      return;
    }

    StoryManager.instance.loadFromSave(snapshot);
  }
}

