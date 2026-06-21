import type { HStoreFacade } from './HStoreFacade';
import type { HStoreListener, HStoreSetOptions, HStoreState, HStoreWatchOptions } from './HStoreTypes';

/**
 * HModel 是项目模型的可继承基类。
 * 框架只提供通用状态读写能力，不在这里放 UserModel、BagModel 这类项目逻辑。
 */
export class HModel<TState extends HStoreState = HStoreState> {
    protected store: HStoreFacade | null = null;

    public constructor(
        public readonly name: string,
        private readonly defaultState: TState,
    ) {}

    public _hAttachStore(store: HStoreFacade): void {
        this.store = store;
        this.onAttach();
    }

    public getDefaultState(): TState {
        return this.clone(this.defaultState);
    }

    public get(): TState {
        this.ensureStore();
        return this.store!.get<TState>(this.name, this.defaultState);
    }

    public set(value: TState, options: HStoreSetOptions = {}): void {
        this.ensureStore();
        this.store!.set<TState>(this.name, value, options);
    }

    public patch(patch: Partial<TState>, options: HStoreSetOptions = {}): TState {
        this.ensureStore();
        return this.store!.patch<TState>(this.name, patch, options);
    }

    public getValue<TValue>(path: string, defaultValue: TValue): TValue {
        this.ensureStore();
        return this.store!.getValue<TValue>(this.name, path, defaultValue);
    }

    public setValue<TValue>(path: string, value: TValue, options: HStoreSetOptions = {}): void {
        this.ensureStore();
        this.store!.setValue<TValue>(this.name, path, value, options);
    }

    public markDirty(paths?: string | string[], options: HStoreSetOptions = {}): void {
        this.ensureStore();
        this.store!.markDirty(this.name, paths, options);
    }

    public watch(paths: string | string[] | undefined, listener: HStoreListener<TState>, options: HStoreWatchOptions = {}): () => void {
        this.ensureStore();
        return this.store!.watch<TState>(this.name, paths, listener, options);
    }

    protected onAttach(): void {}

    private ensureStore(): void {
        if (!this.store) {
            throw new Error(`[HModel] ${this.name} 尚未注册到 H.store`);
        }
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }
}
