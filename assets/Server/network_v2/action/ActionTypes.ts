export enum ActionType {
    BUY_ITEM = 'buy_item',
    SELL_ITEM = 'sell_item',
    SPEND_CURRENCY = 'spend_currency',
    GAIN_REWARD = 'gain_reward',
    LEVEL_COMPLETE = 'level_complete',
    EQUIP_ITEM = 'equip_item',
    DEBUG_PING = 'debug_ping',
}

export interface INetAction {
    actionId: string;
    seqNo: number;
    actionType: ActionType | string;
    payload: Record<string, unknown>;
    clientTime: number;
    clientVersion: string;
    protocolVersion: number;
}
