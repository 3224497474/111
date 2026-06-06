import { AffectionManager } from '../../../Story/AffectionManager';
import type { ICharacterAffection } from '../../../Story/StoryTypes';
import { PlayerState, type IPlayerStateSnapshot } from '../../PlayerState';

export interface IPlayerStatsAffectionSnapshot {
  player: IPlayerStateSnapshot;
  affection: Record<string, ICharacterAffection>;
}

export class PlayerStatsAffectionSerializer {
  public static exportSnapshot(
    playerState: PlayerState,
    affectionManager: AffectionManager = AffectionManager.instance,
  ): IPlayerStatsAffectionSnapshot {
    return {
      player: playerState.exportSnapshot(),
      affection: affectionManager.exportToSave(),
    };
  }

  public static loadSnapshot(
    playerState: PlayerState,
    snapshot: IPlayerStatsAffectionSnapshot | null | undefined,
    affectionManager: AffectionManager = AffectionManager.instance,
  ): void {
    if (!snapshot) {
      return;
    }

    playerState.loadFromSnapshot(snapshot.player);
    affectionManager.loadFromSave(snapshot.affection);
  }
}
