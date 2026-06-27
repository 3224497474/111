import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 一级 UI 层基类。
 *
 * 适用场景：
 * - 主界面、底部 Tab 常驻页面、游戏大厅等第一层页面。
 * - 业务脚本继承该类后，默认应通过 UILayer.Layer1 或 H.ui.openLayer1 打开。
 */
@ccclass('HLayer1View')
export class HLayer1View<TParams = any> extends HUIBase<TParams> {}
