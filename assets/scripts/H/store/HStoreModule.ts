import type { HStoreFacade } from './HStoreFacade';
import type { HStoreListener, HStoreSetOptions, HStoreState, HStoreWatchOptions } from './HStoreTypes';

/**
 * HStoreModule 是单个数据模块的轻量门面。
 * 业务可以长期持有它，避免在代码里反复写 moduleName 字符串。
 */
export class HStoreModule<TState extends HStoreState = HStoreState> {
    public constructor(
        private readonly store: HStoreFacade,
        public readonly name: string,
        private readonly defaultValue: TState,
    ) {}

    public get(): TState {
        return this.store.get<TState>(this.name, this.defaultValue);
    }

    public set(value: TState, options: HStoreSetOptions = {}): void {
        this.store.set<TState>(this.name, value, options);
    }

    public patch(patch: Partial<TState>, options: HStoreSetOptions = {}): TState {
        return this.store.patch<TState>(this.name, patch, options);
    }

    public getValue<TValue>(path: string, defaultValue: TValue): TValue {
        return this.store.getValue<TValue>(this.name, path, defaultValue);
    }

    public setValue<TValue>(path: string, value: TValue, options: HStoreSetOptions = {}): void {
        this.store.setValue<TValue>(this.name, path, value, options);
    }

    public markDirty(paths?: string | string[], options: HStoreSetOptions = {}): void {
        this.store.markDirty(this.name, paths, options);
    }

    public watch(paths: string | string[] | undefined, listener: HStoreListener<TState>, options: HStoreWatchOptions = {}): () => void {
        return this.store.watch<TState>(this.name, paths, listener, options);
    }

    public reset(options: HStoreSetOptions = {}): void {
        this.store.set<TState>(this.name, this.defaultValue, { ...options, reason: options.reason || 'reset' });
    }
}
