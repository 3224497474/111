import { assetManager, Prefab } from 'cc';

interface PrefabCacheEntry {
    asset: Prefab;
    refCount: number;
}

export class RemotePrefabCache {
    private static _prefabs: Map<string, PrefabCacheEntry> = new Map();

    private static makeKey(bundleName: string, path: string): string {
        return `${bundleName}:${path}`;
    }

    private static tryAddRef(prefab: Prefab) {
        if (typeof (prefab as Prefab & { addRef?: () => Prefab }).addRef === 'function') {
            prefab.addRef();
        }
    }

    private static tryDecRef(prefab: Prefab) {
        if (typeof (prefab as Prefab & { decRef?: () => Prefab }).decRef === 'function') {
            prefab.decRef();
        }
    }

    // 删除缓存项前，先把内部记录的所有引用一次性归还给引擎。
    private static releaseEntry(entry: PrefabCacheEntry) {
        for (let i = 0; i < entry.refCount; i++) {
            this.tryDecRef(entry.asset);
        }
    }

    public static set(bundleName: string, path: string, prefab: Prefab) {
        const key = this.makeKey(bundleName, path);
        const oldEntry = this._prefabs.get(key);
        if (oldEntry) {
            this.releaseEntry(oldEntry);
        }

        // 只要 prefab 仍在缓存里，缓存层自己就持有一份引擎引用。
        this.tryAddRef(prefab);
        this._prefabs.set(key, {
            asset: prefab,
            refCount: 1,
        });
    }

    public static get(bundleName: string, path: string): Prefab | null {
        const entry = this._prefabs.get(this.makeKey(bundleName, path));
        if (!entry) {
            return null;
        }

        // 每次取出缓存都补一份引用，调用方用完后必须配对 release()。
        entry.refCount += 1;
        this.tryAddRef(entry.asset);
        return entry.asset;
    }

    public static has(bundleName: string, path: string): boolean {
        return this._prefabs.has(this.makeKey(bundleName, path));
    }

    public static release(bundleName: string, path: string) {
        const key = this.makeKey(bundleName, path);
        const entry = this._prefabs.get(key);
        if (!entry) {
            return;
        }

        entry.refCount -= 1;
        this.tryDecRef(entry.asset);

        if (entry.refCount <= 0) {
            this._prefabs.delete(key);
        }
    }

    // 按 Bundle 清理缓存，并强制释放整个 Bundle 占用的内存。
    public static clearBundle(bundleName: string) {
        const prefix = `${bundleName}:`;
        for (const [key, entry] of this._prefabs.entries()) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            this.releaseEntry(entry);
            this._prefabs.delete(key);
        }

        const bundle = assetManager.getBundle(bundleName);
        if (!bundle) {
            return;
        }

        bundle.releaseAll();
        assetManager.removeBundle(bundle);
    }

    public static clearAll() {
        for (const entry of this._prefabs.values()) {
            this.releaseEntry(entry);
        }
        this._prefabs.clear();
    }
}
