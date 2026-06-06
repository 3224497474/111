import {
    _decorator,
    Component,
    Node,
    Tween,
    UIOpacity,
    Vec3,
    tween,
} from 'cc';

const { ccclass } = _decorator;

export interface AnimationConfig {
    duration: number;
    delay?: number;
    ease?: EaseType;
    onComplete?: () => void;
}

export enum EaseType {
    Linear = 'linear',
    EaseInOut = 'easeInOut',
    EaseIn = 'easeIn',
    EaseOut = 'easeOut',
    EaseOutBack = 'easeOutBack',
    EaseOutElastic = 'easeOutElastic',
    EaseOutBounce = 'easeOutBounce',
    EaseInOutCubic = 'easeInOutCubic',
    EaseOutQuart = 'easeOutQuart',
    EaseOutExpo = 'easeOutExpo',
}

export const AnimationPresets = {
    toast: {
        fadeIn: { duration: 0.25, ease: EaseType.EaseOutQuart },
        fadeOut: { duration: 0.2, ease: EaseType.EaseIn },
        scale: { duration: 0.3, ease: EaseType.EaseOutBack },
    },
    dialog: {
        enter: { duration: 0.35, ease: EaseType.EaseOutBack },
        exit: { duration: 0.25, ease: EaseType.EaseIn },
        scale: { start: 0.7, end: 1.0 },
    },
    button: {
        press: { duration: 0.1, ease: EaseType.EaseOut },
        release: { duration: 0.15, ease: EaseType.EaseOutBack },
        scale: { pressed: 0.95, normal: 1.0 },
    },
    listItem: {
        stagger: 0.05,
        enter: { duration: 0.3, ease: EaseType.EaseOutBack },
        exit: { duration: 0.2, ease: EaseType.EaseIn },
    },
    emphasis: {
        pulse: { duration: 0.3, ease: EaseType.EaseOutElastic },
        shake: { duration: 0.4, ease: EaseType.EaseOut },
    },
};

export const EaseFunctions: Record<string, (t: number) => number> = {
    linear: (t) => t,
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    easeIn: (t) => t * t * t,
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutElastic: (t) => {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutBounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375;
        } else {
            return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375;
        }
    },
    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
    easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

@ccclass('UIAnimation')
export class UIAnimation extends Component {
    static fadeIn(node: Node, config: AnimationConfig = { duration: 0.3 }): void {
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration, { opacity: 255 }, { easing: this.getEasing(config.ease) })
            .call(() => config.onComplete?.())
            .start();
    }

    static fadeOut(node: Node, config: AnimationConfig = { duration: 0.3 }): void {
        const opacity = this.getOrCreateOpacity(node);

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration, { opacity: 0 }, { easing: this.getEasing(config.ease) })
            .call(() => config.onComplete?.())
            .start();
    }

    static scaleIn(node: Node, config: AnimationConfig = { duration: 0.35 }): void {
        node.setScale(0.5, 0.5, 1);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration * 0.7, { opacity: 255 })
            .start();
    }

    static scaleOut(node: Node, config: AnimationConfig = { duration: 0.25 }): void {
        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { scale: new Vec3(0.5, 0.5, 1) }, { easing: 'cubicIn' })
            .call(() => {
                const opacity = node.getComponent(UIOpacity);
                if (opacity) {
                    opacity.opacity = 0;
                }
                config.onComplete?.();
            })
            .start();
    }

    static slideInFromBottom(node: Node, distance: number = 100, config: AnimationConfig = { duration: 0.35 }): void {
        const originalY = node.position.y;
        node.setPosition(node.position.x, originalY - distance, node.position.z);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { position: new Vec3(node.position.x, originalY, node.position.z) }, { easing: 'cubicOut' })
            .start();

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration * 0.6, { opacity: 255 })
            .start();
    }

    static slideInFromTop(node: Node, distance: number = 100, config: AnimationConfig = { duration: 0.35 }): void {
        const originalY = node.position.y;
        node.setPosition(node.position.x, originalY + distance, node.position.z);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { position: new Vec3(node.position.x, originalY, node.position.z) }, { easing: 'cubicOut' })
            .start();

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration * 0.6, { opacity: 255 })
            .start();
    }

    static slideInFromLeft(node: Node, distance: number = 200, config: AnimationConfig = { duration: 0.35 }): void {
        const originalX = node.position.x;
        node.setPosition(originalX - distance, node.position.y, node.position.z);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { position: new Vec3(originalX, node.position.y, node.position.z) }, { easing: 'cubicOut' })
            .start();

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration * 0.6, { opacity: 255 })
            .start();
    }

    static slideOutToBottom(node: Node, distance: number = 100, config: AnimationConfig = { duration: 0.25 }): void {
        tween(node)
            .delay(config.delay || 0)
            .by(config.duration, { position: new Vec3(0, -distance, 0) }, { easing: 'cubicIn' })
            .call(() => config.onComplete?.())
            .start();
    }

    static pulse(node: Node, scale: number = 1.1, config: AnimationConfig = { duration: 0.3 }): void {
        const originalScale = node.scale.clone();
        const targetScale = new Vec3(originalScale.x * scale, originalScale.y * scale, originalScale.z);

        tween(node)
            .to(config.duration * 0.5, { scale: targetScale }, { easing: 'cubicOut' })
            .to(config.duration * 0.5, { scale: originalScale }, { easing: 'cubicIn' })
            .call(() => config.onComplete?.())
            .start();
    }

    static bounce(node: Node, height: number = 20, count: number = 3, config: AnimationConfig = { duration: 0.5 }): void {
        const originalY = node.position.y;
        const duration = config.duration / (count * 2);
        let anim = tween(node);

        for (let i = 0; i < count; i++) {
            const h = height * Math.pow(0.5, i);
            anim = anim
                .to(duration, { position: new Vec3(node.position.x, originalY + h, node.position.z) }, { easing: 'cubicOut' })
                .to(duration, { position: new Vec3(node.position.x, originalY, node.position.z) }, { easing: 'cubicIn' });
        }

        anim.call(() => config.onComplete?.()).start();
    }

    static shake(node: Node, intensity: number = 10, count: number = 3, config: AnimationConfig = { duration: 0.4 }): void {
        const originalX = node.position.x;
        const duration = config.duration / (count * 2);
        let anim = tween(node);

        for (let i = 0; i < count; i++) {
            const offset = intensity * Math.pow(0.6, i);
            anim = anim
                .to(duration, { position: new Vec3(originalX + offset, node.position.y, node.position.z) })
                .to(duration, { position: new Vec3(originalX - offset, node.position.y, node.position.z) });
        }

        anim
            .to(duration, { position: new Vec3(originalX, node.position.y, node.position.z) })
            .call(() => config.onComplete?.())
            .start();
    }

    static rotateIn(node: Node, rotation: number = 360, config: AnimationConfig = { duration: 0.5 }): void {
        node.setScale(0.3, 0.3, 1);
        node.setRotationFromEuler(0, 0, -rotation);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 0;

        tween(node)
            .delay(config.delay || 0)
            .to(config.duration, { scale: new Vec3(1, 1, 1), eulerAngles: new Vec3(0, 0, 0) }, { easing: 'backOut' })
            .start();

        tween(opacity)
            .delay(config.delay || 0)
            .to(config.duration * 0.5, { opacity: 255 })
            .start();
    }

    static ripple(node: Node, maxScale: number = 1.5, config: AnimationConfig = { duration: 0.5 }): void {
        node.setScale(0.5, 0.5, 1);
        const opacity = this.getOrCreateOpacity(node);
        opacity.opacity = 200;

        tween(node)
            .to(config.duration, { scale: new Vec3(maxScale, maxScale, 1) }, { easing: 'cubicOut' })
            .start();

        tween(opacity)
            .to(config.duration, { opacity: 0 })
            .call(() => config.onComplete?.())
            .start();
    }

    static breathe(node: Node, scaleRange: number = 0.05, config: AnimationConfig = { duration: 1.5 }): void {
        const originalScale = node.scale.clone();
        const targetScale = new Vec3(
            originalScale.x * (1 + scaleRange),
            originalScale.y * (1 + scaleRange),
            originalScale.z
        );

        tween(node)
            .to(config.duration / 2, { scale: targetScale }, { easing: 'sineInOut' })
            .to(config.duration / 2, { scale: originalScale }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    static stopBreathe(node: Node): void {
        Tween.stopAllByTarget(node);
    }

    static dialogEnter(maskNode: Node, panelNode: Node, config: AnimationConfig = { duration: 0.35 }): void {
        const maskOpacity = this.getOrCreateOpacity(maskNode);
        maskOpacity.opacity = 0;

        tween(maskOpacity)
            .to(config.duration * 0.6, { opacity: 150 })
            .start();

        this.scaleIn(panelNode, config);
    }

    static dialogExit(maskNode: Node, panelNode: Node, config: AnimationConfig = { duration: 0.25 }): void {
        const maskOpacity = maskNode.getComponent(UIOpacity);
        if (maskOpacity) {
            tween(maskOpacity)
                .to(config.duration, { opacity: 0 })
                .start();
        }

        this.scaleOut(panelNode, config);
    }

    static staggeredEnter(nodes: Node[], staggerDelay: number = 0.05, config: AnimationConfig = { duration: 0.3 }): void {
        nodes.forEach((node, index) => {
            node.setScale(0.8, 0.8, 1);
            const opacity = this.getOrCreateOpacity(node);
            opacity.opacity = 0;

            tween(node)
                .delay(index * staggerDelay)
                .to(config.duration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();

            tween(opacity)
                .delay(index * staggerDelay)
                .to(config.duration * 0.7, { opacity: 255 })
                .start();
        });
    }

    static staggeredExit(nodes: Node[], staggerDelay: number = 0.03, config: AnimationConfig = { duration: 0.2 }): void {
        nodes.forEach((node, index) => {
            tween(node)
                .delay(index * staggerDelay)
                .to(config.duration, { scale: new Vec3(0.8, 0.8, 1) }, { easing: 'cubicIn' })
                .start();

            const opacity = node.getComponent(UIOpacity);
            if (opacity) {
                tween(opacity)
                    .delay(index * staggerDelay)
                    .to(config.duration, { opacity: 0 })
                    .start();
            }
        });
    }

    private static getOrCreateOpacity(node: Node): UIOpacity {
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        return opacity;
    }

    private static getEasing(ease?: EaseType): string {
        if (!ease) {
            return 'cubicOut';
        }

        const easingMap: Record<EaseType, string> = {
            [EaseType.Linear]: 'linear',
            [EaseType.EaseInOut]: 'cubicInOut',
            [EaseType.EaseIn]: 'cubicIn',
            [EaseType.EaseOut]: 'cubicOut',
            [EaseType.EaseOutBack]: 'backOut',
            [EaseType.EaseOutElastic]: 'elasticOut',
            [EaseType.EaseOutBounce]: 'bounceOut',
            [EaseType.EaseInOutCubic]: 'cubicInOut',
            [EaseType.EaseOutQuart]: 'quartOut',
            [EaseType.EaseOutExpo]: 'expoOut',
        };

        return easingMap[ease] || 'cubicOut';
    }
}