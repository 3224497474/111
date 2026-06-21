import { HBaseSDK } from './HBaseSDK';

/**
 * 抖音小游戏 SDK adapter。
 * 具体 callback 包装逻辑继承自 HBaseSDK，这里只声明平台名并返回全局 tt 对象。
 */
export class HDySDK extends HBaseSDK {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }
}
