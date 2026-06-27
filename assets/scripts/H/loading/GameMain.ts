import { _decorator } from 'cc';
import { HMain } from './HMain';
// import { H } from '../H';
// import { ProjectVMTag, BagVMPath } from './ProjectVMTypes';

const { ccclass } = _decorator;

/**
 * 项目侧推荐继承 HMain，而不是直接改 HMain。
 */
@ccclass('GameMain')
export class GameMain extends HMain {
    protected setupSystemComponents(): void {
        super.setupSystemComponents();

        // 例：
        // H.audio.init(this.musicAudioSource);
        // H.time.init();
    }

    protected async initUserData(): Promise<void> {
        // 例：
        // H.vm.add({ coin: 0, level: 1 }, ProjectVMTag.User);
        // H.vm.add({ items: [], viewItems: [] }, ProjectVMTag.Bag);
        //
        // await UserService.loadLocal();
        // await UserService.fetchServerData();
    }

    protected async beforeEnterGame(): Promise<void> {
        // 这里可以做项目进入游戏前的准备。
        // 首屏 UI 建议配在 HLoading 的 Startup UIs 中，不要在这里手动 instantiate。
    }
}
