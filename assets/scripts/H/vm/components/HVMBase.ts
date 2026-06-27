import { _decorator, Component } from 'cc';
import { H } from '../../H';
import { HLifecycleScope } from '../../core/HLifecycleScope';
import type { HVMPathLike, HVMTagLike, HVMWatchId, HVMWatchOptions } from '../HVMTypes';

const { ccclass, property } = _decorator;

/**
 * HVMBase 是所有 VM 绑定组件的基类。
 *
 * 设计说明：
 * - 组件挂到预制体节点上，只声明 tag/path 和展示规则。
 * - 监听、刷新、注销统一走 H.vm，不直接访问 H.store。
 * - 生命周期只在 onEnable/onDisable/onDestroy 中注册和注销，不走 update。
 * - 框架层不写死 user、bag、task；项目可通过继承 getVMTag/getVMPath 返回枚举。
 */
@ccclass('HVMBase')
export class HVMBase<TValue = unknown> extends Component {
    @property({ tooltip: 'VM tag。推荐项目层用枚举赋值，例如 ProjectVMTag.User。' })
    public tag = '';

    @property({ tooltip: 'VM 字段路径。推荐项目层用枚举赋值，例如 UserVMPath.Coin。' })
    public path = '';

    @property({ tooltip: '启用组件时是否立即刷新一次。' })
    public immediate = true;

    @property({ tooltip: '是否监听子路径变化。对象、数组或父路径绑定时建议开启。' })
    public includeChildren = true;

    @property({ tooltip: '组件启用时是否自动注册 VM 监听。' })
    public autoWatch = true;

    /** 类型 HVMWatchId。作用：保存 H.vm.watch 返回的唯一监听 id，注销时精确移除。 */
    protected watchId: HVMWatchId = 0;
    private readonly lifecycle = new HLifecycleScope('HVMBase');
    private watchCleanupId = 0;

    /**
     * Cocos 生命周期：组件启用时注册 VM 监听。
     */
    protected onEnable(): void {
        if (this.autoWatch) {
            this.startWatch();
        }
    }

    /**
     * Cocos 生命周期：组件禁用时注销 VM 监听。
     */
    protected onDisable(): void {
        this.stopWatch();
    }

    /**
     * Cocos 生命周期：节点销毁时兜底注销 VM 监听。
     */
    protected onDestroy(): void {
        this.lifecycle.destroy();
        this.watchId = 0;
        this.watchCleanupId = 0;
    }

    /**
     * 手动启动 VM 监听。
     */
    public startWatch(): void {
        this.stopWatch();

        const tag = this.getVMTag();
        const path = this.getVMPath();
        if (!this.hasValue(tag) || !this.hasValue(path)) {
            return;
        }

        const id = H.vm.watch<TValue>(
            tag,
            path,
            (value, oldValue) => this.refreshValue(value, oldValue),
            this.getWatchOptions(),
        );

        let cleanupId = 0;
        cleanupId = this.lifecycle.add(() => {
            H.vm.unwatch(id);
            if (this.watchId === id) {
                this.watchId = 0;
            }
            if (this.watchCleanupId === cleanupId) {
                this.watchCleanupId = 0;
            }
        }, {
            scope: 'disable',
            kind: 'vm-watch',
            label: H.vm.path(tag, path),
        });

        this.watchId = id;
        this.watchCleanupId = cleanupId;
    }

    /**
     * 手动停止 VM 监听。
     */
    public stopWatch(): void {
        if (!this.watchId) {
            return;
        }

        if (this.watchCleanupId) {
            this.lifecycle.remove(this.watchCleanupId);
            return;
        }

        H.vm.unwatch(this.watchId);
        this.watchId = 0;
    }

    /**
     * 手动刷新一次当前 VM 值。
     */
    public refreshNow(): void {
        const tag = this.getVMTag();
        const path = this.getVMPath();
        if (!this.hasValue(tag) || !this.hasValue(path)) {
            return;
        }

        this.refreshValue(H.vm.read<TValue>(tag, path, this.getDefaultValue()), undefined);
    }

    /**
     * 获取 VM tag。
     *
     * @returns 类型 HVMTagLike，项目子类可重写并返回 ProjectVMTag.User。
     */
    protected getVMTag(): HVMTagLike {
        return this.tag;
    }

    /**
     * 获取 VM 字段路径。
     *
     * @returns 类型 HVMPathLike，项目子类可重写并返回 UserVMPath.Coin。
     */
    protected getVMPath(): HVMPathLike {
        return this.path;
    }

    /**
     * 获取 VM 监听选项。
     *
     * @returns 类型 HVMWatchOptions，返回 immediate/includeChildren 等监听配置。
     */
    protected getWatchOptions(): HVMWatchOptions {
        return {
            immediate: this.immediate,
            includeChildren: this.includeChildren,
        };
    }

    /**
     * 获取默认值。
     *
     * @returns 类型 TValue | undefined，字段不存在时用于第一次刷新。
     */
    protected getDefaultValue(): TValue | undefined {
        return undefined;
    }

    /**
     * VM 值变化回调。
     *
     * @param value 类型 TValue，作用是当前 VM 字段值。
     * @param oldValue 类型 TValue | undefined，作用是上一次 VM 字段值。
     */
    protected refreshValue(_value: TValue, _oldValue?: TValue): void {}

    private hasValue(value: HVMTagLike | HVMPathLike): boolean {
        return String(value ?? '').trim().length > 0;
    }
}
