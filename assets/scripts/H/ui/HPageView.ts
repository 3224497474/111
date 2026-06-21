import { _decorator } from 'cc';
import { HUIViewBase } from './HUIViewBase';

const { ccclass } = _decorator;

/**
 * 页面语义基类。
 * 页面默认走 page 互斥策略，同一层只保留当前页面，适合主界面、关卡界面等全屏 UI。
 */
@ccclass('HPageView')
export class HPageView<TParams = any> extends HUIViewBase<TParams> {}
