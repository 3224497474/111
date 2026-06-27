import { Asset } from 'cc';

export const GAME_SCENE = 'game';
export const GAME_SCENE_BUNDLE = 'game';

export const PRELOAD_BUNDLES: string[] = [
  'resources',
  'game',
];

export const CRITICAL_DIRS: Record<string, string[]> = {
  game: ['textures/ui', 'textures/actors', 'prefabs/ui'],
};

export const CRITICAL_ASSETS: Record<string, string[]> = {};

export const DEFAULT_ASSET_TYPE = Asset;

export const WEIGHTS = {
  bundles: 0.30,
  critical: 0.50,
  scene: 0.20,
};
