export interface INetworkRuntimeConfig {
    baseUrl: string;
    timeoutMs: number;
    protocolVersion: number;
    clientVersion: string;
    useMockTransport: boolean;
    mockLatencyMs: number;
    storageKeyPrefix: string;
}

const DEFAULT_NETWORK_CONFIG: INetworkRuntimeConfig = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 10000,
    protocolVersion: 1,
    clientVersion: '0.1.0-dev',
    useMockTransport: true,
    mockLatencyMs: 120,
    storageKeyPrefix: 'network_debug_',
};

export function createNetworkConfig(
    overrides?: Partial<INetworkRuntimeConfig>,
): INetworkRuntimeConfig {
    return {
        ...DEFAULT_NETWORK_CONFIG,
        ...overrides,
    };
}

