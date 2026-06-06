import type { IPooledEventPayload } from './BattleEventPayloadPools';

type Listener<T = unknown> = {
    callback: (payload?: T) => void;
    context?: unknown;
};

// 轻量事件总线。
// 战斗逻辑层只负责派发事件，表现层和 HUD 通过订阅这些事件做解耦响应。
export class BattleEventBus {
    private readonly listeners = new Map<string, Listener[]>();
    private emissionDepth = 0;
    private readonly pendingRemovalEventNames: string[] = [];
    private readonly pendingRemovalCallbacks: Array<(payload?: unknown) => void> = [];
    private readonly pendingRemovalContexts: unknown[] = [];

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
        if (this.emissionDepth > 0) {
            this.pendingRemovalEventNames.push(eventName);
            this.pendingRemovalCallbacks.push(callback as (payload?: unknown) => void);
            this.pendingRemovalContexts.push(context);
            return;
        }

        this.removeListener(eventName, callback as (payload?: unknown) => void, context);
    }

    public emit<T = unknown>(eventName: string, payload?: T): void {
        const group = this.listeners.get(eventName);
        this.emissionDepth += 1;

        try {
            if (!group || group.length === 0) {
                return;
            }

            // 警告：所有监听器都必须同步消费 payload。
            // emit 返回后，池化 payload 会立刻 recycle，禁止把 payload 缓存到成员变量、
            // setTimeout / Promise / tween 回调等异步路径里；如需延迟处理，只能先复制基础数据。
            const listenerCount = group.length;
            for (let i = 0; i < listenerCount; i++) {
                const listener = group[i];
                if (listener.context) {
                    listener.callback.call(listener.context, payload);
                } else {
                    listener.callback(payload);
                }
            }
        } finally {
            this.emissionDepth -= 1;
            if (this.emissionDepth === 0) {
                this.flushPendingRemovals();
            }

            const pooledPayload = payload as IPooledEventPayload | undefined;
            pooledPayload?.recycle?.();
        }
    }

    public clear(): void {
        this.listeners.clear();
        this.pendingRemovalEventNames.length = 0;
        this.pendingRemovalCallbacks.length = 0;
        this.pendingRemovalContexts.length = 0;
        this.emissionDepth = 0;
    }

    private removeListener(
        eventName: string,
        callback: (payload?: unknown) => void,
        context?: unknown,
    ): void {
        const group = this.listeners.get(eventName);
        if (!group || group.length === 0) {
            return;
        }

        for (let i = 0; i < group.length; i++) {
            const listener = group[i];
            if (listener.callback !== callback || listener.context !== context) {
                continue;
            }

            group.splice(i, 1);
            break;
        }

        if (group.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    private flushPendingRemovals(): void {
        const removalCount = this.pendingRemovalEventNames.length;
        for (let i = 0; i < removalCount; i++) {
            this.removeListener(
                this.pendingRemovalEventNames[i],
                this.pendingRemovalCallbacks[i],
                this.pendingRemovalContexts[i],
            );
        }

        this.pendingRemovalEventNames.length = 0;
        this.pendingRemovalCallbacks.length = 0;
        this.pendingRemovalContexts.length = 0;
    }
}
