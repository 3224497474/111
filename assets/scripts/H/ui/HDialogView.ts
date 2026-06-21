import { _decorator } from 'cc';
import { HUIViewBase } from './HUIViewBase';

const { ccclass } = _decorator;

/**
 * 弹窗语义基类。
 * 默认由 HUIFacade 放到弹窗层，并使用弹窗默认动画、遮罩和返回键策略。
 */
@ccclass('HDialogView')
export class HDialogView<TParams = any> extends HUIViewBase<TParams> {}
