import type { IGameTimeState } from '../X/core/TimeSystem';

export const SAVE_FORMAT = 'NewProjectX1.SaveEnvelope';
export const CURRENT_SAVE_VERSION = 2;

export interface IGameSave {
  id: string;
  createdAt: number;
  version: number;
  time: IGameTimeState;
  modules?: Record<string, unknown>;
}

export interface ISaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  slotId: string;
  savedAt: number;
  encoding: 'plain' | 'base64';
  checksum: string;
  payload: string;
}

export interface IDecodeSaveResult<T> {
  ok: boolean;
  data: T | null;
  upgraded: boolean;
  error?: string;
}
