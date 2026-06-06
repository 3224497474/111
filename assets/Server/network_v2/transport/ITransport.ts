export interface ITransportPostOptions {
    timeoutMs?: number;
    headers?: Record<string, string>;
}

export interface ITransportResponse<T = unknown> {
    status: number;
    ok: boolean;
    data: T;
}

export interface ITransport {
    post<T = unknown>(
        url: string,
        data?: unknown,
        options?: ITransportPostOptions,
    ): Promise<ITransportResponse<T>>;
}
