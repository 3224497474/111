type Listener<T = unknown> = {
    // 订阅回调。
    callback: (payload?: T) => void;
    // 回调绑定上下文。
    context?: unknown;
};

// `battle/event` 目录下的事件总线定义。
// 与上层 `battle/BattleEventBus.ts` 对应，承担分层目录内部的解耦事件分发。
export class BattleEventBus {
    // 按事件名分组的监听器表。
    private readonly listeners = new Map<string, Listener[]>();

    public subscribe<T = unknown>(
        eventName: string,
        callback: (payload?: T) => void,
        context?: unknown,
    ): void {
        const group = this.listeners.get(eventName);
        const listener: Listener<T> = { callback, context };
        if (group) {
            group.push(listener as Listener);
            return;
        }

        this.listeners.set(eventName, [listener as Listener]);
    }

    public unsubscribe<T = unknown>(
        eventName: string,
        callback: (payload?: T) => void,
        context?: unknown,
    ): void {
        const group = this.listeners.get(eventName);
        if (!group || group.length === 0) return;

        const filtered = group.filter((listener) => {
            return listener.callback !== callback || listener.context !== context;
        });

        if (filtered.length === 0) {
            this.listeners.delete(eventName);
            return;
        }

        this.listeners.set(eventName, filtered);
    }

    public emit<T = unknown>(eventName: string, payload?: T): void {
        const group = this.listeners.get(eventName);
        if (!group || group.length === 0) return;

        // 使用快照遍历，避免回调过程中增删监听器导致当前循环失真。
        for (const listener of [...group]) {
            if (listener.context) {
                listener.callback.call(listener.context, payload);
            } else {
                listener.callback(payload);
            }
        }
    }

    public clear(): void {
        this.listeners.clear();
    }
}
