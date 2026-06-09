import { _decorator, Component, Label, Node } from 'cc';
import { H } from '../H';

const { ccclass, property } = _decorator;

@ccclass('HRedDotIcon')
export class HRedDotIcon extends Component {
    @property({ tooltip: '红点树路径，推荐使用 Root/shop/item。也兼容 Root.shop.item。' })
    public redDotPath = '';

    @property({ tooltip: '是否自动定义红点节点。普通红点图标建议开启。' })
    public autoDefine = true;

    @property({ tooltip: '是否把这个红点状态保存到本地。只对需要跨次启动记住的红点开启。' })
    public persist = false;

    @property({ tooltip: '是否反向显示。默认 true 显示红点，开启后 false 显示节点。' })
    public invertVisible = false;

    @property({ type: Node, tooltip: '实际控制显示隐藏的红点节点。为空时控制当前节点。' })
    public targetNode: Node | null = null;

    @property({ type: Label, tooltip: '数量文本。需要显示 11、99+ 这类数字红点时拖入 Label。' })
    public countLabel: Label | null = null;

    @property({ tooltip: '是否显示数字。关闭时只显示普通红点。' })
    public showCount = false;

    @property({ tooltip: '最大显示数字，超过后显示为 99+ 这类格式。' })
    public maxDisplayCount = 99;

    private offWatch: (() => void) | null = null;

    protected onLoad(): void {
        this.bindRedDot();
    }

    protected onDestroy(): void {
        this.unbindRedDot();
    }

    /**
     * 运行时切换红点路径，例如同一个 item 预制体复用到不同功能入口。
     */
    public setPath(path: string, persist = this.persist): void {
        this.redDotPath = path;
        this.persist = persist;
        this.bindRedDot();
    }

    public refresh(): void {
        const path = this.redDotPath.trim();
        if (!path) {
            this.applyVisible(false, 0);
            return;
        }

        this.applyVisible(H.redDot.getValue(path), H.redDot.getCount(path));
    }

    private bindRedDot(): void {
        this.unbindRedDot();

        const path = this.redDotPath.trim();
        if (!path) {
            this.applyVisible(false, 0);
            return;
        }

        if (this.autoDefine) {
            H.redDot.define(path, {
                persist: this.persist,
            });
        }

        this.offWatch = H.redDot.watch(path, (visible, _key, count) => {
            this.applyVisible(visible, count);
        });
    }

    private unbindRedDot(): void {
        if (!this.offWatch) {
            return;
        }

        this.offWatch();
        this.offWatch = null;
    }

    private applyVisible(visible: boolean, count: number): void {
        const target = this.targetNode || this.node;
        if (!target?.isValid) {
            return;
        }

        target.active = this.invertVisible ? !visible : visible;

        if (!this.countLabel?.isValid) {
            return;
        }

        this.countLabel.node.active = this.showCount && visible;
        this.countLabel.string = this.formatCount(count);
    }

    private formatCount(count: number): string {
        const safeCount = Math.max(0, Math.floor(count));
        const maxCount = Math.max(1, Math.floor(this.maxDisplayCount));
        return safeCount > maxCount ? `${maxCount}+` : `${safeCount}`;
    }
}
