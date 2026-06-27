import type { IGameTimeState } from './TimeSystem';
import { SaveDataCodec } from '../../save/SaveDataCodec';
import { SaveStorage } from '../../save/SaveStorage';
import { CURRENT_SAVE_VERSION, IGameSave } from '../../save/SaveTypes';
import { SaveModuleRegistry } from '../../save/modules/SaveModuleRegistry';
import { CoreTimeScheduleSaveModule } from '../../save/modules/CoreTimeScheduleSaveModule';
import type { ISaveModule } from '../../save/modules/SaveModule';
import { StorySaveModule } from '../../save/modules/StorySaveModule';

export type { IGameSave } from '../../save/SaveTypes';

export class SaveSystem {
  private static _instance: SaveSystem | null = null;

  public static get instance(): SaveSystem {
    if (!this._instance) {
      this._instance = new SaveSystem();
    }
    return this._instance;
  }

  private readonly storageKeyPrefix = 'NewProjectX1_Save_';
  private readonly autoSlotId = 'auto';
  private readonly storage = new SaveStorage(this.storageKeyPrefix);
  private readonly codec = new SaveDataCodec(CURRENT_SAVE_VERSION, true);
  private readonly moduleRegistry = new SaveModuleRegistry();

  private constructor() {
    this.moduleRegistry.register(new CoreTimeScheduleSaveModule());
    this.moduleRegistry.register(new StorySaveModule());
  }

  public save(slotId: string, time: IGameTimeState): void {
    const data: IGameSave = {
      id: slotId,
      createdAt: Date.now(),
      version: CURRENT_SAVE_VERSION,
      time: { ...time },
      modules: this.moduleRegistry.captureAll(),
    };

    const encoded = this.codec.encode(slotId, data);
    this.storage.setItem(slotId, encoded);
  }

  public load(slotId: string): IGameSave | null {
    const raw = this.storage.getItem(slotId);
    if (!raw) {
      return null;
    }

    const decoded = this.codec.decode(raw, slotId);
    if (!decoded.ok || !decoded.data) {
      return null;
    }

    if (decoded.upgraded) {
      const normalized = this.codec.encode(slotId, decoded.data);
      this.storage.setItem(slotId, normalized);
    }

    return decoded.data;
  }

  public has(slotId: string): boolean {
    return this.storage.hasItem(slotId);
  }

  public registerModule(module: ISaveModule): void {
    this.moduleRegistry.register(module);
  }

  public unregisterModule(key: string): void {
    this.moduleRegistry.unregister(key);
  }

  public restoreModules(save: IGameSave | null | undefined): string[] {
    if (!save) {
      return [];
    }

    return this.moduleRegistry.restoreAll(save.modules ?? {});
  }

  public delete(slotId: string): void {
    this.storage.removeItem(slotId);
  }

  public listSlots(): string[] {
    return this.storage.keys();
  }

  public createAutoSave(time: IGameTimeState): void {
    this.save(this.autoSlotId, time);
  }

  public loadAutoSave(): IGameSave | null {
    return this.load(this.autoSlotId);
  }

  public clearAll(): void {
    this.storage.clearAll();
  }
}
