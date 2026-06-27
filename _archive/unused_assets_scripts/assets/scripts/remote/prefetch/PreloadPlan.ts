import { Asset } from 'cc';

export type DirTask = { bundle: string; dir: string; type?: typeof Asset | unknown };
export type AssetTask = { bundle: string; path: string; type?: typeof Asset | unknown };
export type Group = { dirs?: DirTask[]; assets?: AssetTask[] };

export const DEFAULT_TYPE = Asset;

export const PREFETCH_PLAN: Record<string, Group> = {
  enterGame: {
    dirs: [
      { bundle: 'game', dir: 'prefabs/ui' },
      { bundle: 'game', dir: 'textures/common' },
    ],
  },
  idle5s: {
    dirs: [
      { bundle: 'game', dir: 'textures/actors' },
      { bundle: 'game', dir: 'effects/basic' },
    ],
  },
  shop: {
    dirs: [{ bundle: 'game', dir: 'prefabs/shop' }],
  },
};
