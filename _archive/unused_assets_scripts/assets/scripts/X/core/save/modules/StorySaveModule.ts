import { StoryManager } from '../../../Story/StoryManager';
import type { IStorySaveData } from '../../../Story/StoryTypes';
import type { ISaveModule } from './SaveModule';

export class StorySaveModule implements ISaveModule<IStorySaveData> {
  public readonly key = 'story_progress';

  capture(): IStorySaveData {
    return StoryManager.instance.exportToSave();
  }

  restore(snapshot: IStorySaveData | null | undefined): void {
    if (!snapshot) {
      return;
    }

    StoryManager.instance.loadFromSave(snapshot);
  }
}
