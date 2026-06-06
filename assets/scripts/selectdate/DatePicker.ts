import { _decorator, Component, Label } from 'cc';
import { VirtualLoopPicker } from './LoopWheelPicker';

const { ccclass, property } = _decorator;

type DateCallback = (date: Date, dateStr: string) => void;

export interface IDatePickerSelection {
    year: number;
    month: number;
    day: number;
    dateStr: string;
}

@ccclass('DatePicker')
export class DatePicker extends Component {
    @property(VirtualLoopPicker)
    monthWheel: VirtualLoopPicker = null!;

    @property(VirtualLoopPicker)
    dayWheel: VirtualLoopPicker = null!;

    @property(Label)
    previewLabel: Label = null!;

    private _curMonth: number = 1;
    private _curDay: number = 1;
    private _curYear: number = new Date().getFullYear();
    private _onConfirm: DateCallback | null = null;
    private _lastMaxDays: number = 0;

    start(): void {
        const now = new Date();
        this.initPicker(now.getMonth() + 1, now.getDate());
    }

    initPicker(month: number, day: number, callback?: DateCallback): void {
        if (callback) this._onConfirm = callback;

        this._curMonth = month;
        this._curDay = day;

        const months = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
        this.monthWheel.init(months, month - 1, (idx) => {
            this._curMonth = idx + 1;
            this.refreshDays();
        });

        this.refreshDays(day - 1);
    }

    private refreshDays(defaultIdx: number = -1): void {
        const maxDays = new Date(this._curYear, this._curMonth, 0).getDate();

        if (maxDays === this._lastMaxDays && defaultIdx === -1) {
            this.refreshPreview();
            return;
        }
        this._lastMaxDays = maxDays;

        const daysData = Array.from({ length: maxDays }, (_, i) => `${i + 1}`);
        let targetIdx = defaultIdx !== -1 ? defaultIdx : this._curDay - 1;
        targetIdx = Math.min(targetIdx, maxDays - 1);

        this.dayWheel.init(daysData, targetIdx, (idx) => {
            this._curDay = idx + 1;
            this.refreshPreview();
        });

        this._curDay = targetIdx + 1;
        this.refreshPreview();
    }

    private refreshPreview(): void {
        if (!this.previewLabel) {
            return;
        }
        this.previewLabel.string =
            `${this._curYear} / ${this._curMonth} / ${this._curDay}`;
    }

    private formatNum(n: number): string {
        return n < 10 ? `0${n}` : `${n}`;
    }

    onConfirm(): void {
        const dateObj = new Date(this._curYear, this._curMonth - 1, this._curDay);
        const dateStr = `${this._curYear}-${this.formatNum(this._curMonth)}-${this.formatNum(this._curDay)}`;

        if (this._onConfirm) {
            this._onConfirm(dateObj, dateStr);
        }
        this.node.active = false;
    }

    onCancel(): void {
        this.node.active = false;
    }

    public getCurrentSelection(): IDatePickerSelection {
        return {
            year: this._curYear,
            month: this._curMonth,
            day: this._curDay,
            dateStr: `${this._curYear}-${this.formatNum(this._curMonth)}-${this.formatNum(this._curDay)}`,
        };
    }
}
