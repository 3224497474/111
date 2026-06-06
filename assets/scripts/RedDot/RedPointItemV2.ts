import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    UIOpacity,
    tween,
    Vec3,
    SpriteFrame,
    resources,
    Enum,
} from 'cc';
import { RedPointMgr } from './RedPointManagerV2';
import { RedPointKey } from './RedPointKeys';
import {
    RedPointAnimation,
    RedPointType,
    AggregateRule,
    PersistType,
    ResetRule,
    type IRedPointState,
    type RedPointCallback,
} from './RedPointTypes';

const { ccclass, property } = _decorator;

export enum RedPointDisplayType {
    Simple = 0,
    Number = 1,
    Breath = 2,
    Blink = 3,
    Pulse = 4,
    Bounce = 5,
    Icon = 6,
}

Enum(RedPointDisplayType);

@ccclass('RedPointItemV2')
export class RedPointItemV2 extends Component {
    @property({ type: String })
    public key: RedPointKey = RedPointKey.Root;

    @property({ type: String })
    public parentKey: RedPointKey = RedPointKey.Root;

    @property({ type: RedPointDisplayType })
    public displayType: RedPointDisplayType = RedPointDisplayType.Simple;

    @property({ type: Label })
    public countLabel: Label | null = null;

    @property
    public maxValue = 99;

    @property({
        slide: true,
        min: 0.1,
        max: 3,
        step: 0.1,
    })
    public animationSpeed = 1.0;

    @property({
        slide: true,
        min: 0.5,
        max: 1,
        step: 0.05,
    })
    public minScale = 0.8;

    @property({
        slide: true,
        min: 1,
        max: 1.5,
        step: 0.05,
    })
    public maxScale = 1.2;

    @property({ type: Sprite })
    public iconSprite: Sprite | null = null;

    @property
    public iconPath = '';

    @property
    public persistLocal = false;

    @property({ type: String })
    public resetRule: ResetRule = ResetRule.Never;

    private _boundCallback: RedPointCallback | null = null;
    private _currentTween: ReturnType<typeof tween> | null = null;
    private _opacity: UIOpacity | null = null;
    private _loadedSpriteFrame: SpriteFrame | null = null;
    private _originalY = 0;
    private _originalScale = new Vec3(1, 1, 1);
    private _isAnimating = false;
    private _currentVisible = false;

    onLoad(): void {
        this.registerConfig();
        this._originalY = this.node.position.y;
        this._originalScale.set(this.node.scale);
    }

    onEnable(): void {
        const keyStr = this.key as string;
        if (!keyStr || keyStr === RedPointKey.Root) {
            console.warn('[RedPointItemV2] key not configured');
            return;
        }

        const node = this.getDisplayNode();
        this._opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        this._boundCallback = (state: IRedPointState) => {
            this.onStateChanged(state);
        };

        RedPointMgr.register(keyStr, this._boundCallback);
    }

    onDisable(): void {
        this.stopAnimation();

        const keyStr = this.key as string;
        if (this._boundCallback && keyStr && keyStr !== RedPointKey.Root) {
            RedPointMgr.unregister(keyStr, this._boundCallback);
        }
        this._boundCallback = null;
    }

    onDestroy(): void {
        this.stopAnimation();
        this.releaseLoadedSpriteFrame();
    }

    private registerConfig(): void {
        const keyStr = this.key as string;
        if (!keyStr || keyStr === RedPointKey.Root) {
            return;
        }

        let redPointType = RedPointType.Boolean;
        let animation = RedPointAnimation.None;

        switch (this.displayType) {
            case RedPointDisplayType.Simple:
                redPointType = RedPointType.Boolean;
                break;
            case RedPointDisplayType.Number:
                redPointType = RedPointType.Number;
                break;
            case RedPointDisplayType.Breath:
                redPointType = RedPointType.Animation;
                animation = RedPointAnimation.Breath;
                break;
            case RedPointDisplayType.Blink:
                redPointType = RedPointType.Animation;
                animation = RedPointAnimation.Blink;
                break;
            case RedPointDisplayType.Pulse:
                redPointType = RedPointType.Animation;
                animation = RedPointAnimation.Pulse;
                break;
            case RedPointDisplayType.Bounce:
                redPointType = RedPointType.Animation;
                animation = RedPointAnimation.Bounce;
                break;
            case RedPointDisplayType.Icon:
                redPointType = RedPointType.Icon;
                break;
        }

        const parentKeyStr = this.parentKey as string;
        RedPointMgr.registerConfig({
            id: keyStr,
            type: redPointType,
            parentId: parentKeyStr !== RedPointKey.Root ? parentKeyStr : undefined,
            maxValue: this.maxValue,
            animation,
            iconPath: this.iconPath || undefined,
            persistType: this.persistLocal ? PersistType.Local : PersistType.None,
            resetRule: this.resetRule,
            aggregateRule: AggregateRule.Sum,
        });
    }

    private getDisplayNode(): Node {
        return this.node;
    }

    private onStateChanged(state: IRedPointState): void {
        const node = this.getDisplayNode();
        if (!node) {
            return;
        }

        switch (this.displayType) {
            case RedPointDisplayType.Simple:
                this.updateSimple(node, state.visible);
                break;
            case RedPointDisplayType.Number:
                this.updateNumber(node, state.visible, state.totalValue);
                break;
            case RedPointDisplayType.Breath:
            case RedPointDisplayType.Blink:
            case RedPointDisplayType.Pulse:
            case RedPointDisplayType.Bounce:
                this.updateAnimation(node, state.visible);
                break;
            case RedPointDisplayType.Icon:
                this.updateIcon(node, state.visible, state.totalValue);
                break;
        }
    }

    private updateSimple(node: Node, visible: boolean): void {
        node.active = visible;
        if (visible) {
            this.playShowAnimation(node);
        }
    }

    private updateNumber(node: Node, visible: boolean, value: number): void {
        node.active = visible;
        if (!visible) {
            return;
        }

        if (this.countLabel) {
            this.countLabel.string = value > this.maxValue ? `${this.maxValue}+` : value.toString();
        }
        this.playShowAnimation(node);
    }

    private updateAnimation(node: Node, visible: boolean): void {
        if (this._currentVisible === visible && this._isAnimating === visible) {
            return;
        }

        this._currentVisible = visible;
        node.active = visible;

        if (visible) {
            this.startAnimation(node);
        } else {
            this.stopAnimation();
        }
    }

    private updateIcon(node: Node, visible: boolean, value: number): void {
        node.active = visible;
        if (!visible) {
            return;
        }

        this.loadIcon(value);
        if (this.countLabel && value > 0) {
            this.countLabel.string = value > this.maxValue ? `${this.maxValue}+` : value.toString();
        }
        this.playShowAnimation(node);
    }

    private loadIcon(_value: number): void {
        if (!this.iconPath || !this.iconSprite) {
            return;
        }

        const cached = RedPointMgr.getIconCache().get(this.iconPath) as SpriteFrame | undefined;
        if (cached) {
            this.applyLoadedSpriteFrame(cached);
            return;
        }

        const requestedPath = this.iconPath;
        resources.load(requestedPath, SpriteFrame, (err, spriteFrame) => {
            if (err || !spriteFrame || !this.iconSprite || this.iconPath !== requestedPath) {
                return;
            }

            this.applyLoadedSpriteFrame(spriteFrame);
            RedPointMgr.setIconToCache(requestedPath, spriteFrame);
        });
    }

    private applyLoadedSpriteFrame(spriteFrame: SpriteFrame): void {
        if (this._loadedSpriteFrame === spriteFrame) {
            if (this.iconSprite) {
                this.iconSprite.spriteFrame = spriteFrame;
            }
            return;
        }

        this.releaseLoadedSpriteFrame();
        spriteFrame.addRef();
        this._loadedSpriteFrame = spriteFrame;
        if (this.iconSprite) {
            this.iconSprite.spriteFrame = spriteFrame;
        }
    }

    private releaseLoadedSpriteFrame(): void {
        if (!this._loadedSpriteFrame) {
            return;
        }

        this._loadedSpriteFrame.decRef();
        this._loadedSpriteFrame = null;
    }

    private playShowAnimation(node: Node): void {
        node.setScale(0.5, 0.5, 1);
        tween(node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    private startAnimation(node: Node): void {
        if (this._isAnimating) {
            return;
        }

        this._isAnimating = true;
        this.stopAnimation();
        this._isAnimating = true;

        switch (this.displayType) {
            case RedPointDisplayType.Breath:
                this.playBreathAnimation(node);
                break;
            case RedPointDisplayType.Blink:
                this.playBlinkAnimation(node);
                break;
            case RedPointDisplayType.Pulse:
                this.playPulseAnimation(node);
                break;
            case RedPointDisplayType.Bounce:
                this.playBounceAnimation(node);
                break;
            default:
                this._isAnimating = false;
                break;
        }
    }

    private playBreathAnimation(node: Node): void {
        const duration = 1.0 / this.animationSpeed;
        this._currentTween = tween(node)
            .to(duration / 2, { scale: new Vec3(this.maxScale, this.maxScale, 1) }, { easing: 'sineInOut' })
            .to(duration / 2, { scale: new Vec3(this.minScale, this.minScale, 1) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private playBlinkAnimation(_node: Node): void {
        if (!this._opacity) {
            return;
        }

        const duration = 0.5 / this.animationSpeed;
        this._currentTween = tween(this._opacity)
            .to(duration, { opacity: 50 })
            .to(duration, { opacity: 255 })
            .union()
            .repeatForever()
            .start();
    }

    private playPulseAnimation(node: Node): void {
        const duration = 0.8 / this.animationSpeed;
        this._currentTween = tween(node)
            .to(duration / 2, { scale: new Vec3(this.maxScale, this.maxScale, 1) }, { easing: 'cubicOut' })
            .to(duration / 2, { scale: new Vec3(1, 1, 1) }, { easing: 'cubicIn' })
            .union()
            .repeatForever()
            .start();
    }

    private playBounceAnimation(node: Node): void {
        const duration = 0.6 / this.animationSpeed;
        const bounceHeight = 10;
        this._currentTween = tween(node)
            .to(duration / 2, { position: new Vec3(node.position.x, this._originalY + bounceHeight, node.position.z) }, { easing: 'cubicOut' })
            .to(duration / 2, { position: new Vec3(node.position.x, this._originalY, node.position.z) }, { easing: 'cubicIn' })
            .union()
            .repeatForever()
            .start();
    }

    private stopAnimation(): void {
        this._isAnimating = false;

        if (this._currentTween) {
            this._currentTween.stop();
            this._currentTween = null;
        }

        const node = this.getDisplayNode();
        node.setScale(this._originalScale.x, this._originalScale.y, this._originalScale.z);
        node.setPosition(node.position.x, this._originalY, node.position.z);

        if (this._opacity) {
            this._opacity.opacity = 255;
        }
    }
}
