export interface ISaveModule<TSnapshot = unknown> {
  readonly key: string;
  capture(): TSnapshot | null | undefined;
  restore(snapshot: TSnapshot | null | undefined): void;
}
