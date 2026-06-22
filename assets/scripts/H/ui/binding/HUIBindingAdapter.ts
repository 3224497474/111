import {
    Color,
    EditBox,
    Label,
    Node,
    ProgressBar,
    RichText,
    Sprite,
    SpriteFrame,
    Toggle,
    UIOpacity,
} from 'cc';
import type { HUIBindingApplyContext, HUIBindingConfig } from './HUIBindingTypes';

/**
 * HUIBindingAdapter 负责把 Store 字段写入 Cocos 节点或组件。
 *
 * 说明：
 * - Watcher 只负责“什么时候刷新”。
 * - Adapter 只负责“怎么写到控件”。
 * - 两者拆开后，线上排查时能很快判断是监听问题还是控件写入问题。
 */
export class HUIBindingAdapter {
    /**
     * 应用一次数据绑定。
     *
     * @param value 类型 unknown，作用是待写入 UI 的最终值。
     * @param context 类型 HUIBindingApplyContext，作用是提供节点、配置、Store 等上下文。
     */
    public static apply(value: unknown, context: HUIBindingApplyContext): void {
        const binding = context.binding;
        if (binding.apply) {
            binding.apply(value, context);
            return;
        }

        const target = binding.target || this.inferTarget(context.node);
        switch (target) {
            case 'label':
                this.setLabel(context.node, this.toText(value));
                break;
            case 'rich-text':
                this.setRichText(context.node, this.toText(value));
                break;
            case 'active':
                context.node.active = this.toBoolean(value, binding);
                break;
            case 'opacity':
                this.setOpacity(context.node, this.toOpacity(value));
                break;
            case 'progress':
                this.setProgress(context.node, this.toProgress(value));
                break;
            case 'toggle':
                this.setToggle(context.node, this.toBoolean(value, binding));
                break;
            case 'edit-box':
                this.setEditBox(context.node, this.toText(value));
                break;
            case 'sprite-frame':
                this.setSpriteFrame(context.node, value);
                break;
            case 'color':
                this.setColor(context.node, value);
                break;
            case 'custom':
            default:
                break;
        }
    }

    /**
     * 从 UI 控件读取当前值，用于 two-way 绑定回写 Store。
     *
     * @param node 类型 Node，作用是绑定目标节点。
     * @param binding 类型 HUIBindingConfig，作用是当前绑定配置。
     * @returns 类型 unknown，返回控件当前值。
     */
    public static readFromNode(node: Node, binding: HUIBindingConfig): unknown {
        const target = binding.target || this.inferTarget(node);
        switch (target) {
            case 'toggle':
                return node.getComponent(Toggle)?.isChecked ?? false;
            case 'edit-box':
                return node.getComponent(EditBox)?.string ?? '';
            case 'label':
                return node.getComponent(Label)?.string ?? '';
            case 'rich-text':
                return node.getComponent(RichText)?.string ?? '';
            case 'active':
                return node.active;
            case 'progress':
                return node.getComponent(ProgressBar)?.progress ?? 0;
            case 'opacity':
                return node.getComponent(UIOpacity)?.opacity ?? 255;
            default:
                return undefined;
        }
    }

    /**
     * 根据节点已有组件推断绑定目标类型。
     *
     * @param node 类型 Node，作用是要推断的节点。
     * @returns 类型 HUIBindingConfig['target']，返回推断出的目标类型。
     */
    public static inferTarget(node: Node): HUIBindingConfig['target'] {
        if (node.getComponent(Label)) {
            return 'label';
        }
        if (node.getComponent(RichText)) {
            return 'rich-text';
        }
        if (node.getComponent(ProgressBar)) {
            return 'progress';
        }
        if (node.getComponent(Toggle)) {
            return 'toggle';
        }
        if (node.getComponent(EditBox)) {
            return 'edit-box';
        }
        if (node.getComponent(Sprite)) {
            return 'sprite-frame';
        }
        return 'active';
    }

    private static setLabel(node: Node, text: string): void {
        const label = node.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private static setRichText(node: Node, text: string): void {
        const richText = node.getComponent(RichText);
        if (richText) {
            richText.string = text;
        }
    }

    private static setOpacity(node: Node, opacity: number): void {
        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = opacity;
    }

    private static setProgress(node: Node, progress: number): void {
        const progressBar = node.getComponent(ProgressBar);
        if (progressBar) {
            progressBar.progress = progress;
        }
    }

    private static setToggle(node: Node, checked: boolean): void {
        const toggle = node.getComponent(Toggle);
        if (toggle) {
            toggle.isChecked = checked;
        }
    }

    private static setEditBox(node: Node, text: string): void {
        const editBox = node.getComponent(EditBox);
        if (editBox) {
            editBox.string = text;
        }
    }

    private static setSpriteFrame(node: Node, value: unknown): void {
        const sprite = node.getComponent(Sprite);
        if (sprite && (value === null || value instanceof SpriteFrame)) {
            sprite.spriteFrame = value;
        }
    }

    private static setColor(node: Node, value: unknown): void {
        if (!(value instanceof Color)) {
            return;
        }

        const label = node.getComponent(Label);
        if (label) {
            label.color = value;
        }

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.color = value;
        }
    }

    private static toText(value: unknown): string {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value);
    }

    private static toBoolean(value: unknown, binding: HUIBindingConfig): boolean {
        const result = !!value;
        return binding.invert ? !result : result;
    }

    private static toOpacity(value: unknown): number {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return 255;
        }
        return Math.max(0, Math.min(255, Math.floor(numberValue)));
    }

    private static toProgress(value: unknown): number {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return 0;
        }
        return Math.max(0, Math.min(1, numberValue));
    }
}
