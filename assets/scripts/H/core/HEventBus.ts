export type HEventListener<T = unknown> = (payload: T) => void;

export class HEventBus {
    private readonly listeners = new Map<string, Set<HEventListener>>();

    /**
     * 监听一个框架事件，返回值可直接用于取消监听。
     */
    public on<T = unknown>(eventName: string, listener: HEventListener<T>): () => void {
        const normalizedEventName = eventName.trim();
        if (!normalizedEventName) {
            throw new Error('[HEventBus] eventName 不能为空');
        }

        let eventListeners = this.listeners.get(normalizedEventName);
        if (!eventListeners) {
            eventListeners = new Set();
            this.listeners.set(normalizedEventName, eventListeners);
        }

        eventListeners.add(listener as HEventListener);
        return () => this.off(normalizedEventName, listener);
    }

    /**
     * 取消监听。组件销毁时必须调用，避免 UI 被隐藏后仍然刷新。
     */
    public off<T = unknown>(eventName: string, listener: HEventListener<T>): void {
        const eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            return;
        }

        eventListeners.delete(listener as HEventListener);
        if (eventListeners.size === 0) {
            this.listeners.delete(eventName);
        }
    }

    /**
     * 派发事件。监听函数异常会被捕获，避免一个 UI 报错影响其他模块。
     */
    public emit<T = unknown>(eventName: string, payload?: T): void {
        const eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            return;
        }

        [...eventListeners].forEach((listener) => {
            try {
                listener(payload as T);
            } catch (error) {
                console.error(`[HEventBus] ${eventName} listener error:`, error);
            }
        });
    }

    public clear(eventName?: string): void {
        if (eventName) {
            this.listeners.delete(eventName);
            return;
        }

        this.listeners.clear();
    }
}
