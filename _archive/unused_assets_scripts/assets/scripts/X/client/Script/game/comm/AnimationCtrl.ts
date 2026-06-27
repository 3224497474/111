import { _decorator, Component, sp } from "cc";

const { ccclass } = _decorator;

@ccclass("AnimationCtrl")
export class AnimationCtrl extends Component {
    get skeleton(): sp.Skeleton | null {
        return this.getComponent(sp.Skeleton);
    }

    play(name: string, loop = false) {
        this.skeleton?.setAnimation(0, name, loop);
    }

    stop() {
        this.skeleton?.clearTrack(0);
    }
}
