import { UIManager, UIPanelId } from '../X/ui/UIManager';
import type { IRemoteSceneLoaderTips } from './RemoteSceneLoader';

export interface ITransitionBundleInput {
    bundleName: string;
    prefabPaths: string[];
}

/**
 * 动态过渡管理器。
 * 负责把“进入哪个场景、预加载哪些远程资源、显示什么提示文案”
 * 统一转交给 TransitionScreen 对应的 RemoteSceneLoader 处理。
 */
export class TransitionManager {
    private static _instance: TransitionManager | null = null;

    public static get instance(): TransitionManager {
        if (!this._instance) {
            this._instance = new TransitionManager();
        }
        return this._instance;
    }

    private constructor() {}

    /**
     * 打开统一的过渡界面，并把场景跳转任务交给 RemoteSceneLoader。
     * `tips` 为可选参数，不传时会由 RemoteSceneLoader 根据场景名自动推断默认文案。
     */
    public async gotoScene(
        sceneName: string,
        bundles: ReadonlyArray<ITransitionBundleInput>,
        tips?: IRemoteSceneLoaderTips,
    ): Promise<void> {
        
        await UIManager.instance.openPopup(UIPanelId.TransitionScreen, {
            sceneName,
            bundles: bundles.map((item) => ({
                bundleName: item.bundleName,
                prefabPaths: [...item.prefabPaths],
            })),
            tips: tips ? { ...tips } : undefined,
        });
    }
}
