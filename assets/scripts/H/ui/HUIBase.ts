import { _decorator } from 'cc';
import { HUIViewBase } from './HUIViewBase';

const { ccclass } = _decorator;

/**
 * 所有业务 UI 的统一基类。
 *
 * 说明：
 * - HUIViewBase 负责生命周期、事件、定时器、VM/Store 监听和资源清理。
 * - HUIBase 作为业务可继承入口，后续不同层级的 UI 基类都从这里扩展。
 */
@ccclass('HUIBase')
export class HUIBase<TParams = any> extends HUIViewBase<TParams> {}
