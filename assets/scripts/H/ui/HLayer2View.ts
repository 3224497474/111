import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 二级 UI 层基类。
 *
 * 适用场景：
 * - 背包、任务、商城、关卡选择等从一级页面进入的全屏页面。
 * - 旧的 HPageView 会继承该类，保证旧项目代码继续可用。
 */
@ccclass('HLayer2View')
export class HLayer2View<TParams = any> extends HUIBase<TParams> {}
