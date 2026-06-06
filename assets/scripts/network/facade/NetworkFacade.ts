import { createNetworkConfig, type INetworkRuntimeConfig } from '../NetworkConfig';
import { AuthService } from '../auth/AuthService';
import { HttpClient } from '../http/HttpClient';
import { NativeHttpTransport } from '../http/NativeHttpTransport';
import { MockHttpTransport } from '../mock/MockHttpTransport';
import type {
    IActionSyncSummary,
    IAuthMeData,
    IAuthSnapshot,
    IHealthData,
    ILoginResult,
    IQueueSnapshot,
} from '../protocol/Types';
import { NetworkKV } from '../storage/NetworkKV';
import { ActionQueueService } from '../sync/ActionQueueService';

export class NetworkFacade {
    private static _instance: NetworkFacade | null = null;

    public static get instance(): NetworkFacade {
        if (!this._instance) {
            this._instance = new NetworkFacade();
        }
        return this._instance;
    }

    private config: INetworkRuntimeConfig = createNetworkConfig();
    private kv: NetworkKV = new NetworkKV(this.config.storageKeyPrefix);
    private httpClient: HttpClient = new HttpClient(this.config, new MockHttpTransport(this.config));
    private authService: AuthService = new AuthService(this.httpClient, this.kv);
    private actionQueueService: ActionQueueService = new ActionQueueService(
        this.httpClient,
        this.kv,
        () => this.authService.getSnapshot().uid,
        () => this.config,
    );

    private constructor() {
        this.rebuildServices();
        this.init();
    }

    public configure(overrides?: Partial<INetworkRuntimeConfig>): void {
        this.config = createNetworkConfig({
            ...this.config,
            ...overrides,
        });
        this.rebuildServices();
        this.init();
    }

    public init(): void {
        this.authService.restoreSession();
        this.actionQueueService.restore();
    }

    public getRuntimeConfig(): INetworkRuntimeConfig {
        return {
            ...this.config,
        };
    }

    public async healthCheck(): Promise<IHealthData> {
        const response = await this.httpClient.get<IHealthData>('/api/health', false);
        if (!response.data) {
            throw new Error('[NetworkFacade] Health response data is empty.');
        }
        return response.data;
    }

    public async devLogin(devUserId: string): Promise<ILoginResult> {
        return this.authService.devLogin(devUserId);
    }

    public async getMe(): Promise<IAuthMeData> {
        return this.authService.getMe();
    }

    public enqueueAction(
        actionType: string,
        payload: Record<string, unknown>,
    ) {
        return this.actionQueueService.enqueue(actionType, payload);
    }

    public async syncPendingActions(): Promise<IActionSyncSummary> {
        return this.actionQueueService.submitPending();
    }

    public getAuthSnapshot(): IAuthSnapshot {
        return this.authService.getSnapshot();
    }

    public getQueueSnapshot(): IQueueSnapshot {
        return this.actionQueueService.getSnapshot();
    }

    public clearLocalState(): void {
        this.authService.clearAuth();
        this.actionQueueService.clearQueue();
    }

    public resetMockServerState(): void {
        MockHttpTransport.resetServerState();
    }

    public getMockServerSnapshot(): ReturnType<typeof MockHttpTransport.getServerSnapshot> {
        return MockHttpTransport.getServerSnapshot();
    }

    private rebuildServices(): void {
        this.kv = new NetworkKV(this.config.storageKeyPrefix);
        const transport = this.config.useMockTransport
            ? new MockHttpTransport(this.config)
            : new NativeHttpTransport();
        this.httpClient = new HttpClient(this.config, transport);
        this.authService = new AuthService(this.httpClient, this.kv);
        this.actionQueueService = new ActionQueueService(
            this.httpClient,
            this.kv,
            () => this.authService.getSnapshot().uid,
            () => this.config,
        );
    }
}

