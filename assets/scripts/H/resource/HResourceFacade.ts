import { Asset, assetManager, AssetManager, AudioClip, JsonAsset, Prefab, resources, SpriteFrame, Texture2D } from 'cc';
import type {
    HResourceBatchResult,
    HResourceAssetKind,
    HResourceAssetType,
    HResourceBundleBatchResult,
    HResourceBundleTask,
    HResourceInitOptions,
    HResourcePhase,
    HResourceProfile,
    HResourceProfileItem,
    HResourceProgressListener,
    HResourceTask,
} from '../HTypes';

export class HResourceFacade {
    private debug = false;
    private backgroundConcurrency = 1;
    private readonly criticalTasks: HResourceTask[] = [];
    private readonly preloadTasks: HResourceTask[] = [];
    private readonly criticalBundles: HResourceBundleTask[] = [];
    private readonly preloadBundles: HResourceBundleTask[] = [];
    private readonly backgroundBundleQueue: HResourceBundleTask[] = [];
    private readonly backgroundQueue: HResourceTask[] = [];
    private readonly cachedAssets = new Map<string, Asset>();
    private readonly bundleCache = new Map<string, AssetManager.Bundle>();
    private backgroundRunning = false;
    private backgroundActiveCount = 0;

    /**
     * 初始化资源管理器。可以一次性登记首屏资源、预加载资源和后台资源。
     */
    public init(options: HResourceInitOptions = {}): void {
        const profile = options.profile;
        this.debug = !!(options.debug ?? profile?.debug);
        this.backgroundConcurrency = Math.max(1, Math.floor(options.backgroundConcurrency ?? profile?.backgroundConcurrency ?? this.backgroundConcurrency));
        this.criticalTasks.length = 0;
        this.preloadTasks.length = 0;
        this.criticalBundles.length = 0;
        this.preloadBundles.length = 0;
        this.backgroundBundleQueue.length = 0;
        this.backgroundQueue.length = 0;

        const criticalBundles = [
            ...this.normalizeBundleTasks(profile?.criticalBundles || [], 'critical'),
            ...this.normalizeBundleTasks(options.criticalBundles || [], 'critical'),
        ];
        const preloadBundles = [
            ...this.normalizeBundleTasks(profile?.preloadBundles || [], 'preload'),
            ...this.normalizeBundleTasks(options.preloadBundles || [], 'preload'),
        ];
        const backgroundBundles = [
            ...this.normalizeBundleTasks(profile?.backgroundBundles || [], 'background'),
            ...this.normalizeBundleTasks(options.backgroundBundles || [], 'background'),
        ];
        const criticalTasks = [
            ...this.profileItemsToTasks(profile?.critical || [], 'critical'),
            ...(options.critical || []),
        ];
        const preloadTasks = [
            ...this.profileItemsToTasks(profile?.preload || [], 'preload'),
            ...(options.preload || []),
        ];
        const backgroundTasks = [
            ...this.profileItemsToTasks(profile?.background || [], 'background'),
            ...(options.background || []),
        ];

        this.criticalBundles.push(...criticalBundles);
        this.preloadBundles.push(...preloadBundles);
        this.backgroundBundleQueue.push(...backgroundBundles);
        this.criticalTasks.push(...this.normalizeTasks(criticalTasks, 'critical'));
        this.preloadTasks.push(...this.normalizeTasks(preloadTasks, 'preload'));
        this.backgroundQueue.push(...this.normalizeTasks(backgroundTasks, 'background'));
    }

    /**
     * 应用一份资源配置。append=false 时会替换当前登记队列。
     */
    public applyProfile(profile: HResourceProfile, append = false): void {
        if (!append) {
            this.criticalTasks.length = 0;
            this.preloadTasks.length = 0;
            this.criticalBundles.length = 0;
            this.preloadBundles.length = 0;
            this.backgroundBundleQueue.length = 0;
            this.backgroundQueue.length = 0;
        }

        this.debug = !!(profile.debug ?? this.debug);
        this.backgroundConcurrency = Math.max(1, Math.floor(profile.backgroundConcurrency ?? this.backgroundConcurrency));
        this.criticalBundles.push(...this.normalizeBundleTasks(profile.criticalBundles || [], 'critical'));
        this.preloadBundles.push(...this.normalizeBundleTasks(profile.preloadBundles || [], 'preload'));
        this.backgroundBundleQueue.push(...this.normalizeBundleTasks(profile.backgroundBundles || [], 'background'));
        this.criticalTasks.push(...this.normalizeTasks(this.profileItemsToTasks(profile.critical || [], 'critical'), 'critical'));
        this.preloadTasks.push(...this.normalizeTasks(this.profileItemsToTasks(profile.preload || [], 'preload'), 'preload'));
        this.backgroundQueue.push(...this.normalizeTasks(this.profileItemsToTasks(profile.background || [], 'background'), 'background'));
    }

    /**
     * 给编辑器面板或调试界面读取当前登记的资源队列。
     */
    public getRegisteredTasks(phase?: HResourcePhase): HResourceTask[] {
        if (phase === 'critical') {
            return this.criticalTasks.map((task) => ({ ...task }));
        }
        if (phase === 'preload') {
            return this.preloadTasks.map((task) => ({ ...task }));
        }
        if (phase === 'background') {
            return this.backgroundQueue.map((task) => ({ ...task }));
        }

        return [
            ...this.criticalTasks,
            ...this.preloadTasks,
            ...this.backgroundQueue,
        ].map((task) => ({ ...task }));
    }

    public getRegisteredBundles(phase?: HResourcePhase): HResourceBundleTask[] {
        if (phase === 'critical') {
            return this.criticalBundles.map((task) => ({ ...task }));
        }
        if (phase === 'preload') {
            return this.preloadBundles.map((task) => ({ ...task }));
        }
        if (phase === 'background') {
            return this.backgroundBundleQueue.map((task) => ({ ...task }));
        }

        return [
            ...this.criticalBundles,
            ...this.preloadBundles,
            ...this.backgroundBundleQueue,
        ].map((task) => ({ ...task }));
    }

    /**
     * 加载首屏必须 Bundle。Bundle 加载完成后，后续读取该 Bundle 内资源不会重复下载 Bundle 配置。
     */
    public loadCriticalBundles(tasks?: HResourceBundleTask[], onProgress?: (finished: number, total: number, task: HResourceBundleTask) => void): Promise<HResourceBundleBatchResult> {
        return this.loadBundleBatch(this.normalizeBundleTasks(tasks || this.criticalBundles, 'critical'), onProgress);
    }

    /**
     * 加载预登记的 Bundle。适合 Home 前后会高概率使用的 Bundle。
     */
    public preloadRegisteredBundles(onProgress?: (finished: number, total: number, task: HResourceBundleTask) => void): Promise<HResourceBundleBatchResult> {
        return this.loadBundleBatch(this.preloadBundles, onProgress);
    }

    public loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        return this.getBundle(bundleName).then((bundle) => {
            if (!bundle) {
                throw new Error('[HResourceFacade] bundleName 不能为空');
            }
            return bundle;
        });
    }

    /**
     * 加载首屏必要资源。只放启动必须显示的资源，避免拉长首进时间。
     */
    public loadCritical(tasks?: HResourceTask[], onProgress?: HResourceProgressListener): Promise<HResourceBatchResult> {
        return this.loadBatch(this.normalizeTasks(tasks || this.criticalTasks, 'critical'), onProgress);
    }

    /**
     * 预加载常用预制体。默认只 preload，不强制实例化或缓存 Asset。
     */
    public preloadPrefabs(pathsOrTasks: Array<string | HResourceTask>, onProgress?: HResourceProgressListener): Promise<HResourceBatchResult> {
        const tasks = pathsOrTasks.map((item) => {
            if (typeof item === 'string') {
                return {
                    path: item,
                    type: Prefab,
                    phase: 'preload' as const,
                    preloadOnly: true,
                };
            }

            return {
                ...item,
                type: item.type || Prefab,
                phase: item.phase || 'preload',
                preloadOnly: item.preloadOnly !== false,
            };
        });

        return this.loadBatch(tasks, onProgress);
    }

    /**
     * 加载预登记的预加载资源。
     */
    public preloadRegistered(onProgress?: HResourceProgressListener): Promise<HResourceBatchResult> {
        return this.loadBatch(this.preloadTasks, onProgress);
    }

    /**
     * 直接加载单个资源。需要频繁复用时设置 cache=true。
     */
    public loadAsset<T extends Asset = Asset>(task: HResourceTask<T>): Promise<T> {
        const normalizedTask = this.normalizeTask(task, 'preload');
        const cacheKey = this.getCacheKey(normalizedTask);
        const cached = this.cachedAssets.get(cacheKey);
        if (cached?.isValid) {
            return Promise.resolve(cached as T);
        }

        return this.loadOne(normalizedTask).then((asset) => {
            if (normalizedTask.cache) {
                this.cachedAssets.set(cacheKey, asset);
            }
            return asset as T;
        });
    }

    public preloadAsset(task: HResourceTask): Promise<void> {
        const normalizedTask = {
            ...this.normalizeTask(task, 'preload'),
            preloadOnly: true,
        };
        return this.preloadOne(normalizedTask);
    }

    public getCached<T extends Asset = Asset>(keyOrPath: string): T | null {
        const cached = this.cachedAssets.get(keyOrPath);
        return cached?.isValid ? cached as T : null;
    }

    public releaseCached(keyOrPath: string): void {
        const cached = this.cachedAssets.get(keyOrPath);
        if (cached?.isValid) {
            assetManager.releaseAsset(cached);
        }
        this.cachedAssets.delete(keyOrPath);
    }

    /**
     * 加入不重要的后台资源。后台队列默认低并发，避免影响首屏和交互。
     */
    public enqueueBackground(tasks: HResourceTask[]): void {
        this.backgroundQueue.push(...this.normalizeTasks(tasks, 'background'));
        if (this.backgroundRunning) {
            this.pumpBackgroundQueue();
        }
    }

    public enqueueBackgroundBundles(tasks: HResourceBundleTask[]): void {
        this.backgroundBundleQueue.push(...this.normalizeBundleTasks(tasks, 'background'));
        if (this.backgroundRunning) {
            this.pumpBackgroundQueue();
        }
    }

    public startBackground(): void {
        if (this.backgroundRunning) {
            return;
        }

        this.backgroundRunning = true;
        this.pumpBackgroundQueue();
    }

    public pauseBackground(): void {
        this.backgroundRunning = false;
    }

    public clearBackgroundQueue(): void {
        this.backgroundQueue.length = 0;
    }

    public getBackgroundStatus(): { running: boolean; active: number; pending: number } {
        return {
            running: this.backgroundRunning,
            active: this.backgroundActiveCount,
            pending: this.backgroundQueue.length + this.backgroundBundleQueue.length,
        };
    }

    private async loadBatch(tasks: HResourceTask[], onProgress?: HResourceProgressListener): Promise<HResourceBatchResult> {
        const total = tasks.length;
        let completed = 0;
        const errors: Array<{ task: HResourceTask; error: unknown }> = [];

        for (const task of tasks) {
            try {
                if (task.preloadOnly) {
                    await this.preloadOne(task);
                } else {
                    await this.loadAsset(task);
                }
            } catch (error) {
                errors.push({
                    task,
                    error,
                });
                if (this.debug) {
                    console.warn('[HResourceFacade] load failed:', task.path, error);
                }
            }

            completed += 1;
            onProgress?.(completed, total, task);
        }

        return {
            ok: errors.length === 0,
            total,
            completed,
            failed: errors.length,
            errors,
        };
    }

    private pumpBackgroundQueue(): void {
        if (!this.backgroundRunning) {
            return;
        }

        while (this.backgroundActiveCount < this.backgroundConcurrency && (this.backgroundBundleQueue.length > 0 || this.backgroundQueue.length > 0)) {
            const bundleTask = this.backgroundBundleQueue.shift();
            this.backgroundActiveCount += 1;
            if (bundleTask) {
                this.loadBundle(bundleTask.name).catch((error) => {
                    if (this.debug) {
                        console.warn('[HResourceFacade] background bundle failed:', bundleTask.name, error);
                    }
                }).then(() => {
                    this.backgroundActiveCount -= 1;
                    this.pumpBackgroundQueue();
                });
            } else {
                const task = this.backgroundQueue.shift()!;
                const runner = task.preloadOnly === false
                    ? this.loadAsset(task).then(() => undefined)
                    : this.preloadOne({
                        ...task,
                        preloadOnly: true,
                    });

                runner.catch((error) => {
                    if (this.debug) {
                        console.warn('[HResourceFacade] background resource failed:', task.path, error);
                    }
                }).then(() => {
                    this.backgroundActiveCount -= 1;
                    this.pumpBackgroundQueue();
                });
            }
        }
    }

    private async loadBundleBatch(tasks: HResourceBundleTask[], onProgress?: (finished: number, total: number, task: HResourceBundleTask) => void): Promise<HResourceBundleBatchResult> {
        const total = tasks.length;
        let completed = 0;
        const errors: Array<{ task: HResourceBundleTask; error: unknown }> = [];

        for (const task of tasks) {
            try {
                await this.loadBundle(task.name);
            } catch (error) {
                errors.push({
                    task,
                    error,
                });
                if (this.debug) {
                    console.warn('[HResourceFacade] bundle load failed:', task.name, error);
                }
            }

            completed += 1;
            onProgress?.(completed, total, task);
        }

        return {
            ok: errors.length === 0,
            total,
            completed,
            failed: errors.length,
            errors,
        };
    }

    private loadOne<T extends Asset = Asset>(task: HResourceTask<T>): Promise<T> {
        return this.getBundle(task.bundle).then((bundle) => new Promise<T>((resolve, reject) => {
            const assetType = (task.type || Asset) as any;
            const callback = (err: Error | null, asset: Asset | null) => {
                if (err || !asset) {
                    reject(err || new Error(`[HResourceFacade] 加载失败：${task.path}`));
                    return;
                }
                resolve(asset as T);
            };

            if (bundle) {
                bundle.load(task.path, assetType, callback);
                return;
            }

            resources.load(task.path, assetType, callback);
        }));
    }

    private preloadOne(task: HResourceTask): Promise<void> {
        return this.getBundle(task.bundle).then((bundle) => new Promise<void>((resolve, reject) => {
            const assetType = (task.type || Asset) as any;
            const callback = (err: Error | null) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            };

            if (bundle) {
                bundle.preload(task.path, assetType, callback);
                return;
            }

            resources.preload(task.path, assetType, callback);
        }));
    }

    private getBundle(bundleName?: string): Promise<AssetManager.Bundle | null> {
        const normalizedBundleName = bundleName?.trim();
        if (!normalizedBundleName) {
            return Promise.resolve(null);
        }

        const cachedBundle = this.bundleCache.get(normalizedBundleName);
        if (cachedBundle) {
            return Promise.resolve(cachedBundle);
        }

        const loadedBundle = assetManager.getBundle(normalizedBundleName);
        if (loadedBundle) {
            this.bundleCache.set(normalizedBundleName, loadedBundle);
            return Promise.resolve(loadedBundle);
        }

        return new Promise((resolve, reject) => {
            assetManager.loadBundle(normalizedBundleName, (err, bundle) => {
                if (err || !bundle) {
                    reject(err || new Error(`[HResourceFacade] Bundle 加载失败：${normalizedBundleName}`));
                    return;
                }

                this.bundleCache.set(normalizedBundleName, bundle);
                resolve(bundle);
            });
        });
    }

    private normalizeTasks(tasks: HResourceTask[], phase: HResourceTask['phase']): HResourceTask[] {
        return tasks.map((task) => this.normalizeTask(task, phase));
    }

    private normalizeBundleTasks(tasks: HResourceBundleTask[], phase: HResourcePhase): HResourceBundleTask[] {
        return tasks
            .filter((task) => task.enabled !== false)
            .map((task) => {
                const name = task.name.trim();
                if (!name) {
                    throw new Error('[HResourceFacade] Bundle name 不能为空');
                }

                return {
                    ...task,
                    name,
                    phase: task.phase || phase,
                };
            });
    }

    private normalizeTask<T extends Asset = Asset>(task: HResourceTask<T>, phase: HResourceTask['phase']): HResourceTask<T> {
        const normalizedPath = task.path.trim();
        if (!normalizedPath) {
            throw new Error('[HResourceFacade] 资源 path 不能为空');
        }

        return {
            ...task,
            path: normalizedPath,
            key: task.key?.trim() || this.getCacheKey(task),
            type: (task.type || this.resolveAssetType(task.assetType)) as HResourceAssetType<T>,
            phase: task.phase || phase,
            cache: !!task.cache,
            preloadOnly: task.preloadOnly ?? phase !== 'critical',
        };
    }

    private getCacheKey(task: HResourceTask): string {
        return task.key?.trim() || `${task.bundle || 'resources'}:${task.path}`;
    }

    private profileItemsToTasks(items: HResourceProfileItem[], phase: HResourcePhase): HResourceTask[] {
        return items
            .filter((item) => item.enabled !== false)
            .map((item) => ({
                key: item.key,
                path: item.path,
                bundle: item.bundle,
                assetType: item.assetType,
                phase,
                cache: item.cache,
                preloadOnly: item.preloadOnly,
            }));
    }

    private resolveAssetType(assetType?: HResourceAssetKind): typeof Asset {
        switch (assetType) {
            case 'Prefab':
                return Prefab;
            case 'SpriteFrame':
                return SpriteFrame;
            case 'Texture2D':
                return Texture2D;
            case 'AudioClip':
                return AudioClip;
            case 'JsonAsset':
                return JsonAsset;
            default:
                return Asset;
        }
    }
}
