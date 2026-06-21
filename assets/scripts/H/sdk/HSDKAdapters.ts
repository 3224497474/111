/**
 * SDK 目录的统一导出口。
 * 外部项目需要扩展渠道 adapter、广告 adapter、平台 adapter 或屏幕适配时，优先从这里引用。
 */
export type { HMiniGameSDKAdapter, HSDKLifecycleListener } from './HSDKAdapter';
export { HBaseSDK } from './HBaseSDK';
export { HWxSDK, HWxSDK as HWechatSDKAdapter } from './HWxSDK';
export { HDySDK, HDySDK as HDouyinSDKAdapter } from './HDySDK';
export { HMockSDK, HMockSDK as HMockSDKAdapter } from './HMockSDK';
export { HAdFacade } from './ad/HAdFacade';
export { HDouyinAdAdapter, HMockAdAdapter, HWechatAdAdapter } from './ad/HAdAdapters';
export type { HAdAdapter } from './ad/HAdAdapters';
export { HPlatformFacade } from './platform/HPlatformFacade';
export { HDouyinPlatformAdapter, HMockPlatformAdapter, HWechatPlatformAdapter } from './platform/HPlatformAdapters';
export type { HPlatformAdapter } from './platform/HPlatformAdapters';
export { HDefaultSDKRegistry, HSDKRegistry } from './HSDKRegistry';
export type { HSDKAdapterConstructor, HSDKAdapterFactory } from './HSDKRegistry';
export { HScreenFacade } from './HScreenFacade';
