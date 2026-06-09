import { Color, director, Graphics, Label, Node, UITransform, UIOpacity, Vec3, view } from 'cc';
import type { HUIOpenOptions, HTransitionAnimation, HTransitionProgressSetter, HTransitionShowOptions } from '../HTypes';
import type { HUIFacade } from '../ui/HUIFacade';

export class HTransitionFacade {
    private ui: HUIFacade | null = null;
    private rootNode: Node | null = null;
    private titleLabel: Label | null = null;
    private messageLabel: Label | null = null;
    private percentLabel: Label | null = null;
    private barFill: Node | null = null;
    private animationTimer: ReturnType<typeof setInterval> | null = null;
    private startAt = 0;
    private minShowMs = 300;
    private baseMessage = '加载中';
    private animation: HTransitionAnimation = 'dots-bar';

    public init(ui: HUIFacade): void {
        this.ui = ui;
    }

    /**
     * 显示过渡界面。用于大型 UI、场景跳转、资源下载等等待过程。
     */
    public async show(options: HTransitionShowOptions = {}): Promise<void> {
        this.ensureInit();
        this.minShowMs = Math.max(0, Math.floor(options.minShowMs ?? this.minShowMs));
        this.animation = options.animation || this.animation;
        this.baseMessage = options.message || '加载中';
        this.startAt = Date.now();

        if (!this.rootNode || !this.rootNode.isValid) {
            this.createTransitionNode();
        }

        this.rootNode!.active = true;
        this.setText(options.title || '请稍候', this.baseMessage);
        this.updateProgress(options.progress ?? 0);
        this.startAnimation();
    }

    public updateProgress(progress: number, message?: string): void {
        if (message !== undefined) {
            this.baseMessage = message;
            if (this.messageLabel) {
                this.messageLabel.string = message;
            }
        }

        const normalizedProgress = Math.max(0, Math.min(1, progress));
        if (this.percentLabel) {
            this.percentLabel.string = `${Math.floor(normalizedProgress * 100)}%`;
        }

        if (this.barFill) {
            const width = 520 * normalizedProgress;
            this.drawRect(this.barFill, width, 18, new Color(88, 196, 255, 255));
        }
    }

    public async hide(): Promise<void> {
        if (!this.rootNode) {
            return;
        }

        const elapsed = Date.now() - this.startAt;
        const waitMs = Math.max(0, this.minShowMs - elapsed);
        if (waitMs > 0) {
            await this.wait(waitMs);
        }

        this.stopAnimation();
        this.rootNode.active = false;
    }

    /**
     * 用过渡界面包裹一段异步流程。
     */
    public async run<T>(
        options: HTransitionShowOptions,
        task: (setProgress: HTransitionProgressSetter) => Promise<T>,
    ): Promise<T> {
        await this.show(options);
        try {
            const ret = await task((progress, message) => this.updateProgress(progress, message));
            this.updateProgress(1, '加载完成');
            return ret;
        } finally {
            await this.hide();
        }
    }

    /**
     * 打开大型 UI 的快捷方法。内部会显示过渡界面，再调用 H.ui.open。
     */
    public openLargeUI(openOptions: HUIOpenOptions, transitionOptions: HTransitionShowOptions = {}): Promise<Node> {
        return this.run<Node>({
            title: transitionOptions.title || '正在打开',
            message: transitionOptions.message || '正在加载界面',
            animation: transitionOptions.animation || 'dots-bar',
            minShowMs: transitionOptions.minShowMs,
        }, async (setProgress) => {
            setProgress(0.2, '准备界面资源');
            const node = await this.ui!.open(openOptions);
            setProgress(1, '界面加载完成');
            return node;
        });
    }

    /**
     * 预加载并切换场景。适合大场景跳转，避免黑屏或卡住无反馈。
     */
    public loadScene(sceneName: string, options: HTransitionShowOptions = {}): Promise<void> {
        const normalizedSceneName = sceneName.trim();
        if (!normalizedSceneName) {
            return Promise.reject(new Error('[HTransitionFacade] sceneName 不能为空'));
        }

        return this.run<void>({
            title: options.title || '正在进入',
            message: options.message || '正在加载场景',
            animation: options.animation || 'dots-bar',
            minShowMs: options.minShowMs,
        }, (setProgress) => new Promise<void>((resolve, reject) => {
            const anyDirector = director as any;
            anyDirector.preloadScene(
                normalizedSceneName,
                (completedCount: number, totalCount: number) => {
                    const total = Math.max(1, totalCount);
                    setProgress(Math.min(0.95, completedCount / total), '正在加载场景');
                },
                (err: Error | null) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    setProgress(0.98, '正在切换场景');
                    director.loadScene(normalizedSceneName, (loadErr) => {
                        if (loadErr) {
                            reject(loadErr);
                            return;
                        }
                        setProgress(1, '切换完成');
                        resolve();
                    });
                },
            );
        }));
    }

    private createTransitionNode(): void {
        const layer = this.ui!.getLayerNode('transition');
        const visibleSize = view.getVisibleSize();

        const root = new Node('HTransition');
        const rootTransform = root.addComponent(UITransform);
        rootTransform.setContentSize(visibleSize.width, visibleSize.height);
        root.addComponent(UIOpacity).opacity = 255;
        layer.addChild(root);
        root.setPosition(Vec3.ZERO);

        const background = new Node('Background');
        root.addChild(background);
        this.drawRect(background, visibleSize.width, visibleSize.height, new Color(0, 0, 0, 190));

        const titleNode = new Node('Title');
        root.addChild(titleNode);
        titleNode.setPosition(new Vec3(0, 80, 0));
        this.titleLabel = titleNode.addComponent(Label);
        this.titleLabel.fontSize = 34;
        this.titleLabel.lineHeight = 40;
        this.titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const messageNode = new Node('Message');
        root.addChild(messageNode);
        messageNode.setPosition(new Vec3(0, 24, 0));
        this.messageLabel = messageNode.addComponent(Label);
        this.messageLabel.fontSize = 24;
        this.messageLabel.lineHeight = 30;
        this.messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.messageLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const barBg = new Node('ProgressBarBg');
        root.addChild(barBg);
        barBg.setPosition(new Vec3(0, -30, 0));
        this.drawRect(barBg, 540, 26, new Color(255, 255, 255, 70));

        this.barFill = new Node('ProgressBarFill');
        barBg.addChild(this.barFill);
        this.barFill.setPosition(new Vec3(-260, 0, 0));
        this.drawRect(this.barFill, 0, 18, new Color(88, 196, 255, 255));

        const percentNode = new Node('Percent');
        root.addChild(percentNode);
        percentNode.setPosition(new Vec3(0, -72, 0));
        this.percentLabel = percentNode.addComponent(Label);
        this.percentLabel.fontSize = 22;
        this.percentLabel.lineHeight = 26;
        this.percentLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.percentLabel.verticalAlign = Label.VerticalAlign.CENTER;

        this.rootNode = root;
    }

    private setText(title: string, message: string): void {
        if (this.titleLabel) {
            this.titleLabel.string = title;
        }
        if (this.messageLabel) {
            this.messageLabel.string = message;
        }
    }

    private startAnimation(): void {
        this.stopAnimation();
        if (this.animation === 'none' || this.animation === 'bar') {
            return;
        }

        let dotCount = 0;
        this.animationTimer = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            if (this.messageLabel) {
                this.messageLabel.string = `${this.baseMessage}${'.'.repeat(dotCount)}`;
            }
        }, 350);
    }

    private stopAnimation(): void {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
    }

    private drawRect(node: Node, width: number, height: number, color: Color): void {
        let transform = node.getComponent(UITransform);
        if (!transform) {
            transform = node.addComponent(UITransform);
        }
        transform.setContentSize(Math.max(0, width), Math.max(0, height));

        let graphics = node.getComponent(Graphics);
        if (!graphics) {
            graphics = node.addComponent(Graphics);
        }
        graphics.clear();
        graphics.fillColor = color;
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private ensureInit(): void {
        if (!this.ui) {
            throw new Error('[HTransitionFacade] 请先调用 H.init({ uiRoot }) 或 H.transition.init(H.ui)');
        }
    }
}
