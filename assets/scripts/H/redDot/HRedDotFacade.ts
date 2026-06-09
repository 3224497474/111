import type { Node } from 'cc';
import type { HDataStore } from '../data/HDataStore';
import type {
    HRedDotDefineOptions,
    HRedDotExportData,
    HRedDotInitOptions,
    HRedDotListener,
    HRedDotStoredValue,
} from '../HTypes';

interface HRedDotNode {
    key: string;
    value: boolean;
    count: number;
    ownCount: number | null;
    persist: boolean;
    compute?: () => boolean | number;
    children: Set<string>;
    watchers: Set<HRedDotListener>;
}

export class HRedDotFacade {
    private readonly nodes = new Map<string, HRedDotNode>();
    private readonly dirtyKeys = new Set<string>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private dataStore: HDataStore | null = null;
    private persistedValues: Record<string, HRedDotStoredValue> = {};
    private storageModuleName = 'redDot';
    private persistByDefault = false;

    /**
     * 初始化红点系统。Loading 阶段调用 H.init 后，会在这里统一读取本地红点数据。
     */
    public init(dataStore: HDataStore, options: HRedDotInitOptions = {}): void {
        this.dataStore = dataStore;
        this.storageModuleName = options.storageModuleName?.trim() || this.storageModuleName;
        this.persistByDefault = !!options.persistByDefault;

        if (options.autoLoadLocal !== false) {
            this.loadLocalData();
        }
    }

    /**
     * 从 H.data 对应模块读取本地红点数据，适合 Loading 脚本统一调用。
     */
    public loadLocalData(moduleName = this.storageModuleName): void {
        if (!this.dataStore) {
            return;
        }

        const stored = this.dataStore.getModule<Record<string, HRedDotStoredValue>>(moduleName, {});
        this.importData({ values: stored }, false);
    }

    /**
     * 把当前需要持久化的红点信息保存到 H.data。
     */
    public saveLocal(immediate = false): void {
        this.dataStore?.setModule(this.storageModuleName, this.clone(this.persistedValues), {
            immediate,
        });
    }

    public exportData(): HRedDotExportData {
        return {
            values: this.clone(this.persistedValues),
        };
    }

    public importData(data: HRedDotExportData | Record<string, HRedDotStoredValue>, saveAfterImport = false): void {
        const values = this.extractImportValues(data);
        const normalizedValues: Record<string, HRedDotStoredValue> = {};

        Object.keys(values || {}).forEach((rawKey) => {
            const key = this.normalizeKey(rawKey);
            const count = this.toCount(values[rawKey]);
            normalizedValues[key] = count;

            const node = this.ensureNode(key);
            node.persist = true;
            node.ownCount = count;
            this.markDirty(key);
        });

        this.persistedValues = {
            ...this.persistedValues,
            ...normalizedValues,
        };

        this.flushDirty();
        if (saveAfterImport) {
            this.saveLocal(true);
        }
    }

    /**
     * 定义一个红点节点。compute 可返回 boolean 或 number；number 会参与父级计数汇总。
     */
    public define(key: string, options: HRedDotDefineOptions = {}): void {
        const normalizedKey = this.normalizeKey(key);
        const node = this.ensureNode(normalizedKey);
        node.persist = !!options.persist || node.persist || this.persistByDefault;
        node.compute = options.compute;

        if (node.persist && this.persistedValues[normalizedKey] !== undefined) {
            node.ownCount = this.toCount(this.persistedValues[normalizedKey]);
        }

        this.markDirty(normalizedKey);
    }

    /**
     * 兼容旧布尔写法。数字会被当成计数，0 隐藏，大于 0 显示。
     */
    public setValue(key: string, value: boolean | number, persist = false, immediate = false): void {
        this.setCount(key, this.toCount(value), persist, immediate);
    }

    /**
     * 设置某个节点自己的红点数量。父级数量会在下一帧统一汇总。
     */
    public setCount(key: string, count: number, persist = false, immediate = false): void {
        const normalizedKey = this.normalizeKey(key);
        const node = this.ensureNode(normalizedKey);
        node.ownCount = this.normalizeCount(count);
        node.persist = node.persist || persist || this.persistByDefault;

        if (node.persist) {
            this.persistedValues[normalizedKey] = node.ownCount;
            this.saveLocal(immediate);
        }

        this.markDirty(normalizedKey);
    }

    /**
     * 给某个节点增加数量。常用于获得新商品、解锁任务、新增邮件等。
     */
    public addCount(key: string, delta = 1, persist = false, immediate = false): number {
        const normalizedKey = this.normalizeKey(key);
        const node = this.ensureNode(normalizedKey);
        const nextCount = this.normalizeCount((node.ownCount ?? 0) + delta);
        this.setCount(normalizedKey, nextCount, persist, immediate);
        return nextCount;
    }

    /**
     * 给某个节点减少数量。不会减到 0 以下。
     */
    public reduceCount(key: string, delta = 1, persist = false, immediate = false): number {
        return this.addCount(key, -Math.abs(delta), persist, immediate);
    }

    public getValue(key: string): boolean {
        return this.ensureNode(this.normalizeKey(key)).value;
    }

    /**
     * 获取汇总后的数量。父级会返回所有子节点数量之和。
     */
    public getCount(key: string): number {
        return this.ensureNode(this.normalizeKey(key)).count;
    }

    /**
     * 获取节点自己的数量，不包含子节点。没有直接设置过时返回 0。
     */
    public getOwnCount(key: string): number {
        return this.ensureNode(this.normalizeKey(key)).ownCount ?? 0;
    }

    public has(key: string): boolean {
        return this.nodes.has(this.normalizeKey(key));
    }

    public clear(key: string, immediate = false): void {
        this.setCount(key, 0, true, immediate);
    }

    public clearPersisted(key: string, immediate = false): void {
        const normalizedKey = this.normalizeKey(key);
        delete this.persistedValues[normalizedKey];
        const node = this.ensureNode(normalizedKey);
        node.ownCount = 0;
        node.persist = false;
        this.markDirty(normalizedKey);
        this.saveLocal(immediate);
    }

    public markDirty(key: string): void {
        let currentKey: string | null = this.normalizeKey(key);
        while (currentKey) {
            this.dirtyKeys.add(currentKey);
            currentKey = this.getParentKey(currentKey);
        }
        this.scheduleFlush();
    }

    public watch(key: string, listener: HRedDotListener): () => void {
        const normalizedKey = this.normalizeKey(key);
        const node = this.ensureNode(normalizedKey);
        node.watchers.add(listener);
        listener(node.value, normalizedKey, node.count);
        return () => node.watchers.delete(listener);
    }

    /**
     * 将红点节点 active 绑定到某个 UI Node。UI 销毁时请调用返回的取消函数。
     */
    public bindNode(key: string, node: Node): () => void {
        return this.watch(key, (visible) => {
            if (node.isValid) {
                node.active = visible;
            }
        });
    }

    public flushDirty(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        const dirtyKeys = [...this.dirtyKeys].sort((left, right) => this.getDepth(right) - this.getDepth(left));
        this.dirtyKeys.clear();

        dirtyKeys.forEach((key) => this.recalculate(key));
    }

    public dump(): Record<string, boolean> {
        const ret: Record<string, boolean> = {};
        this.nodes.forEach((node, key) => {
            ret[key] = node.value;
        });
        return ret;
    }

    public dumpCounts(): Record<string, number> {
        const ret: Record<string, number> = {};
        this.nodes.forEach((node, key) => {
            ret[key] = node.count;
        });
        return ret;
    }

    public dumpPersisted(): Record<string, HRedDotStoredValue> {
        return this.clone(this.persistedValues);
    }

    private ensureNode(key: string): HRedDotNode {
        const normalizedKey = this.normalizeKey(key);

        let node = this.nodes.get(normalizedKey);
        if (!node) {
            node = {
                key: normalizedKey,
                value: false,
                count: 0,
                ownCount: null,
                persist: false,
                children: new Set(),
                watchers: new Set(),
            };
            this.nodes.set(normalizedKey, node);

            const parentKey = this.getParentKey(normalizedKey);
            if (parentKey) {
                const parent = this.ensureNode(parentKey);
                parent.children.add(normalizedKey);
            }
        }

        return node;
    }

    private recalculate(key: string): void {
        const node = this.ensureNode(key);
        const oldValue = node.value;
        const oldCount = node.count;
        const ownCount = node.compute
            ? this.toCount(node.compute())
            : node.ownCount ?? 0;
        const childrenCount = [...node.children].reduce((sum, childKey) => {
            return sum + this.ensureNode(childKey).count;
        }, 0);
        const nextCount = this.normalizeCount(ownCount + childrenCount);
        const nextValue = nextCount > 0;

        node.count = nextCount;
        node.value = nextValue;
        if (oldValue !== nextValue || oldCount !== nextCount) {
            node.watchers.forEach((listener) => {
                try {
                    listener(nextValue, key, nextCount);
                } catch (error) {
                    console.error(`[HRedDotFacade] ${key} watcher error:`, error);
                }
            });
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => this.flushDirty(), 0);
    }

    private getParentKey(key: string): string | null {
        const index = key.lastIndexOf('/');
        return index > 0 ? key.slice(0, index) : null;
    }

    private getDepth(key: string): number {
        return key.split('/').length;
    }

    private normalizeKey(key: string): string {
        const normalizedKey = key
            .trim()
            .replace(/\\/g, '/')
            .replace(/\./g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\/+|\/+$/g, '');

        if (!normalizedKey) {
            throw new Error('[HRedDotFacade] key 不能为空');
        }

        return normalizedKey;
    }

    private normalizeCount(count: number): number {
        if (!Number.isFinite(count)) {
            return 0;
        }
        return Math.max(0, Math.floor(count));
    }

    private toCount(value: HRedDotStoredValue): number {
        if (typeof value === 'number') {
            return this.normalizeCount(value);
        }
        return value ? 1 : 0;
    }

    private extractImportValues(data: HRedDotExportData | Record<string, HRedDotStoredValue>): Record<string, HRedDotStoredValue> {
        const maybeExport = data as HRedDotExportData;
        if (maybeExport.values && typeof maybeExport.values === 'object') {
            return maybeExport.values;
        }

        return data as Record<string, HRedDotStoredValue>;
    }

    private clone<T>(value: T): T {
        if (value === undefined || value === null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }
}
