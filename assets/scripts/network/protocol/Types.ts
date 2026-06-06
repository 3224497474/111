export interface IApiEnvelope<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    status?: number;
}

export enum ActionType {
    DEBUG_PING = 'debug_ping',
    DEBUG_ADD_GOLD = 'debug_add_gold',
    SPEND_CURRENCY = 'spend_currency',
    LEVEL_UP = 'level_up',
    EQUIP_SOUL = 'equip_soul',
}

export interface IPlayerAction {
    id: string;
    timestamp: number;
    actionType: ActionType | string;
    payload: any;
}

export interface IServerResponse<T = unknown> {
    code: number;
    message: string;
    data: T;
    serverSnapshot?: any;
}

export interface IHealthData {
    message: string;
    time: string;
}

export interface ILoginResult {
    uid: string;
    token: string;
    openid?: string;
    isNewUser?: boolean;
}

export interface IAuthMeData {
    uid: string;
    openid?: string;
}

export type TQueuedActionStatus = 'pending' | 'submitting';

export interface IQueuedAction {
    actionId: string;
    seqNo: number;
    actionType: string;
    payload: Record<string, unknown>;
    createdAt: number;
    clientVersion: string;
    protocolVersion: number;
    status: TQueuedActionStatus;
}

export interface IActionSubmitRequest {
    actions: IQueuedAction[];
}

export type TActionSubmitStatus = 'accepted' | 'rejected' | 'duplicate';

export interface IActionSubmitItemResult {
    actionId: string;
    seqNo: number;
    status: TActionSubmitStatus;
    reason?: string;
}

export interface IActionSubmitResponseData {
    accepted: IActionSubmitItemResult[];
    rejected: IActionSubmitItemResult[];
    duplicates: IActionSubmitItemResult[];
    serverTime: number;
}

export interface IActionSyncSummary {
    submitted: number;
    remaining: number;
    accepted: IActionSubmitItemResult[];
    rejected: IActionSubmitItemResult[];
    duplicates: IActionSubmitItemResult[];
}

export interface IAuthSnapshot {
    uid: string | null;
    token: string | null;
}

export interface IQueueSnapshot {
    nextSeqNo: number;
    total: number;
    pending: number;
    submitting: number;
    actions: IQueuedAction[];
}

export interface IHttpRequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    baseUrl?: string;
}

export interface IHttpClientRequestOptions {
    needAuth?: boolean;
    timeoutMs?: number;
    baseUrl?: string;
    headers?: Record<string, string>;
}

export interface IHttpTransportResponse<T = unknown> {
    status: number;
    data: T;
}

export interface IHttpTransport {
    request<T = unknown>(options: IHttpRequestOptions): Promise<IHttpTransportResponse<T>>;
}
