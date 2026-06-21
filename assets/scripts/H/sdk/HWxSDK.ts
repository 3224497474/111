import { HBaseSDK } from './HBaseSDK';

/**
 * 微信小游戏 SDK adapter。
 * 具体 callback 包装逻辑继承自 HBaseSDK，这里只声明平台名并返回全局 wx 对象。
 */
export class HWxSDK extends HBaseSDK {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }
}
