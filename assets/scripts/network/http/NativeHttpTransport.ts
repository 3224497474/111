import type { IHttpRequestOptions, IHttpTransport, IHttpTransportResponse } from '../protocol/Types';

export class NativeHttpTransport implements IHttpTransport {
    public async request<T = unknown>(
        options: IHttpRequestOptions,
    ): Promise<IHttpTransportResponse<T>> {
        if (typeof fetch === 'function') {
            return this.requestByFetch<T>(options);
        }

        return this.requestByXhr<T>(options);
    }

    private async requestByFetch<T = unknown>(
        options: IHttpRequestOptions,
    ): Promise<IHttpTransportResponse<T>> {
        const controller = typeof AbortController === 'function'
            ? new AbortController()
            : null;
        const timeoutMs = options.timeoutMs ?? 0;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        if (controller && timeoutMs > 0) {
            timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        }

        try {
            const response = await fetch(this.makeUrl(options), {
                method: options.method,
                headers: options.headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                signal: controller?.signal,
            });

            const rawText = await response.text();
            return {
                status: response.status,
                data: this.parsePayload(rawText) as T,
            };
        } finally {
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private async requestByXhr<T = unknown>(
        options: IHttpRequestOptions,
    ): Promise<IHttpTransportResponse<T>> {
        return await new Promise<IHttpTransportResponse<T>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(options.method, this.makeUrl(options), true);
            xhr.timeout = options.timeoutMs ?? 0;

            Object.entries(options.headers ?? {}).forEach(([key, value]) => {
                xhr.setRequestHeader(key, value);
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }

                resolve({
                    status: xhr.status,
                    data: this.parsePayload(xhr.responseText) as T,
                });
            };

            xhr.onerror = () => {
                reject(new Error(`Network request failed: ${options.method} ${options.path}`));
            };

            xhr.ontimeout = () => {
                reject(new Error(`Network request timeout: ${options.method} ${options.path}`));
            };

            xhr.send(options.body === undefined ? null : JSON.stringify(options.body));
        });
    }

    private makeUrl(options: IHttpRequestOptions): string {
        const baseUrl = (options.baseUrl ?? '').trim();
        if (!baseUrl) {
            return options.path;
        }

        if (/^https?:\/\//i.test(options.path)) {
            return options.path;
        }

        const normalizedBaseUrl = baseUrl.endsWith('/')
            ? baseUrl.slice(0, -1)
            : baseUrl;
        const normalizedPath = options.path.startsWith('/')
            ? options.path
            : `/${options.path}`;
        return `${normalizedBaseUrl}${normalizedPath}`;
    }

    private parsePayload(payload: string): unknown {
        if (!payload) {
            return {};
        }

        try {
            return JSON.parse(payload);
        } catch {
            return {
                message: payload,
            };
        }
    }
}

