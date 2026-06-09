import {
    assetManager,
    AssetManager,
    Component,
    game,
    instantiate,
    isValid,
    Label,
    Node,
    Prefab,
    resources,
    Tween,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
    Widget,
} from 'cc';
import type {
    HUIAnimationConfig,
    HUIAnimationType,
    HUICacheMode,
    HUIConfig,
    HUILayerName,
    HUILifecycle,
    HUIOpenOptions,
    HUIRecord,
    HUIType,
    HUIInitOptions,
} from '../HTypes';
import { HBaseUI } from './HBaseUI';
import { HUIConfigs } from './HUIConfig';
import { HUIStack } from './HUIStack';

type HUIOpenInput = string | HUIOpenOptions;

export class HUIFacade {
    private root: Node | null = null;
    private readonly layerNodes = new Map<HUILayerName, Node>();
    private readonly records = new Map<string, HUIRecord>();
    private readonly configs = new Map<string, HUIConfig>();
    private readonly loadingTasks = new Map<string, Promise<Node>>();
    private readonly stack = new HUIStack();
    private readonly animationBaseMap = new WeakMap<Node, { position: Vec3; scale: Vec3 }>();
    private loadingRefCount = 0;
    private defaultLoadingId = 'h:global_loading';

    private readonly defaultLayerOrder: Record<HUILayerName, number> = {
        layer1: 100,
        layer2: 200,
        layer3: 300,
        layer4: 400,
        transition: 500,
        tip: 600,
    };

    /**
     * 初始化 UI 根节点，并自动创建 layer1/layer2/layer3/layer4/transition/tip 六个层。
     * root 建议传 Canvas 或 Canvas 下的 UIRoot，层节点会自动铺满 root。
     */
    public init(root: Node, options: HUIInitOptions = {}): void {
        this.root = root;
        this.defaultLoadingId = options.defaultLoadingId || this.defaultLoadingId;

        if (options.persistRoot && root.parent) {
            game.addPersistRootNode(root);
        }

        this.ensureRootTransform(root);
        this.bindLayers(options.layerOrder);
        this.registerConfigs(HUIConfigs);
        this.registerConfigs(options.configs || []);
    }

    public registerConfig(config: HUIConfig): void {
        const normalized = this.normalizeConfig(config);
        this.configs.set(normalized.id, normalized);
    }

    public registerConfigs(configs: HUIConfig[]): void {
        configs.forEach((config) => this.registerConfig(config));
    }

    public unregisterConfig(id: string): void {
        this.configs.delete(id);
    }

    public getConfig(id: string): HUIConfig | null {
        const config = this.configs.get(id);
        return config ? { ...config } : null;
    }

    /**
     * 打开 UI。支持：
     * - H.ui.open({ id, prefabPath, layer })
     * - H.ui.open('ShopView', { tab: 1 })，前提是先 registerConfig。
     */
    public async open(input: HUIOpenInput, params?: any): Promise<Node> {
        this.ensureInit();

        const options = this.resolveOpenInput(input, params);
        const config = this.normalizeConfig(options);
        const id = config.id;

        const singleton = config.singleton !== false;
        const existing = this.getRecord(id);
        if (existing && singleton) {
            this.openRecord(existing, options.params, options.restorePreviousDialog);
            return existing.node;
        }

        const loadingTask = this.loadingTasks.get(id);
        if (loadingTask && singleton) {
            return loadingTask;
        }

        const task = this.loadCreateAndOpen(config, options);
        this.loadingTasks.set(id, task);
        try {
            return await task;
        } finally {
            this.loadingTasks.delete(id);
        }
    }

    public async openPage(id: string, params?: any): Promise<Node> {
        return this.open({
            id,
            type: 'page',
            layer: 'layer2',
            params,
        });
    }

    public async openDialog(id: string, params?: any): Promise<Node> {
        return this.open({
            id,
            type: 'dialog',
            layer: 'layer3',
            params,
        });
    }

    public async openWithLoad(id: string, params?: any): Promise<Node> {
        return this.open(id, params);
    }

    public showDialog(id: string, params?: any, callback?: (target: HUILifecycle | Node | null) => void, parent?: Node): void {
        void this.open({
            id,
            type: 'dialog',
            layer: 'layer3',
            params,
            parent,
        }).then((node) => {
            const record = this.getRecord(id);
            callback?.(record?.script || node);
        });
    }

    public hideDialog(id: string, callback?: () => void): void {
        this.close(id);
        callback?.();
    }

    public pushShowDialog(id: string, params?: any, callback?: (target: HUILifecycle | Node | null) => void, parent?: Node): void {
        void this.open({
            id,
            type: 'dialog',
            layer: 'layer3',
            params,
            parent,
            restorePreviousDialog: true,
        }).then((node) => {
            const record = this.getRecord(id);
            callback?.(record?.script || node);
        });
    }

    public popHideDialog(id: string, callback?: () => void): void {
        this.close(id);
        callback?.();
    }

    public registerExisting(id: string, node: Node, config: Partial<HUIConfig> = {}): HUILifecycle | null {
        this.ensureInit();
        const normalized = this.normalizeConfig({
            ...config,
            id,
            node: undefined,
        } as HUIOpenOptions);
        const record = this.createRecord(normalized, node);
        this.records.set(record.id, record);
        this.attachToLayer(record, config.order);
        return record.script;
    }

    public get(id: string): Node | null {
        return this.getRecord(id)?.node || null;
    }

    public getNode(id: string): Node | null {
        return this.get(id);
    }

    public getScript<T extends HUILifecycle = HUILifecycle>(id: string): T | null {
        return this.getRecord(id)?.script as T | null;
    }

    public isOpen(id: string): boolean {
        const record = this.getRecord(id);
        return !!record && record.node.active;
    }

    public getOpenIds(layer?: HUILayerName): string[] {
        return [...this.records.values()]
            .filter((record) => record.node.active && (!layer || record.layer === layer))
            .map((record) => record.id);
    }

    public toggle(id: string, params?: any): void {
        if (this.isOpen(id)) {
            this.close(id);
            return;
        }

        void this.open(id, params);
    }

    /**
     * 关闭指定 UI。destroy 会释放节点，hide/keep 会保留节点供下次复用。
     */
    public close(id: string, forceDestroy = false): void {
        const record = this.getRecord(id);
        if (!record || record.closing) {
            return;
        }

        this.stack.remove(id);
        record.closing = true;
        void this.closeRecord(record, forceDestroy);
    }

    public destroy(id: string): void {
        this.close(id, true);
    }

    public closeTopDialog(): boolean {
        const topDialog = this.stack.peekDialog();
        if (!topDialog) {
            return false;
        }

        this.close(topDialog);
        return true;
    }

    public goBack(): boolean {
        const topDialog = this.stack.peekDialog();
        if (topDialog && this.tryBackRecord(topDialog)) {
            return true;
        }

        const pageStack = this.stack.getPageStack();
        for (let i = pageStack.length - 1; i >= 0; i--) {
            const id = pageStack[i];
            if (this.tryBackRecord(id)) {
                return true;
            }
        }

        return false;
    }

    public closeLayer(layer: HUILayerName): void {
        this.collectRecordIds((record) => record.layer === layer)
            .forEach((id) => this.close(id));
    }

    public closeGroup(group: string): void {
        this.collectRecordIds((record) => record.group === group)
            .forEach((id) => this.close(id));
    }

    public closeMutexGroup(mutexGroup: string, exceptId?: string): void {
        this.collectRecordIds((record) => record.mutexGroup === mutexGroup && record.id !== exceptId)
            .forEach((id) => this.close(id));
    }

    /**
     * 清理隐藏缓存。cacheMode 为 keep 的 UI 会被保留，适合主界面常驻节点。
     */
    public clearHiddenCache(): void {
        this.collectRecordIds((record) => {
            return record.cacheMode !== 'keep' && !record.node.active;
        }).forEach((id) => this.destroy(id));
    }

    public bringToTop(id: string): void {
        const record = this.getRecord(id);
        if (!record || !record.node.parent) {
            return;
        }

        record.node.setSiblingIndex(record.node.parent.children.length - 1);
    }

    public showLoading(message?: string): void {
        this.loadingRefCount++;
        void this.ensureLoadingVisible(message);
    }

    public hideLoading(): void {
        if (this.loadingRefCount <= 0) {
            this.loadingRefCount = 0;
            this.hideLoadingRecord();
            return;
        }

        this.loadingRefCount--;
        if (this.loadingRefCount <= 0) {
            this.loadingRefCount = 0;
            this.hideLoadingRecord();
        }
    }

    public resetLoading(): void {
        this.loadingRefCount = 0;
        this.hideLoadingRecord();
    }

    public async withLoading<T>(task: () => Promise<T>, message?: string): Promise<T> {
        this.showLoading(message);
        try {
            return await task();
        } finally {
            this.hideLoading();
        }
    }

    public setLoadingMessage(message: string): void {
        const record = this.getLoadingRecord();
        if (record?.script?.setMessage) {
            record.script.setMessage(message);
            return;
        }

        const label = record?.node.getComponentInChildren(Label);
        if (label) {
            label.string = message;
        }
    }

    public setLoadingProgress(progress: number): void {
        const record = this.getLoadingRecord();
        record?.script?.setProgress?.(Math.max(0, Math.min(1, progress)));
    }

    /**
     * Tip 层轻量提示。正式项目可以用 registerConfig 配置自己的 Toast 预制体。
     */
    public showTip(message: string, durationMs = 1500): Node {
        this.ensureInit();
        const tipLayer = this.getLayerNode('tip');
        const tipNode = new Node('HTip');
        const transform = tipNode.addComponent(UITransform);
        transform.setContentSize(620, 64);

        const label = tipNode.addComponent(Label);
        label.string = message;
        label.fontSize = 28;
        label.lineHeight = 34;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        tipNode.setPosition(new Vec3(0, 120, 0));
        tipLayer.addChild(tipNode);

        setTimeout(() => {
            if (tipNode.isValid) {
                tipNode.destroy();
            }
        }, Math.max(300, durationMs));

        return tipNode;
    }

    public getLayerNode(layer: HUILayerName): Node {
        this.ensureInit();
        const layerNode = this.layerNodes.get(layer);
        if (!layerNode) {
            throw new Error(`[HUIFacade] 找不到 UI 层：${layer}`);
        }
        return layerNode;
    }

    private bindLayers(customOrder?: Partial<Record<HUILayerName, number>>): void {
        const layerOrder = {
            ...this.defaultLayerOrder,
            ...(customOrder || {}),
        };

        const sortedLayers = (Object.keys(this.defaultLayerOrder) as HUILayerName[])
            .sort((a, b) => layerOrder[a] - layerOrder[b]);

        sortedLayers.forEach((layerName, index) => {
            const layerNode = this.ensureLayerNode(layerName);
            layerNode.setSiblingIndex(index);
            this.layerNodes.set(layerName, layerNode);
        });
    }

    private ensureLayerNode(layerName: HUILayerName): Node {
        const root = this.root;
        if (!root) {
            throw new Error('[HUIFacade] UI 根节点不存在');
        }

        let layerNode = root.getChildByName(layerName);
        if (!layerNode) {
            layerNode = new Node(layerName);
            root.addChild(layerNode);
        }

        const rootTransform = root.getComponent(UITransform);
        let transform = layerNode.getComponent(UITransform);
        if (!transform) {
            transform = layerNode.addComponent(UITransform);
        }
        if (rootTransform) {
            transform.setContentSize(rootTransform.contentSize);
        }

        let widget = layerNode.getComponent(Widget);
        if (!widget) {
            widget = layerNode.addComponent(Widget);
        }
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;

        return layerNode;
    }

    private ensureRootTransform(root: Node): void {
        if (!root.getComponent(UITransform)) {
            root.addComponent(UITransform);
        }
    }

    private async loadCreateAndOpen(config: HUIConfig, options: HUIOpenOptions): Promise<Node> {
        const node = options.node || await this.loadPrefabNode(config);
        const record = this.createRecord(config, node);
        this.records.set(record.id, record);
        this.openRecord(record, options.params, options.restorePreviousDialog, options.parent);
        return node;
    }

    private createRecord(config: HUIConfig, node: Node): HUIRecord {
        const script = this.resolveScript(node, config.scriptName);
        this.bindScriptContext(script, config.id, config);

        return {
            id: config.id,
            layer: config.layer || this.resolveLayer(config),
            type: config.type || this.resolveType(config.layer),
            node,
            mutexGroup: config.mutexGroup || '',
            group: config.group,
            cacheMode: config.cacheMode || this.resolveCacheMode(config),
            prefabPath: config.prefabPath,
            bundle: config.bundle,
            config,
            script,
            blockBack: config.blockBack,
            loaded: false,
            closing: false,
        };
    }

    private openRecord(record: HUIRecord, params?: any, restorePreviousDialog?: boolean, parent?: Node): void {
        record.closing = false;
        this.stopAnimations(record.node);
        this.attachToLayer(record, record.config.order, parent);

        if (record.mutexGroup) {
            this.closeMutexGroup(record.mutexGroup, record.id);
        }
        if (record.config.exclusive) {
            this.closeExclusivePeers(record);
        }

        if (record.type === 'page') {
            this.stack.pushPage(record.id);
        } else if (record.type === 'dialog') {
            if (restorePreviousDialog) {
                this.hideCurrentTopDialog(record.id);
            }
            this.stack.pushDialog(record.id);
        }

        record.params = params ?? null;
        this.showScript(record, record.params);
        this.bringToTop(record.id);
        void this.playOpenAnimation(record);
    }

    private attachToLayer(record: HUIRecord, order?: number, parent?: Node): void {
        const layerNode = parent || this.getLayerNode(record.layer);
        if (record.node.parent !== layerNode) {
            record.node.setParent(layerNode);
        }

        if (typeof order === 'number') {
            record.node.setSiblingIndex(order);
            return;
        }

        record.node.setSiblingIndex(layerNode.children.length - 1);
    }

    private closeExclusivePeers(targetRecord: HUIRecord): void {
        this.collectRecordIds((record) => {
            if (record.id === targetRecord.id || !record.node.active) {
                return false;
            }
            if (record.layer !== targetRecord.layer || record.type !== targetRecord.type) {
                return false;
            }
            if (targetRecord.group && record.group !== targetRecord.group) {
                return false;
            }
            return true;
        }).forEach((id) => this.close(id));
    }

    private hideCurrentTopDialog(nextDialogId: string): void {
        const topDialogId = this.stack.peekDialog();
        if (!topDialogId || topDialogId === nextDialogId) {
            return;
        }

        const record = this.getRecord(topDialogId);
        if (record?.node.active) {
            this.hideScript(record);
        }
    }

    private restorePreviousDialog(): void {
        const topDialogId = this.stack.peekDialog();
        if (!topDialogId) {
            return;
        }

        const record = this.getRecord(topDialogId);
        if (!record || record.node.active) {
            return;
        }

        this.showScript(record, record.params);
    }

    private tryBackRecord(id: string): boolean {
        const record = this.getRecord(id);
        if (!record) {
            return false;
        }

        if (record.script?.onUIBack?.()) {
            return true;
        }

        if (record.blockBack) {
            return false;
        }

        this.close(id);
        return true;
    }

    private async closeRecord(record: HUIRecord, forceDestroy: boolean): Promise<void> {
        const shouldDestroy = forceDestroy || record.cacheMode === 'destroy';
        this.runCloseLifecycleBeforeAnimation(record, shouldDestroy);

        try {
            await this.playCloseAnimation(record);
        } finally {
            if (!isValid(record.node)) {
                this.records.delete(record.id);
                return;
            }

            this.stopAnimations(record.node);
            this.restoreBaseTransform(record.node);
            record.closing = false;

            if (shouldDestroy) {
                record.node.destroy();
                this.records.delete(record.id);
            } else {
                record.node.active = false;
            }

            if (record.type === 'dialog') {
                this.restorePreviousDialog();
            }
        }
    }

    private runCloseLifecycleBeforeAnimation(record: HUIRecord, destroyAfterClose: boolean): void {
        const script = record.script;
        if (!script) {
            return;
        }

        script.uiStatus = 'hiding';
        if (destroyAfterClose) {
            script.onUIClose?.();
        } else {
            script.onUIHide?.();
        }
    }

    private showScript(record: HUIRecord, params?: any): void {
        const script = record.script;
        if (!script) {
            record.node.active = true;
            return;
        }

        script.uiParams = params ?? null;
        if (typeof script.openUI === 'function') {
            script.openUI(params);
            record.loaded = true;
            return;
        }

        if (!record.loaded) {
            record.loaded = true;
            script.onUILoad?.(params);
        } else if (record.node.active) {
            script.onUIRefresh?.(params);
        }

        script.uiStatus = 'opening';
        script.onUIOpen?.(params);
        record.node.active = true;
        script.show?.(params);
        script.updateInfo?.();
        script.uiStatus = 'opened';
        script.onUIShow?.();
    }

    private hideScript(record: HUIRecord): void {
        const script = record.script;
        if (!script) {
            record.node.active = false;
            return;
        }

        if (typeof script.hideUI === 'function') {
            script.hideUI();
            return;
        }

        script.uiStatus = 'hiding';
        script.onUIHide?.();
        script.hide?.();
        record.node.active = false;
        script.uiStatus = 'closed';
    }

    private playOpenAnimation(record: HUIRecord): Promise<void> {
        const config = this.resolveAnimationConfig(record);
        const animation = config.open || 'none';
        const duration = config.openDuration ?? config.duration ?? this.getDefaultAnimationDuration(record);
        if (animation === 'none' || duration <= 0 || !isValid(record.node)) {
            this.restoreBaseTransform(record.node);
            this.ensureOpacity(record.node).opacity = 255;
            return Promise.resolve();
        }

        const base = this.captureBaseTransform(record.node);
        const opacity = this.ensureOpacity(record.node);
        this.stopAnimations(record.node);
        this.prepareOpenAnimation(record.node, opacity, animation, base, config.distance ?? 96);

        return new Promise((resolve) => {
            tween(record.node)
                .to(duration, {
                    position: base.position,
                    scale: base.scale,
                }, {
                    easing: 'backOut',
                })
                .call(() => {
                    this.restoreBaseTransform(record.node);
                    resolve();
                })
                .start();

            tween(opacity)
                .to(duration, {
                    opacity: 255,
                }, {
                    easing: 'quadOut',
                })
                .start();
        });
    }

    private playCloseAnimation(record: HUIRecord): Promise<void> {
        const config = this.resolveAnimationConfig(record);
        const animation = config.close || config.open || 'none';
        const duration = config.closeDuration ?? config.duration ?? this.getDefaultAnimationDuration(record);
        if (animation === 'none' || duration <= 0 || !isValid(record.node)) {
            return Promise.resolve();
        }

        const base = this.captureBaseTransform(record.node);
        const opacity = this.ensureOpacity(record.node);
        const target = this.getCloseAnimationTarget(record.node, animation, base, config.distance ?? 96);
        this.stopAnimations(record.node);

        return new Promise((resolve) => {
            tween(record.node)
                .to(duration, {
                    position: target.position,
                    scale: target.scale,
                }, {
                    easing: 'quadIn',
                })
                .call(() => resolve())
                .start();

            tween(opacity)
                .to(duration, {
                    opacity: target.opacity,
                }, {
                    easing: 'quadIn',
                })
                .start();
        });
    }

    private resolveAnimationConfig(record: HUIRecord): Required<Pick<HUIAnimationConfig, 'open' | 'close'>> & HUIAnimationConfig {
        const raw = record.config.animation;
        const defaultAnimation = this.getDefaultAnimationType(record);
        if (!raw) {
            return {
                open: defaultAnimation,
                close: defaultAnimation,
            };
        }

        if (typeof raw === 'string') {
            return {
                open: raw,
                close: raw,
            };
        }

        return {
            ...raw,
            open: raw.open || defaultAnimation,
            close: raw.close || raw.open || defaultAnimation,
        };
    }

    private getDefaultAnimationType(record: HUIRecord): HUIAnimationType {
        if (record.type === 'dialog') {
            return 'fade-scale';
        }
        if (record.type === 'page') {
            return 'fade';
        }
        if (record.type === 'loading' || record.type === 'tip') {
            return 'fade';
        }
        return 'none';
    }

    private getDefaultAnimationDuration(record: HUIRecord): number {
        if (record.type === 'dialog') {
            return 0.18;
        }
        if (record.type === 'page') {
            return 0.14;
        }
        return 0.12;
    }

    private prepareOpenAnimation(
        node: Node,
        opacity: UIOpacity,
        animation: HUIAnimationType,
        base: { position: Vec3; scale: Vec3 },
        distance: number,
    ): void {
        opacity.opacity = this.animationUsesFade(animation) ? 0 : 255;
        node.setPosition(this.getSlideStartPosition(animation, base.position, distance));
        if (animation === 'scale' || animation === 'fade-scale') {
            node.setScale(base.scale.x * 0.86, base.scale.y * 0.86, base.scale.z);
        } else {
            node.setScale(base.scale.x, base.scale.y, base.scale.z);
        }
    }

    private getCloseAnimationTarget(
        node: Node,
        animation: HUIAnimationType,
        base: { position: Vec3; scale: Vec3 },
        distance: number,
    ): { position: Vec3; scale: Vec3; opacity: number } {
        const position = this.getSlideEndPosition(animation, base.position, distance);
        const scale = (animation === 'scale' || animation === 'fade-scale')
            ? new Vec3(base.scale.x * 0.88, base.scale.y * 0.88, base.scale.z)
            : new Vec3(base.scale.x, base.scale.y, base.scale.z);
        const opacity = this.animationUsesFade(animation) ? 0 : this.ensureOpacity(node).opacity;

        return {
            position,
            scale,
            opacity,
        };
    }

    private getSlideStartPosition(animation: HUIAnimationType, base: Vec3, distance: number): Vec3 {
        switch (animation) {
            case 'slide-up':
                return new Vec3(base.x, base.y - distance, base.z);
            case 'slide-down':
                return new Vec3(base.x, base.y + distance, base.z);
            case 'slide-left':
                return new Vec3(base.x + distance, base.y, base.z);
            case 'slide-right':
                return new Vec3(base.x - distance, base.y, base.z);
            default:
                return new Vec3(base.x, base.y, base.z);
        }
    }

    private getSlideEndPosition(animation: HUIAnimationType, base: Vec3, distance: number): Vec3 {
        switch (animation) {
            case 'slide-up':
                return new Vec3(base.x, base.y + distance, base.z);
            case 'slide-down':
                return new Vec3(base.x, base.y - distance, base.z);
            case 'slide-left':
                return new Vec3(base.x - distance, base.y, base.z);
            case 'slide-right':
                return new Vec3(base.x + distance, base.y, base.z);
            default:
                return new Vec3(base.x, base.y, base.z);
        }
    }

    private animationUsesFade(animation: HUIAnimationType): boolean {
        return animation === 'fade'
            || animation === 'fade-scale'
            || animation === 'slide-up'
            || animation === 'slide-down'
            || animation === 'slide-left'
            || animation === 'slide-right';
    }

    private captureBaseTransform(node: Node): { position: Vec3; scale: Vec3 } {
        const cached = this.animationBaseMap.get(node);
        if (cached) {
            return {
                position: cached.position.clone(),
                scale: cached.scale.clone(),
            };
        }

        const base = {
            position: node.position.clone(),
            scale: node.scale.clone(),
        };
        this.animationBaseMap.set(node, base);
        return {
            position: base.position.clone(),
            scale: base.scale.clone(),
        };
    }

    private restoreBaseTransform(node: Node): void {
        const base = this.animationBaseMap.get(node);
        if (!base || !isValid(node)) {
            return;
        }

        node.setPosition(base.position);
        node.setScale(base.scale);
        this.ensureOpacity(node).opacity = 255;
    }

    private ensureOpacity(node: Node): UIOpacity {
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        return opacity;
    }

    private stopAnimations(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
        }
    }

    private closeScript(record: HUIRecord): void {
        const script = record.script;
        if (!script) {
            record.node.active = false;
            return;
        }

        if (typeof script.closeUI === 'function') {
            script.closeUI();
            return;
        }

        script.onUIClose?.();
        script.hide?.();
        record.node.active = false;
        script.uiStatus = 'closed';
    }

    private bindScriptContext(script: HUILifecycle | null, id: string, config: HUIConfig): void {
        if (!script) {
            return;
        }

        if (typeof script.bindUIContext === 'function') {
            script.bindUIContext(id, config);
            return;
        }

        script.uiId = id;
        script.uiPanelId = id;
        script.dialogPath = id;
        script.uiConfig = config;
    }

    private resolveScript(node: Node, scriptName?: string): HUILifecycle | null {
        if (scriptName) {
            const namedScript = node.getComponent(scriptName as any) as HUILifecycle | null;
            if (namedScript) {
                return namedScript;
            }
        }

        const baseUI = node.getComponent(HBaseUI);
        if (baseUI) {
            return baseUI;
        }

        const components = node.getComponents(Component) as Array<Component & HUILifecycle>;
        return components.find((component) => {
            return typeof component.openUI === 'function'
                || typeof component.onUIOpen === 'function'
                || typeof component.show === 'function'
                || typeof component.bindUIContext === 'function';
        }) ?? null;
    }

    private loadPrefabNode(config: HUIConfig): Promise<Node> {
        const prefabPath = config.prefabPath?.trim();
        if (!prefabPath) {
            throw new Error(`[HUIFacade] ${config.id} 需要 node 或 prefabPath`);
        }

        return this.loadPrefab(config.bundle, prefabPath).then((prefab) => instantiate(prefab));
    }

    private async loadPrefab(bundleName: string | undefined, prefabPath: string): Promise<Prefab> {
        if (!bundleName || bundleName === 'resources') {
            return this.loadResourcesPrefab(prefabPath);
        }

        const bundle = await this.loadBundle(bundleName);
        return new Promise((resolve, reject) => {
            bundle.load(prefabPath, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err || new Error(`[HUIFacade] 预制体加载失败：${bundleName}/${prefabPath}`));
                    return;
                }
                resolve(prefab);
            });
        });
    }

    private loadResourcesPrefab(prefabPath: string): Promise<Prefab> {
        return new Promise((resolve, reject) => {
            resources.load(prefabPath, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err || new Error(`[HUIFacade] 预制体加载失败：resources/${prefabPath}`));
                    return;
                }
                resolve(prefab);
            });
        });
    }

    private loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const existing = assetManager.getBundle(bundleName);
        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err || !bundle) {
                    reject(err || new Error(`[HUIFacade] Bundle 加载失败：${bundleName}`));
                    return;
                }
                resolve(bundle);
            });
        });
    }

    private resolveOpenInput(input: HUIOpenInput, params?: any): HUIOpenOptions {
        if (typeof input !== 'string') {
            return input;
        }

        const registered = this.configs.get(input);
        return {
            ...(registered || this.inferConfig(input)),
            id: input,
            params,
        };
    }

    private normalizeConfig(config: HUIConfig): HUIConfig {
        const id = config.id?.trim();
        if (!id) {
            throw new Error('[HUIFacade] UI id 不能为空');
        }

        const registered = this.configs.get(id);
        const merged = {
            ...this.inferConfig(id),
            ...(registered || {}),
            ...config,
            id,
        };

        const layer = merged.layer || this.resolveLayer(merged);
        const type = merged.type || this.resolveType(layer);
        const group = merged.group || this.resolveDefaultGroup(type, layer);
        const mutexGroup = merged.mutexGroup || this.resolveDefaultMutexGroup(merged, type, layer, group);

        return {
            ...merged,
            layer,
            type,
            group,
            mutexGroup,
            prefabPath: merged.prefabPath || this.inferPrefabPath(id),
            bundle: merged.bundle || this.inferBundleName(id),
            cacheMode: merged.cacheMode || this.resolveCacheMode({ ...merged, type }),
            exclusive: merged.exclusive ?? this.resolveDefaultExclusive(type),
            blockBack: merged.blockBack ?? this.resolveDefaultBlockBack(type, layer),
            singleton: merged.singleton ?? true,
        };
    }

    private inferConfig(id: string): HUIConfig {
        const bundle = this.inferBundleName(id);
        const prefabPath = this.inferPrefabPath(id);
        return {
            id,
            bundle,
            prefabPath,
        };
    }

    private inferBundleName(id: string): string | undefined {
        const separatorIndex = id.indexOf('|');
        if (separatorIndex > 0) {
            return id.slice(0, separatorIndex);
        }
        return undefined;
    }

    private inferPrefabPath(id: string): string {
        const separatorIndex = id.indexOf('|');
        if (separatorIndex > 0) {
            return id.slice(separatorIndex + 1);
        }
        return id;
    }

    private resolveLayer(config: Partial<HUIConfig>): HUILayerName {
        if (config.layer) {
            return config.layer;
        }

        switch (config.type) {
            case 'page':
                return 'layer2';
            case 'dialog':
                return 'layer3';
            case 'loading':
                return 'transition';
            case 'tip':
                return 'tip';
            default:
                return 'layer2';
        }
    }

    private resolveType(layer?: HUILayerName): HUIType {
        switch (layer) {
            case 'layer1':
            case 'layer2':
                return 'page';
            case 'layer3':
            case 'layer4':
                return 'dialog';
            case 'transition':
                return 'loading';
            case 'tip':
                return 'tip';
            default:
                return 'custom';
        }
    }

    private resolveDefaultGroup(type: HUIType, layer: HUILayerName): string {
        if (type === 'page') {
            return layer === 'layer1' ? 'main' : 'sub';
        }
        if (type === 'dialog') {
            return 'popup';
        }
        if (type === 'loading') {
            return 'loading';
        }
        if (type === 'tip') {
            return 'tip';
        }
        return layer;
    }

    private resolveDefaultMutexGroup(config: HUIConfig, type: HUIType, layer: HUILayerName, group: string): string {
        if (config.mutexGroup) {
            return config.mutexGroup;
        }
        if (type === 'page') {
            return `${layer}:${group}`;
        }
        return '';
    }

    private resolveDefaultExclusive(type: HUIType): boolean {
        return type === 'page';
    }

    private resolveDefaultBlockBack(type: HUIType, layer: HUILayerName): boolean {
        return type === 'page' && layer === 'layer1';
    }

    private resolveCacheMode(config: Partial<HUIConfig>): HUICacheMode {
        if (config.cacheMode) {
            return config.cacheMode;
        }
        if (config.type === 'page' || config.type === 'loading' || config.type === 'tip') {
            return 'hide';
        }
        return 'destroy';
    }

    private collectRecordIds(predicate: (record: HUIRecord) => boolean): string[] {
        const ids: string[] = [];
        this.records.forEach((record) => {
            if (predicate(record)) {
                ids.push(record.id);
            }
        });
        return ids;
    }

    private getRecord(id: string): HUIRecord | null {
        const record = this.records.get(id);
        if (!record) {
            return null;
        }

        if (!isValid(record.node)) {
            this.records.delete(id);
            this.stack.remove(id);
            return null;
        }

        return record;
    }

    private async ensureLoadingVisible(message?: string): Promise<void> {
        const registered = this.configs.get(this.defaultLoadingId);
        if (registered) {
            await this.open({
                ...registered,
                type: 'loading',
                layer: registered.layer || 'transition',
                cacheMode: registered.cacheMode || 'keep',
                params: { message },
            });
            this.setLoadingMessage(message || '加载中');
            return;
        }

        const record = this.getOrCreateDefaultLoadingRecord();
        record.node.active = true;
        this.setLoadingMessage(message || '加载中');
    }

    private hideLoadingRecord(): void {
        const record = this.getLoadingRecord();
        if (record) {
            this.hideScript(record);
        }
    }

    private getLoadingRecord(): HUIRecord | null {
        const registered = this.getRecord(this.defaultLoadingId);
        if (registered) {
            return registered;
        }

        let result: HUIRecord | null = null;
        this.records.forEach((record) => {
            if (record.type === 'loading' && !result) {
                result = record;
            }
        });
        return result;
    }

    private getOrCreateDefaultLoadingRecord(): HUIRecord {
        const existing = this.getRecord(this.defaultLoadingId);
        if (existing) {
            return existing;
        }

        const node = new Node(this.defaultLoadingId);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(520, 96);

        const label = node.addComponent(Label);
        label.string = '加载中';
        label.fontSize = 28;
        label.lineHeight = 34;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        node.active = false;
        const config = this.normalizeConfig({
            id: this.defaultLoadingId,
            type: 'loading',
            layer: 'transition',
            cacheMode: 'keep',
            prefabPath: '',
            singleton: true,
        });
        const record = this.createRecord(config, node);
        this.records.set(record.id, record);
        this.attachToLayer(record);
        return record;
    }

    private ensureInit(): void {
        if (!this.root) {
            throw new Error('[HUIFacade] 请先调用 H.ui.init(root) 或 H.init({ uiRoot })');
        }
    }
}
