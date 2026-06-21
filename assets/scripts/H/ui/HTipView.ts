import { _decorator } from 'cc';
import { HUIViewBase } from './HUIViewBase';

const { ccclass } = _decorator;

/**
 * 提示层语义基类。
 * Tip 默认非单例、自动移除、销毁缓存，适合 toast、飘字和轻提示。
 */
@ccclass('HTipView')
export class HTipView<TParams = any> extends HUIViewBase<TParams> {}
