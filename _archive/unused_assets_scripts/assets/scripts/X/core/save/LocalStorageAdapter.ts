import { sys } from 'cc';

export class LocalStorageAdapter {
  constructor(private readonly keyPrefix = '') {}

  public isAvailable(): boolean {
    return !!sys?.localStorage;
  }

  public getItem(key: string): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    return sys.localStorage.getItem(this.makeKey(key));
  }

  public setItem(key: string, value: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      sys.localStorage.setItem(this.makeKey(key), value);
      return true;
    } catch {
      return false;
    }
  }

  public removeItem(key: string): void {
    if (!this.isAvailable()) {
      return;
    }

    sys.localStorage.removeItem(this.makeKey(key));
  }

  public hasItem(key: string): boolean {
    return this.getItem(key) != null;
  }

  public keys(): string[] {
    if (!this.isAvailable()) {
      return [];
    }

    const keys: string[] = [];
    for (let i = 0; i < sys.localStorage.length; i++) {
      const key = sys.localStorage.key(i);
      if (!key || !key.startsWith(this.keyPrefix)) {
        continue;
      }

      keys.push(key.slice(this.keyPrefix.length));
    }
    return keys;
  }

  public clearAll(): void {
    if (!this.isAvailable()) {
      return;
    }

    for (const key of this.keys()) {
      this.removeItem(key);
    }
  }

  private makeKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
