import type { HUIConfig } from '../HTypes';

/**
 * H 框架内置 UI 配置表。
 *
 * 使用方式：
 * 1. 在这里登记 UI 预制体。
 * 2. Loading 阶段调用 H.init({ uiRoot }) 后会自动注册这里的配置。
 * 3. 业务层直接 H.ui.open('ShopView')，不需要每次都写 prefabPath。
 */
export const HUIConfigs: HUIConfig[] = [
    // 示例：
    // {
    //     id: 'ShopView',
    //     type: 'page',
    //     layer: 'layer2',
    //     bundle: 'resources',
    //     prefabPath: 'ui/ShopView',
    //     scriptName: 'ShopView',
    //     cacheMode: 'hide',
    //     group: 'main-page',
    //     exclusive: true,
    //     animation: 'slide-left',
    // },
    // {
    //     id: 'RewardDialog',
    //     type: 'dialog',
    //     layer: 'layer3',
    //     bundle: 'resources',
    //     prefabPath: 'ui/RewardDialog',
    //     scriptName: 'RewardDialog',
    //     cacheMode: 'destroy',
    //     animation: 'fade-scale',
    // },
];
