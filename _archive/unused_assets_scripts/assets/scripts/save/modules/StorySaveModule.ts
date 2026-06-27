import { StoryManager } from '../../X/Story/StoryManager';
import type { IStorySaveData } from '../../X/Story/StoryTypes';
import type { ISaveModule } from './SaveModule';

export class StorySaveModule implements ISaveModule<IStorySaveData> {
  public readonly key = 'story_progress';

  public capture(): IStorySaveData {
    return StoryManager.instance.exportToSave();
  }

  public restore(snapshot: IStorySaveData | null | undefined): void {
    if (!snapshot) {
      return;
    }

    StoryManager.instance.loadFromSave(snapshot);
  }
}

