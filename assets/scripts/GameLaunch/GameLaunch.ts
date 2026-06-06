import { _decorator, Component } from 'cc';
import { GameFacade } from '../app/GameFacade';
import { ConfigManager } from '../config/ConfigManager';
import { StartupPerfTracker } from '../tools/StartupPerfTracker';
import { UIManager } from '../X/ui/UIManager';
import '../remote/RemoteSceneLoader';
import '../remote/config-Button/SmartTransitionButton';

const { ccclass } = _decorator;

@ccclass('GameLaunch')
export class GameLaunch extends Component {
    protected async start(): Promise<void> {
        try {
            StartupPerfTracker.mark('launch_start');

            if (GameFacade.instance.hasAnySave()) {
                const loaded = GameFacade.instance.loadGame();
                console.log(`[GameLaunch] runtime save ${loaded ? 'loaded' : 'load failed'}.`);
            } else {
                console.log('[GameLaunch] no local save found, treating this as first launch.');
            }

            const configTask = ConfigManager.initConfig();
            const uiRootTask = UIManager.instance.initUIRoot('ui/UIRoot');

            await uiRootTask;
            StartupPerfTracker.mark('ui_root_ready');

            await StartupPerfTracker.waitForNextFrame();
            StartupPerfTracker.mark('first_frame_ready');

            await configTask;
            StartupPerfTracker.mark('config_ready');
        } catch (error) {
            console.error('[GameLaunch] startup failed:', error);
        }
    }
}
