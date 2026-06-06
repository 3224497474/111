import { director } from 'cc';

export const EVENT_FORCE_RELOAD_UI = 'EVENT_FORCE_RELOAD_UI';

export class EventBus {
    public static emit(eventName: string, payload?: unknown): void {
        director.emit(eventName, payload);
    }

    public static on(eventName: string, handler: (...args: unknown[]) => void, target?: unknown): void {
        director.on(eventName, handler, target);
    }

    public static off(eventName: string, handler: (...args: unknown[]) => void, target?: unknown): void {
        director.off(eventName, handler, target);
    }
}
