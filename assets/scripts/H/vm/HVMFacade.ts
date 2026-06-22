import type { HStoreFacade } from '../store/HStoreFacade';
import type { HStoreChange, HStoreState } from '../store/HStoreTypes';
import { HVMModel } from './HVMModel';
import type {
    HVMLegacyBindListener,
    HVMLifecycleInfo,
    HVMAddOptions,
    HVMInitOptions,
    HVMPathInfo,
    HVMPathLike,
    HVMSetOptions,
    HVMStatus,
    HVMTagLike,
    HVMWatchId,
    HVMWatchListener,
    HVMWatchOptions,
    HVMWatchRecord,
} from './HVMTypes';

interface HVMModelRecord<TState extends HStoreState = HStoreState> extends HVMLifecycleInfo {
    model: HVMModel<TState>;
}

interface HVMTagWatchGroup {
    tag: string;
    dispose: () => void;
}

/**
 * HVMFacade 是框架级 VM 门面。
 *
 * 设计目标：
 * - 提供类似第三方仓库 VM.add / VM.getValue / VM.setValue / VM.bindPath 的开发体验。
 * - 底层复用 H.store，不额外维护第二套数据源。
 * - 按 tag 分组监听 Store，避免大量 UI 字段绑定时创建过多 Store watcher。
 * - VM 支持 active / inactive / removed 生命周期，方便暂停派发和统一清理。
 */
export class HVMFacade {
    private store: HStoreFacade | null = null;
    private debug = false;
    private watchSeed = 0;
    private readonly records = new Map<string, HVMModelRecord<any>>();
    private readonly watchers = new Map<HVMWatchId, HVMWatchRecord>();
    private readonly watcherIdsByTag = new Map<string, Set<HVMWatchId>>();
    private readonly watchGroups = new Map<string, HVMTagWatchGroup>();

    /**
     * 初始化 VM 门面。
     *
     * @param store 类型 HStoreFacade，作用是 VM 底层读写的数据源。
     * @param options 类型 HVMInitOptions，作用是 VM 初始化配置。
     */
    public init(store: HStoreFacade, options: HVMInitOptions = {}): void {
        this.store = store;
        this.debug = !!options.debug;
    }

    /**
     * 注册一个 VM 数据模型。
     *
     * @param data 类型 TState，作用是初始模型数据。
     * @param tag 类型 HVMTagLike，作用是模型标签，建议项目层使用枚举。
     * @param options 类型 HVMAddOptions<TState>，作用是持久化、覆盖、生命周期等注册选项。
     * @returns 类型 HVMModel<TState>，返回模型引用。
     */
    public add<TState extends HStoreState>(
        data: TState,
        tag: HVMTagLike = 'global',
        options: HVMAddOptions<TState> = {},
    ): HVMModel<TState> {
        this.ensureStore();
        const normalizedTag = this.normalizeTag(tag);
        const existing = this.records.get(normalizedTag);
        if (existing && existing.status !== 'removed' && !options.overwrite) {
            return existing.model as HVMModel<TState>;
        }

        this.store!.register<TState>(
            normalizedTag,
            options.defaultValue || data,
            {
                persist: options.persist,
                storageName: options.storageName,
                autoLoad: options.autoLoad,
            },
        );

        if (options.defaultValue && data) {
            this.store!.set<TState>(normalizedTag, data, { reason: 'set', immediate: true });
        }

        const now = Date.now();
        const status: HVMStatus = options.active === false ? 'created' : 'active';
        const model = new HVMModel<TState>(this.store!, normalizedTag, options.defaultValue || data);
        this.records.set(normalizedTag, {
            tag: normalizedTag,
            model,
            status,
            createdAt: now,
            activeAt: status === 'active' ? now : 0,
            inactiveAt: 0,
            removedAt: 0,
        });
        this.log('add', normalizedTag, status);
        return model;
    }

    /**
     * 获取 VM 模型引用。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签，建议项目层使用枚举。
     * @param defaultValue 类型 TState，作用是模型不存在时自动创建的默认数据。
     * @returns 类型 HVMModel<TState>，返回模型引用。
     */
    public get<TState extends HStoreState = HStoreState>(
        tag: HVMTagLike = 'global',
        defaultValue: TState = {} as TState,
    ): HVMModel<TState> {
        this.ensureStore();
        const normalizedTag = this.normalizeTag(tag);
        const existing = this.records.get(normalizedTag);
        if (existing && existing.status !== 'removed') {
            return existing.model as HVMModel<TState>;
        }

        if (!this.store!.has(normalizedTag)) {
            this.store!.register<TState>(normalizedTag, defaultValue);
        }

        const now = Date.now();
        const model = new HVMModel<TState>(this.store!, normalizedTag, defaultValue);
        this.records.set(normalizedTag, {
            tag: normalizedTag,
            model,
            status: 'active',
            createdAt: now,
            activeAt: now,
            inactiveAt: 0,
            removedAt: 0,
        });
        return model;
    }

    /**
     * 判断 VM 模型是否处于可用状态。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     * @returns 类型 boolean，true 表示存在且没有 removed。
     */
    public has(tag: HVMTagLike): boolean {
        const normalizedTag = this.normalizeTag(tag);
        const record = this.records.get(normalizedTag);
        return !!record && record.status !== 'removed';
    }

    /**
     * 激活 VM，恢复监听派发。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     */
    public active(tag: HVMTagLike): void {
        this.setStatus(tag, 'active');
    }

    /**
     * 暂停 VM，数据仍可读写，但不会派发 watcher。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     */
    public inactive(tag: HVMTagLike): void {
        this.setStatus(tag, 'inactive');
    }

    /**
     * 获取 VM 生命周期状态。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     * @returns 类型 HVMStatus，返回当前状态。
     */
    public getStatus(tag: HVMTagLike): HVMStatus {
        return this.records.get(this.normalizeTag(tag))?.status || 'removed';
    }

    /**
     * 获取 VM 生命周期快照。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     * @returns 类型 HVMLifecycleInfo | null，未注册时返回 null。
     */
    public getLifecycle(tag: HVMTagLike): HVMLifecycleInfo | null {
        const record = this.records.get(this.normalizeTag(tag));
        if (!record) {
            return null;
        }

        return {
            tag: record.tag,
            status: record.status,
            createdAt: record.createdAt,
            activeAt: record.activeAt,
            inactiveAt: record.inactiveAt,
            removedAt: record.removedAt,
        };
    }

    /**
     * 移除 VM 本地引用，并取消该 tag 下所有 VM watcher。
     *
     * @param tag 类型 HVMTagLike，作用是模型标签。
     */
    public remove(tag: HVMTagLike): void {
        const normalizedTag = this.normalizeTag(tag);
        const record = this.records.get(normalizedTag);
        if (record) {
            record.status = 'removed';
            record.removedAt = Date.now();
        }

        [...(this.watcherIdsByTag.get(normalizedTag) || [])].forEach((id) => this.unwatch(id));
        this.releaseTagWatchGroup(normalizedTag);
        this.records.delete(normalizedTag);
        this.log('remove', normalizedTag);
    }

    /**
     * 拼接枚举 tag 和字段路径。
     *
     * @param tag 类型 HVMTagLike，作用是 VM tag。
     * @param path 类型 HVMPathLike，作用是字段路径。
     * @returns 类型 string，返回完整路径，例如 user.coin。
     */
    public path(tag: HVMTagLike, path: HVMPathLike = '*'): string {
        const normalizedTag = this.normalizeTag(tag);
        const normalizedPath = this.normalizePath(path);
        return normalizedPath === '*' ? normalizedTag : `${normalizedTag}.${normalizedPath}`;
    }

    /**
     * 安全读取完整路径字段，会深拷贝返回值。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，读取到的字段值。
     */
    public getValue<TValue = unknown>(fullPath: string, defaultValue?: TValue): TValue {
        const pathInfo = this.parsePath(fullPath);
        return this.get(pathInfo.tag).getValue<TValue>(pathInfo.path, defaultValue);
    }

    /**
     * 轻量读取完整路径字段，不做深拷贝。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，读取到的字段值。
     */
    public readValue<TValue = unknown>(fullPath: string, defaultValue?: TValue): TValue {
        const pathInfo = this.parsePath(fullPath);
        return this.read<TValue>(pathInfo.tag, pathInfo.path, defaultValue);
    }

    /**
     * 通过枚举 tag 和字段路径轻量读取字段，不做深拷贝。
     *
     * @param tag 类型 HVMTagLike，作用是 VM tag。
     * @param path 类型 HVMPathLike，作用是字段路径。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，读取到的字段值。
     */
    public read<TValue = unknown>(tag: HVMTagLike, path: HVMPathLike, defaultValue?: TValue): TValue {
        this.ensureStore();
        return this.store!.readValue<TValue>(this.normalizeTag(tag), this.normalizePath(path), defaultValue);
    }

    /**
     * 通过完整路径写入字段。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param value 类型 TValue，作用是要写入的字段值。
     * @param options 类型 HVMSetOptions，作用是 Store 写入选项。
     */
    public setValue<TValue>(fullPath: string, value: TValue, options: HVMSetOptions = {}): void {
        const pathInfo = this.parsePath(fullPath);
        this.write<TValue>(pathInfo.tag, pathInfo.path, value, options);
    }

    /**
     * 通过枚举 tag 和字段路径写入字段。
     *
     * @param tag 类型 HVMTagLike，作用是 VM tag。
     * @param path 类型 HVMPathLike，作用是字段路径。
     * @param value 类型 TValue，作用是要写入的字段值。
     * @param options 类型 HVMSetOptions，作用是 Store 写入选项。
     */
    public write<TValue>(tag: HVMTagLike, path: HVMPathLike, value: TValue, options: HVMSetOptions = {}): void {
        this.get(this.normalizeTag(tag)).setValue<TValue>(this.normalizePath(path), value, options);
    }

    /**
     * 通过完整路径给数值字段增加一个值。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param value 类型 number，作用是增加的数值。
     * @param options 类型 HVMSetOptions，作用是 Store 写入选项。
     */
    public addValue(fullPath: string, value: number, options: HVMSetOptions = {}): void {
        const pathInfo = this.parsePath(fullPath);
        this.addNumber(pathInfo.tag, pathInfo.path, value, options);
    }

    /**
     * 通过枚举 tag 和字段路径给数值字段增加一个值。
     *
     * @param tag 类型 HVMTagLike，作用是 VM tag。
     * @param path 类型 HVMPathLike，作用是字段路径。
     * @param value 类型 number，作用是增加的数值。
     * @param options 类型 HVMSetOptions，作用是 Store 写入选项。
     */
    public addNumber(tag: HVMTagLike, path: HVMPathLike, value: number, options: HVMSetOptions = {}): void {
        const current = Number(this.read<number>(tag, path, 0));
        const nextValue = Number.isFinite(current) ? current + value : value;
        this.write(tag, path, nextValue, options);
    }

    /**
     * 通过完整路径监听字段变化。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param listener 类型 HVMWatchListener<TValue, TState>，作用是字段变化回调。
     * @param options 类型 HVMWatchOptions，作用是监听选项。
     * @returns 类型 HVMWatchId，监听唯一 id。
     */
    public watchPath<TValue = unknown, TState extends HStoreState = HStoreState>(
        fullPath: string,
        listener: HVMWatchListener<TValue, TState>,
        options: HVMWatchOptions = {},
    ): HVMWatchId {
        const pathInfo = this.parsePath(fullPath, options.allowRootPath);
        return this.watchByPathInfo<TValue, TState>(pathInfo, listener, options);
    }

    /**
     * 通过枚举 tag 和字段路径监听字段变化。
     *
     * @param tag 类型 HVMTagLike，作用是 VM tag。
     * @param path 类型 HVMPathLike，作用是字段路径。
     * @param listener 类型 HVMWatchListener<TValue, TState>，作用是字段变化回调。
     * @param options 类型 HVMWatchOptions，作用是监听选项。
     * @returns 类型 HVMWatchId，监听唯一 id。
     */
    public watch<TValue = unknown, TState extends HStoreState = HStoreState>(
        tag: HVMTagLike,
        path: HVMPathLike,
        listener: HVMWatchListener<TValue, TState>,
        options: HVMWatchOptions = {},
    ): HVMWatchId {
        return this.watchByPathInfo<TValue, TState>(this.createPathInfo(tag, path), listener, options);
    }

    /**
     * 兼容第三方 VM.bindPath 的监听接口。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param listener 类型 HVMLegacyBindListener<TValue>，作用是旧 VM 风格回调。
     * @param target 类型 any，作用是回调 this 指向。
     * @param options 类型 HVMWatchOptions，作用是监听选项。
     * @returns 类型 HVMWatchId，监听唯一 id。
     */
    public bindPath<TValue = unknown>(
        fullPath: string,
        listener: HVMLegacyBindListener<TValue>,
        target?: any,
        options: HVMWatchOptions = {},
    ): HVMWatchId {
        const id = this.watchPath<TValue>(
            fullPath,
            (value, previousValue, context) => {
                listener.call(target, value, previousValue, context.path.pathArray);
            },
            options,
        );
        const record = this.watchers.get(id);
        if (record) {
            record.listener = listener;
            record.target = target;
        }
        return id;
    }

    /**
     * 取消监听。
     *
     * @param id 类型 HVMWatchId，作用是 watch/watchPath/bindPath 返回的监听 id。
     */
    public unwatch(id: HVMWatchId): void {
        const record = this.watchers.get(id);
        if (!record) {
            return;
        }

        this.watchers.delete(id);
        const idSet = this.watcherIdsByTag.get(record.path.tag);
        idSet?.delete(id);
        if (idSet && idSet.size <= 0) {
            this.watcherIdsByTag.delete(record.path.tag);
            this.releaseTagWatchGroup(record.path.tag);
        }
    }

    /**
     * 兼容第三方 VM.unbindPath。
     *
     * @param idOrPath 类型 HVMWatchId | string，作用是监听 id 或完整路径。
     * @param listener 类型 Function，作用是按路径取消时匹配原始回调。
     * @param target 类型 any，作用是按路径取消时匹配 this 指向。
     */
    public unbindPath(idOrPath: HVMWatchId | string, listener?: Function, target?: any): void {
        if (typeof idOrPath === 'number') {
            this.unwatch(idOrPath);
            return;
        }

        const fullPath = this.parsePath(idOrPath, true).fullPath;
        [...this.watchers.values()]
            .filter((record) => record.path.fullPath === fullPath)
            .filter((record) => !listener || record.listener === listener)
            .filter((record) => target === undefined || record.target === target)
            .forEach((record) => this.unwatch(record.id));
    }

    /**
     * 取消所有 VM 监听。
     */
    public clearWatchers(): void {
        [...this.watchers.keys()].forEach((id) => this.unwatch(id));
    }

    /**
     * 解析完整 VM 路径。
     *
     * @param fullPath 类型 string，作用是完整路径，例如 user.coin。
     * @param allowRootPath 类型 boolean，作用是是否允许只有 tag 的根路径。
     * @returns 类型 HVMPathInfo，解析后的路径信息。
     */
    public parsePath(fullPath: string, allowRootPath = false): HVMPathInfo {
        const normalized = String(fullPath || '').trim();
        if (!normalized) {
            throw new Error('[HVMFacade] fullPath is empty');
        }

        const parts = normalized.split('.').map((part) => part.trim()).filter((part) => !!part);
        if (parts.length < 2 && !allowRootPath) {
            throw new Error(`[HVMFacade] path must be tag.path: ${normalized}`);
        }

        return this.createPathInfo(parts[0], parts.length > 1 ? parts.slice(1).join('.') : '*');
    }

    private watchByPathInfo<TValue, TState extends HStoreState>(
        pathInfo: HVMPathInfo,
        listener: HVMWatchListener<TValue, TState>,
        options: HVMWatchOptions,
    ): HVMWatchId {
        this.ensureStore();
        this.get(pathInfo.tag);
        this.ensureTagWatchGroup(pathInfo.tag);

        const id = ++this.watchSeed;
        this.watchers.set(id, {
            id,
            path: pathInfo,
            listener,
            once: options.once === true,
            includeChildren: options.includeChildren !== false,
        });

        let idSet = this.watcherIdsByTag.get(pathInfo.tag);
        if (!idSet) {
            idSet = new Set();
            this.watcherIdsByTag.set(pathInfo.tag, idSet);
        }
        idSet.add(id);

        if (options.immediate && this.isTagActive(pathInfo.tag)) {
            this.emitImmediate(id, pathInfo, listener);
            if (options.once) {
                this.unwatch(id);
            }
        }

        return id;
    }

    private ensureTagWatchGroup(tag: string): void {
        if (this.watchGroups.has(tag)) {
            return;
        }

        const dispose = this.store!.watch(
            tag,
            '*',
            (change) => this.dispatchTagChange(tag, change),
            {
                immediate: false,
                includeChildren: true,
            },
        );
        this.watchGroups.set(tag, { tag, dispose });
    }

    private releaseTagWatchGroup(tag: string): void {
        const group = this.watchGroups.get(tag);
        if (!group) {
            return;
        }

        this.watchGroups.delete(tag);
        group.dispose();
    }

    private dispatchTagChange<TState extends HStoreState>(tag: string, change: HStoreChange<TState>): void {
        if (!this.isTagActive(tag)) {
            return;
        }

        const ids = [...(this.watcherIdsByTag.get(tag) || [])];
        ids.forEach((id) => {
            const record = this.watchers.get(id);
            if (!record || !this.pathsInclude(change.paths, record.path.path, record.includeChildren)) {
                return;
            }

            this.emitFromChange(id, record.path, record.listener as HVMWatchListener<any, TState>, change);
            if (record.once) {
                this.unwatch(id);
            }
        });
    }

    private emitImmediate<TValue, TState extends HStoreState>(
        id: HVMWatchId,
        pathInfo: HVMPathInfo,
        listener: HVMWatchListener<TValue, TState>,
    ): void {
        const value = this.read<TValue>(pathInfo.tag, pathInfo.path);
        listener(value, undefined, {
            id,
            path: pathInfo,
            value,
            previousValue: undefined,
        });
    }

    private emitFromChange<TValue, TState extends HStoreState>(
        id: HVMWatchId,
        pathInfo: HVMPathInfo,
        listener: HVMWatchListener<TValue, TState>,
        change: HStoreChange<TState>,
    ): void {
        const value = this.readValueFromState<TValue>(change.current, pathInfo.path);
        const previousValue = change.previous
            ? this.readValueFromState<TValue>(change.previous, pathInfo.path)
            : undefined;

        listener(value, previousValue, {
            id,
            path: pathInfo,
            value,
            previousValue,
            change,
        });
    }

    private readValueFromState<TValue>(state: HStoreState, path: string): TValue {
        if (path === '*') {
            return state as TValue;
        }

        return path.split('.').reduce((current, key) => {
            return current === undefined || current === null ? undefined : current[key];
        }, state) as TValue;
    }

    private setStatus(tag: HVMTagLike, status: HVMStatus): void {
        const model = this.get(this.normalizeTag(tag));
        const normalizedTag = model.tag;
        const record = this.records.get(normalizedTag);
        if (!record) {
            return;
        }

        const now = Date.now();
        record.status = status;
        if (status === 'active') {
            record.activeAt = now;
        } else if (status === 'inactive') {
            record.inactiveAt = now;
        } else if (status === 'removed') {
            record.removedAt = now;
        }
        this.log('status', normalizedTag, status);
    }

    private isTagActive(tag: string): boolean {
        return this.records.get(tag)?.status === 'active';
    }

    private pathsInclude(changedPaths: string[], watchPath: string, includeChildren: boolean): boolean {
        const normalizedWatchPath = this.normalizePath(watchPath);
        return changedPaths.some((changedPath) => {
            const normalizedChangedPath = this.normalizePath(changedPath);
            if (normalizedChangedPath === '*' || normalizedWatchPath === '*') {
                return true;
            }
            if (normalizedChangedPath === normalizedWatchPath) {
                return true;
            }
            if (!includeChildren) {
                return false;
            }

            return normalizedChangedPath.startsWith(`${normalizedWatchPath}.`)
                || normalizedWatchPath.startsWith(`${normalizedChangedPath}.`);
        });
    }

    private createPathInfo(tag: HVMTagLike, path: HVMPathLike = '*'): HVMPathInfo {
        const normalizedTag = this.normalizeTag(tag);
        const normalizedPath = this.normalizePath(path);
        return {
            fullPath: normalizedPath === '*' ? normalizedTag : `${normalizedTag}.${normalizedPath}`,
            tag: normalizedTag,
            path: normalizedPath,
            pathArray: normalizedPath === '*' ? [normalizedTag] : [normalizedTag, ...normalizedPath.split('.')],
        };
    }

    private normalizeTag(tag: HVMTagLike): string {
        const normalized = String(tag || '').trim();
        if (!normalized) {
            throw new Error('[HVMFacade] tag is empty');
        }
        if (normalized.includes('.')) {
            throw new Error(`[HVMFacade] tag cannot include dot: ${normalized}`);
        }
        return normalized;
    }

    private normalizePath(path: HVMPathLike): string {
        const normalized = String(path || '*').trim();
        return normalized || '*';
    }

    private ensureStore(): void {
        if (!this.store) {
            throw new Error('[HVMFacade] call H.init() before using H.vm');
        }
    }

    private log(...args: unknown[]): void {
        if (this.debug) {
            console.log('[HVMFacade]', ...args);
        }
    }
}
