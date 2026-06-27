import { Size, Vec2 } from 'cc';

/**
 * 虚拟列表滚动方向。
 *
 * Vertical：竖向滚动。crossCount 表示列数。
 * Horizontal：横向滚动。crossCount 表示行数。
 */
export enum HVirtualListDirection {
    Vertical = 0,
    Horizontal = 1,
}

/**
 * 虚拟列表四边距。
 *
 * 坐标约定：所有布局计算都以左上角为逻辑原点。
 */
export interface HVirtualListPadding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * 虚拟列表布局配置。
 */
export interface HVirtualListLayoutOptions {
    /** 滚动方向。 */
    direction: HVirtualListDirection;

    /** item 宽度。 */
    itemWidth: number;

    /** item 高度。 */
    itemHeight: number;

    /** 横向间距。 */
    spacingX: number;

    /** 纵向间距。 */
    spacingY: number;

    /** 四边距。 */
    padding: HVirtualListPadding;

    /** 竖向列表表示列数，横向列表表示行数。 */
    crossCount: number;

    /** 可见区域外额外渲染的行数/列数。 */
    bufferLine: number;
}

/**
 * item 在左上角逻辑坐标系中的矩形。
 *
 * x 向右为正，y 向下为正。
 */
export interface HVirtualItemRect {
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * 当前应该显示的 index 范围，闭区间。
 */
export interface HVirtualVisibleRange {
    start: number;
    end: number;
}

/**
 * 虚拟列表布局基础类。
 *
 * 设计目标：
 * - 只做数学计算。
 * - 不依赖 ScrollView、Node、Prefab、VM。
 * - content、item 坐标运算统一以左上角为参考原点。
 * - content 锚点不在这里处理，由使用者根据滚动方向手动设置。
 */
export abstract class HVirtualListLayoutBase {
    protected options!: HVirtualListLayoutOptions;
    protected dataCount = 0;

    public setup(options: HVirtualListLayoutOptions): void {
        this.options = {
            ...options,
            itemWidth: Math.max(1, Number(options.itemWidth) || 1),
            itemHeight: Math.max(1, Number(options.itemHeight) || 1),
            spacingX: Math.max(0, Number(options.spacingX) || 0),
            spacingY: Math.max(0, Number(options.spacingY) || 0),
            crossCount: Math.max(1, Math.floor(Number(options.crossCount) || 1)),
            bufferLine: Math.max(0, Math.floor(Number(options.bufferLine) || 0)),
            padding: {
                left: Math.max(0, Number(options.padding?.left) || 0),
                right: Math.max(0, Number(options.padding?.right) || 0),
                top: Math.max(0, Number(options.padding?.top) || 0),
                bottom: Math.max(0, Number(options.padding?.bottom) || 0),
            },
        };
    }

    public setDataCount(count: number): void {
        this.dataCount = Math.max(0, Math.floor(Number(count) || 0));
    }

    public getDataCount(): number {
        return this.dataCount;
    }

    /**
     * 根据 viewSize 和数据数量计算 content 尺寸。
     */
    public abstract getContentSize(viewSize: Size): Size;

    /**
     * 获取指定 index 的 item 逻辑矩形。
     */
    public abstract getItemRect(index: number): HVirtualItemRect;

    /**
     * 根据左上角逻辑偏移和 viewSize 计算可见范围。
     *
     * offsetX 越大，表示越往右滚。
     * offsetY 越大，表示越往下滚。
     */
    public abstract getVisibleRange(offsetX: number, offsetY: number, viewSize: Size): HVirtualVisibleRange;

    /**
     * 获取 item 节点在 Cocos 坐标系下的位置。
     *
     * 逻辑坐标 y 向下为正，Cocos 节点坐标 y 向上为正，所以这里返回 -rect.y。
     */
    public getItemPosition(index: number): Vec2 {
        const rect = this.getItemRect(index);
        return new Vec2(rect.x, -rect.y);
    }

    /**
     * 获取 item 所在的主轴行/列。
     */
    public getMainLine(index: number): number {
        const crossCount = this.getCrossCount();
        return Math.floor(this.clampIndex(index) / crossCount);
    }

    /**
     * 获取总主轴行/列数量。
     */
    public getLineCount(): number {
        const crossCount = this.getCrossCount();
        return Math.ceil(this.dataCount / crossCount);
    }

    protected getCrossCount(): number {
        return Math.max(1, Math.floor(this.options?.crossCount || 1));
    }

    protected clampIndex(index: number): number {
        if (this.dataCount <= 0) {
            return 0;
        }
        return Math.max(0, Math.min(this.dataCount - 1, Math.floor(index)));
    }

    protected emptyRange(): HVirtualVisibleRange {
        return { start: 0, end: -1 };
    }
}
