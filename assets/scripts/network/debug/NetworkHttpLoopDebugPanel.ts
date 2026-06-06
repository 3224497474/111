import {
    _decorator,
    Button,
    Component,
    EditBox,
    Label,
} from 'cc';
import { NetworkFacade } from '../facade/NetworkFacade';

const { ccclass, property } = _decorator;

@ccclass('NetworkHttpLoopDebugPanel')
export class NetworkHttpLoopDebugPanel extends Component {
    @property
    public useMockTransport = true;

    @property
    public baseUrl = 'http://127.0.0.1:8080';

    @property
    public clientVersion = '0.1.0-dev';

    @property(EditBox)
    public devUserIdInput: EditBox | null = null;

    @property(EditBox)
    public actionTypeInput: EditBox | null = null;

    @property(EditBox)
    public payloadJsonInput: EditBox | null = null;

    @property(Button)
    public healthButton: Button | null = null;

    @property(Button)
    public devLoginButton: Button | null = null;

    @property(Button)
    public authMeButton: Button | null = null;

    @property(Button)
    public addActionButton: Button | null = null;

    @property(Button)
    public syncQueueButton: Button | null = null;

    @property(Button)
    public clearLocalButton: Button | null = null;

    @property(Button)
    public resetMockServerButton: Button | null = null;

    @property(Label)
    public runtimeLabel: Label | null = null;

    @property(Label)
    public authLabel: Label | null = null;

    @property(Label)
    public queueLabel: Label | null = null;

    @property(Label)
    public serverLabel: Label | null = null;

    @property(Label)
    public logLabel: Label | null = null;

    private readonly facade = NetworkFacade.instance;
    private readonly logs: string[] = [];

    protected onLoad(): void {
        this.facade.configure({
            useMockTransport: this.useMockTransport,
            baseUrl: this.baseUrl.trim(),
            clientVersion: this.clientVersion.trim() || '0.1.0-dev',
        });

        this.bindButton(this.healthButton, this.onClickHealth);
        this.bindButton(this.devLoginButton, this.onClickDevLogin);
        this.bindButton(this.authMeButton, this.onClickAuthMe);
        this.bindButton(this.addActionButton, this.onClickAddAction);
        this.bindButton(this.syncQueueButton, this.onClickSyncQueue);
        this.bindButton(this.clearLocalButton, this.onClickClearLocal);
        this.bindButton(this.resetMockServerButton, this.onClickResetMockServer);

        if (this.devUserIdInput && !this.devUserIdInput.string) {
            this.devUserIdInput.string = 'test_user_001';
        }
        if (this.actionTypeInput && !this.actionTypeInput.string) {
            this.actionTypeInput.string = 'debug_ping';
        }
        if (this.payloadJsonInput && !this.payloadJsonInput.string) {
            this.payloadJsonInput.string = '{"value":1}';
        }

        this.appendLog('Network debug panel ready.');
        this.refreshView();
    }

    protected onDestroy(): void {
        this.unbindButton(this.healthButton, this.onClickHealth);
        this.unbindButton(this.devLoginButton, this.onClickDevLogin);
        this.unbindButton(this.authMeButton, this.onClickAuthMe);
        this.unbindButton(this.addActionButton, this.onClickAddAction);
        this.unbindButton(this.syncQueueButton, this.onClickSyncQueue);
        this.unbindButton(this.clearLocalButton, this.onClickClearLocal);
        this.unbindButton(this.resetMockServerButton, this.onClickResetMockServer);
    }

    public async onClickHealth(): Promise<void> {
        try {
            const result = await this.facade.healthCheck();
            this.appendLog(`Health OK: ${JSON.stringify(result)}`);
        } catch (error) {
            this.appendLog(`Health failed: ${this.stringifyError(error)}`);
        } finally {
            this.refreshView();
        }
    }

    public async onClickDevLogin(): Promise<void> {
        try {
            const userId = this.devUserIdInput?.string?.trim() || 'test_user_001';
            const result = await this.facade.devLogin(userId);
            this.appendLog(`DevLogin OK: ${JSON.stringify(result)}`);
        } catch (error) {
            this.appendLog(`DevLogin failed: ${this.stringifyError(error)}`);
        } finally {
            this.refreshView();
        }
    }

    public async onClickAuthMe(): Promise<void> {
        try {
            const result = await this.facade.getMe();
            this.appendLog(`AuthMe OK: ${JSON.stringify(result)}`);
        } catch (error) {
            this.appendLog(`AuthMe failed: ${this.stringifyError(error)}`);
        } finally {
            this.refreshView();
        }
    }

    public onClickAddAction(): void {
        try {
            const actionType = this.actionTypeInput?.string?.trim() || 'debug_ping';
            const payload = this.parsePayloadJson(this.payloadJsonInput?.string ?? '');
            const action = this.facade.enqueueAction(actionType, payload);
            this.appendLog(`Enqueue OK: ${JSON.stringify(action)}`);
        } catch (error) {
            this.appendLog(`Enqueue failed: ${this.stringifyError(error)}`);
        } finally {
            this.refreshView();
        }
    }

    public async onClickSyncQueue(): Promise<void> {
        try {
            const result = await this.facade.syncPendingActions();
            this.appendLog(`SyncQueue OK: ${JSON.stringify(result)}`);
        } catch (error) {
            this.appendLog(`SyncQueue failed: ${this.stringifyError(error)}`);
        } finally {
            this.refreshView();
        }
    }

    public onClickClearLocal(): void {
        this.facade.clearLocalState();
        this.appendLog('Local auth and queue cleared.');
        this.refreshView();
    }

    public onClickResetMockServer(): void {
        this.facade.resetMockServerState();
        this.appendLog('Mock server state cleared.');
        this.refreshView();
    }

    private refreshView(): void {
        if (this.runtimeLabel) {
            this.runtimeLabel.string = this.prettyStringify(this.facade.getRuntimeConfig());
        }
        if (this.authLabel) {
            this.authLabel.string = this.prettyStringify(this.facade.getAuthSnapshot());
        }
        if (this.queueLabel) {
            this.queueLabel.string = this.prettyStringify(this.facade.getQueueSnapshot());
        }
        if (this.serverLabel) {
            this.serverLabel.string = this.facade.getRuntimeConfig().useMockTransport
                ? this.prettyStringify(this.facade.getMockServerSnapshot())
                : 'Real HTTP mode: mock server snapshot unavailable.';
        }
        if (this.logLabel) {
            this.logLabel.string = this.logs.join('\n');
        }
    }

    private parsePayloadJson(rawJson: string): Record<string, unknown> {
        const normalized = rawJson.trim();
        if (!normalized) {
            return {};
        }

        const parsed = JSON.parse(normalized) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Payload JSON must be an object.');
        }

        return { ...(parsed as Record<string, unknown>) };
    }

    private appendLog(message: string): void {
        const timestamp = new Date().toISOString().slice(11, 19);
        this.logs.unshift(`[${timestamp}] ${message}`);
        if (this.logs.length > 14) {
            this.logs.length = 14;
        }
    }

    private prettyStringify(value: unknown): string {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }

    private stringifyError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    private bindButton(
        button: Button | null,
        handler: () => void | Promise<void>,
    ): void {
        button?.node.on(Button.EventType.CLICK, handler, this);
    }

    private unbindButton(
        button: Button | null,
        handler: () => void | Promise<void>,
    ): void {
        button?.node.off(Button.EventType.CLICK, handler, this);
    }
}
