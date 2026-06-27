import { _decorator } from 'cc';
import { HGuideLayerView } from './HGuideLayerView';

const { ccclass } = _decorator;

/**
 * 引导层语义基类。
 * 引导 UI 通常在 Guide 层并拥有最高返回键优先级，用于新手引导和强制遮罩。
 */
@ccclass('HGuideView')
export class HGuideView<TParams = any> extends HGuideLayerView<TParams> {}
