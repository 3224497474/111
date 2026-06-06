import { TimeSystem, type IGameTimeState } from '../../../X/core/TimeSystem';
import { DirtySaveModule } from '../../../save/modules/DirtySaveModule';

export class TimeSaveModule extends DirtySaveModule<IGameTimeState> {
    public readonly key = 'time';

    constructor(private readonly timeSystem: TimeSystem) {
        super();
        this.timeSystem.onTimeChanged(this.handleChanged);
    }

    public capture(): IGameTimeState {
        return this.timeSystem.exportSnapshot();
    }

    public restore(snapshot: IGameTimeState | null | undefined): void {
        if (!snapshot) {
            return;
        }

        this.timeSystem.loadFromSnapshot(snapshot);
    }

    private readonly handleChanged = (): void => {
        this.markDirty();
    };
}

