import type { INetAction } from '../action/ActionTypes';
import type { IServerSnapshot } from '../state/SnapshotManager';

export interface ISyncRequest {
    actions: INetAction[];
}

export interface ISyncRejectItem {
    actionId: string;
    reason?: string;
}

export interface ISyncResponse {
    acceptedIds: string[];
    rejected?: ISyncRejectItem[];
    snapshot?: IServerSnapshot;
    message?: string;
}
