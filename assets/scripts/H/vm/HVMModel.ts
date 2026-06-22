import type { HStoreFacade } from '../store/HStoreFacade';
import type { HStoreListener, HStoreSetOptions, HStoreState, HStoreWatchOptions } from '../store/HStoreTypes';

/**
 * 单个 VM 数据模型引用。
 *
 * 说明：
 * - tag 对应 H.store 的 moduleName。
 * - 不复制业务数据，只提供统一读写入口。
 */
export class HVMModel<TState extends HStoreState = HStoreState> {
    public constructor(
        private readonly store: HStoreFacade,
        public readonly tag: string,
        private readonly defaultValue: TState = {} as TState,
    ) {}

    /**
     * 获取整个模型数据副本。
     *
     * @returns 类型 TState，当前模型数据。
     */
    public get(): TState {
        return this.store.get<TState>(this.tag, this.defaultValue);
    }

    /**
     * 替换整个模型数据。
     *
     * @param value 类型 TState，作用是新的完整模型数据。
     * @param options 类型 HStoreSetOptions，作用是 Store 写入选项。
     */
    public set(value: TState, options: HStoreSetOptions = {}): void {
        this.store.set<TState>(this.tag, value, options);
    }

    /**
     * 合并模型数据。
     *
     * @param patch 类型 Partial<TState>，作用是要合并的字段。
     * @param options 类型 HStoreSetOptions，作用是 Store 写入选项。
     * @returns 类型 TState，合并后的模型数据。
     */
    public patch(patch: Partial<TState>, options: HStoreSetOptions = {}): TState {
        return this.store.patch<TState>(this.tag, patch, options);
    }

    /**
     * 读取模型字段。
     *
     * @param path 类型 string，作用是模块内字段路径。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，读取到的字段值。
     */
    public getValue<TValue>(path: string, defaultValue?: TValue): TValue {
        return this.store.getValue<TValue>(this.tag, path, defaultValue as TValue);
    }

    /**
     * 轻量读取模型字段，不做深拷贝。
     *
     * @param path 类型 string，作用是模块内字段路径。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，读取到的字段值。
     */
    public readValue<TValue>(path: string, defaultValue?: TValue): TValue {
        return this.store.readValue<TValue>(this.tag, path, defaultValue);
    }

    /**
     * 写入模型字段。
     *
     * @param path 类型 string，作用是模块内字段路径。
     * @param value 类型 TValue，作用是要写入的字段值。
     * @param options 类型 HStoreSetOptions，作用是 Store 写入选项。
     */
    public setValue<TValue>(path: string, value: TValue, options: HStoreSetOptions = {}): void {
        this.store.setValue<TValue>(this.tag, path, value, options);
    }

    /**
     * 标记字段为脏数据。
     *
     * @param paths 类型 string | string[]，作用是要通知刷新的字段路径。
     * @param options 类型 HStoreSetOptions，作用是 Store 写入选项。
     */
    public markDirty(paths: string | string[] = '*', options: HStoreSetOptions = {}): void {
        this.store.markDirty(this.tag, paths, options);
    }

    /**
     * 监听模型字段变化。
     *
     * @param paths 类型 string | string[] | undefined，作用是监听字段路径。
     * @param listener 类型 HStoreListener<TState>，作用是 Store 变化回调。
     * @param options 类型 HStoreWatchOptions，作用是监听选项。
     * @returns 类型 () => void，调用后取消监听。
     */
    public watch(
        paths: string | string[] | undefined,
        listener: HStoreListener<TState>,
        options: HStoreWatchOptions = {},
    ): () => void {
        return this.store.watch<TState>(this.tag, paths, listener, options);
    }
}
