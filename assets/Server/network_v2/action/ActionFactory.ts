import type { ActionType, INetAction } from './ActionTypes';

export interface IActionFactoryOptions {
    getNextSeqNo: () => number;
    getClientVersion: () => string;
    getProtocolVersion: () => number;
    getPlayerId?: () => string | null;
}

export class ActionFactory {
    private readonly getNextSeqNo: () => number;
    private readonly getClientVersion: () => string;
    private readonly getProtocolVersion: () => number;
    private readonly getPlayerId?: () => string | null;

    constructor(options: IActionFactoryOptions) {
        this.getNextSeqNo = options.getNextSeqNo;
        this.getClientVersion = options.getClientVersion;
        this.getProtocolVersion = options.getProtocolVersion;
        this.getPlayerId = options.getPlayerId;
    }

    public create(
        actionType: ActionType | string,
        payload: Record<string, unknown>,
    ): INetAction {
        const seqNo = this.getNextSeqNo();
        const playerId = this.getPlayerId?.()?.trim() || 'anonymous';
        const clientTime = Date.now();

        return {
            actionId: `${playerId}-${seqNo}-${this.createIdSuffix()}`,
            seqNo,
            actionType,
            payload: { ...payload },
            clientTime,
            clientVersion: this.getClientVersion(),
            protocolVersion: this.getProtocolVersion(),
        };
    }

    private createIdSuffix(): string {
        const random = Math.floor(Math.random() * 1_000_000);
        return `${Date.now()}-${random}`;
    }
}
