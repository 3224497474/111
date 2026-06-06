import {
    _decorator,
    Component,
} from 'cc';
import { GameFacade } from './app/GameFacade';
import { RuntimePerfOverlay } from './tools/RuntimePerfOverlay';
import { StartupPerfTracker } from './tools/StartupPerfTracker';

const { ccclass } = _decorator;

@ccclass('HomeScene')
export class HomeScene extends Component {
    protected async start(): Promise<void> {
        console.log('[HomeScene] start');

        const homeUI = await GameFacade.instance.bootstrapHomeScene();
        if (!homeUI) {
            console.error('[HomeScene] 未找到已加载的 Home 面板节点');
            return;
        }

        StartupPerfTracker.mark('home_panel_ready');
        await StartupPerfTracker.waitForNextFrame();
        StartupPerfTracker.mark('home_first_frame_ready');

        if (RuntimePerfOverlay.isEnabled()) {
            RuntimePerfOverlay.ensureMounted(this.node);
        }

        StartupPerfTracker.mark('interactive_ready', {
            sceneName: 'HomeScene',
        });
        StartupPerfTracker.flush();
        console.log('[HomeScene] Home 主界面初始化完成');
    }
}

