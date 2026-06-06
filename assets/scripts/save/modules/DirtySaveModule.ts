import type { IDirtySaveModule } from './SaveModule';

export abstract class DirtySaveModule<TSnapshot = unknown> implements IDirtySaveModule<TSnapshot> {
  private dirty = true;

  public abstract readonly key: string;

  public abstract capture(): TSnapshot | null | undefined;

  public abstract restore(snapshot: TSnapshot | null | undefined): void;

  public isDirty(): boolean {
    return this.dirty;
  }

  public markDirty(_reason?: string): void {
    this.dirty = true;
  }

  public clearDirty(): void {
    this.dirty = false;
  }
}
