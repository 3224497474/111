import { _decorator, Component, Label, ProgressBar } from "cc";
const { ccclass, property } = _decorator;

@ccclass
export class EnergyCounter extends Component{
    @property
    public timeToRecover = 0;
    @property
    public totalCount = 0;
    @property
    public currentCount = 0;
    @property({
        type: Label
    })
    labelTimer: Label = null!;
    @property({
        type: Label
    })
    labelCount: Label = null!;
    @property({
        type: ProgressBar
    })
    progressBar: ProgressBar = null!;

    private _timer = 0;
    // UI 刷新累积计时，降低刷新频率以节省性能
    private _uiAccum = 0;

    onLoad() {
        this._timer = 0;
        this._uiAccum = 0;
    }

    update(dt: number) {
        if (this.timeToRecover <= 0) {
            return;
        }

        // 精确累加计时，用于恢复体力逻辑
        this._timer += dt;
        while (this._timer >= this.timeToRecover && this.currentCount < this.totalCount) {
            this._timer -= this.timeToRecover;
            this.currentCount++;
        }

        // UI 刷新降频：例如每 1 秒更新一次
        this._uiAccum += dt;
        if (this._uiAccum < 1.0) {
            return;
        }
        this._uiAccum = 0;

        const ratio = this._timer / this.timeToRecover;
        if (this.progressBar) {
            this.progressBar.progress = ratio;
        }

        if (this.currentCount > this.totalCount) {
            this.currentCount = this.totalCount;
        }

        const timeLeft = Math.max(0, Math.floor(this.timeToRecover - this._timer));

        if (this.labelCount) {
            this.labelCount.string = `${this.currentCount}/${this.totalCount}`;
        }

        if (this.labelTimer) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            this.labelTimer.string = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
        }
    }
}
