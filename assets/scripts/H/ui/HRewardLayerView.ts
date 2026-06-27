import { _decorator } from 'cc';
import { HUIBase } from './HUIBase';

const { ccclass } = _decorator;

/**
 * 奖励物品层基类。
 *
 * 适用场景：
 * - 道具飞行动画、奖励 item 展示、金币/钻石获得表现。
 * - 奖励层独立出来后，不会和普通弹窗、提示层抢层级。
 */
@ccclass('HRewardLayerView')
export class HRewardLayerView<TParams = any> extends HUIBase<TParams> {}
