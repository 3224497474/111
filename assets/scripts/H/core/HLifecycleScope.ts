/**
 * 生命周期释放作用域。
 *
 * disable：对象临时不可用时释放，例如 UI 关闭、组件禁用。
 * remove：对象从管理器移除时释放，例如 UI 从缓存移除。
 * destroy：对象彻底销毁时释放，例如节点销毁、模块销毁。
 */
export type HLifecycleClearScope = 'disable' | 'remove' | 'destroy';

/**
 * 生命周期托管对象类型。
 */
export type HLifecycleKind =
    | 'event'
    | 'node-event'
    | 'timer'
    | 'vm-watch'
    | 'resource'
    | 'object'
    | 'custom';

/** 类型 () => void。作用：统一释放函数。 */
export type HLifecycleDispose = () => void;

/**
 * 可被生命周期托管的对象。
 */
export interface HLifecycleDisposableLike {
    dispose?: () => void;
    destroy?: () => void;
    stop?: () => void;
    release?: () => void;
}

/**
 * 添加生命周期托管记录的配置。
 */
export interface HLifecycleAddOptions {
    /** 类型 HLifecycleClearScope。作用：在哪个生命周期阶段自动释放，默认 disable。 */
    scope?: HLifecycleClearScope;

    /** 类型 HLifecycleKind | string。作用：释放对象分类，便于调试和按类型清理。 */
    kind?: HLifecycleKind | string;

    /** 类型 string。作用：调试标签，例如 uiId、vm path、resource key。 */
    label?: string;
}

/**
 * 生命周期托管记录快照。
 */
export interface HLifecycleRecordInfo {
    /** 类型 number。作用：托管记录唯一 id。 */
    id: number;

    /** 类型 string。作用：归属对象名称。 */
    owner: string;

    /** 类型 HLifecycleClearScope。作用：释放作用域。 */
    scope: HLifecycleClearScope;

    /** 类型 string。作用：释放对象分类。 */
    kind: string;

    /** 类型 string | undefined。作用：调试标签。 */
    label?: string;

    /** 类型 number。作用：创建时间戳。 */
    createdAt: number;
}

interface HLifecycleRecord extends HLifecycleRecordInfo {
    dispose: HLifecycleDispose;
}

const ScopeWeight: Record<HLifecycleClearScope, number> = {
    disable: 1,
    remove: 2,
    destroy: 3,
};

/**
 * HLifecycleScope 是框架级生命周期托管容器。
 *
 * 设计目标：
 * - UI、VM、Presenter、资源、对象池都可以使用同一套释放语义。
 * - 业务代码只登记资源和监听，不手动关心何时 off/unwatch/release。
 * - 每条释放记录都有唯一 id，方便单独释放、调试和排查泄漏。
 */
export class HLifecycleScope {
    private seed = 0;
    private version = 0;
    private destroyed = false;
    private readonly records = new Map<number, HLifecycleRecord>();

    public constructor(
        private readonly owner = 'unknown',
        private readonly debug = false,
    ) {}

    /**
     * 添加一个释放函数。
     *
     * @param dispose 类型 HLifecycleDispose，作用是生命周期结束时执行的释放函数。
     * @param options 类型 HLifecycleAddOptions，作用是配置释放作用域、分类和标签。
     * @returns 类型 number，返回托管记录唯一 id。
     */
    public add(dispose: HLifecycleDispose, options: HLifecycleAddOptions = {}): number {
        if (typeof dispose !== 'function') {
            return 0;
        }

        if (this.destroyed) {
            this.safeDispose(0, 'destroyed-add', dispose);
            return 0;
        }

        const id = this.nextId();
        const record: HLifecycleRecord = {
            id,
            owner: this.owner,
            scope: options.scope || 'disable',
            kind: options.kind || 'custom',
            label: options.label,
            createdAt: Date.now(),
            dispose,
        };

        this.records.set(id, record);
        this.log('add', this.toInfo(record));
        return id;
    }

    /**
     * 添加一个拥有 dispose/destroy/stop/release API 的对象。
     *
     * @param target 类型 HLifecycleDisposableLike | HLifecycleDispose，作用是要托管的对象或释放函数。
     * @param options 类型 HLifecycleAddOptions，作用是配置释放作用域、分类和标签。
     * @returns 类型 number，返回托管记录唯一 id。
     */
    public addDisposable(
        target: HLifecycleDisposableLike | HLifecycleDispose | null | undefined,
        options: HLifecycleAddOptions = {},
    ): number {
        const dispose = this.toDispose(target);
        return dispose ? this.add(dispose, options) : 0;
    }

    /**
     * 立即释放某一条托管记录。
     *
     * @param id 类型 number，作用是 add/addDisposable 返回的托管记录 id。
     */
    public remove(id: number): void {
        const record = this.records.get(id);
        if (!record) {
            return;
        }

        this.records.delete(id);
        this.safeDispose(record.id, record.kind, record.dispose);
        this.log('remove', this.toInfo(record));
    }

    /**
     * 按生命周期作用域批量释放。
     *
     * @param scope 类型 HLifecycleClearScope | undefined，作用是指定释放阶段；不传则释放全部。
     * @param includePrevious 类型 boolean，作用是清理 remove/destroy 时是否连带清理更早阶段。
     * @param kind 类型 string | undefined，作用是只清理指定分类。
     */
    public clear(scope?: HLifecycleClearScope, includePrevious = false, kind?: string): void {
        const ids = [...this.records.values()]
            .filter((record) => this.matchesScope(record, scope, includePrevious))
            .filter((record) => !kind || record.kind === kind)
            .map((record) => record.id);

        ids.forEach((id) => this.remove(id));
    }

    /**
     * 销毁整个生命周期容器。
     */
    public destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.clear('destroy', true);
        this.destroyed = true;
        this.version++;
    }

    /**
     * 递增生命周期版本号。
     *
     * @returns 类型 number，返回新的版本号。
     */
    public nextVersion(): number {
        this.version++;
        return this.version;
    }

    /**
     * 判断版本号是否仍然有效。
     *
     * @param version 类型 number，作用是异步流程开始时保存的版本号。
     * @returns 类型 boolean，true 表示该异步流程仍然属于当前对象生命周期。
     */
    public isVersion(version: number): boolean {
        return !this.destroyed && this.version === version;
    }

    /**
     * 判断生命周期容器是否已经销毁。
     *
     * @returns 类型 boolean，true 表示容器已经销毁。
     */
    public isDestroyed(): boolean {
        return this.destroyed;
    }

    /**
     * 查询当前托管数量。
     *
     * @param kind 类型 string | undefined，作用是只统计指定分类。
     * @returns 类型 number，返回托管记录数量。
     */
    public size(kind?: string): number {
        if (!kind) {
            return this.records.size;
        }

        return [...this.records.values()].filter((record) => record.kind === kind).length;
    }

    /**
     * 获取托管记录快照。
     *
     * @returns 类型 HLifecycleRecordInfo[]，返回调试用快照。
     */
    public getRecords(): HLifecycleRecordInfo[] {
        return [...this.records.values()].map((record) => this.toInfo(record));
    }

    private matchesScope(record: HLifecycleRecord, scope?: HLifecycleClearScope, includePrevious = false): boolean {
        if (!scope) {
            return true;
        }

        if (includePrevious) {
            return ScopeWeight[record.scope] <= ScopeWeight[scope];
        }

        return record.scope === scope;
    }

    private toDispose(target: HLifecycleDisposableLike | HLifecycleDispose | null | undefined): HLifecycleDispose | null {
        if (!target) {
            return null;
        }

        if (typeof target === 'function') {
            return target;
        }

        if (typeof target.dispose === 'function') {
            return () => target.dispose!();
        }
        if (typeof target.destroy === 'function') {
            return () => target.destroy!();
        }
        if (typeof target.stop === 'function') {
            return () => target.stop!();
        }
        if (typeof target.release === 'function') {
            return () => target.release!();
        }

        return null;
    }

    private safeDispose(id: number, kind: string, dispose: HLifecycleDispose): void {
        try {
            dispose();
        } catch (error) {
            console.warn(`[HLifecycleScope] dispose failed: ${this.owner}#${id}:${kind}`, error);
        }
    }

    private nextId(): number {
        this.seed++;
        if (this.seed >= Number.MAX_SAFE_INTEGER) {
            this.seed = 1;
        }
        return this.seed;
    }

    private toInfo(record: HLifecycleRecord): HLifecycleRecordInfo {
        return {
            id: record.id,
            owner: record.owner,
            scope: record.scope,
            kind: record.kind,
            label: record.label,
            createdAt: record.createdAt,
        };
    }

    private log(...args: unknown[]): void {
        if (this.debug) {
            console.log('[HLifecycleScope]', this.owner, ...args);
        }
    }
}
