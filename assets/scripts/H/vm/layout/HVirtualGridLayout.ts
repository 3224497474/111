import { Size } from 'cc';
import {
    HVirtualItemRect,
    HVirtualListDirection,
    HVirtualListLayoutBase,
    HVirtualVisibleRange,
} from './HVirtualListLayoutBase';

/**
 * 固定尺寸网格布局。
 *
 * 支持：
 * - 竖向单列列表。
 * - 竖向多列网格。
 * - 横向单行列表。
 * - 横向多行网格。
 */
export class HVirtualGridLayout extends HVirtualListLayoutBase {
    public getContentSize(viewSize: Size): Size {
        const opt = this.options;
        const crossCount = this.getCrossCount();
        const lineCount = this.getLineCount();

        if (opt.direction === HVirtualListDirection.Vertical) {
            const width =
                opt.padding.left +
                opt.padding.right +
                crossCount * opt.itemWidth +
                Math.max(0, crossCount - 1) * opt.spacingX;

            const height =
                opt.padding.top +
                opt.padding.bottom +
                lineCount * opt.itemHeight +
                Math.max(0, lineCount - 1) * opt.spacingY;

            return new Size(Math.max(width, viewSize.width), Math.max(height, viewSize.height));
        }

        const width =
            opt.padding.left +
            opt.padding.right +
            lineCount * opt.itemWidth +
            Math.max(0, lineCount - 1) * opt.spacingX;

        const height =
            opt.padding.top +
            opt.padding.bottom +
            crossCount * opt.itemHeight +
            Math.max(0, crossCount - 1) * opt.spacingY;

        return new Size(Math.max(width, viewSize.width), Math.max(height, viewSize.height));
    }

    public getItemRect(index: number): HVirtualItemRect {
        const opt = this.options;
        const crossCount = this.getCrossCount();
        const safeIndex = this.clampIndex(index);

        let row = 0;
        let col = 0;

        if (opt.direction === HVirtualListDirection.Vertical) {
            row = Math.floor(safeIndex / crossCount);
            col = safeIndex % crossCount;
        } else {
            col = Math.floor(safeIndex / crossCount);
            row = safeIndex % crossCount;
        }

        return {
            index: safeIndex,
            x: opt.padding.left + col * (opt.itemWidth + opt.spacingX),
            y: opt.padding.top + row * (opt.itemHeight + opt.spacingY),
            width: opt.itemWidth,
            height: opt.itemHeight,
        };
    }

    public getVisibleRange(offsetX: number, offsetY: number, viewSize: Size): HVirtualVisibleRange {
        const opt = this.options;
        const crossCount = this.getCrossCount();
        const bufferLine = Math.max(0, opt.bufferLine);

        if (this.dataCount <= 0) {
            return this.emptyRange();
        }

        if (opt.direction === HVirtualListDirection.Vertical) {
            const lineSize = Math.max(1, opt.itemHeight + opt.spacingY);
            const startLineRaw = Math.floor((offsetY - opt.padding.top) / lineSize);
            const endLineRaw = Math.ceil((offsetY + viewSize.height - opt.padding.top) / lineSize);
            const maxLine = Math.max(0, this.getLineCount() - 1);

            const startLine = Math.max(0, Math.min(maxLine, startLineRaw - bufferLine));
            const endLine = Math.max(startLine, Math.min(maxLine, endLineRaw + bufferLine));

            return {
                start: this.clampIndex(startLine * crossCount),
                end: this.clampIndex((endLine + 1) * crossCount - 1),
            };
        }

        const lineSize = Math.max(1, opt.itemWidth + opt.spacingX);
        const startLineRaw = Math.floor((offsetX - opt.padding.left) / lineSize);
        const endLineRaw = Math.ceil((offsetX + viewSize.width - opt.padding.left) / lineSize);
        const maxLine = Math.max(0, this.getLineCount() - 1);

        const startLine = Math.max(0, Math.min(maxLine, startLineRaw - bufferLine));
        const endLine = Math.max(startLine, Math.min(maxLine, endLineRaw + bufferLine));

        return {
            start: this.clampIndex(startLine * crossCount),
            end: this.clampIndex((endLine + 1) * crossCount - 1),
        };
    }
}
