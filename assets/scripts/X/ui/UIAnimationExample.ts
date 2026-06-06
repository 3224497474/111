import { _decorator, Component, Node } from 'cc';
import { UIAnimation } from './UIAnimation';

const { ccclass, property } = _decorator;

@ccclass('AnimationExample')
export class AnimationExample extends Component {
    @property(Node)
    targetNode: Node = null!;

    onScaleIn() {
        UIAnimation.scaleIn(this.targetNode, { duration: 0.35 });
    }

    onSlideFromBottom() {
        UIAnimation.slideInFromBottom(this.targetNode, 100, { duration: 0.35 });
    }

    onPulse() {
        UIAnimation.pulse(this.targetNode, 1.1, { duration: 0.3 });
    }

    onShake() {
        UIAnimation.shake(this.targetNode, 10, 3, { duration: 0.4 });
    }

    onBounce() {
        UIAnimation.bounce(this.targetNode, 20, 3, { duration: 0.5 });
    }

    onRotateIn() {
        UIAnimation.rotateIn(this.targetNode, 360, { duration: 0.5 });
    }

    onBreathe() {
        UIAnimation.breathe(this.targetNode, 0.05, { duration: 1.5 });
    }

    onStopBreathe() {
        UIAnimation.stopBreathe(this.targetNode);
    }
}
