/**
 * 框架内置事件名枚举。
 * 项目事件建议在项目层定义自己的 enum，例如 ProjectEventName，再传给 H.event/listenEvent。
 */
export enum HEventName {
    HInit = 'h:init',

    UIRequestOpen = 'ui:request_open',
    UIRequestClose = 'ui:request_close',
    UIRequestRefresh = 'ui:request_refresh',
    UITabChanged = 'ui:tab_changed',

    StoreChanged = 'store:changed',

    SDKLoginSuccess = 'sdk:login_success',
    SDKLoginFail = 'sdk:login_fail',

    AdRewarded = 'ad:rewarded',
    AdClosed = 'ad:closed',

    SystemLanguageChanged = 'system:language_changed',
}

export type HEventNameLike = HEventName | string;

export interface HEventPayloadMap {
    [HEventName.HInit]: void;
    [HEventName.UIRequestOpen]: { id: string; params?: unknown };
    [HEventName.UIRequestClose]: { id: string; reason?: string };
    [HEventName.UIRequestRefresh]: { id: string; params?: unknown };
    [HEventName.UITabChanged]: { previousId: number; currentId: number; pageId: string; reason: string };
    [HEventName.StoreChanged]: { module: string; paths: string[] };
    [HEventName.SDKLoginSuccess]: { platform: string; raw?: unknown };
    [HEventName.SDKLoginFail]: { platform: string; reason?: string; raw?: unknown };
    [HEventName.AdRewarded]: { placement: string; raw?: unknown };
    [HEventName.AdClosed]: { placement: string; rewarded?: boolean; raw?: unknown };
    [HEventName.SystemLanguageChanged]: { language: string };
}

export type HEventPayload<TName extends HEventNameLike> =
    TName extends keyof HEventPayloadMap ? HEventPayloadMap[TName] : unknown;
