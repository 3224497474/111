import type { HDataStore } from '../data/HDataStore';
import { HModel } from './HModel';
import { HStoreModule } from './HStoreModule';
import type {
    HStoreChange,
    HStoreChangeReason,
    HStoreInitOptions,
    HStoreListener,
    HStoreModuleConfig,
    HStoreSetOptions,
    HStoreState,
    HStoreWatcher,
    HStoreWatchOptions,
} from './HStoreTypes';

interface HStoreRecord<TState extends HStoreState = HStoreState> {
    name: string;
    state: TState;
    defaultValue: TState;
    persist: boolean;
    storageName: string;
    model?: HModel<TState>;
}

interface HStorePendingChange {
    module: string;
    paths: Set<string>;
    reason: HStoreChangeReason;
    previous?: HStoreState;
}

/**
 * HStoreFacade 是框架级运行时数据门面。
 *
 * 设计目标：
 * 1. 项目用 H.store.register/module 注册 user、bag、task 等模型。
 * 2. 修改数据时只标记脏字段，H.store 在下一轮统一 flush。
 * 3. UI 通过 watchModel/watch 订阅字段，框架自动按脏字段刷新 UI。
 * 4. 持久化交给 H.data，Store 只做运行时数据和刷新通知。
 */
export class HStoreFacade {
    private dataStore: HDataStore | null = null;
    private debug = false;
    private persistByDefault = true;
    private flushDelayMs = 0;
    private storagePrefix = 'store';
    private initialized = false;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private watcherSeed = 0;

    private readonly records = new Map<string, HStoreRecord>();
    private readonly modules = new Map<string, HStoreModule<any>>();
    private readonly watchers = new Map<number, HStoreWatcher>();
    private readonly pendingChanges = new Map<string, HStorePendingChange>();

    public init(options: HStoreInitOptions = {}, dataStore?: HDataStore): void {
        this.dataStore = dataStore || null;
        this.debug = !!options.debug;
        this.persistByDefault = options.persistByDefault ?? this.persistByDefault;
        this.flushDelayMs = Math.max(0, Math.floor(options.flushDelayMs ?? this.flushDelayMs));
        this.storagePrefix = options.storagePrefix?.trim() || this.storagePrefix;
        this.initialized = true;

        (options.modules || []).forEach((config) => this.register(config.name, config.defaultValue || {}, config));
    }

    public register<TState extends HStoreState>(
        name: string,
        defaultValueOrModel: TState | HModel<TState>,
        config: Partial<HStoreModuleConfig<TState>> = {},
    ): HStoreModule<TState> {
        this.ensureInit();
        const moduleName = this.normalizeModuleName(name);
        const model = defaultValueOrModel instanceof HModel ? defaultValueOrModel : undefined;
        const defaultValue = model ? model.getDefaultState() : this.clone(defaultValueOrModel as TState);
        const persist = config.persist ?? this.persistByDefault;
        const storageName = config.storageName?.trim() || this.getDefaultStorageName(moduleName);
        const loadedState = persist && config.autoLoad !== false && this.dataStore
            ? this.dataStore.getModule<TState>(storageName, defaultValue)
            : this.clone(defaultValue);

        const record: HStoreRecord<TState> = {
            name: moduleName,
            state: loadedState,
            defaultValue,
            persist,
            storageName,
            model,
        };
        this.records.set(moduleName, record);

        if (model) {
            model._hAttachStore(this);
        }

        const facade = new HStoreModule<TState>(this, moduleName, defaultValue);
        this.modules.set(moduleName, facade);
        this.markDirty(moduleName, '*', { reason: 'init', silent: true, persist: false });
        return facade;
    }

    public registerModel<TState extends HStoreState>(
        model: HModel<TState>,
        config: Partial<HStoreModuleConfig<TState>> = {},
    ): HStoreModule<TState> {
        return this.register<TState>(model.name, model, config);
    }

    public module<TState extends HStoreState>(name: string, defaultValue: TState = {} as TState): HStoreModule<TState> {
        this.ensureInit();
        const moduleName = this.normalizeModuleName(name);
        const existing = this.modules.get(moduleName);
        if (existing) {
            return existing as HStoreModule<TState>;
        }
        return this.register<TState>(moduleName, defaultValue);
    }

    public has(name: string): boolean {
        return this.records.has(this.normalizeModuleName(name));
    }

    public get<TState extends HStoreState>(name: string, defaultValue: TState = {} as TState): TState {
        const record = this.ensureRecord<TState>(name, defaultValue);
        return this.clone(record.state);
    }

    public set<TState extends HStoreState>(name: string, value: TState, options: HStoreSetOptions = {}): void {
        const record = this.ensureRecord<TState>(name, value);
        const previous = this.clone(record.state);
        record.state = this.clone(value);
        this.queueChange(record.name, ['*'], options.reason || 'set', previous, options);
    }

    public patch<TState extends HStoreState>(name: string, patch: Partial<TState>, options: HStoreSetOptions = {}): TState {
        const record = this.ensureRecord<TState>(name, {} as TState);
        const previous = this.clone(record.state);
        record.state = {
            ...record.state,
            ...this.clone(patch),
        };
        this.queueChange(record.name, Object.keys(patch as Record<string, unknown>), options.reason || 'patch', previous, options);
        return this.clone(record.state);
    }

    public getValue<TValue>(name: string, path: string, defaultValue: TValue): TValue {
        const record = this.ensureRecord(name, {});
        const value = this.readPath(record.state, path);
        return value === undefined ? this.clone(defaultValue) : this.clone(value as TValue);
    }

    /**
     * 轻量读取字段值，不做 JSON 深拷贝。
     *
     * 说明：
     * - 适合 VM、UI 绑定这类高频只读路径。
     * - 如果读取到的是对象或数组，调用方必须当作只读引用使用。
     *
     * @param name 类型 string，作用是 Store 模块名。
     * @param path 类型 string，作用是模块内字段路径。
     * @param defaultValue 类型 TValue，作用是字段不存在时返回的默认值。
     * @returns 类型 TValue，读取到的字段值或默认值。
     */
    public readValue<TValue>(name: string, path: string, defaultValue?: TValue): TValue {
        const record = this.ensureRecord(name, {});
        const value = this.readPath(record.state, path);
        return value === undefined ? defaultValue as TValue : value as TValue;
    }

    public setValue<TValue>(name: string, path: string, value: TValue, options: HStoreSetOptions = {}): void {
        const record = this.ensureRecord(name, {});
        const previous = this.clone(record.state);
        this.writePath(record.state, path, this.clone(value));
        this.queueChange(record.name, [path], options.reason || 'set-value', previous, options);
    }

    public markDirty(name: string, paths: string | string[] = '*', options: HStoreSetOptions = {}): void {
        const record = this.ensureRecord(name, {});
        this.queueChange(record.name, this.normalizePaths(paths), options.reason || 'mark-dirty', undefined, options);
    }

    public watch<TState extends HStoreState>(
        name: string,
        paths: string | string[] | undefined,
        listener: HStoreListener<TState>,
        options: HStoreWatchOptions = {},
    ): () => void {
        this.ensureInit();
        const moduleName = this.normalizeModuleName(name);
        const id = ++this.watcherSeed;
        const watcher: HStoreWatcher = {
            id,
            module: moduleName,
            paths: this.normalizePaths(paths || '*'),
            includeChildren: options.includeChildren !== false,
            once: options.once === true,
            listener: listener as HStoreListener,
        };
        this.watchers.set(id, watcher);

        if (options.immediate) {
            const record = this.ensureRecord<TState>(moduleName, {} as TState);
            listener(this.createChange(record, watcher.paths, 'init', undefined));
            if (watcher.once) {
                this.watchers.delete(id);
            }
        }

        return () => this.watchers.delete(id);
    }

    public flushDirty(): void {
        this.ensureInit();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        const changes = [...this.pendingChanges.values()];
        this.pendingChanges.clear();
        changes.forEach((pending) => this.flushOne(pending));
    }

    public clear(): void {
        this.records.clear();
        this.modules.clear();
        this.watchers.clear();
        this.pendingChanges.clear();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }

    private queueChange(
        moduleName: string,
        paths: string[],
        reason: HStoreChangeReason,
        previous: HStoreState | undefined,
        options: HStoreSetOptions,
    ): void {
        const record = this.records.get(moduleName);
        if (!record) {
            return;
        }

        if (options.persist !== false && record.persist) {
            this.persistRecord(record, options.immediate === true);
        }

        if (options.silent) {
            return;
        }

        const existing = this.pendingChanges.get(moduleName);
        if (existing) {
            paths.forEach((path) => existing.paths.add(path));
            existing.reason = reason;
            existing.previous = existing.previous || previous;
        } else {
            this.pendingChanges.set(moduleName, {
                module: moduleName,
                paths: new Set(paths),
                reason,
                previous,
            });
        }

        if (options.immediate) {
            this.flushDirty();
            return;
        }
        this.scheduleFlush();
    }

    private flushOne(pending: HStorePendingChange): void {
        const record = this.records.get(pending.module);
        if (!record) {
            return;
        }

        const change = this.createChange(record, [...pending.paths], pending.reason, pending.previous);
        const targets = [...this.watchers.values()]
            .filter((watcher) => watcher.module === record.name)
            .filter((watcher) => this.shouldNotify(watcher, change.paths));

        targets.forEach((watcher) => {
            try {
                watcher.listener(change);
            } catch (error) {
                console.warn(`[HStoreFacade] ${record.name} watcher 执行失败`, error);
            }
            if (watcher.once) {
                this.watchers.delete(watcher.id);
            }
        });

        if (this.debug) {
            console.log('[HStoreFacade] flush', record.name, change.paths, change.reason);
        }
    }

    private createChange<TState extends HStoreState>(
        record: HStoreRecord<TState>,
        paths: string[],
        reason: HStoreChangeReason,
        previous?: HStoreState,
    ): HStoreChange<TState> {
        const normalizedPaths = this.normalizePaths(paths.length > 0 ? paths : '*');
        return {
            module: record.name,
            paths: normalizedPaths,
            reason,
            current: this.clone(record.state),
            previous: previous ? this.clone(previous) as TState : undefined,
            timestamp: Date.now(),
            has: (path: string) => this.pathsInclude(normalizedPaths, this.normalizePath(path), true, record.name),
        };
    }

    private persistRecord(record: HStoreRecord, immediate: boolean): void {
        this.dataStore?.setModule(record.storageName, record.state, { immediate });
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushDirty();
        }, this.flushDelayMs);
    }

    private shouldNotify(watcher: HStoreWatcher, changedPaths: string[]): boolean {
        return watcher.paths.some((watchPath) => {
            return changedPaths.some((changedPath) => this.pathsInclude([changedPath], watchPath, watcher.includeChildren, watcher.module));
        });
    }

    private pathsInclude(paths: string[], targetPath: string, includeChildren: boolean, moduleName?: string): boolean {
        const normalizedTarget = this.stripModulePrefix(targetPath, moduleName);
        return paths.some((path) => {
            const normalizedPath = this.stripModulePrefix(path, moduleName);
            if (normalizedPath === '*' || normalizedTarget === '*') {
                return true;
            }
            if (normalizedPath === normalizedTarget) {
                return true;
            }
            if (!includeChildren) {
                return false;
            }
            return normalizedPath.startsWith(`${normalizedTarget}.`)
                || normalizedTarget.startsWith(`${normalizedPath}.`);
        });
    }

    private ensureRecord<TState extends HStoreState>(name: string, defaultValue: TState): HStoreRecord<TState> {
        this.ensureInit();
        const moduleName = this.normalizeModuleName(name);
        const existing = this.records.get(moduleName);
        if (existing) {
            return existing as HStoreRecord<TState>;
        }
        this.register<TState>(moduleName, defaultValue);
        return this.records.get(moduleName)! as HStoreRecord<TState>;
    }

    private normalizeModuleName(name: string): string {
        const normalized = String(name || '').trim();
        if (!normalized) {
            throw new Error('[HStoreFacade] moduleName 不能为空');
        }
        return normalized;
    }

    private normalizePaths(paths: string | string[]): string[] {
        const list = Array.isArray(paths) ? paths : [paths];
        const normalized = list
            .map((path) => this.normalizePath(path))
            .filter((path, index, arr) => arr.indexOf(path) === index);
        return normalized.length > 0 ? normalized : ['*'];
    }

    private normalizePath(path: string): string {
        const normalized = String(path || '*').trim();
        return normalized || '*';
    }

    private stripModulePrefix(path: string, moduleName?: string): string {
        if (!moduleName) {
            return path;
        }
        if (path === moduleName) {
            return '*';
        }
        const prefix = `${moduleName}.`;
        return path.startsWith(prefix) ? path.slice(prefix.length) : path;
    }

    private getDefaultStorageName(moduleName: string): string {
        return this.storagePrefix ? `${this.storagePrefix}:${moduleName}` : moduleName;
    }

    private readPath(data: any, path: string): unknown {
        const normalized = this.normalizePath(path);
        if (normalized === '*') {
            return data;
        }
        return normalized.split('.').reduce((current, key) => {
            return current === undefined || current === null ? undefined : current[key];
        }, data);
    }

    private writePath(data: any, path: string, value: unknown): void {
        const keys = this.normalizePath(path).split('.').filter(Boolean);
        if (keys.length === 0 || keys[0] === '*') {
            return;
        }

        let current = data;
        keys.slice(0, -1).forEach((key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        });
        current[keys[keys.length - 1]] = value;
    }

    private clone<T>(value: T): T {
        if (value === undefined || value === null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }
}
