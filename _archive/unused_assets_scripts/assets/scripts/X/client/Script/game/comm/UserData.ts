class UserDataStore {
    private readonly timestamps = new Map<string, number>();

    getIntervalCD(key: string, interval: number) {
        const endAt = this.ensureEndAt(key, interval * 1000);
        return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    }

    checkCDTime(key: string, interval: number, startTime = 0): [number, number] {
        const now = Math.floor(Date.now() / 1000);
        const beginAt = startTime > 0 ? startTime : now;
        const endAt = beginAt + interval;
        const remain = Math.max(0, endAt - now);
        const finished = remain <= 0 ? 1 : 0;
        return [finished, remain];
    }

    checkLimitTime(key: string, intervalMs: number) {
        const endAt = this.ensureEndAt(key, intervalMs);
        return Math.max(0, endAt - Date.now());
    }

    checkEndTime(_key: string, endTime: number) {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, endTime - now);
    }

    clearCDTime(key: string) {
        this.timestamps.delete(key);
    }

    private ensureEndAt(key: string, durationMs: number) {
        const now = Date.now();
        const current = this.timestamps.get(key);
        if (current && current > now) {
            return current;
        }
        const endAt = now + durationMs;
        this.timestamps.set(key, endAt);
        return endAt;
    }
}

export const userData = new UserDataStore();
