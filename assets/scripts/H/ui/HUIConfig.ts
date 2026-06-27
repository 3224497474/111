import { Enum } from 'cc';
import { UILayer, type HUIConfig as HUIRouteConfig, type HUIRouteConfigMap, type HUIRouteId } from './HUITypes';

/**
 * 项目 UI 路由枚举。
 *
 * 推荐把所有业务 UI 的 id 都集中放在这里，
 * 这样 Loading、启动首屏、业务 open/close 都可以直接复用同一套枚举，
 * 避免到处手写字符串。
 */
export enum HUI {
    home = 'home',
}

Enum(HUI);

/**
 * 创建一条 UI 路由配置。
 *
 * 用法示例：
 * defineUIConfig(HUI.home, 'prefabs/Home', {
 *     bundle: 'home',
 *     type: 'page',
 *     layer: UILayer.Layer1,
 *     cacheMode: 'keep',
 * });
 */
export function defineUIConfig(
    id: HUIRouteId,
    prefabPath: string,
    options: Partial<HUIRouteConfig> = {},
): HUIRouteConfig {
    return {
        ...options,
        id,
        prefabPath,
    };
}

/**
 * H UI 框架默认路由表。
 *
 * 项目可以直接在这里维护统一的 UI 枚举 id 与 prefab 路径映射。
 * 后续 startupUIs.uiId、H.ui.open(...)、Loading 首屏自动显示都应优先复用这些 id。
 */
export const UIRouteConfigs: HUIRouteConfigMap = {
    [HUI.home]: defineUIConfig(HUI.home, 'prefabs/Home', {
        bundle: 'home',
        type: 'page',
        layer: UILayer.Layer1,
        cacheMode: 'keep',
        openLoading: false,
        animation: 'none',
    }),
};

export const HUIConfigs = UIRouteConfigs;
