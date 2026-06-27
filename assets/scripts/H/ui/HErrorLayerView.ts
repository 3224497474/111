import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 错误信息层基类。
 *
 * 适用场景：
 * - 网络错误、SDK 错误、支付失败、接口异常等强提示信息。
 * - 错误层比普通提示层更高，避免关键错误被 toast 或弹窗遮挡。
 */
@ccclass('HErrorLayerView')
export class HErrorLayerView<TParams = any> extends HUIBase<TParams> {}
