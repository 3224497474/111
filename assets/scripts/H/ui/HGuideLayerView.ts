import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 引导层基类。
 *
 * 适用场景：
 * - 新手引导遮罩、强制点击引导、聚焦高亮。
 * - 引导层在返回键和层级排序中拥有更高优先级。
 */
@ccclass('HGuideLayerView')
export class HGuideLayerView<TParams = any> extends HUIBase<TParams> {}
