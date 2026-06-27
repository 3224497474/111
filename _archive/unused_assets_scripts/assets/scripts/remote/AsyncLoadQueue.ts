export class AsyncLoadQueue {
    private readonly _maxConcurrent: number;

    constructor(maxConcurrent: number) {
        this._maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    }

    public async run<T>(
        items: readonly T[],
        worker: (item: T, index: number) => Promise<void>,
    ): Promise<void> {
        if (items.length === 0) {
            return;
        }

        let nextIndex = 0;
        let firstError: unknown = null;

        // 固定大小的 worker 池可以避免单个 Bundle 一次性打满网络请求。
        const runWorker = async () => {
            while (true) {
                if (firstError) {
                    return;
                }

                const currentIndex = nextIndex;
                nextIndex += 1;

                if (currentIndex >= items.length) {
                    return;
                }

                try {
                    await worker(items[currentIndex], currentIndex);
                } catch (error) {
                    firstError = error;
                    return;
                }
            }
        };

        const workerCount = Math.min(this._maxConcurrent, items.length);
        const workers: Promise<void>[] = [];

        for (let i = 0; i < workerCount; i++) {
            workers.push(runWorker());
        }

        await Promise.all(workers);

        if (firstError) {
            throw firstError;
        }
    }
}
