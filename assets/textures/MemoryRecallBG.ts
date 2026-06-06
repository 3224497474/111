import { _decorator, Component, Sprite, Material } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MemoryRecallBG')
export class MemoryRecallBG extends Component {
    @property(Sprite)
    sprite: Sprite | null = null;

    private _material: Material | null = null;

    start () {
        if (!this.sprite) {
            this.sprite = this.getComponent(Sprite);
        }
        if (!this.sprite) {
            return;
        }

        // 如果后面还想做别的属性控制，可以保留这个材质实例
        this._material = this.sprite.getMaterialInstance(0);
    }

    update (dt: number) {
        // 这里不需要再 setProperty('time', ...)
        // 动画全部在 shader 里用 cc_time.x 驱动
    }
}
