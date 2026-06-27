import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 弹窗层基类。
 *
 * 适用场景：
 * - 确认框、购买弹窗、奖励结算弹窗、系统提示弹窗。
 * - 该层通常带遮罩、返回键关闭、关闭动画和关闭节流。
 */
@ccclass('HDialogLayerView')
export class HDialogLayerView<TParams = any> extends HUIBase<TParams> {}
