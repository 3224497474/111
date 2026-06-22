import { _decorator, Component, Node } from 'cc';
import type { HUIBindingConfig, HUIBindingTargetKind } from './HUIBindingTypes';

const { ccclass, property } = _decorator;

/**
 * HUIBindingComponent 是可挂在预制体节点上的“声明式绑定组件”。
 *
 * 使用方式：
 * - 在节点上挂这个组件。
 * - 配置 moduleName/path/target。
 * - 当前 UI 继承 HUIViewBase 后，框架会在 bind 阶段自动收集这些组件。
 *
 * 注意：
 * - 这个组件只声明绑定，不自己监听 Store。
 * - 监听、刷新、注销全部由 HUIViewBase/HUIBindingWatcher 统一管理。
 */
@ccclass('HUIBindingComponent')
export class HUIBindingComponent extends Component {
    @property({ tooltip: 'Store 模块名，例如 user、bag、task。' })
    public moduleName = '';

    @property({ tooltip: '模块内字段路径，例如 coin 或 profile.nickName。' })
    public path = '';

    @property({ type: Node, tooltip: '绑定目标节点。不填时默认使用当前节点。' })
    public targetNode: Node | null = null;

    @property({
        tooltip: '目标类型：label、rich-text、active、opacity、progress、toggle、edit-box、sprite-frame、color。',
    })
    public target: HUIBindingTargetKind = 'label';

    @property({ tooltip: '文本模板，例如 金币：{value}。只对文本类或需要字符串显示的绑定生效。' })
    public template = '';

    @property({ tooltip: '数值保留小数位。-1 表示不处理。' })
    public digits = -1;

    @property({ tooltip: '写入 boolean 目标前是否取反。' })
    public invert = false;

    @property({ tooltip: 'Store 字段不存在时使用的默认字符串。' })
    public defaultString = '';

    @property({ tooltip: '是否立即刷新一次。' })
    public immediate = true;

    @property({ tooltip: '是否监听子路径变化。' })
    public includeChildren = true;

    @property({ tooltip: '是否启用双向绑定。只建议用于 Toggle/EditBox。' })
    public twoWay = false;

    /**
     * 转成 HUIBindingWatcher 可识别的绑定配置。
     *
     * @returns 类型 HUIBindingConfig | null，配置不完整时返回 null。
     */
    public toBindingConfig(): HUIBindingConfig | null {
        const module = this.moduleName.trim();
        const bindPath = this.path.trim();
        if (!module || !bindPath) {
            return null;
        }

        return {
            module,
            path: bindPath,
            node: this.targetNode || this.node,
            target: this.target,
            mode: this.twoWay ? 'two-way' : 'one-way',
            template: this.template || undefined,
            digits: this.digits >= 0 ? this.digits : undefined,
            invert: this.invert,
            defaultValue: this.defaultString,
            immediate: this.immediate,
            includeChildren: this.includeChildren,
            debugName: `${this.node.name}.${module}.${bindPath}`,
        };
    }
}
