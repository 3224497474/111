import type { HUIRouteConfigMap } from './HUITypes';

/**
 * H 框架内置 UI 路由表。
 *
 * 框架只提供空表和结构，具体项目在 Loading 阶段调用
 * H.ui.registerRoutes(ProjectUIRouteConfigs) 注入自己的 UI。
 */
export const UIRouteConfigs: HUIRouteConfigMap = {};

export const HUIConfigs = UIRouteConfigs;
