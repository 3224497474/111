import type { ISaveModule } from './SaveModule';

export class CrossModuleSaveAggregator {
  private readonly modules = new Map<string, ISaveModule>();

  public register(module: ISaveModule): void {
    this.modules.set(module.key, module);
  }

  public unregister(key: string): void {
    this.modules.delete(key);
  }

  public captureAll(): Record<string, unknown> {
    const snapshots: Record<string, unknown> = {};

    for (const [key, module] of this.modules) {
      const snapshot = module.capture();
      if (snapshot === undefined) {
        continue;
      }
      snapshots[key] = snapshot ?? null;
    }

    return snapshots;
  }

  public restoreAll(snapshots?: Record<string, unknown> | null): string[] {
    if (!snapshots) {
      return [];
    }

    const restored: string[] = [];
    for (const [key, module] of this.modules) {
      if (!(key in snapshots)) {
        continue;
      }

      module.restore(snapshots[key]);
      restored.push(key);
    }

    return restored;
  }
}
