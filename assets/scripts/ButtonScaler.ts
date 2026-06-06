import { _decorator, Component, Vec3, Button, tween, EventTouch, Input} from "cc";
const { ccclass, property } = _decorator;

@ccclass
export class ButtonScaler extends Component {
    @property
    public scaleTo = new Vec3(1.2, 1.2, 1.2);
    @property
    public transDuration = 0.2;

    public initScale = new Vec3();
    public button: Button | null = null;

    // use this for initialization
    onLoad() {
        this.initScale = this.node.scale.clone();
        this.button = this.getComponent(Button);

        const tweenDown = tween(this.node).to(
            this.transDuration,
            { scale: this.scaleTo },
            { easing: 'cubicInOut' },
        );
        const tweenUp = tween(this.node).to(
            this.transDuration,
            { scale: this.initScale },
            { easing: 'cubicInOut' },
        );

        const onTouchDown = (event: EventTouch) => {
            tweenUp.stop();
            tweenDown.start();
        };
        const onTouchUp = (event: EventTouch) => {
            tweenDown.stop();
            tweenUp.start();
        };

        this.node.on(Input.EventType.TOUCH_START, onTouchDown, this);
        this.node.on(Input.EventType.TOUCH_END, onTouchUp, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, onTouchUp, this);
    }
}
