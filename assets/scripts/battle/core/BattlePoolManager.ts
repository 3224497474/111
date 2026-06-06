import { Node, NodePool, Prefab, instantiate } from 'cc';

type PrefabLike = Prefab & {
    _uuid?: string;
    uuid?: string;
};

export class BattlePoolManager {
    private static _instance: BattlePoolManager | null = null;

    public static get instance(): BattlePoolManager {
        if (!this._instance) {
            this._instance = new BattlePoolManager();
        }
        return this._instance;
    }

    private _pools: Map<string, NodePool> = new Map();
    private _prefabs: Map<string, Prefab> = new Map();

    private constructor() {}

    public initPool(prefab: Prefab, initialCount: number): void {
        const key = this.getPrefabKey(prefab);
        let pool = this._pools.get(key);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(key, pool);
        }

        this._prefabs.set(key, prefab);

        const targetCount = Math.max(0, initialCount);
        const missingCount = Math.max(0, targetCount - pool.size());
        for (let i = 0; i < missingCount; i++) {
            pool.put(instantiate(prefab));
        }
    }

    public getNode(prefab: Prefab): Node {
        const key = this.getPrefabKey(prefab);
        let pool = this._pools.get(key);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(key, pool);
        }

        this._prefabs.set(key, prefab);
        if (pool.size() > 0) {
            return pool.get();
        }

        console.warn(`[BattlePoolManager] pool exhausted for prefab: ${key}`);
        return instantiate(prefab);
    }

    public putNode(prefabName: string, node: Node): void {
        if (!node?.isValid) {
            return;
        }

        let pool = this._pools.get(prefabName);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(prefabName, pool);
        }

        this.invokeUnuse(node);
        pool.put(node);
    }

    public clearAll(): void {
        for (const pool of this._pools.values()) {
            pool.clear();
        }
        this._pools.clear();
        this._prefabs.clear();
    }

    public clearPool(prefabName: string): void {
        const pool = this._pools.get(prefabName);
        if (!pool) {
            return;
        }

        pool.clear();
        this._pools.delete(prefabName);
        this._prefabs.delete(prefabName);
    }

    public getPrefabKey(prefab: Prefab): string {
        const prefabLike = prefab as PrefabLike;
        return prefabLike._uuid ?? prefabLike.uuid ?? prefab.name;
    }

    private invokeUnuse(node: Node): void {
        const components = node.components as Array<{ unuse?: () => void }>;
        for (const component of components) {
            component.unuse?.();
        }
    }
}
