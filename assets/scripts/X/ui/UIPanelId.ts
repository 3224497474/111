/**
 * 这里只保留面板加载配置，避免和 UIManager.ts 形成循环依赖。
 */
export type PanelGroup = 'main' | 'sub' | 'popup' | string;

export interface UIPanelLoadConfig {
    /**
     * 资源所在 bundle 名称。
     * 例如：home、resources、common-remote。
     */
    bundleName: string;

    /**
     * prefab 在 bundle 内的相对路径。
     * 例如：prefab/Home、prefab/ui/DialogView。
     */
    prefabPath: string;

    /**
     * 实例化后挂载到哪个父节点。
     * 如果不传，UIManager 会默认尝试挂到 Canvas。
     */
    parentPath?: string;

    /**
     * prefab 根节点上挂载的脚本类名（@ccclass 名称）。
     * UIManager 会用它来解析统一生命周期。
     */
    rootScript?: string;

    /**
     * 面板分组，用于普通页面互斥显示和弹窗分类。
     */
    group?: PanelGroup;

    /**
     * 同组是否互斥。
     * popup 通常不需要互斥，因为队列会负责顺序控制。
     */
    exclusiveInGroup?: boolean;

    /**
     * 显示层级。
     * 全屏遮罩和通用弹窗建议给更高值，避免被底层界面盖住。
     */
    order?: number;
}

/**
 * UI 预制体统一加载配置表。
 * key 必须和 UIPanelId 的字符串值保持一致。
 */
export const PANEL_LOAD_CONFIG: Partial<Record<string, UIPanelLoadConfig>> = {
    Home: {
        bundleName: 'home',
        prefabPath: 'prefabs/Home',
        parentPath: 'Canvas',
        rootScript: 'HomeUI',
        group: 'main',
        exclusiveInGroup: true,
        order: 10,
    },
    Dialog: {
        // 统一对话弹窗入口，供 DialogSystem -> UIManager.openPopup 使用。
        bundleName: 'resources',
        prefabPath: 'prefabs/ui/DialogView',
        parentPath: 'Canvas',
        rootScript: 'DialogView',
        group: 'popup',
        exclusiveInGroup: false,
        order: 2000,
    },
    CommonDialog: {
        // 系统通用确认弹窗入口，供 PromptManager -> UIManager.openPopup 使用。
        // 如果项目里的 prefab 路径不同，只需要调整这里的 prefabPath。
        bundleName: 'resources',
        prefabPath: 'prefabs/ui/CommonDialog',
        parentPath: 'Canvas',
        rootScript: 'CommonDialog',
        group: 'popup',
        exclusiveInGroup: false,
        order: 2100,
    },
    TransitionScreen: {
        // 统一场景过渡遮罩入口，供 TransitionManager -> UIManager.openPopup 使用。
        bundleName: 'prefabs',
        prefabPath: 'ui/TransitionScreen',
        parentPath: 'Canvas',
        rootScript: 'RemoteSceneLoader',
        group: 'popup',
        exclusiveInGroup: false,
        order: 3000,
    },
};
