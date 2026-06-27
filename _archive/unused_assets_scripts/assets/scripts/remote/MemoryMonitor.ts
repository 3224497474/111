import {
    _decorator,
    assetManager,
    Component,
    director,
    game,
    Node,
} from 'cc';
import { BYTEDANCE, WECHAT } from 'cc/env';
import { Notifications } from '../X/client/Script/easyFramework/mgr/notifications';

const { ccclass } = _decorator;

const ROOT_NAME = 'MemoryMonitorRoot';
export const EVENT_MEMORY_WARNING = 'Event_Memory_Warning';

type MemoryWarningPayload = {
    level?: number;
    source: 'wx' | 'tt' | 'unknown';
    timestamp: number;
};

type MiniGameApiCallback = (res?: { level?: number }) => void;

interface IMiniGameApi {
    onMemoryWarning?: (callback: MiniGameApiCallback) => void;
    offMemoryWarning?: (callback: MiniGameApiCallback) => void;
}

@ccclass('MemoryMonitor')
export class MemoryMonitor extends Component {
    private static _instance: MemoryMonitor | null = null;

    private _memoryWarningHandler: MiniGameApiCallback | null = null;

    public static get instance(): MemoryMonitor | null {
        return this._instance;
    }

    public static ensureMounted(_host?: Node | null): MemoryMonitor | null {
        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        let root = scene.getChildByName(ROOT_NAME);
        if (!root) {
            root = new Node(ROOT_NAME);
            scene.addChild(root);
            game.addPersistRootNode(root);
        }

        let monitor = root.getComponent(MemoryMonitor);
        if (!monitor) {
            monitor = root.addComponent(MemoryMonitor);
        }

        return monitor;
    }

    protected onLoad(): void {
        if (MemoryMonitor._instance && MemoryMonitor._instance !== this) {
            this.node.destroy();
            return;
        }

        MemoryMonitor._instance = this;
        this.registerMemoryWarning();
    }

    protected onDestroy(): void {
        this.unregisterMemoryWarning();

        if (MemoryMonitor._instance === this) {
            MemoryMonitor._instance = null;
        }
    }

    private registerMemoryWarning(): void {
        const platformApi = this.getPlatformApi();
        if (!platformApi?.onMemoryWarning || this._memoryWarningHandler) {
            return;
        }

        this._memoryWarningHandler = (res?: { level?: number }) => {
            this.handleMemoryWarning(res);
        };

        platformApi.onMemoryWarning(this._memoryWarningHandler);
        console.log('[MemoryMonitor] Registered platform memory warning listener');
    }

    private unregisterMemoryWarning(): void {
        const platformApi = this.getPlatformApi();
        if (!platformApi?.offMemoryWarning || !this._memoryWarningHandler) {
            this._memoryWarningHandler = null;
            return;
        }

        platformApi.offMemoryWarning(this._memoryWarningHandler);
        this._memoryWarningHandler = null;
    }

    private handleMemoryWarning(res?: { level?: number }): void {
        const payload: MemoryWarningPayload = {
            level: res?.level,
            source: BYTEDANCE ? 'tt' : (WECHAT ? 'wx' : 'unknown'),
            timestamp: Date.now(),
        };

        console.error('[MemoryMonitor] High memory warning received', payload);

        try {
            const releaser = (assetManager as typeof assetManager & {
                releaseUnusedAssets?: () => void;
            }).releaseUnusedAssets;

            if (typeof releaser === 'function') {
                releaser.call(assetManager);
            } else {
                console.warn('[MemoryMonitor] assetManager.releaseUnusedAssets is unavailable');
            }
        } catch (error) {
            console.error('[MemoryMonitor] releaseUnusedAssets failed', error);
        }

        Notifications.emit(EVENT_MEMORY_WARNING, payload);
        director.emit(EVENT_MEMORY_WARNING, payload);
    }

    private getPlatformApi(): IMiniGameApi | null {
        const globalApi = globalThis as typeof globalThis & {
            wx?: IMiniGameApi;
            tt?: IMiniGameApi;
        };

        if (BYTEDANCE && globalApi.tt) {
            return globalApi.tt;
        }
        if (WECHAT && globalApi.wx) {
            return globalApi.wx;
        }

        return null;
    }
}
