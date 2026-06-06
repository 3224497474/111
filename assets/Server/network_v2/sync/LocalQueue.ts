import { sys } from 'cc';
import type { INetAction } from '../action/ActionTypes';

const ACTIONS_KEY = 'network_v2_actions';
const SEQ_KEY = 'network_v2_next_seq';

export class LocalQueue {
    private readonly storageKeyPrefix: string;

    constructor(storageKeyPrefix: string = '') {
        this.storageKeyPrefix = storageKeyPrefix;
    }

    public enqueue(action: INetAction): void {
        const actions = this.getPendingActions();
        actions.push({ ...action, payload: { ...action.payload } });
        this.saveActions(actions);
    }

    public dequeueConfirmed(actionIds: string[]): void {
        if (actionIds.length === 0) {
            return;
        }

        const removable = new Set(actionIds);
        const actions = this.getPendingActions().filter((action) => !removable.has(action.actionId));
        this.saveActions(actions);
    }

    public getPendingActions(): INetAction[] {
        const raw = sys.localStorage.getItem(this.getScopedKey(ACTIONS_KEY));
        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw) as INetAction[];
            return Array.isArray(parsed) ? parsed.map((item) => ({
                ...item,
                payload: item?.payload && typeof item.payload === 'object'
                    ? { ...item.payload }
                    : {},
            })) : [];
        } catch {
            return [];
        }
    }

    public clear(): void {
        this.saveActions([]);
    }

    public clearAll(): void {
        this.clear();
    }

    public replaceAll(actions: INetAction[]): void {
        this.saveActions(actions);
    }

    public consumeNextSeqNo(): number {
        const current = this.getNextSeqNo();
        sys.localStorage.setItem(this.getScopedKey(SEQ_KEY), String(current + 1));
        return current;
    }

    public getNextSeqNo(): number {
        const raw = sys.localStorage.getItem(this.getScopedKey(SEQ_KEY));
        const value = Number(raw ?? '1');
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    }

    private saveActions(actions: INetAction[]): void {
        sys.localStorage.setItem(this.getScopedKey(ACTIONS_KEY), JSON.stringify(actions));
    }

    private getScopedKey(key: string): string {
        return `${this.storageKeyPrefix}${key}`;
    }
}
