import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 提示层基类。
 *
 * 适用场景：
 * - Toast、飘字、轻提示、弱打断消息。
 * - 该层通常不阻塞操作，并且关闭后默认销毁。
 */
@ccclass('HTipLayerView')
export class HTipLayerView<TParams = any> extends HUIBase<TParams> {}
