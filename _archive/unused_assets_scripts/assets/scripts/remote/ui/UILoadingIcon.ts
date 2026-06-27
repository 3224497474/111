import { _decorator, Component, tween, Tween, Vec3 } from 'cc';

const { ccclass } = _decorator;

/**
 * 加载图标呼吸动画。
 * 节点激活时自动播放，隐藏时自动停止并重置状态。
 */
@ccclass('UILoadingIcon')
export class UILoadingIcon extends Component {
    onEnable(): void {
        Tween.stopAllByTarget(this.node);
        this.node.setScale(1, 1, 1);

        tween(this.node)
            .to(0.6, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'sineInOut' })
            .to(0.6, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    onDisable(): void {
        Tween.stopAllByTarget(this.node);
        this.node.setScale(new Vec3(1, 1, 1));
    }
}
