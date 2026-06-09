import type { HResourceProfile } from '../HTypes';

/**
 * H 资源配置示例。
 * 后续如果做 Cocos 编辑器面板，面板只需要读写这份结构即可。
 */
export const HDefaultResourceProfile: HResourceProfile = {
    name: 'default',
    debug: true,
    backgroundConcurrency: 1,
    criticalBundles: [
        {
            enabled: true,
            name: 'resources',
            phase: 'critical',
            note: '首屏基础资源 Bundle',
        },
    ],
    preloadBundles: [],
    backgroundBundles: [
        {
            enabled: true,
            name: 'home-remote',
            phase: 'background',
            note: '进入主界面后后台拉取的远程 Bundle',
        },
    ],
    critical: [
        {
            enabled: true,
            key: 'home_view',
            bundle: 'resources',
            path: 'ui/HomeView',
            assetType: 'Prefab',
            cache: true,
            preloadOnly: false,
            note: '首屏首页 UI',
        },
    ],
    preload: [
        {
            enabled: true,
            key: 'shop_view',
            bundle: 'resources',
            path: 'ui/ShopView',
            assetType: 'Prefab',
            preloadOnly: true,
            note: '常用商店页面',
        },
        {
            enabled: true,
            key: 'task_view',
            bundle: 'resources',
            path: 'ui/TaskView',
            assetType: 'Prefab',
            preloadOnly: true,
            note: '常用任务页面',
        },
    ],
    background: [
        {
            enabled: true,
            key: 'rank_view',
            bundle: 'resources',
            path: 'ui/RankView',
            assetType: 'Prefab',
            preloadOnly: true,
            note: '低频排行榜页面，进入首页后后台加载',
        },
    ],
};
