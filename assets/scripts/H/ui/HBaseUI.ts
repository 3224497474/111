import { _decorator } from 'cc';
import { HUIViewBase } from './HUIViewBase';

const { ccclass } = _decorator;

/**
 * 通用业务 UI 基类别名。
 * 项目脚本可以继承 HBaseUI，也可以按语义继承 HPageView/HDialogView 等类。
 */
@ccclass('HBaseUI')
export class HBaseUI<TParams = any> extends HUIViewBase<TParams> {}
