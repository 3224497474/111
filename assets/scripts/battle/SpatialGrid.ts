import type { IPoint } from './Types';

export class SpatialGrid<T> {
    private readonly columns = new Map<number, Map<number, T[]>>();

    constructor(private readonly cellSize: number) {}

    public clear(): void {
        for (const column of this.columns.values()) {
            for (const cell of column.values()) {
                cell.length = 0;
            }
        }
    }

    public insert(position: Readonly<IPoint>, item: T): void {
        const cell = this.getOrCreateCell(this.toCellCoord(position.x), this.toCellCoord(position.y));
        cell.push(item);
    }

    public forEachNearby(position: Readonly<IPoint>, callback: (item: T) => void): void {
        const cellX = this.toCellCoord(position.x);
        const cellY = this.toCellCoord(position.y);

        for (let x = cellX - 1; x <= cellX + 1; x++) {
            const column = this.columns.get(x);
            if (!column) {
                continue;
            }

            for (let y = cellY - 1; y <= cellY + 1; y++) {
                const cell = column.get(y);
                if (!cell || cell.length === 0) {
                    continue;
                }

                for (let i = 0; i < cell.length; i++) {
                    callback(cell[i]);
                }
            }
        }
    }

    private toCellCoord(value: number): number {
        return Math.floor(value / this.cellSize);
    }

    private getOrCreateCell(cellX: number, cellY: number): T[] {
        let column = this.columns.get(cellX);
        if (!column) {
            column = new Map<number, T[]>();
            this.columns.set(cellX, column);
        }

        let cell = column.get(cellY);
        if (!cell) {
            cell = [];
            column.set(cellY, cell);
        }

        return cell;
    }
}
