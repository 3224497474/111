import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * Loading 语义基类。
 * 通常由 UIOpenLoadingPolicy 自动打开和关闭，业务不需要手动管理慢加载提示。
 */
@ccclass('HLoadingView')
export class HLoadingView<TParams = any> extends HUIBase<TParams> {}
