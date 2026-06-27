import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    Director,
    Label,
    Layers,
    Node,
    Sprite,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    Widget,
    director,
    isValid,
    tween,
    view,
} from 'cc';
import { UIManager, UIPanelId } from './UIManager';

const { ccclass, property } = _decorator;

interface ToastConfig {
    message: string;
    duration?: number;
    position?: 'top' | 'center' | 'bottom';
    type?: 'default' | 'success' | 'error' | 'warning';
}

interface ToastStyle {
    bgColor: Color;
    textColor: Color;
}

@ccclass('Popup')
export class Popup extends Component {
    private static _instance: Popup | null = null;

    @property({ tooltip: 'Toast 默认显示时长，单位秒' })
    public toastDuration: number = 2.0;

    @property({ tooltip: '同时显示的 Toast 最大数量' })
    public maxToastCount: number = 3;

    @property({ tooltip: 'Toast 之间的垂直间距' })
    public toastSpacing: number = 70;

    private _toastContainer: Node | null = null;
    private _activeToasts: Node[] = [];

    private readonly _toastStyles: Record<string, ToastStyle> = {
        default: {
            bgColor: new Color(50, 50, 50, 230),
            textColor: new Color(255, 255, 255, 255),
        },
        success: {
            bgColor: new Color(76, 175, 80, 230),
            textColor: new Color(255, 255, 255, 255),
        },
        error: {
            bgColor: new Color(244, 67, 54, 230),
            textColor: new Color(255, 255, 255, 255),
        },
        warning: {
            bgColor: new Color(255, 152, 0, 230),
            textColor: new Color(255, 255, 255, 255),
        },
    };

    private static ensureCanvasCamera(hostNode: Node, canvas: Canvas): void {
        let cameraNode = hostNode.getChildByName('UICamera');
        if (!cameraNode || !isValid(cameraNode)) {
            cameraNode = new Node('UICamera');
            cameraNode.layer = Layers.Enum.UI_2D;
            hostNode.addChild(cameraNode);
        }

        let camera = cameraNode.getComponent(Camera);
        if (!camera) {
            camera = cameraNode.addComponent(Camera);
        }

        camera.projection = Camera.ProjectionType.ORTHO;
        camera.priority = 100;
        camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        camera.visibility = 1 << Layers.Enum.UI_2D;
        canvas.cameraComponent = camera;
    }

    public static get instance(): Popup {
        if (Popup._instance) {
            const canvas = Popup._instance.node.getComponent(Canvas);
            if (canvas) {
                Popup.ensureCanvasCamera(Popup._instance.node, canvas);
            }
            return Popup._instance;
        }

        const scene = director.getScene();
        if (!scene) {
            throw new Error('Popup can only be used after the scene is loaded.');
        }

        const existingPopup = scene.getComponentInChildren(Popup);
        if (existingPopup) {
            Popup._instance = existingPopup;
            const existingCanvas = existingPopup.node.getComponent(Canvas);
            if (existingCanvas) {
                Popup.ensureCanvasCamera(existingPopup.node, existingCanvas);
            }
            existingPopup.init();
            return existingPopup;
        }

        const node = new Node('Popup');
        node.layer = Layers.Enum.UI_2D;
        scene.addChild(node);

        const transform = node.addComponent(UITransform);
        const canvas = node.addComponent(Canvas);
        Popup.ensureCanvasCamera(node, canvas);
        const popup = node.addComponent(Popup);

        const designSize = view.getDesignResolutionSize();
        transform.setContentSize(designSize.width, designSize.height);
        node.setSiblingIndex(9999);

        Popup._instance = popup;
        popup.init();
        return popup;
    }

    onLoad() {
        if (Popup._instance && Popup._instance !== this) {
            this.node.destroy();
            return;
        }

        Popup._instance = this;
        const canvas = this.node.getComponent(Canvas);
        if (canvas) {
            Popup.ensureCanvasCamera(this.node, canvas);
        }
        director.addPersistRootNode(this.node);
        director.on(Director.EVENT_BEFORE_SCENE_LAUNCH, this.onSceneChange, this);
        this.init();
    }

    onDestroy() {
        Tween.stopAllByTarget(this.node);
        director.off(Director.EVENT_BEFORE_SCENE_LAUNCH, this.onSceneChange, this);

        if (Popup._instance === this) {
            Popup._instance = null;
        }
    }

    private onSceneChange(): void {
        Tween.stopAllByTarget(this.node);
        this._activeToasts = [];
        this._toastContainer?.destroyAllChildren();
    }

    private init(): void {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }

        if (!this._toastContainer || !isValid(this._toastContainer)) {
            this._toastContainer = new Node('ToastContainer');
            this._toastContainer.layer = Layers.Enum.UI_2D;
            const widget = this._toastContainer.addComponent(Widget);
            widget.isAlignTop = true;
            widget.isAlignBottom = true;
            widget.isAlignLeft = true;
            widget.isAlignRight = true;
            widget.top = 0;
            widget.bottom = 0;
            widget.left = 0;
            widget.right = 0;
            this.node.addChild(this._toastContainer);
        }
    }

    public static toast(message: string, config?: Partial<ToastConfig>): void {
        Popup.instance.showToast({
            message,
            duration: config?.duration,
            position: config?.position || 'top',
            type: config?.type || 'default',
        });
        console.log(`Popup toast: ${message}`);
    }

    public static success(message: string): void {
        Popup.toast(message, { type: 'success' });
    }

    public static error(message: string): void {
        Popup.toast(message, { type: 'error' });
    }

    public static warning(message: string): void {
        Popup.toast(message, { type: 'warning' });
    }

    public static alert(title: string, message: string, onConfirm?: () => void): void {
        void UIManager.instance.openPopup(UIPanelId.Dialog, {
            title,
            message,
            showCancel: false,
            onConfirm,
        });
    }

    public static confirm(
        title: string,
        message: string,
        onConfirm?: () => void,
        onCancel?: () => void,
    ): void {
        void UIManager.instance.openPopup(UIPanelId.Dialog, {
            title,
            message,
            showCancel: true,
            onConfirm,
            onCancel,
        });
    }

    public showToast(config: ToastConfig): void {
        if (!this._toastContainer) {
            return;
        }

        const toastNode = this.createToastNode(config);
        this._toastContainer.addChild(toastNode);
        this._activeToasts.push(toastNode);

        while (this._activeToasts.length > this.maxToastCount) {
            const oldToast = this._activeToasts.shift();
            if (oldToast && isValid(oldToast)) {
                Tween.stopAllByTarget(oldToast);
                oldToast.destroy();
            }
        }

        this.arrangeToasts(config.position || 'top');
        this.playToastEnterAnimation(toastNode);

        const duration = config.duration ?? this.toastDuration;
        tween(toastNode)
            .delay(duration)
            .call(() => {
                this.hideToast(toastNode, config.position || 'top');
            })
            .start();
    }

    private createToastNode(config: ToastConfig): Node {
        const node = new Node('Toast');
        node.layer = Layers.Enum.UI_2D;
        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 0;
        node.setScale(0.8, 0.8, 1);

        const bgNode = new Node('Background');
        bgNode.layer = Layers.Enum.UI_2D;
        const bgSprite = bgNode.addComponent(Sprite);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(420, 64);
        bgSprite.color = this._toastStyles[config.type || 'default'].bgColor;
        node.addChild(bgNode);

        const labelNode = new Node('Content');
        labelNode.layer = Layers.Enum.UI_2D;
        const label = labelNode.addComponent(Label);
        label.string = config.message;
        label.fontSize = 28;
        label.lineHeight = 36;
        label.enableWrapText = true;
        label.color = this._toastStyles[config.type || 'default'].textColor;
        labelNode.setPosition(0, 0, 0);
        node.addChild(labelNode);

        return node;
    }

    private arrangeToasts(position: 'top' | 'center' | 'bottom'): void {
        let startY = -80;

        if (position === 'center') {
            startY = (this._activeToasts.length * this.toastSpacing) * 0.5;
        } else if (position === 'bottom') {
            startY = -300 + (this._activeToasts.length - 1) * this.toastSpacing;
        }

        for (let i = 0; i < this._activeToasts.length; i++) {
            const toastNode = this._activeToasts[i];
            const targetY = startY - i * this.toastSpacing;

            tween(toastNode)
                .to(0.2, { position: new Vec3(0, targetY, 0) }, { easing: 'cubicOut' })
                .start();
        }
    }

    private playToastEnterAnimation(toastNode: Node): void {
        toastNode.setPosition(0, toastNode.position.y + 50, 0);

        const opacity = toastNode.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity)
                .to(0.25, { opacity: 255 })
                .start();
        }

        tween(toastNode)
            .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        tween(toastNode)
            .to(0.3, { position: new Vec3(0, toastNode.position.y - 50, 0) }, { easing: 'cubicOut' })
            .start();
    }

    private hideToast(toastNode: Node, position: 'top' | 'center' | 'bottom' = 'top'): void {
        if (!isValid(toastNode)) {
            return;
        }

        const opacity = toastNode.getComponent(UIOpacity);

        tween(toastNode)
            .to(
                0.25,
                {
                    position: new Vec3(0, toastNode.position.y + 30, 0),
                    scale: new Vec3(0.8, 0.8, 1),
                },
                { easing: 'cubicIn' }
            )
            .call(() => {
                const index = this._activeToasts.indexOf(toastNode);
                if (index !== -1) {
                    this._activeToasts.splice(index, 1);
                }

                if (isValid(toastNode)) {
                    toastNode.destroy();
                }

                this.arrangeToasts(position);
            })
            .start();

        if (opacity) {
            tween(opacity)
                .to(0.2, { opacity: 0 })
                .start();
        }
    }
}
