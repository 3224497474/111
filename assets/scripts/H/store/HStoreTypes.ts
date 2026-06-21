/**
 * Store 类型集中在这里。
 * H.store 只负责运行时模型、脏字段合并和 UI 刷新通知；真正本地落盘继续复用 H.data。
 */
export type HStoreState = Record<string, any>;
export type HStoreChangeReason =
    | 'init'
    | 'set'
    | 'patch'
    | 'set-value'
    | 'mark-dirty'
    | 'reset'
    | 'remove';

export interface HStoreInitOptions {
    debug?: boolean;
    persistByDefault?: boolean;
    flushDelayMs?: number;
    storagePrefix?: string;
    modules?: HStoreModuleConfig[];
}

export interface HStoreModuleConfig<TState = HStoreState> {
    name: string;
    defaultValue?: TState;
    persist?: boolean;
    storageName?: string;
    autoLoad?: boolean;
}

export interface HStoreSetOptions {
    immediate?: boolean;
    silent?: boolean;
    persist?: boolean;
    reason?: HStoreChangeReason;
}

export interface HStoreWatchOptions {
    immediate?: boolean;
    includeChildren?: boolean;
    once?: boolean;
}

export interface HStoreChange<TState = HStoreState> {
    module: string;
    paths: string[];
    reason: HStoreChangeReason;
    current: TState;
    previous?: TState;
    timestamp: number;
    has(path: string): boolean;
}

export type HStoreListener<TState = HStoreState> = (change: HStoreChange<TState>) => void;

export interface HStoreWatcher {
    id: number;
    module: string;
    paths: string[];
    includeChildren: boolean;
    once: boolean;
    listener: HStoreListener;
}
