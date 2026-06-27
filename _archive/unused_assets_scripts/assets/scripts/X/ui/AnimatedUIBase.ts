/**
 * UI动画组件基类
 *
 * 其他需要动画的UI组件可以继承此类
 */

import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
    Tween,
    UIOpacity,
} from 'cc';
import { UIAnimation, AnimationConfig } from './UIAnimation';

const { ccclass, property } = _decorator;

export enum EnterAnimationType {
    None = 'none',
    ScaleIn = 'scaleIn',
    FadeIn = 'fadeIn',
    SlideFromBottom = 'slideFromBottom',
    SlideFromTop = 'slideFromTop',
    SlideFromLeft = 'slideFromLeft',
    SlideFromRight = 'slideFromRight',
    RotateIn = 'rotateIn',
}

export enum ExitAnimationType {
    None = 'none',
    ScaleOut = 'scaleOut',
    FadeOut = 'fadeOut',
    SlideToBottom = 'slideToBottom',
    SlideToTop = 'slideToTop',
}

@ccclass('AnimatedUIBase')
export class AnimatedUIBase extends Component {
    @property({ type: String })
    enterAnimType: EnterAnimationType = EnterAnimationType.ScaleIn;

    @property({ type: String })
    exitAnimType: ExitAnimationType = ExitAnimationType.ScaleOut;

    @property
    enterDuration: number = 0.35;

    @property
    exitDuration: number = 0.25;

    @property
    slideDistance: number = 100;

    @property
    autoPlayEnter: boolean = true;

    @property({ type: Node, tooltip: '背景遮罩节点，需要挂载 Sprite 组件' })
    public maskNode: Node | null = null;

    protected _isAnimating: boolean = false;

    protected get panelNode(): Node {
        return this.node;
    }

    onEnable() {
        if (this.autoPlayEnter) {
            this.playEnterAnimation();
        }
    }

    public playEnterAnimation(onComplete?: () => void): void {
        if (this._isAnimating) return;
        this._isAnimating = true;

        const config: AnimationConfig = {
            duration: this.enterDuration,
            onComplete: () => {
                this._isAnimating = false;
                onComplete?.();
            },
        };

        switch (this.enterAnimType) {
            case EnterAnimationType.ScaleIn:
                UIAnimation.scaleIn(this.panelNode, config);
                break;
            case EnterAnimationType.FadeIn:
                this.panelNode.setScale(1, 1, 1);
                UIAnimation.fadeIn(this.panelNode, config);
                break;
            case EnterAnimationType.SlideFromBottom:
                this.panelNode.setScale(1, 1, 1);
                UIAnimation.slideInFromBottom(this.panelNode, this.slideDistance, config);
                break;
            case EnterAnimationType.SlideFromTop:
                this.panelNode.setScale(1, 1, 1);
                UIAnimation.slideInFromTop(this.panelNode, this.slideDistance, config);
                break;
            case EnterAnimationType.SlideFromLeft:
                this.panelNode.setScale(1, 1, 1);
                UIAnimation.slideInFromLeft(this.panelNode, this.slideDistance, config);
                break;
            case EnterAnimationType.SlideFromRight:
                this.panelNode.setScale(1, 1, 1);
                UIAnimation.slideInFromLeft(this.panelNode, -this.slideDistance, config);
                break;
            case EnterAnimationType.RotateIn:
                UIAnimation.rotateIn(this.panelNode, 360, config);
                break;
            case EnterAnimationType.None:
            default:
                this._isAnimating = false;
                onComplete?.();
                break;
        }
    }

    public playExitAnimation(onComplete?: () => void): void {
        if (this._isAnimating) return;
        this._isAnimating = true;

        const config: AnimationConfig = {
            duration: this.exitDuration,
            onComplete: () => {
                this._isAnimating = false;
                this.node.active = false;
                onComplete?.();
            },
        };

        switch (this.exitAnimType) {
            case ExitAnimationType.ScaleOut:
                UIAnimation.scaleOut(this.panelNode, config);
                break;
            case ExitAnimationType.FadeOut:
                UIAnimation.fadeOut(this.panelNode, config);
                break;
            case ExitAnimationType.SlideToBottom:
                UIAnimation.slideOutToBottom(this.panelNode, this.slideDistance, config);
                break;
            case ExitAnimationType.SlideToTop:
                tween(this.panelNode)
                    .to(
                        this.exitDuration,
                        {
                            position: new Vec3(
                                this.panelNode.position.x,
                                this.panelNode.position.y + this.slideDistance,
                                this.panelNode.position.z
                            ),
                        },
                        { easing: 'cubicIn' }
                    )
                    .call(() => {
                        this._isAnimating = false;
                        this.node.active = false;
                        onComplete?.();
                    })
                    .start();
                break;
            case ExitAnimationType.None:
            default:
                this._isAnimating = false;
                this.node.active = false;
                onComplete?.();
                break;
        }
    }

    public playEmphasisAnimation(): void {
        UIAnimation.pulse(this.panelNode);
    }

    public playErrorAnimation(): void {
        UIAnimation.shake(this.panelNode);
    }

    public show(onComplete?: () => void): void {
        this.node.active = true;
        this.playEnterAnimation(onComplete);
    }

    public hide(onComplete?: () => void): void {
        this.playExitAnimation(onComplete);
    }

    public stopAnimation(): void {
        Tween.stopAllByTarget(this.panelNode);
        const opacity = this.panelNode.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
        }
        this._isAnimating = false;
    }

    public isAnimating(): boolean {
        return this._isAnimating;
    }
}
