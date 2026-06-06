import { AffectionManager } from '../../X/Story/AffectionManager';
import { PlayerState } from '../../X/core/PlayerState';
import { PlayerStatsAffectionSerializer, type IPlayerStatsAffectionSnapshot } from '../serializers/PlayerStatsAffectionSerializer';
import type { ISaveModule } from './SaveModule';

export class PlayerStateSaveModule implements ISaveModule<IPlayerStatsAffectionSnapshot> {
  public readonly key = 'player_state';

  constructor(private readonly playerState: PlayerState) {}

  public capture(): IPlayerStatsAffectionSnapshot {
    return PlayerStatsAffectionSerializer.exportSnapshot(this.playerState, AffectionManager.instance);
  }

  public restore(snapshot: IPlayerStatsAffectionSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }

    PlayerStatsAffectionSerializer.loadSnapshot(this.playerState, snapshot, AffectionManager.instance);
  }
}

