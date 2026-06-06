import type { INetworkRuntimeConfig } from '../NetworkConfig';
import type {
    IApiEnvelope,
    IActionSubmitItemResult,
    IActionSubmitResponseData,
    IAuthMeData,
    IHealthData,
    IHttpRequestOptions,
    IHttpTransport,
    IHttpTransportResponse,
    ILoginResult,
    IQueuedAction,
} from '../protocol/Types';

interface IMockServerState {
    readonly tokens: Map<string, string>;
    readonly processedActions: Map<string, IActionSubmitItemResult>;
    readonly actionLog: IQueuedAction[];
}

const ALLOWED_ACTION_TYPES = new Set<string>([
    'debug_ping',
    'debug_add_gold',
]);

const mockServerState: IMockServerState = {
    tokens: new Map<string, string>(),
    processedActions: new Map<string, IActionSubmitItemResult>(),
    actionLog: [],
};

export class MockHttpTransport implements IHttpTransport {
    constructor(private readonly config: INetworkRuntimeConfig) {}

    public static resetServerState(): void {
        mockServerState.tokens.clear();
        mockServerState.processedActions.clear();
        mockServerState.actionLog.length = 0;
    }

    public static getServerSnapshot(): {
        tokenCount: number;
        processedActionCount: number;
        actionLog: IQueuedAction[];
    } {
        return {
            tokenCount: mockServerState.tokens.size,
            processedActionCount: mockServerState.processedActions.size,
            actionLog: mockServerState.actionLog.map((action) => ({
                ...action,
                payload: { ...action.payload },
            })),
        };
    }

    public async request<T = unknown>(
        options: IHttpRequestOptions,
    ): Promise<IHttpTransportResponse<T>> {
        await this.delay(this.config.mockLatencyMs);

        if (options.method === 'GET' && options.path === '/api/health') {
            return {
                status: 200,
                data: this.ok<IHealthData>({
                    message: 'ok',
                    time: new Date().toISOString(),
                }) as T,
            };
        }

        if (options.method === 'POST' && options.path === '/api/auth/dev-login') {
            const uid = this.normalizeDevUserId((options.body as Record<string, unknown> | undefined)?.devUserId);
            const token = this.makeToken(uid);
            mockServerState.tokens.set(token, uid);

            return {
                status: 200,
                data: this.ok<ILoginResult>({
                    uid,
                    token,
                }) as T,
            };
        }

        if (options.method === 'GET' && options.path === '/api/auth/me') {
            const auth = this.requireAuth(options.headers);
            if (!auth) {
                return {
                    status: 401,
                    data: this.fail('unauthorized', 'Missing or invalid token.') as T,
                };
            }

            return {
                status: 200,
                data: this.ok<IAuthMeData>({
                    uid: auth.uid,
                    openid: `mock_openid_${auth.uid}`,
                }) as T,
            };
        }

        if (options.method === 'POST' && options.path === '/api/actions/submit') {
            const auth = this.requireAuth(options.headers);
            if (!auth) {
                return {
                    status: 401,
                    data: this.fail('unauthorized', 'Missing or invalid token.') as T,
                };
            }

            const actions = Array.isArray((options.body as Record<string, unknown> | undefined)?.actions)
                ? ((options.body as Record<string, unknown>).actions as IQueuedAction[])
                : null;
            if (!actions) {
                return {
                    status: 400,
                    data: this.fail('invalid_actions', '`actions` must be an array.') as T,
                };
            }

            const accepted: IActionSubmitItemResult[] = [];
            const rejected: IActionSubmitItemResult[] = [];
            const duplicates: IActionSubmitItemResult[] = [];

            actions.forEach((action) => {
                const baseResult: IActionSubmitItemResult = {
                    actionId: String(action?.actionId ?? ''),
                    seqNo: Number(action?.seqNo ?? 0),
                    status: 'rejected',
                };

                if (!baseResult.actionId || !Number.isFinite(baseResult.seqNo)) {
                    rejected.push({
                        ...baseResult,
                        reason: 'invalid_action_identity',
                    });
                    return;
                }

                if (!ALLOWED_ACTION_TYPES.has(String(action?.actionType ?? ''))) {
                    rejected.push({
                        ...baseResult,
                        reason: 'unsupported_action_type',
                    });
                    return;
                }

                if (mockServerState.processedActions.has(baseResult.actionId)) {
                    duplicates.push({
                        ...baseResult,
                        status: 'duplicate',
                    });
                    return;
                }

                const acceptedItem: IActionSubmitItemResult = {
                    actionId: baseResult.actionId,
                    seqNo: baseResult.seqNo,
                    status: 'accepted',
                };

                mockServerState.processedActions.set(baseResult.actionId, acceptedItem);
                mockServerState.actionLog.push({
                    ...action,
                    payload: { ...(action.payload ?? {}) },
                });
                accepted.push(acceptedItem);
            });

            return {
                status: 200,
                data: this.ok<IActionSubmitResponseData>({
                    accepted,
                    rejected,
                    duplicates,
                    serverTime: Date.now(),
                }) as T,
            };
        }

        return {
            status: 404,
            data: this.fail('not_found', `Mock route not found: ${options.method} ${options.path}`) as T,
        };
    }

    private ok<T>(data: T): IApiEnvelope<T> {
        return {
            success: true,
            data,
        };
    }

    private fail(error: string, message: string): IApiEnvelope<never> {
        return {
            success: false,
            error,
            message,
        };
    }

    private makeToken(uid: string): string {
        return `mock-token-${uid}`;
    }

    private normalizeDevUserId(rawValue: unknown): string {
        const normalized = String(rawValue ?? '').trim();
        return normalized || 'test_user_001';
    }

    private requireAuth(
        headers: Record<string, string> | undefined,
    ): { token: string; uid: string } | null {
        const rawAuthorization = headers?.Authorization ?? headers?.authorization ?? '';
        if (!rawAuthorization.startsWith('Bearer ')) {
            return null;
        }

        const token = rawAuthorization.slice('Bearer '.length).trim();
        const uid = mockServerState.tokens.get(token);
        if (!uid) {
            return null;
        }

        return {
            token,
            uid,
        };
    }

    private async delay(ms: number): Promise<void> {
        if (!Number.isFinite(ms) || ms <= 0) {
            return;
        }

        await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), ms);
        });
    }
}

