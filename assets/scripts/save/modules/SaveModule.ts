export interface ISaveModule<TSnapshot = unknown> {
  readonly key: string;
  capture(): TSnapshot | null | undefined;
  restore(snapshot: TSnapshot | null | undefined): void;
}

export interface IDirtySaveModule<TSnapshot = unknown> extends ISaveModule<TSnapshot> {
  isDirty(): boolean;
  markDirty(reason?: string): void;
  clearDirty(): void;
}
