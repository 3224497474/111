import { sys } from 'cc';

export class NetworkKV {
    constructor(private readonly keyPrefix: string) {}

    public isAvailable(): boolean {
        return !!sys?.localStorage;
    }

    public getString(key: string): string | null {
        if (!this.isAvailable()) {
            return null;
        }

        return sys.localStorage.getItem(this.makeKey(key));
    }

    public setString(key: string, value: string): boolean {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            sys.localStorage.setItem(this.makeKey(key), value);
            return true;
        } catch (error) {
            console.warn('[NetworkKV] Failed to set string value.', error);
            return false;
        }
    }

    public getNumber(key: string, fallback: number = 0): number {
        const raw = this.getString(key);
        if (!raw) {
            return fallback;
        }

        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    }

    public setNumber(key: string, value: number): boolean {
        return this.setString(key, String(value));
    }

    public getJson<T>(key: string, fallback: T): T {
        const raw = this.getString(key);
        if (!raw) {
            return fallback;
        }

        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            console.warn('[NetworkKV] Failed to parse JSON value.', error);
            return fallback;
        }
    }

    public setJson(key: string, value: unknown): boolean {
        try {
            return this.setString(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[NetworkKV] Failed to stringify JSON value.', error);
            return false;
        }
    }

    public remove(key: string): void {
        if (!this.isAvailable()) {
            return;
        }

        sys.localStorage.removeItem(this.makeKey(key));
    }

    public clearAll(): void {
        if (!this.isAvailable()) {
            return;
        }

        const keysToRemove: string[] = [];
        for (let index = 0; index < sys.localStorage.length; index++) {
            const rawKey = sys.localStorage.key(index);
            if (!rawKey || !rawKey.startsWith(this.keyPrefix)) {
                continue;
            }
            keysToRemove.push(rawKey);
        }

        keysToRemove.forEach((rawKey) => {
            sys.localStorage.removeItem(rawKey);
        });
    }

    private makeKey(key: string): string {
        return `${this.keyPrefix}${key}`;
    }
}

