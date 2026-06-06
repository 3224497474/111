import { createNetworkConfig, type INetworkRuntimeConfig } from '../NetworkConfig';
import { NativeHttpTransport } from './NativeHttpTransport';
import type {
    IApiEnvelope,
    IHttpClientRequestOptions,
    IHttpTransport,
} from '../protocol/Types';

export class HttpClientError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload?: IApiEnvelope<unknown>,
    ) {
        super(message);
        this.name = 'HttpClientError';
    }
}

export class HttpClient {
    private static sharedConfig: INetworkRuntimeConfig = createNetworkConfig();
    private static sharedTransport: IHttpTransport = new NativeHttpTransport();
    private static sharedToken: string | null = null;

    private token: string | null = null;

    constructor(
        private config: INetworkRuntimeConfig,
        private transport: IHttpTransport,
    ) {}

    public configure(
        config: Partial<INetworkRuntimeConfig>,
        transport?: IHttpTransport,
    ): void {
        this.config = createNetworkConfig({
            ...this.config,
            ...config,
        });

        if (transport) {
            this.transport = transport;
        }
    }

    public static configure(
        config: Partial<INetworkRuntimeConfig>,
        transport?: IHttpTransport,
    ): void {
        this.sharedConfig = createNetworkConfig({
            ...this.sharedConfig,
            ...config,
        });

        if (transport) {
            this.sharedTransport = transport;
        }
    }

    public static setToken(token: string | null): void {
        this.sharedToken = token?.trim() || null;
    }

    public static getToken(): string | null {
        return this.sharedToken;
    }

    public static async get<T>(
        path: string,
        options?: IHttpClientRequestOptions,
    ): Promise<IApiEnvelope<T>> {
        return this.requestShared<T>('GET', path, undefined, options);
    }

    public static async post<T>(
        path: string,
        body: unknown,
        options?: IHttpClientRequestOptions,
    ): Promise<IApiEnvelope<T>> {
        return this.requestShared<T>('POST', path, body, options);
    }

    public setToken(token: string | null): void {
        this.token = token?.trim() || null;
    }

    public getToken(): string | null {
        return this.token;
    }

    public async get<T>(
        path: string,
        needAuthOrOptions: boolean | IHttpClientRequestOptions = true,
    ): Promise<IApiEnvelope<T>> {
        return this.request<T>('GET', path, undefined, this.normalizeRequestOptions(needAuthOrOptions));
    }

    public async post<T>(
        path: string,
        body: unknown,
        needAuthOrOptions: boolean | IHttpClientRequestOptions = true,
    ): Promise<IApiEnvelope<T>> {
        return this.request<T>('POST', path, body, this.normalizeRequestOptions(needAuthOrOptions));
    }

    private static async requestShared<T>(
        method: 'GET' | 'POST',
        path: string,
        body: unknown,
        options?: IHttpClientRequestOptions,
    ): Promise<IApiEnvelope<T>> {
        return this.executeRequest<T>({
            method,
            path,
            body,
            options: {
                needAuth: options?.needAuth ?? true,
                timeoutMs: options?.timeoutMs ?? this.sharedConfig.timeoutMs,
                baseUrl: options?.baseUrl ?? this.sharedConfig.baseUrl,
                headers: options?.headers,
            },
            token: this.sharedToken,
            transport: this.sharedTransport,
        });
    }

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        body: unknown,
        options: IHttpClientRequestOptions,
    ): Promise<IApiEnvelope<T>> {
        return HttpClient.executeRequest<T>({
            method,
            path,
            body,
            options: {
                needAuth: options.needAuth ?? true,
                timeoutMs: options.timeoutMs ?? this.config.timeoutMs,
                baseUrl: options.baseUrl ?? this.config.baseUrl,
                headers: options.headers,
            },
            token: this.token,
            transport: this.transport,
        });
    }

    private static async executeRequest<T>(params: {
        method: 'GET' | 'POST';
        path: string;
        body: unknown;
        options: IHttpClientRequestOptions;
        token: string | null;
        transport: IHttpTransport;
    }): Promise<IApiEnvelope<T>> {
        const headers = this.buildHeaders(params.options, params.token);
        const response = await params.transport.request<IApiEnvelope<T>>({
            method: params.method,
            path: params.path,
            body: params.body,
            headers,
            timeoutMs: params.options.timeoutMs,
            baseUrl: params.options.baseUrl,
        });

        if (response.status < 200 || response.status >= 300) {
            throw new HttpClientError(
                this.extractErrorMessage(response.data, `${params.method} ${params.path} failed.`),
                response.status,
                response.data,
            );
        }

        if (!response.data || typeof response.data !== 'object') {
            throw new Error(`${params.method} ${params.path} returned an invalid payload.`);
        }

        if (!response.data.success) {
            throw new HttpClientError(
                this.extractErrorMessage(response.data, `${params.method} ${params.path} failed.`),
                response.status,
                response.data,
            );
        }

        return response.data;
    }

    private normalizeRequestOptions(
        needAuthOrOptions: boolean | IHttpClientRequestOptions,
    ): IHttpClientRequestOptions {
        if (typeof needAuthOrOptions === 'boolean') {
            return {
                needAuth: needAuthOrOptions,
            };
        }

        return {
            needAuth: needAuthOrOptions?.needAuth ?? true,
            timeoutMs: needAuthOrOptions?.timeoutMs,
            baseUrl: needAuthOrOptions?.baseUrl,
            headers: needAuthOrOptions?.headers,
        };
    }

    private static buildHeaders(
        options: IHttpClientRequestOptions,
        token: string | null,
    ): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        };

        if ((options.needAuth ?? true) && token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    private static extractErrorMessage(payload: IApiEnvelope<unknown>, fallback: string): string {
        if (!payload) {
            return fallback;
        }

        if (payload.message) {
            return String(payload.message);
        }

        if (payload.error) {
            return String(payload.error);
        }

        return fallback;
    }
}
