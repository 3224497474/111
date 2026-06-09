import { Game, game, sys } from 'cc';
import type {
    HDataImportOptions,
    HDataInitOptions,
    HDataModuleConfig,
    HDataSetOptions,
    HDataSnapshot,
    HDataStorageMode,
} from '../HTypes';
import { HDataModule } from './HDataModule';

export class HDataStore {
    private namespace = 'H';
    private flushDelayMs = 1000;
    private debug = false;
    private initialized = false;
    private hideEventBound = false;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private version = 1;
    private storageMode: HDataStorageMode = 'module';
    private snapshotKey = '__snapshot__';
    private autoLoadLocal = true;
    private snapshotLoaded = false;

    private readonly moduleCache = new Map<string, unknown>();
    private readonly moduleDefaults = new Map<string, unknown>();
    private readonly moduleConfigs = new Map<string, HDataModuleConfig>();
    private readonly moduleFacades = new Map<string, HDataModule<any>>();
    private readonly dirtyModules = new Set<string>();
    private readonly flushListeners = new Set<(moduleName: string) => void>();
    private snapshotModules: Record<string, unknown> = {};
    private snapshotVersion = 1;

    /**
     * 初始化本地存储。namespace 用于区分不同游戏、不同账号或不同环境。
     * 如果配置了 modules 且 autoLoadLocal 不为 false，会在进入游戏时读取本地数据到缓存。
     */
    public init(options: HDataInitOptions = {}): void {
        const nextNamespace = options.namespace?.trim() || this.namespace;
        if (this.initialized && nextNamespace !== this.namespace) {
            this.clearRuntimeCache();
        }

        this.namespace = nextNamespace;
        this.flushDelayMs = Math.max(0, Math.floor(options.flushDelayMs ?? this.flushDelayMs));
        this.debug = !!options.debug;
        this.version = Math.max(1, Math.floor(options.version ?? this.version));
        this.storageMode = options.storageMode || this.storageMode;
        this.snapshotKey = options.snapshotKey?.trim() || this.snapshotKey;
        this.autoLoadLocal = options.autoLoadLocal !== false;
        this.initialized = true;

        this.registerModules(options.modules || []);

        if (this.autoLoadLocal) {
            this.loadLocalData();
        }

        if (!this.hideEventBound) {
            this.hideEventBound = true;
            game.on(Game.EVENT_HIDE, this.handleGameHide, this);
        }
    }

    /**
     * 注册模块默认数据，并返回模块门面。业务层推荐长期持有这个门面，而不是散写 moduleName。
     */
    public registerModule<T>(config: HDataModuleConfig<T>): HDataModule<T> {
        this.ensureInit();
        const moduleName = this.normalizeModuleName(config.name);
        const normalizedConfig: HDataModuleConfig<T> = {
            ...config,
            name: moduleName,
            defaultValue: this.clone(config.defaultValue ?? {}) as T,
        };

        this.moduleConfigs.set(moduleName, normalizedConfig);
        this.moduleDefaults.set(moduleName, this.clone(normalizedConfig.defaultValue));

        const facade = this.getModuleFacade<T>(moduleName, normalizedConfig.defaultValue as T);
        if (this.autoLoadLocal && normalizedConfig.autoLoad !== false) {
            this.getModule<T>(moduleName, normalizedConfig.defaultValue as T);
        }
        return facade;
    }

    public registerModules(configs: HDataModuleConfig[]): void {
        configs.forEach((config) => this.registerModule(config));
    }

    /**
     * 获取模块门面。没有提前注册时，也可以传 defaultValue 临时创建。
     */
    public module<T = Record<string, unknown>>(moduleName: string, defaultValue?: T): HDataModule<T> {
        this.ensureInit();
        const normalizedModuleName = this.normalizeModuleName(moduleName);
        if (defaultValue !== undefined && !this.moduleDefaults.has(normalizedModuleName)) {
            this.moduleDefaults.set(normalizedModuleName, this.clone(defaultValue));
        }

        const resolvedDefault = this.resolveDefaultValue<T>(normalizedModuleName, defaultValue);
        return this.getModuleFacade<T>(normalizedModuleName, resolvedDefault);
    }

    /**
     * 进入游戏时主动读取本地数据。未传 moduleNames 时，读取所有已注册且 autoLoad 不为 false 的模块。
     */
    public loadLocalData(moduleNames?: string[]): void {
        this.ensureSnapshotLoaded();
        const names = moduleNames && moduleNames.length > 0
            ? moduleNames.map((name) => this.normalizeModuleName(name))
            : [...this.moduleConfigs.values()]
                .filter((config) => config.autoLoad !== false)
                .map((config) => config.name);

        names.forEach((name) => {
            this.getModule(name, this.resolveDefaultValue(name));
        });
    }

    /**
     * 读取一个模块数据。外部拿到的是副本，避免直接改缓存绕过 dirty 标记。
     */
    public getModule<T>(moduleName: string, defaultValue: T): T {
        this.ensureInit();
        const normalizedModuleName = this.normalizeModuleName(moduleName);
        if (!this.moduleDefaults.has(normalizedModuleName)) {
            this.moduleDefaults.set(normalizedModuleName, this.clone(defaultValue));
        }
        if (!this.moduleCache.has(normalizedModuleName)) {
            this.moduleCache.set(
                normalizedModuleName,
                this.readModuleFromStorage(normalizedModuleName, defaultValue),
            );
        }

        return this.clone(this.moduleCache.get(normalizedModuleName) as T);
    }

    /**
     * 替换整个模块数据，并标记为脏数据。
     */
    public setModule<T>(moduleName: string, value: T, options: HDataSetOptions = {}): void {
        this.ensureInit();
        const normalizedModuleName = this.normalizeModuleName(moduleName);
        this.moduleCache.set(normalizedModuleName, this.clone(value));
        this.snapshotModules[normalizedModuleName] = this.clone(value);
        this.markDirty(normalizedModuleName, options.immediate);
    }

    /**
     * 按对象字段合并模块数据，适合配置、红点、用户资料这类小模块。
     */
    public patchModule<T extends Record<string, unknown>>(moduleName: string, patch: Partial<T>, options: HDataSetOptions = {}): T {
        const current = this.getModule<T>(moduleName, {} as T);
        const next = {
            ...current,
            ...patch,
        } as T;
        this.setModule(moduleName, next, options);
        return this.clone(next);
    }

    /**
     * 读取点路径字段，例如 getValue('user', 'profile.nickName', '游客')。
     */
    public getValue<T>(moduleName: string, path: string, defaultValue: T): T {
        const moduleData = this.getModule<Record<string, unknown>>(moduleName, {});
        const value = this.readPath(moduleData, path);
        return value === undefined ? defaultValue : this.clone(value as T);
    }

    /**
     * 写入点路径字段。写完只标记模块 dirty，由调度器批量落盘。
     */
    public setValue<T>(moduleName: string, path: string, value: T, options: HDataSetOptions = {}): void {
        const moduleData = this.getModule<Record<string, unknown>>(moduleName, {});
        this.writePath(moduleData, path, value);
        this.setModule(moduleName, moduleData, options);
    }

    public markDirty(moduleName: string, immediate = false): void {
        const normalizedModuleName = this.normalizeModuleName(moduleName);
        this.dirtyModules.add(normalizedModuleName);

        if (immediate) {
            this.flush(normalizedModuleName);
            return;
        }

        this.scheduleFlush();
    }

    public isDirty(moduleName?: string): boolean {
        if (!moduleName) {
            return this.dirtyModules.size > 0;
        }
        return this.dirtyModules.has(this.normalizeModuleName(moduleName));
    }

    public getDirtyModules(): string[] {
        return [...this.dirtyModules];
    }

    public flush(moduleName?: string): void {
        this.ensureInit();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        let flushed = false;
        if (moduleName) {
            flushed = this.flushOne(this.normalizeModuleName(moduleName), false);
        } else {
            [...this.dirtyModules].forEach((dirtyModuleName) => {
                flushed = this.flushOne(dirtyModuleName, false) || flushed;
            });
        }

        if (flushed && this.shouldWriteSnapshot()) {
            this.writeSnapshotToStorage();
        }
    }

    /**
     * 导出最终本地存档快照。可用于调试、云存档上传、跨设备迁移。
     */
    public exportSnapshot(): HDataSnapshot {
        this.ensureInit();
        const modules: Record<string, unknown> = {
            ...this.clone(this.snapshotModules),
        };
        this.moduleCache.forEach((value, moduleName) => {
            modules[moduleName] = this.clone(value);
        });

        return {
            version: this.version,
            namespace: this.namespace,
            updatedAt: Date.now(),
            modules,
        };
    }

    /**
     * 导入存档快照。默认替换当前缓存；merge=true 时只覆盖传入模块。
     */
    public importSnapshot(snapshot: Partial<HDataSnapshot>, options: HDataImportOptions = {}): void {
        this.ensureInit();
        const incomingModules = snapshot.modules || {};

        if (!options.merge) {
            this.moduleCache.clear();
            this.snapshotModules = {};
            this.dirtyModules.clear();
        }

        Object.keys(incomingModules).forEach((moduleName) => {
            const normalizedModuleName = this.normalizeModuleName(moduleName);
            const value = this.applyModuleMigrate(
                normalizedModuleName,
                incomingModules[moduleName],
                snapshot.version || this.version,
            );
            this.moduleCache.set(normalizedModuleName, this.clone(value));
            this.snapshotModules[normalizedModuleName] = this.clone(value);
            this.dirtyModules.add(normalizedModuleName);
        });

        if (options.immediate) {
            this.flush();
        } else {
            this.scheduleFlush();
        }
    }

    public getAllModules(): Record<string, unknown> {
        return this.exportSnapshot().modules;
    }

    public hasLocalData(): boolean {
        this.ensureInit();
        if (sys.localStorage.getItem(this.getStorageKey(this.snapshotKey))) {
            return true;
        }

        return [...this.moduleConfigs.keys()].some((moduleName) => {
            return !!sys.localStorage.getItem(this.getStorageKey(moduleName));
        });
    }

    public clearModule(moduleName: string): void {
        const normalizedModuleName = this.normalizeModuleName(moduleName);
        this.moduleCache.delete(normalizedModuleName);
        delete this.snapshotModules[normalizedModuleName];
        this.dirtyModules.delete(normalizedModuleName);
        sys.localStorage.removeItem(this.getStorageKey(normalizedModuleName));
        if (this.shouldWriteSnapshot()) {
            this.writeSnapshotToStorage();
        }
    }

    public clearAll(): void {
        this.moduleCache.clear();
        this.snapshotModules = {};
        this.dirtyModules.clear();
        this.moduleConfigs.forEach((_, moduleName) => {
            sys.localStorage.removeItem(this.getStorageKey(moduleName));
        });
        sys.localStorage.removeItem(this.getStorageKey(this.snapshotKey));
    }

    public onFlushed(listener: (moduleName: string) => void): void {
        this.flushListeners.add(listener);
    }

    public offFlushed(listener: (moduleName: string) => void): void {
        this.flushListeners.delete(listener);
    }

    private readonly handleGameHide = (): void => {
        // 切后台时立即落盘，降低延迟保存带来的丢档风险。
        this.flush();
    };

    private getModuleFacade<T>(moduleName: string, defaultValue: T): HDataModule<T> {
        const existing = this.moduleFacades.get(moduleName);
        if (existing) {
            return existing as HDataModule<T>;
        }

        const facade = new HDataModule<T>(this, moduleName, this.clone(defaultValue));
        this.moduleFacades.set(moduleName, facade);
        return facade;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flush();
        }, this.flushDelayMs);
    }

    private flushOne(moduleName: string, writeSnapshot: boolean): boolean {
        if (!this.dirtyModules.has(moduleName)) {
            return false;
        }

        const data = this.moduleCache.get(moduleName);
        this.snapshotModules[moduleName] = this.clone(data ?? null);

        if (this.storageMode === 'module' || this.storageMode === 'both') {
            sys.localStorage.setItem(this.getStorageKey(moduleName), JSON.stringify(data ?? null));
        }

        this.dirtyModules.delete(moduleName);

        if (writeSnapshot && this.shouldWriteSnapshot()) {
            this.writeSnapshotToStorage();
        }

        if (this.debug) {
            console.log(`[HDataStore] flush ${moduleName}`);
        }

        this.flushListeners.forEach((listener) => listener(moduleName));
        return true;
    }

    private readModuleFromStorage<T>(moduleName: string, defaultValue: T): T {
        this.ensureSnapshotLoaded();

        if (Object.prototype.hasOwnProperty.call(this.snapshotModules, moduleName)) {
            return this.clone(
                this.applyModuleMigrate(moduleName, this.snapshotModules[moduleName], this.snapshotVersion) as T,
            );
        }

        const raw = sys.localStorage.getItem(this.getStorageKey(moduleName));
        if (!raw) {
            return this.clone(defaultValue);
        }

        try {
            return this.clone(this.applyModuleMigrate(moduleName, JSON.parse(raw), this.version) as T);
        } catch (error) {
            console.warn(`[HDataStore] ${moduleName} 存档解析失败，使用默认值`, error);
            return this.clone(defaultValue);
        }
    }

    private ensureSnapshotLoaded(): void {
        if (this.snapshotLoaded || this.storageMode === 'module') {
            return;
        }

        this.snapshotLoaded = true;
        const raw = sys.localStorage.getItem(this.getStorageKey(this.snapshotKey));
        if (!raw) {
            return;
        }

        try {
            const snapshot = JSON.parse(raw) as Partial<HDataSnapshot>;
            this.snapshotVersion = Math.max(1, Math.floor(snapshot.version || 1));
            this.snapshotModules = this.clone(snapshot.modules || {});
        } catch (error) {
            console.warn('[HDataStore] 完整存档快照解析失败，继续使用模块存档', error);
            this.snapshotModules = {};
            this.snapshotVersion = this.version;
        }
    }

    private writeSnapshotToStorage(): void {
        const snapshot = this.exportSnapshot();
        this.snapshotModules = this.clone(snapshot.modules);
        sys.localStorage.setItem(this.getStorageKey(this.snapshotKey), JSON.stringify(snapshot));

        if (this.debug) {
            console.log(`[HDataStore] flush snapshot ${this.snapshotKey}`);
        }
    }

    private shouldWriteSnapshot(): boolean {
        return this.storageMode === 'snapshot' || this.storageMode === 'both';
    }

    private applyModuleMigrate(moduleName: string, stored: unknown, fromVersion: number): unknown {
        const config = this.moduleConfigs.get(moduleName);
        if (!config?.migrate) {
            return this.clone(stored);
        }

        const targetVersion = Math.max(1, Math.floor(config.version || this.version));
        if (fromVersion >= targetVersion) {
            return this.clone(stored);
        }

        try {
            return this.clone(config.migrate(stored, fromVersion, targetVersion));
        } catch (error) {
            console.warn(`[HDataStore] ${moduleName} 存档迁移失败，使用默认值`, error);
            return this.clone(config.defaultValue ?? {});
        }
    }

    private resolveDefaultValue<T = Record<string, unknown>>(moduleName: string, explicitDefault?: T): T {
        if (explicitDefault !== undefined) {
            return this.clone(explicitDefault);
        }

        if (this.moduleDefaults.has(moduleName)) {
            return this.clone(this.moduleDefaults.get(moduleName) as T);
        }

        return {} as T;
    }

    private getStorageKey(moduleName: string): string {
        return `${this.namespace}.${moduleName}`;
    }

    private normalizeModuleName(moduleName: string): string {
        const normalizedModuleName = moduleName.trim();
        if (!normalizedModuleName) {
            throw new Error('[HDataStore] moduleName 不能为空');
        }
        return normalizedModuleName;
    }

    private readPath(data: Record<string, unknown>, path: string): unknown {
        const parts = this.normalizePath(path);
        let cursor: unknown = data;
        for (const part of parts) {
            if (!cursor || typeof cursor !== 'object') {
                return undefined;
            }
            cursor = (cursor as Record<string, unknown>)[part];
        }
        return cursor;
    }

    private writePath(data: Record<string, unknown>, path: string, value: unknown): void {
        const parts = this.normalizePath(path);
        let cursor = data;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const next = cursor[part];
            if (!next || typeof next !== 'object') {
                cursor[part] = {};
            }
            cursor = cursor[part] as Record<string, unknown>;
        }
        cursor[parts[parts.length - 1]] = this.clone(value);
    }

    private normalizePath(path: string): string[] {
        const parts = path.split('.').map((part) => part.trim()).filter((part) => part.length > 0);
        if (parts.length === 0) {
            throw new Error('[HDataStore] path 不能为空');
        }
        return parts;
    }

    private clearRuntimeCache(): void {
        this.moduleCache.clear();
        this.moduleDefaults.clear();
        this.moduleConfigs.clear();
        this.moduleFacades.clear();
        this.dirtyModules.clear();
        this.snapshotModules = {};
        this.snapshotLoaded = false;
        this.snapshotVersion = this.version;
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
