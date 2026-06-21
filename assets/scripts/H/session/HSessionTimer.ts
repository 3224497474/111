import { Game, game } from 'cc';
import type {
    HSessionCooldownState,
    HSessionSnapshot,
    HSessionTaskCallback,
    HSessionTimerInitOptions,
} from '../HTypes';

interface HLifecycleSource {
    onShow(listener: (raw?: unknown) => void): void;
    offShow(listener: (raw?: unknown) => void): void;
    onHide(listener: (raw?: unknown) => void): void;
    offHide(listener: (raw?: unknown) => void): void;
}

interface HIntervalTask {
    timer: ReturnType<typeof setInterval>;
    callback: HSessionTaskCallback;
    intervalMs: number;
}

export class HSessionTimer {
    private initialized = false;
    private enterAt = Date.now();
    private lastShowAt = this.enterAt;
    private lastHideAt = 0;
    private foreground = true;
    private activeStartedAt = this.enterAt;
    private onlineDurationMs = 0;
    private defaultCooldownMs = 30000;
    private readonly cooldowns = new Map<string, number>();
    private readonly locks = new Set<string>();
    private readonly intervalTasks = new Map<string, HIntervalTask>();
    private lifecycleSource: HLifecycleSource | null = null;

    private readonly handleCocosShow = (): void => {
        this.handleShow();
    };

    private readonly handleCocosHide = (): void => {
        this.handleHide();
    };

    private readonly handlePlatformShow = (raw?: unknown): void => {
        this.handleShow(raw);
    };

    private readonly handlePlatformHide = (raw?: unknown): void => {
        this.handleHide(raw);
    };

    public init(options: HSessionTimerInitOptions = {}): void {
        this.defaultCooldownMs = Math.max(0, Math.floor(options.defaultCooldownMs ?? this.defaultCooldownMs));

        if (this.initialized) {
            return;
        }

        const now = Date.now();
        this.enterAt = now;
        this.lastShowAt = now;
        this.activeStartedAt = now;
        this.foreground = true;
        this.initialized = true;

        game.on(Game.EVENT_SHOW, this.handleCocosShow, this);
        game.on(Game.EVENT_HIDE, this.handleCocosHide, this);
    }

    public bindLifecycle(source: HLifecycleSource): void {
        this.ensureInit();
        if (this.lifecycleSource === source) {
            return;
        }

        if (this.lifecycleSource) {
            this.lifecycleSource.offShow(this.handlePlatformShow);
            this.lifecycleSource.offHide(this.handlePlatformHide);
        }

        this.lifecycleSource = source;
        source.onShow(this.handlePlatformShow);
        source.onHide(this.handlePlatformHide);
    }

    public getEnterTime(): number {
        this.ensureInit();
        return this.enterAt;
    }

    public getLastShowTime(): number {
        this.ensureInit();
        return this.lastShowAt;
    }

    public getLastHideTime(): number {
        this.ensureInit();
        return this.lastHideAt;
    }

    public isForeground(): boolean {
        this.ensureInit();
        return this.foreground;
    }

    public getOnlineDurationMs(): number {
        this.ensureInit();
        if (!this.foreground) {
            return this.onlineDurationMs;
        }
        return this.onlineDurationMs + Math.max(0, Date.now() - this.activeStartedAt);
    }

    public getSnapshot(): HSessionSnapshot {
        return {
            enterAt: this.getEnterTime(),
            lastShowAt: this.getLastShowTime(),
            lastHideAt: this.getLastHideTime(),
            onlineDurationMs: this.getOnlineDurationMs(),
            foreground: this.isForeground(),
        };
    }

    public canUseCooldown(key: string, cooldownMs = this.defaultCooldownMs): HSessionCooldownState {
        this.ensureInit();
        const normalizedKey = this.normalizeKey(key);
        const lastAt = this.cooldowns.get(normalizedKey) || 0;
        const safeCooldownMs = Math.max(0, Math.floor(cooldownMs));
        const elapsed = Date.now() - lastAt;
        const remainingMs = Math.max(0, safeCooldownMs - elapsed);

        return {
            allowed: remainingMs <= 0,
            remainingMs,
            lastAt,
        };
    }

    public markCooldown(key: string, at = Date.now()): void {
        this.ensureInit();
        this.cooldowns.set(this.normalizeKey(key), at);
    }

    public isLocked(key: string): boolean {
        return this.locks.has(this.normalizeKey(key));
    }

    public acquireLock(key: string): boolean {
        const normalizedKey = this.normalizeKey(key);
        if (this.locks.has(normalizedKey)) {
            return false;
        }
        this.locks.add(normalizedKey);
        return true;
    }

    public releaseLock(key: string): void {
        this.locks.delete(this.normalizeKey(key));
    }

    public setIntervalTask(id: string, intervalMs: number, callback: HSessionTaskCallback, runImmediately = false): void {
        this.ensureInit();
        const normalizedId = this.normalizeKey(id);
        this.clearIntervalTask(normalizedId);

        const safeIntervalMs = Math.max(16, Math.floor(intervalMs));
        const timer = setInterval(callback, safeIntervalMs);
        this.intervalTasks.set(normalizedId, {
            timer,
            callback,
            intervalMs: safeIntervalMs,
        });

        if (runImmediately) {
            callback();
        }
    }

    public clearIntervalTask(id: string): void {
        const normalizedId = this.normalizeKey(id);
        const task = this.intervalTasks.get(normalizedId);
        if (!task) {
            return;
        }
        clearInterval(task.timer);
        this.intervalTasks.delete(normalizedId);
    }

    public clearAllIntervalTasks(): void {
        this.intervalTasks.forEach((task) => clearInterval(task.timer));
        this.intervalTasks.clear();
    }

    private handleShow(_raw?: unknown): void {
        this.ensureInit();
        const now = Date.now();
        this.lastShowAt = now;
        if (this.foreground) {
            return;
        }
        this.foreground = true;
        this.activeStartedAt = now;
    }

    private handleHide(_raw?: unknown): void {
        this.ensureInit();
        const now = Date.now();
        this.lastHideAt = now;
        if (!this.foreground) {
            return;
        }
        this.onlineDurationMs += Math.max(0, now - this.activeStartedAt);
        this.foreground = false;
    }

    private normalizeKey(key: string): string {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            throw new Error('[HSessionTimer] key 不能为空');
        }
        return normalizedKey;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }
}
