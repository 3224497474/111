import type { ITransport, ITransportPostOptions, ITransportResponse } from './ITransport';

export interface IHttpAdapterOptions {
    baseUrl: string;
    timeoutMs?: number;
}

export class HttpAdapter implements ITransport {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private authToken: string | null = null;

    constructor(options: IHttpAdapterOptions) {
        this.baseUrl = options.baseUrl.trim().replace(/\/$/, '');
        this.timeoutMs = Math.max(1000, options.timeoutMs ?? 10000);
    }

    public setToken(token: string | null): void {
        this.authToken = token?.trim() || null;
    }

    public async post<T = unknown>(
        url: string,
        data?: unknown,
        options: ITransportPostOptions = {},
    ): Promise<ITransportResponse<T>> {
        const targetUrl = this.resolveUrl(url);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }

        if (typeof fetch === 'function') {
            return this.postWithFetch<T>(targetUrl, data, headers, options.timeoutMs ?? this.timeoutMs);
        }

        return this.postWithXhr<T>(targetUrl, data, headers, options.timeoutMs ?? this.timeoutMs);
    }

    private async postWithFetch<T>(
        targetUrl: string,
        data: unknown,
        headers: Record<string, string>,
        timeoutMs: number,
    ): Promise<ITransportResponse<T>> {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;

        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: data === undefined ? undefined : JSON.stringify(data),
                signal: controller?.signal,
            });

            const responseData = await response.json() as T;
            return {
                status: response.status,
                ok: response.ok,
                data: responseData,
            };
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        }
    }

    private postWithXhr<T>(
        targetUrl: string,
        data: unknown,
        headers: Record<string, string>,
        timeoutMs: number,
    ): Promise<ITransportResponse<T>> {
        return new Promise<ITransportResponse<T>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', targetUrl, true);
            xhr.timeout = timeoutMs;

            Object.entries(headers).forEach(([key, value]) => {
                xhr.setRequestHeader(key, value);
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== XMLHttpRequest.DONE) {
                    return;
                }

                const rawText = xhr.responseText || 'null';
                try {
                    const responseData = JSON.parse(rawText) as T;
                    resolve({
                        status: xhr.status,
                        ok: xhr.status >= 200 && xhr.status < 300,
                        data: responseData,
                    });
                } catch (error) {
                    reject(error);
                }
            };

            xhr.onerror = () => reject(new Error('[HttpAdapter] Request failed.'));
            xhr.ontimeout = () => reject(new Error('[HttpAdapter] Request timeout.'));
            xhr.send(data === undefined ? undefined : JSON.stringify(data));
        });
    }

    private resolveUrl(url: string): string {
        if (/^https?:\/\//i.test(url)) {
            return url;
        }

        return `${this.baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
    }
}
