import { sys } from 'cc';

interface IGlobalProgressProfile {
  unlockedCGs: string[];
  unlockedEndings: string[];
  readDialogs: string[];
}

export class GlobalProgressionSystem {
  private static _instance: GlobalProgressionSystem | null = null;

  public static get instance(): GlobalProgressionSystem {
    if (!this._instance) {
      this._instance = new GlobalProgressionSystem();
    }
    return this._instance;
  }

  private readonly storageKey = 'NewProjectX1_GlobalProgress_profile';
  private readonly unlockedCGs = new Set<string>();
  private readonly unlockedEndings = new Set<string>();
  private readonly readDialogs = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDelayMs = 120;

  private constructor() {}

  public markCGUnlocked(id: string | null | undefined): void {
    if (!id || this.unlockedCGs.has(id)) {
      return;
    }

    this.unlockedCGs.add(id);
    this.save();
  }

  public markEndingUnlocked(id: string | null | undefined): void {
    if (!id || this.unlockedEndings.has(id)) {
      return;
    }

    this.unlockedEndings.add(id);
    this.save();
  }

  public markDialogRead(id: string | null | undefined): void {
    if (!id || this.readDialogs.has(id)) {
      return;
    }

    this.readDialogs.add(id);
    this.save();
  }

  public hasCG(id: string): boolean {
    return this.unlockedCGs.has(id);
  }

  public hasEnding(id: string): boolean {
    return this.unlockedEndings.has(id);
  }

  public isDialogRead(id: string): boolean {
    return this.readDialogs.has(id);
  }

  public getUnlockedCGs(): string[] {
    return Array.from(this.unlockedCGs);
  }

  public getUnlockedEndings(): string[] {
    return Array.from(this.unlockedEndings);
  }

  public getReadDialogs(): string[] {
    return Array.from(this.readDialogs);
  }

  public load(): void {
    if (!sys?.localStorage) {
      return;
    }

    this.clearPendingSave();

    const raw = sys.localStorage.getItem(this.storageKey);
    if (!raw) {
      this.unlockedCGs.clear();
      this.unlockedEndings.clear();
      this.readDialogs.clear();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<IGlobalProgressProfile> | null;
      this.unlockedCGs.clear();
      this.unlockedEndings.clear();
      this.readDialogs.clear();

      for (const id of parsed?.unlockedCGs ?? []) {
        if (typeof id === 'string' && id.length > 0) {
          this.unlockedCGs.add(id);
        }
      }

      for (const id of parsed?.unlockedEndings ?? []) {
        if (typeof id === 'string' && id.length > 0) {
          this.unlockedEndings.add(id);
        }
      }

      for (const id of parsed?.readDialogs ?? []) {
        if (typeof id === 'string' && id.length > 0) {
          this.readDialogs.add(id);
        }
      }
    } catch (error) {
      console.warn('[GlobalProgressionSystem] Failed to load global progress profile.', error);
      this.unlockedCGs.clear();
      this.unlockedEndings.clear();
      this.readDialogs.clear();
    }
  }

  public save(): void {
    if (!sys?.localStorage) {
      return;
    }

    this.clearPendingSave();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistNow();
    }, this.saveDelayMs);
  }

  private persistNow(): void {
    if (!sys?.localStorage) {
      return;
    }

    const payload: IGlobalProgressProfile = {
      unlockedCGs: Array.from(this.unlockedCGs),
      unlockedEndings: Array.from(this.unlockedEndings),
      readDialogs: Array.from(this.readDialogs),
    };

    try {
      sys.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('[GlobalProgressionSystem] Failed to save global progress profile.', error);
    }
  }

  private clearPendingSave(): void {
    if (!this.saveTimer) {
      return;
    }

    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
