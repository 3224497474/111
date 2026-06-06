import {
    _decorator,
    Component,
    director,
    assetManager,
    AssetManager,
    Prefab,
    ProgressBar,
    Label,
} from 'cc';
import { MemoryMonitor } from './MemoryMonitor';
import { AsyncLoadQueue } from './AsyncLoadQueue';
import { RemotePrefabCache } from './RemotePrefabCache';

const { ccclass, property } = _decorator;

const MAX_CONCURRENT = 4;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const FRAME_SLICE_BUDGET_MS = 16;
const MAX_CALLBACKS_PER_SLICE = 4;

interface LoadFrameSliceState {
    startedAt: number;
    processedCount: number;
    yieldPromise: Promise<void> | null;
}

@ccclass('LoadingController')
export class LoadingController extends Component {
    @property
    public bundleName: string = 'home';

    @property
    public nextSceneName: string = 'HomeScene';

    /**
     * 这里只负责声明要预加载哪些 prefab，
     * 不负责实例化节点，也不会自动给其他脚本注入引用。
     */
    @property({ type: [String] })
    public prefabPaths: string[] = [];

    @property
    public versionUrl: string = '';

    @property
    public localVersion: string = '1.0.0';

    @property
    public versionRequestTimeout: number = 5;

    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;

    @property(Label)
    public progressLabel: Label | null = null;

    @property(Label)
    public errorLabel: Label | null = null;

    start() {
        // Loading 场景本身也是启动入口之一，这里同样挂上内存监控。
        MemoryMonitor.ensureMounted(this.node);
        this.clearError();
        this.updateProgress(0);
        this.startFlow();
    }

    private async startFlow() {
        try {
            await this.checkVersionAndNetwork();

            const bundle = await this.loadBundle(this.bundleName);
            await this.preloadPrefabs(bundle, this.prefabPaths);

            await new Promise((resolve) => setTimeout(resolve, 1000));
            director.loadScene(this.nextSceneName);
        } catch (e) {
            console.error('[LoadingController] 加载流程失败:', e);
            this.showError('加载失败，请检查网络后重试');
        }
    }

    public onClickRetry() {
        this.clearError();
        this.updateProgress(0);
        this.startFlow();
    }

    private checkVersionAndNetwork(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.versionUrl) {
                resolve();
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', this.versionUrl, true);
            xhr.timeout = this.versionRequestTimeout * 1000;

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }

                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText || '{}');
                        const minVersion: string = data.minVersion ?? '';
                        const latestVersion: string = data.latestVersion ?? '';

                        if (minVersion && this.compareVersion(this.localVersion, minVersion) < 0) {
                            this.showError('当前版本过低，请先更新游戏');
                            reject(new Error('force_update'));
                            return;
                        }

                        console.log(
                            `[LoadingController] 版本检查通过，本地=${this.localVersion}，最新=${latestVersion}`,
                        );
                        resolve();
                    } catch (err) {
                        console.warn('[LoadingController] 版本信息解析失败:', err);
                        resolve();
                    }
                } else {
                    this.showError('网络异常，请检查后重试');
                    reject(new Error(`network_error: ${xhr.status}`));
                }
            };

            xhr.onerror = () => {
                this.showError('网络异常，请检查后重试');
                reject(new Error('network_error'));
            };

            xhr.ontimeout = () => {
                this.showError('请求超时，请稍后重试');
                reject(new Error('network_timeout'));
            };

            try {
                xhr.send();
            } catch (err) {
                this.showError('网络请求失败，请稍后重试');
                reject(err);
            }
        });
    }

    private compareVersion(a: string, b: string): number {
        const pa = a.split('.').map((n) => parseInt(n) || 0);
        const pb = b.split('.').map((n) => parseInt(n) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const na = pa[i] ?? 0;
            const nb = pb[i] ?? 0;
            if (na > nb) {
                return 1;
            }
            if (na < nb) {
                return -1;
            }
        }
        return 0;
    }

    private loadBundle(name: string): Promise<AssetManager.Bundle> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle(name, (err, bundle) => {
                if (err || !bundle) {
                    reject(err ?? new Error(`Bundle 加载失败: ${name}`));
                    return;
                }

                console.log(`[LoadingController] Bundle "${name}" 加载成功`);
                resolve(bundle);
            });
        });
    }

    private preloadPrefabs(
        bundle: AssetManager.Bundle,
        paths: string[],
    ): Promise<void> {
        if (!paths || paths.length === 0) {
            this.updateProgress(1);
            return Promise.resolve();
        }

        return this.preloadPrefabsWithQueue(bundle, paths);
    }

    private preloadPrefabsWithQueue(
        bundle: AssetManager.Bundle,
        paths: string[],
    ): Promise<void> {
        const queue = new AsyncLoadQueue(MAX_CONCURRENT);
        const total = paths.length;
        let finished = 0;

        // 并发回调共用一个时间片预算，避免 Loading UI 长时间得不到刷新。
        const frameSliceState = this.createLoadFrameSliceState();

        return queue.run(paths, async (path) => {
            const prefab = await this.loadPrefabWithRetry(bundle, path);
            RemotePrefabCache.set(this.bundleName, path, prefab);
            finished++;
            this.updateProgress(finished / total);
            await this.maybeYieldForUi(frameSliceState);
        });
    }

    private createLoadFrameSliceState(): LoadFrameSliceState {
        return {
            startedAt: this.getNowMs(),
            processedCount: 0,
            yieldPromise: null,
        };
    }

    private async maybeYieldForUi(state: LoadFrameSliceState): Promise<void> {
        if (state.yieldPromise) {
            await state.yieldPromise;
            return;
        }

        state.processedCount += 1;
        const elapsedMs = this.getNowMs() - state.startedAt;
        const exceededCountBudget = state.processedCount >= MAX_CALLBACKS_PER_SLICE;
        const exceededTimeBudget = elapsedMs >= FRAME_SLICE_BUDGET_MS;

        if (!exceededCountBudget && !exceededTimeBudget) {
            return;
        }

        // 当前时间片过密时主动把控制权还给引擎。
        state.yieldPromise = this.yieldFrame();

        try {
            await state.yieldPromise;
        } finally {
            state.processedCount = 0;
            state.startedAt = this.getNowMs();
            state.yieldPromise = null;
        }
    }

    private async loadPrefabWithRetry(
        bundle: AssetManager.Bundle,
        path: string,
    ): Promise<Prefab> {
        let lastError: unknown = null;

        // 用退避重试吸收短时弱网抖动，同时避免请求风暴。
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
            try {
                return await this.loadPrefabOnce(bundle, path);
            } catch (error) {
                lastError = error;
                if (attempt >= RETRY_DELAYS_MS.length) {
                    break;
                }

                const retryDelay = RETRY_DELAYS_MS[attempt];
                console.warn(
                    `[LoadingController] Prefab load failed, retrying (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${this.bundleName}/${path}`,
                    error,
                );
                await this.delayMs(retryDelay);
            }
        }

        throw lastError ?? new Error(`Prefab load failed: ${this.bundleName}/${path}`);
    }

    private loadPrefabOnce(
        bundle: AssetManager.Bundle,
        path: string,
    ): Promise<Prefab> {
        return new Promise((resolve, reject) => {
            bundle.load(path, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err ?? new Error(`Prefab load failed: ${bundle.name}/${path}`));
                    return;
                }

                resolve(prefab);
            });
        });
    }

    private delayMs(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), ms / 1000);
        });
    }

    private yieldFrame(): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), 0);
        });
    }

    private getNowMs(): number {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }

        return Date.now();
    }

    private updateProgress(ratio: number) {
        if (this.progressBar) {
            this.progressBar.progress = ratio;
        }

        if (this.progressLabel) {
            this.progressLabel.string = `${Math.floor(ratio * 100)}%`;
        }
    }

    private showError(msg: string) {
        if (this.errorLabel) {
            this.errorLabel.string = msg;
        }

        console.warn('[LoadingController] ' + msg);
    }

    private clearError() {
        if (this.errorLabel) {
            this.errorLabel.string = '';
        }
    }
}
