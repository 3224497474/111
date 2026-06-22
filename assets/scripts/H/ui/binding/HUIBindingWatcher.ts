import { EditBox, Node, Toggle, isValid } from 'cc';
import type { HStoreFacade } from '../../store/HStoreFacade';
import type { HStoreChange, HStoreSetOptions, HStoreState } from '../../store/HStoreTypes';
import { HUIBindingAdapter } from './HUIBindingAdapter';
import { HUIBindingPath } from './HUIBindingPath';
import type { HUIBindingConfig, HUIBindingRecord, HUIBindingWatcherOptions } from './HUIBindingTypes';

/**
 * HUIBindingWatcher 是 UI 数据驱动绑定的运行时调度器。
 *
 * 核心职责：
 * - UI 打开时订阅 H.store。
 * - Store 字段变化时只刷新命中的绑定。
 * - UI 关闭/移除时统一取消监听，避免内存泄漏。
 * - 支持 Toggle/EditBox 这类控件的双向回写。
 */
export class HUIBindingWatcher {
    private readonly records: HUIBindingRecord[] = [];
    private readonly unwatchers: Array<() => void> = [];
    private recordSeed = 0;
    private started = false;

    public constructor(
        private readonly root: Node,
        private readonly store: HStoreFacade,
        private readonly options: HUIBindingWatcherOptions = {},
    ) {}

    /**
     * 替换绑定配置。
     *
     * @param bindings 类型 HUIBindingConfig[]，作用是 UI 声明的全部数据绑定。
     */
    public setBindings(bindings: HUIBindingConfig[]): void {
        const wasStarted = this.started;
        if (wasStarted) {
            this.stop();
        }

        this.records.length = 0;
        bindings
            .filter((binding) => !!binding?.module && !!binding?.path)
            .forEach((binding) => this.addBinding(binding));

        if (wasStarted) {
            this.start();
        }
    }

    /**
     * 追加一个绑定。
     *
     * @param binding 类型 HUIBindingConfig，作用是单条数据绑定配置。
     */
    public addBinding(binding: HUIBindingConfig): void {
        const record: HUIBindingRecord = {
            id: ++this.recordSeed,
            binding: {
                ...binding,
                target: binding.target || undefined,
                mode: binding.mode || 'one-way',
                immediate: binding.immediate !== false,
                includeChildren: binding.includeChildren !== false,
            },
            node: HUIBindingPath.resolveNode(this.root, binding.node, binding.nodePath, binding.nodeName),
            writeBackConnected: false,
            disposers: [],
        };
        this.records.push(record);
    }

    /**
     * 启动绑定监听。
     */
    public start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.connectStoreWatches();
        this.records.forEach((record) => {
            this.connectWriteBack(record);
            if (record.binding.immediate !== false) {
                this.refreshRecord(record, null);
            }
        });
    }

    /**
     * 停止绑定监听并清理事件。
     */
    public stop(): void {
        this.started = false;

        while (this.unwatchers.length > 0) {
            this.safeDispose(this.unwatchers.pop());
        }

        this.records.forEach((record) => {
            while (record.disposers.length > 0) {
                this.safeDispose(record.disposers.pop());
            }
            record.writeBackConnected = false;
        });
    }

    /**
     * 手动刷新所有绑定或指定模块/路径的绑定。
     *
     * @param moduleName 类型 string | undefined，作用是指定模块名；不传则刷新全部。
     * @param paths 类型 string | string[] | undefined，作用是指定字段路径；不传则刷新模块全部绑定。
     */
    public refresh(moduleName?: string, paths?: string | string[]): void {
        const changedPaths = Array.isArray(paths)
            ? paths
            : paths
                ? [paths]
                : ['*'];

        this.records
            .filter((record) => !moduleName || record.binding.module === moduleName)
            .filter((record) => HUIBindingPath.includes(changedPaths, record.binding.path, record.binding.includeChildren !== false))
            .forEach((record) => this.refreshRecord(record, null));
    }

    /**
     * 根据 Store 变化刷新命中的绑定。
     *
     * @param change 类型 HStoreChange，作用是 H.store 派发的模块变化。
     */
    public refreshByChange(change: HStoreChange): void {
        this.records
            .filter((record) => record.binding.module === change.module)
            .filter((record) => HUIBindingPath.includes(change.paths, record.binding.path, record.binding.includeChildren !== false))
            .forEach((record) => this.refreshRecord(record, change));
    }

    /**
     * 返回当前绑定数量，便于调试。
     *
     * @returns 类型 number，当前绑定记录数量。
     */
    public getBindingCount(): number {
        return this.records.length;
    }

    private connectStoreWatches(): void {
        const groups = new Map<string, HUIBindingConfig[]>();
        this.records.forEach((record) => {
            const list = groups.get(record.binding.module) || [];
            list.push(record.binding);
            groups.set(record.binding.module, list);
        });

        groups.forEach((bindings, moduleName) => {
            const paths = bindings
                .map((binding) => binding.path)
                .filter((path, index, list) => list.indexOf(path) === index);
            const unwatch = this.store.watch(
                moduleName,
                paths.length > 0 ? paths : '*',
                (change) => this.refreshByChange(change),
                {
                    immediate: false,
                    includeChildren: true,
                },
            );
            this.unwatchers.push(unwatch);
        });
    }

    private refreshRecord(record: HUIBindingRecord, change: HStoreChange | null): void {
        const node = this.ensureNode(record);
        if (!node || !isValid(node)) {
            return;
        }

        const binding = record.binding;
        const state = this.store.get<HStoreState>(binding.module, {});
        const rawValue = HUIBindingPath.read(state, binding.path, binding.defaultValue);
        const value = this.formatValue(rawValue, state, binding);
        const context = {
            binding,
            record,
            node,
            state,
            change,
            setValue: (nextValue: unknown, options: HStoreSetOptions = {}) => {
                this.store.setValue(binding.module, binding.path, nextValue, {
                    reason: 'set-value',
                    ...options,
                });
            },
        };

        HUIBindingAdapter.apply(value, context);
        if (this.options.debug) {
            console.log('[HUIBindingWatcher] refresh', this.options.owner || '', binding.module, binding.path, value);
        }
    }

    private ensureNode(record: HUIBindingRecord): Node | null {
        if (record.node && isValid(record.node)) {
            return record.node;
        }

        record.node = HUIBindingPath.resolveNode(
            this.root,
            record.binding.node,
            record.binding.nodePath,
            record.binding.nodeName,
        );
        if (!record.node && this.options.debug) {
            console.warn('[HUIBindingWatcher] 未找到绑定节点', this.options.owner || '', record.binding);
        }
        return record.node;
    }

    private formatValue(value: unknown, state: HStoreState, binding: HUIBindingConfig): unknown {
        let nextValue = value;
        if (typeof nextValue === 'number' && binding.digits !== undefined) {
            nextValue = nextValue.toFixed(Math.max(0, Math.floor(binding.digits)));
        }
        if (binding.formatter) {
            nextValue = binding.formatter(nextValue, state, binding);
        }
        if (binding.template) {
            nextValue = binding.template.replace(/\{value\}/g, nextValue === undefined || nextValue === null ? '' : String(nextValue));
        }
        return nextValue;
    }

    private connectWriteBack(record: HUIBindingRecord): void {
        if (record.writeBackConnected || record.binding.mode !== 'two-way') {
            return;
        }

        const node = this.ensureNode(record);
        if (!node) {
            return;
        }

        const target = record.binding.target || HUIBindingAdapter.inferTarget(node);
        if (target === 'toggle') {
            const callback = () => this.writeNodeValueToStore(record);
            node.on(Toggle.EventType.TOGGLE, callback, this);
            record.disposers.push(() => node.off(Toggle.EventType.TOGGLE, callback, this));
        } else if (target === 'edit-box') {
            const callback = () => this.writeNodeValueToStore(record);
            node.on(EditBox.EventType.EDITING_DID_ENDED, callback, this);
            record.disposers.push(() => node.off(EditBox.EventType.EDITING_DID_ENDED, callback, this));
        }

        record.writeBackConnected = true;
    }

    private writeNodeValueToStore(record: HUIBindingRecord): void {
        const node = this.ensureNode(record);
        if (!node) {
            return;
        }

        const rawValue = HUIBindingAdapter.readFromNode(node, record.binding);
        const state = this.store.get<HStoreState>(record.binding.module, {});
        const context = {
            binding: record.binding,
            record,
            node,
            state,
            change: null,
            setValue: (nextValue: unknown, options: HStoreSetOptions = {}) => {
                this.store.setValue(record.binding.module, record.binding.path, nextValue, {
                    reason: 'set-value',
                    ...options,
                });
            },
        };
        const nextValue = record.binding.read
            ? record.binding.read(rawValue, context)
            : rawValue;
        context.setValue(nextValue);
    }

    private safeDispose(dispose?: () => void): void {
        if (!dispose) {
            return;
        }

        try {
            dispose();
        } catch (error) {
            console.warn('[HUIBindingWatcher] dispose 执行失败', error);
        }
    }
}
