import { HttpClient } from '../http/HttpClient';
import type { IApiEnvelope, IAuthMeData, IAuthSnapshot, ILoginResult } from '../protocol/Types';
import { NetworkKV } from '../storage/NetworkKV';

const AUTH_UID_KEY = 'auth_uid';
const AUTH_TOKEN_KEY = 'auth_token';

export class AuthService {
    private snapshot: IAuthSnapshot = {
        uid: null,
        token: null,
    };

    constructor(
        private readonly httpClient: HttpClient,
        private readonly kv: NetworkKV,
    ) {}

    public restoreSession(): IAuthSnapshot {
        const uid = this.kv.getString(AUTH_UID_KEY);
        const token = this.kv.getString(AUTH_TOKEN_KEY);
        this.snapshot = {
            uid: uid?.trim() || null,
            token: token?.trim() || null,
        };
        this.httpClient.setToken(this.snapshot.token);
        return this.getSnapshot();
    }

    public async devLogin(devUserId: string): Promise<ILoginResult> {
        const response = await this.httpClient.post<ILoginResult>('/api/auth/dev-login', {
            devUserId: devUserId.trim(),
        }, false);
        const data = this.requireData(response, 'devLogin');

        this.snapshot = {
            uid: data.uid,
            token: data.token,
        };

        this.httpClient.setToken(data.token);
        this.persistSnapshot();
        return data;
    }

    public async getMe(): Promise<IAuthMeData> {
        const response = await this.httpClient.get<IAuthMeData>('/api/auth/me', true);
        const data = this.requireData(response, 'getMe');

        if (data.uid && this.snapshot.uid !== data.uid) {
            this.snapshot = {
                ...this.snapshot,
                uid: data.uid,
            };
            this.persistSnapshot();
        }

        return data;
    }

    public getSnapshot(): IAuthSnapshot {
        return {
            uid: this.snapshot.uid,
            token: this.snapshot.token,
        };
    }

    public clearAuth(): void {
        this.snapshot = {
            uid: null,
            token: null,
        };
        this.httpClient.setToken(null);
        this.kv.remove(AUTH_UID_KEY);
        this.kv.remove(AUTH_TOKEN_KEY);
    }

    private persistSnapshot(): void {
        if (this.snapshot.uid) {
            this.kv.setString(AUTH_UID_KEY, this.snapshot.uid);
        } else {
            this.kv.remove(AUTH_UID_KEY);
        }

        if (this.snapshot.token) {
            this.kv.setString(AUTH_TOKEN_KEY, this.snapshot.token);
        } else {
            this.kv.remove(AUTH_TOKEN_KEY);
        }
    }

    private requireData<T>(response: IApiEnvelope<T>, context: string): T {
        if (response.data === undefined || response.data === null) {
            throw new Error(`[AuthService] ${context} returned an empty data payload.`);
        }

        return response.data;
    }
}

