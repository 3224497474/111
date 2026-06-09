import type { HDataSetOptions } from '../HTypes';
import type { HDataStore } from './HDataStore';

export class HDataModule<T = Record<string, unknown>> {
    public constructor(
        private readonly store: HDataStore,
        public readonly name: string,
        private readonly defaultValue: T,
    ) {}

    /**
     * 读取模块完整数据。返回副本，避免外部直接改缓存而绕过 dirty 标记。
     */
    public get(): T {
        return this.store.getModule<T>(this.name, this.defaultValue);
    }

    /**
     * 替换模块完整数据，并标记脏数据。
     */
    public set(value: T, options: HDataSetOptions = {}): void {
        this.store.setModule<T>(this.name, value, options);
    }

    /**
     * 合并对象字段，适合玩家、任务、设置等模块数据。
     */
    public patch(patch: Partial<T>, options: HDataSetOptions = {}): T {
        return this.store.patchModule(this.name, patch as Partial<Record<string, unknown>>, options) as T;
    }

    /**
     * 读取点路径字段，例如 player.getValue('profile.level', 1)。
     */
    public getValue<V>(path: string, defaultValue: V): V {
        return this.store.getValue<V>(this.name, path, defaultValue);
    }

    /**
     * 写入点路径字段，写完会标记当前模块 dirty。
     */
    public setValue<V>(path: string, value: V, options: HDataSetOptions = {}): void {
        this.store.setValue<V>(this.name, path, value, options);
    }

    public markDirty(immediate = false): void {
        this.store.markDirty(this.name, immediate);
    }

    public flush(): void {
        this.store.flush(this.name);
    }

    public reset(options: HDataSetOptions = {}): void {
        this.set(this.defaultValue, options);
    }

    public clear(): void {
        this.store.clearModule(this.name);
    }
}
