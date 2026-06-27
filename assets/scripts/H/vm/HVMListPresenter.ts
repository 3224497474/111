import { H } from '../H';
import { HLifecycleScope } from '../core/HLifecycleScope';
import type { HVMPathLike, HVMSetOptions, HVMTagLike, HVMWatchOptions } from './HVMTypes';

/**
 * 列表 Presenter 的刷新原因。
 *
 * start：启动 Presenter 后的首次刷新。
 * manual：外部主动调用 refresh。
 * source-change：原始数据变化后自动刷新。
 */
export type HVMListPresenterRefreshReason = 'start' | 'manual' | 'source-change';

/**
 * 列表 Presenter 的数据源配置。
 *
 * @template TValue 类型 TValue，作用是该数据源读取出来的数据类型。
 */
export interface HVMListSourceConfig<TValue = unknown> {
    /** 类型 HVMTagLike，作用是原始数据所在的 VM tag，推荐项目层使用枚举。 */
    tag: HVMTagLike;

    /** 类型 HVMPathLike，作用是原始数据字段路径，推荐项目层使用枚举。 */
    path: HVMPathLike;

    /** 类型 TValue，作用是字段不存在时的默认值。 */
    defaultValue?: TValue;

    /** 类型 boolean，作用是是否监听子路径变化，默认 true。 */
    includeChildren?: boolean;

    /** 类型 boolean，作用是是否允许只监听 tag 根路径，默认 false。 */
    allowRootPath?: boolean;
}

/**
 * 列表 Presenter 的输出目标配置。
 */
export interface HVMListTargetConfig {
    /** 类型 HVMTagLike，作用是展示数据列表写入的 VM tag，推荐项目层使用枚举。 */
    tag: HVMTagLike;

    /** 类型 HVMPathLike，作用是展示数据列表写入的字段路径，HVMList 绑定这个路径。 */
    path: HVMPathLike;
}

/**
 * 列表 Presenter 的构建上下文。
 *
 * @template TViewItem 类型 TViewItem，作用是最终给 HVMList 渲染的 item 展示数据类型。
 */
export interface HVMListBuildContext<TViewItem = unknown> {
    /** 类型 HVMListPresenter<TViewItem>，作用是当前 Presenter 实例。 */
    presenter: HVMListPresenter<TViewItem>;

    /** 类型 HVMListPresenterRefreshReason，作用是本次刷新原因。 */
    reason: HVMListPresenterRefreshReason;

    /** 类型 number，作用是 Presenter 当前刷新版本号。 */
    version: number;

    /** 类型 unknown[]，作用是所有 source 按配置顺序读取到的值。 */
    sourceValues: unknown[];

    /**
     * 读取某个 source 的值。
     *
     * @param index 类型 number，作用是 source 配置数组中的索引。
     * @param defaultValue 类型 TValue，作用是值为空时使用的默认值。
     * @returns 类型 TValue，返回该 source 的当前值。
     */
    getSource<TValue = unknown>(index: number, defaultValue?: TValue): TValue;

    /**
     * 轻量读取任意 VM 字段。
     *
     * @param tag 类型 HVMTagLike，作用是要读取的 VM tag。
     * @param path 类型 HVMPathLike，作用是要读取的字段路径。
     * @param defaultValue 类型 TValue，作用是字段不存在时的默认值。
     * @returns 类型 TValue，返回读取到的字段值。
     */
    read<TValue = unknown>(tag: HVMTagLike, path: HVMPathLike, defaultValue?: TValue): TValue;

    /**
     * 手动写入展示列表。
     *
     * @param list 类型 TViewItem[]，作用是要写入目标 VM 的展示数据列表。
     * @param options 类型 HVMSetOptions，作用是 VM 写入选项。
     */
    writeTarget(list: TViewItem[], options?: HVMSetOptions): void;
}

/**
 * 列表 Presenter 的构建函数。
 *
 * @param context 类型 HVMListBuildContext<TViewItem>，作用是读取原始数据并生成展示列表。
 * @returns 类型 TViewItem[]，返回给 HVMList 渲染的 item 展示数据数组。
 */
export type HVMListBuildHandler<TViewItem = unknown> = (
    context: HVMListBuildContext<TViewItem>,
) => TViewItem[];

/**
 * 列表 Presenter 初始化配置。
 *
 * @template TViewItem 类型 TViewItem，作用是最终给 HVMList 渲染的 item 展示数据类型。
 */
export interface HVMListPresenterOptions<TViewItem = unknown> {
    /** 类型 HVMListSourceConfig[]，作用是原始数据来源列表。 */
    sources: HVMListSourceConfig[];

    /** 类型 HVMListTargetConfig，作用是展示数据列表写入位置。 */
    target: HVMListTargetConfig;

    /** 类型 HVMListBuildHandler<TViewItem>，作用是把原始数据转换成 item 展示数据。 */
    build: HVMListBuildHandler<TViewItem>;

    /** 类型 boolean，作用是 start 后是否立即刷新一次，默认 true。 */
    immediate?: boolean;

    /** 类型 HVMSetOptions，作用是写入展示列表时使用的默认 VM 写入选项。 */
    writeOptions?: HVMSetOptions;

    /** 类型 HVMWatchOptions，作用是监听 source 时附加的默认监听选项。 */
    watchOptions?: HVMWatchOptions;

    /** 类型 boolean，作用是是否输出调试日志。 */
    debug?: boolean;
}

/**
 * HVMListPresenter 标准化“原始数据 -> item 展示数据 -> HVMList 刷新”链路。
 *
 * 设计说明：
 * - source 只读原始数据，例如任务列表、用户等级、选中 id。
 * - build 只负责转换展示数据，例如 showLock、showSelected、buttonEnable。
 * - target 只写 UI 展示列表，HVMList 绑定 target 并负责节点复用刷新。
 * - Presenter 不包含任何项目业务字段，项目层通过继承或传入 build 函数使用。
 */
export class HVMListPresenter<TViewItem = unknown> {
    private readonly sources: HVMListSourceConfig[];
    private readonly target: HVMListTargetConfig;
    private readonly build: HVMListBuildHandler<TViewItem>;
    private readonly watchOptions: HVMWatchOptions;
    private readonly writeOptions: HVMSetOptions;
    private readonly immediate: boolean;
    private readonly debug: boolean;
    private readonly lifecycle = new HLifecycleScope('HVMListPresenter');
    private currentList: TViewItem[] = [];
    private started = false;
    private destroyed = false;
    private version = 0;

    public constructor(options: HVMListPresenterOptions<TViewItem>) {
        this.sources = (options.sources || []).slice();
        this.target = options.target;
        this.build = options.build;
        this.watchOptions = options.watchOptions || {};
        this.writeOptions = {
            immediate: true,
            reason: 'list-presenter',
            ...options.writeOptions,
        };
        this.immediate = options.immediate !== false;
        this.debug = !!options.debug;
        this.validateOptions();
    }

    /**
     * 启动 Presenter，注册所有 source 监听。
     */
    public start(): void {
        if (this.started || this.destroyed) {
            return;
        }

        this.started = true;
        this.sources.forEach((source) => {
            const id = H.vm.watch(
                source.tag,
                source.path,
                (_value, _oldValue, context) => {
                    if (this.shouldIgnoreTargetOnlyChange(source, context.change?.paths)) {
                        return;
                    }
                    this.refresh('source-change');
                },
                {
                    ...this.watchOptions,
                    immediate: false,
                    includeChildren: source.includeChildren !== false,
                    allowRootPath: source.allowRootPath,
                },
            );
            this.lifecycle.add(() => H.vm.unwatch(id), {
                scope: 'disable',
                kind: 'vm-watch',
                label: H.vm.path(source.tag, source.path),
            });
        });

        if (this.immediate) {
            this.refresh('start');
        }
    }

    /**
     * 停止 Presenter，注销所有 source 监听。
     *
     * @param clearTarget 类型 boolean，作用是停止时是否把目标展示列表清空，默认 false。
     */
    public stop(clearTarget = false): void {
        if (this.destroyed) {
            return;
        }

        this.lifecycle.clear('disable');
        this.started = false;

        if (clearTarget) {
            this.writeTarget([]);
        }
    }

    /**
     * 销毁 Presenter。
     *
     * @param clearTarget 类型 boolean，作用是销毁时是否把目标展示列表清空，默认 false。
     */
    public destroy(clearTarget = false): void {
        if (this.destroyed) {
            return;
        }

        this.stop(clearTarget);
        this.lifecycle.destroy();
        this.currentList = [];
        this.destroyed = true;
    }

    /**
     * 手动刷新展示列表。
     *
     * @param reason 类型 HVMListPresenterRefreshReason，作用是本次刷新原因。
     * @returns 类型 TViewItem[]，返回本次生成的展示列表。
     */
    public refresh(reason: HVMListPresenterRefreshReason = 'manual'): TViewItem[] {
        if (this.destroyed) {
            return this.currentList;
        }

        this.version++;
        const sourceValues = this.sources.map((source) => {
            return H.vm.read(source.tag, source.path, source.defaultValue);
        });

        const context: HVMListBuildContext<TViewItem> = {
            presenter: this,
            reason,
            version: this.version,
            sourceValues,
            getSource: <TValue = unknown>(index: number, defaultValue?: TValue): TValue => {
                const value = sourceValues[index] as TValue | undefined;
                return value === undefined ? defaultValue as TValue : value;
            },
            read: <TValue = unknown>(tag: HVMTagLike, path: HVMPathLike, defaultValue?: TValue): TValue => {
                return H.vm.read<TValue>(tag, path, defaultValue);
            },
            writeTarget: (list: TViewItem[], options?: HVMSetOptions): void => {
                this.writeTarget(list, options);
            },
        };

        const nextList = this.build(context);
        this.currentList = Array.isArray(nextList) ? nextList : [];
        this.writeTarget(this.currentList);
        this.log('refresh', reason, this.target, this.currentList.length);
        return this.currentList;
    }

    /**
     * 获取当前展示列表。
     *
     * @returns 类型 readonly TViewItem[]，返回最近一次生成的展示数据数组。
     */
    public getList(): readonly TViewItem[] {
        return this.currentList;
    }

    /**
     * 获取当前刷新版本号。
     *
     * @returns 类型 number，返回 Presenter 当前版本号。
     */
    public getVersion(): number {
        return this.version;
    }

    /**
     * 判断 Presenter 是否已经启动监听。
     *
     * @returns 类型 boolean，true 表示已经启动。
     */
    public isStarted(): boolean {
        return this.started;
    }

    /**
     * 判断 Presenter 是否已经销毁。
     *
     * @returns 类型 boolean，true 表示 Presenter 已经销毁，不应再 start/refresh。
     */
    public isDestroyed(): boolean {
        return this.destroyed;
    }

    private writeTarget(list: TViewItem[], options: HVMSetOptions = {}): void {
        H.vm.write(this.target.tag, this.target.path, list, {
            ...this.writeOptions,
            ...options,
        });
    }

    private shouldIgnoreTargetOnlyChange(source: HVMListSourceConfig, changedPaths?: string[]): boolean {
        if (!changedPaths || String(source.tag) !== String(this.target.tag)) {
            return false;
        }

        const targetPath = String(this.target.path);
        return changedPaths.length > 0 && changedPaths.every((path) => {
            return path === targetPath || path.startsWith(`${targetPath}.`);
        });
    }

    private log(...args: unknown[]): void {
        if (this.debug) {
            console.log('[HVMListPresenter]', ...args);
        }
    }

    private validateOptions(): void {
        if (!this.target || !this.hasValue(this.target.tag) || !this.hasValue(this.target.path)) {
            throw new Error('[HVMListPresenter] target tag/path is required');
        }
        if (typeof this.build !== 'function') {
            throw new Error('[HVMListPresenter] build function is required');
        }
    }

    private hasValue(value: HVMTagLike | HVMPathLike): boolean {
        return String(value ?? '').trim().length > 0;
    }
}
