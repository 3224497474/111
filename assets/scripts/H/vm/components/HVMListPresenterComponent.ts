import { _decorator, Component } from 'cc';
import { HVMListPresenter } from '../HVMListPresenter';
import type {
    HVMListPresenterOptions,
    HVMListBuildContext,
    HVMListSourceConfig,
    HVMListTargetConfig,
} from '../HVMListPresenter';

const { ccclass, property } = _decorator;

/**
 * HVMListPresenterComponent 是给 UI 预制体挂载使用的列表 Presenter 基类。
 *
 * 设计说明：
 * - UI 打开时 onEnable 自动 start，UI 关闭时 onDisable 自动 stop。
 * - 项目子类重写 getSources、getTarget、buildList，即可完成列表展示数据转换。
 * - 该组件不负责创建 item 节点，节点创建和复用仍然由 HVMList 负责。
 */
@ccclass('HVMListPresenterComponent')
export class HVMListPresenterComponent<TViewItem = unknown> extends Component {
    @property({ tooltip: '启用节点时是否自动启动 Presenter。' })
    public autoStart = true;

    @property({ tooltip: '启动时是否立即生成一次展示列表。' })
    public immediate = true;

    @property({ tooltip: '停止或销毁时是否清空目标展示列表。' })
    public clearTargetOnStop = false;

    @property({ tooltip: '是否输出 Presenter 调试日志。' })
    public debug = false;

    /** 类型 HVMListPresenter<TViewItem> | null。作用：当前组件持有的 Presenter 实例。*/
    protected presenter: HVMListPresenter<TViewItem> | null = null;

    /**
     * Cocos 生命周期：节点启用时启动 Presenter。
     */
    protected onEnable(): void {
        if (this.autoStart) {
            this.startPresenter();
        }
    }

    /**
     * Cocos 生命周期：节点禁用时停止 Presenter，避免 UI 关闭后继续刷新。
     */
    protected onDisable(): void {
        this.stopPresenter(this.clearTargetOnStop);
    }

    /**
     * Cocos 生命周期：节点销毁时释放 Presenter。
     */
    protected onDestroy(): void {
        this.destroyPresenter(this.clearTargetOnStop);
    }

    /**
     * 手动启动 Presenter。
     */
    public startPresenter(): void {
        const presenter = this.getOrCreatePresenter();
        presenter.start();
    }

    /**
     * 手动停止 Presenter。
     *
     * @param clearTarget 类型 boolean，作用是停止时是否清空目标展示列表。
     */
    public stopPresenter(clearTarget = false): void {
        this.presenter?.stop(clearTarget);
    }

    /**
     * 手动销毁 Presenter。
     *
     * @param clearTarget 类型 boolean，作用是销毁时是否清空目标展示列表。
     */
    public destroyPresenter(clearTarget = false): void {
        this.presenter?.destroy(clearTarget);
        this.presenter = null;
    }

    /**
     * 手动刷新展示列表。
     */
    public refreshPresenter(): void {
        this.getOrCreatePresenter().refresh('manual');
    }

    /**
     * 获取 Presenter 实例。
     *
     * @returns 类型 HVMListPresenter<TViewItem>，返回当前 Presenter。
     */
    public getPresenter(): HVMListPresenter<TViewItem> {
        return this.getOrCreatePresenter();
    }

    /**
     * 获取原始数据源配置。
     *
     * @returns 类型 HVMListSourceConfig[]，项目子类返回任务列表、用户信息、选中 id 等来源。
     */
    protected getSources(): HVMListSourceConfig[] {
        return [];
    }

    /**
     * 获取展示列表输出目标。
     *
     * @returns 类型 HVMListTargetConfig，项目子类返回 HVMList 绑定的目标路径。
     */
    protected getTarget(): HVMListTargetConfig {
        return {
            tag: '',
            path: '',
        };
    }

    /**
     * 把原始数据转换为 item 展示数据。
     *
     * @param context 类型 HVMListBuildContext<TViewItem>，作用是读取 source 并生成展示列表。
     * @returns 类型 TViewItem[]，返回给 HVMList 渲染的 item 展示数据列表。
     */
    protected buildList(_context: HVMListBuildContext<TViewItem>): TViewItem[] {
        return [];
    }

    /**
     * 创建 Presenter 配置。
     *
     * @returns 类型 HVMListPresenterOptions<TViewItem>，返回 Presenter 初始化配置。
     */
    protected createPresenterOptions(): HVMListPresenterOptions<TViewItem> {
        return {
            sources: this.getSources(),
            target: this.getTarget(),
            build: (context) => this.buildList(context),
            immediate: this.immediate,
            debug: this.debug,
        };
    }

    private getOrCreatePresenter(): HVMListPresenter<TViewItem> {
        if (!this.presenter) {
            this.presenter = new HVMListPresenter<TViewItem>(this.createPresenterOptions());
        }
        return this.presenter;
    }
}
