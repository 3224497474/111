import { _decorator, Button, Component, EditBox } from 'cc';
import { GameFacade } from '../app/GameFacade';
import { DatePicker } from './DatePicker';

const { ccclass, property } = _decorator;

@ccclass('DatePickerDebugSaver')
export class DatePickerDebugSaver extends Component {
    @property(DatePicker)
    public datePicker: DatePicker | null = null;

    @property(EditBox)
    public textInput: EditBox | null = null;

    @property(Button)
    public saveButton: Button | null = null;

    private _hasSaved = false;

    protected onLoad(): void {
        this._hasSaved = GameFacade.instance.progress.hasDateSelection();
        this.refreshButtonState();

        if (this.saveButton) {
            this.saveButton.node.on(Button.EventType.CLICK, this.onClickSave, this);
        }
    }

    protected onDestroy(): void {
        if (this.saveButton) {
            this.saveButton.node.off(Button.EventType.CLICK, this.onClickSave, this);
        }
    }

    public onClickSave(): void {
        if (this._hasSaved) {
            console.log('[DatePickerDebugSaver] save ignored because date selection is already locked.');
            this.refreshButtonState();
            return;
        }

        if (!this.datePicker) {
            console.error('[DatePickerDebugSaver] datePicker is not assigned.');
            return;
        }

        const selection = this.datePicker.getCurrentSelection();
        if (!selection) {
            console.error('[DatePickerDebugSaver] datePicker selection is empty.');
            return;
        }
        const text = this.textInput?.string?.trim() ?? '';
        const savedSelection = GameFacade.instance.progress.saveDateSelection({
            text,
            month: selection.month,
            day: selection.day,
            dateStr: selection.dateStr,
        });
        GameFacade.instance.saveGame();
        this._hasSaved = true;
        this.refreshButtonState();

        console.log('[DatePickerDebugSaver] saved date selection to ProgressFacade:', savedSelection);
    }

    private refreshButtonState(): void {
        if (!this.saveButton) {
            return;
        }

        this.saveButton.interactable = !this._hasSaved;
    }
}
