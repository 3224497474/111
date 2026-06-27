import {
    assetManager,
    AssetManager,
    director,
    find,
    instantiate,
    isValid,
    Node,
    Prefab,
} from 'cc';
import { RemotePrefabCache } from '../../remote/RemotePrefabCache';
import { AnimatedUIBase } from './AnimatedUIBase';
import { PANEL_LOAD_CONFIG } from './UIPanelId';

export type PanelGroup = 'main' | 'sub' | 'popup' | string;

export enum UIPanelId {
    Home = 'Home',
    BackPack = 'BackPack',
    Shop = 'Shop',
    Challenge = 'Challenge',
    Dialog = 'Dialog',
    CommonDialog = 'CommonDialog',
    TransitionScreen = 'TransitionScreen',
}

interface IPanelLifecycle {
    node?: Node;
    zIndex?: number;
    uiPanelId?: string;
    init?(params?: any): void;
    show?(params?: any): void;
    hide?(): void;
    onUIOpen?(params?: any): void;
    onUIClose?(): void;
    updateInfo?(): void;
}

interface PanelRecord {
    id: UIPanelId;
    node: Node;
    script?: IPanelLifecycle | null;
    group?: PanelGroup;
    exclusiveInGroup: boolean;
    order: number;
    onOpen?: (params?: any) => void;
    onClose?: () => void;
}

export interface RegisterPanelOptions {
    group?: PanelGroup;
    exclusiveInGroup?: boolean;
    onOpen?: (params?: any) => void;
    onClose?: () => void;
    order?: number;
    isMain?: boolean;
    script?: IPanelLifecycle | null;
}

interface PopupRequest {
    id: UIPanelId;
    params?: any;
}

/**
 * 统一 UI 管理器。
 * 负责面板注册、弹窗队列、UIRoot 分层挂载和预制体自动加载。
 */
export class UIManager {
    private static _inst: UIManager | null = null;
    private readonly MAX_CACHED_PANELS = 5;

    public static get instance(): UIManager {
        if (!this._inst) {
            this._inst = new UIManager();
        }
        return this._inst;
    }

    private _panels = new Map<UIPanelId, PanelRecord>();
    private _currentByGroup = new Map<PanelGroup, UIPanelId>();
    private _loadingPanels = new Map<UIPanelId, Promise<void>>();
    private _uiRootNode: Node | null = null;
    private _uiRootLayers = new Map<string, Node>();

    private _popupQueue: PopupRequest[] = [];
    private _currentPopup: UIPanelId | null = null;
    private _closingPopup: UIPanelId | null = null;
    private _blockerTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    /**
     * 初始化全局 UIRoot。
     * 默认从 resources bundle 加载，也支持 `bundle:path` 形式。
     */
    public async initUIRoot(rootPrefabPath: string): Promise<Node | null> {
        if (!rootPrefabPath) {
            console.warn('[UIManager] initUIRoot failed, rootPrefabPath is empty.');
            return null;
        }

        if (this._uiRootNode && isValid(this._uiRootNode)) {
            this.cacheUIRootLayers(this._uiRootNode);
            return this._uiRootNode;
        }

        const scene = director.getScene();
        if (!scene) {
            console.warn('[UIManager] initUIRoot failed, scene is not ready.');
            return null;
        }

        const { bundleName, prefabPath } = this.parsePrefabLocation(rootPrefabPath);

        let prefab = RemotePrefabCache.get(bundleName, prefabPath) as Prefab | null;
        const loadedFromCache = !!prefab;

        if (!prefab) {
            const bundle = await this.loadBundleAsync(bundleName);
            prefab = await this.loadPrefabFromBundle(bundle, prefabPath);
        }

        let rootNode: Node;
        try {
            rootNode = instantiate(prefab as Prefab);
        } finally {
            if (loadedFromCache) {
                RemotePrefabCache.release(bundleName, prefabPath);
            }
        }

        scene.addChild(rootNode);
        director.addPersistRootNode(rootNode);

        this._uiRootNode = rootNode;
        this.cacheUIRootLayers(rootNode);

        return rootNode;
    }

    /**
     * 注册已经存在的面板节点。
     */
    registerPanel(
        id: UIPanelId,
        node: Node,
        options?: RegisterPanelOptions,
    ): void {
        if (!node) {
            console.warn('[UIManager] registerPanel failed, node is null:', id);
            return;
        }

        const isMain = !!options?.isMain;
        const group: PanelGroup | undefined =
            options?.group ?? (isMain ? 'main' : undefined);
        const exclusiveInGroup =
            options?.exclusiveInGroup ?? (group ? true : false);
        const order = options?.order ?? 0;
        const script = options?.script ?? this.resolvePanelScript(id, node);

        if (script) {
            script.uiPanelId = id;
        }

        this._panels.set(id, {
            id,
            node,
            script,
            group,
            exclusiveInGroup,
            order,
            onOpen: options?.onOpen,
            onClose: options?.onClose,
        });
    }

    /**
     * 打开普通面板。
     * 如果同组互斥，则会先关闭同组内已显示的面板。
     */
    public open(id: UIPanelId, params?: any): void {
        const record = this._panels.get(id);
        if (!record) {
            console.warn('[UIManager] open failed, panel not registered:', id);
            return;
        }

        if (!isValid(record.node)) {
            this.removePanelCache(id);
            console.warn('[UIManager] open skipped, panel node is invalid:', id);
            return;
        }

        const { group, exclusiveInGroup } = record;

        if (group && exclusiveInGroup) {
            for (const other of this._panels.values()) {
                if (
                    other.id !== id &&
                    other.group === group &&
                    other.node.active
                ) {
                    this.invokePanelClose(other);
                }
            }
            this._currentByGroup.set(group, id);
        }

        if (record.order > 0) {
            try {
                record.node.setSiblingIndex(record.order);
            } catch {
                // 节点尚未挂载到父节点时，忽略层级设置异常。
            }
        }

        this.invokePanelOpen(record, params);
    }

    /**
     * 关闭普通面板。
     */
    public close(id: UIPanelId): void {
        const record = this._panels.get(id);
        if (!record) {
            console.warn('[UIManager] close failed, panel not registered:', id);
            return;
        }

        if (!isValid(record.node)) {
            this.removePanelCache(id);
            this.finalizePopupIfNeeded(id);
            return;
        }

        if (!record.node.active) {
            return;
        }

        this.invokePanelClose(record);

        const { group } = record;
        if (group && this._currentByGroup.get(group) === id) {
            this._currentByGroup.delete(group);
        }
    }

    public toggle(id: UIPanelId, params?: any): void {
        if (this.isOpen(id)) {
            this.close(id);
        } else {
            this.open(id, params);
        }
    }

    public isOpen(id: UIPanelId): boolean {
        const record = this._panels.get(id);
        return !!record && isValid(record.node) && record.node.active;
    }

    public getNode(id: UIPanelId): Node | null {
        return this._panels.get(id)?.node ?? null;
    }

    public getCurrentInGroup(group: PanelGroup): UIPanelId | null {
        return this._currentByGroup.get(group) ?? null;
    }

    public closeGroup(group: PanelGroup): void {
        for (const record of this._panels.values()) {
            if (record.group !== group || !isValid(record.node) || !record.node.active) {
                continue;
            }

            this.close(record.id);
        }
    }

    public hasPanel(id: UIPanelId): boolean {
        const record = this._panels.get(id);
        return !!record && isValid(record.node);
    }

    /**
     * 按配置自动加载并打开普通面板。
     */
    public async openWithLoad(
        id: UIPanelId,
        parent?: Node,
        params?: any,
    ): Promise<void> {
        if (!this.hasPanel(id)) {
            await this.loadAndRegisterPanel(id, parent);
        }
        this.open(id, params);
    }

    /**
     * 统一弹窗打开入口。
     */
    public async openPopup(id: UIPanelId, params?: any): Promise<void> {
        if (!this.hasPanel(id)) {
            await this.loadAndRegisterPanel(id);
        }

        this._popupQueue.push({ id, params });
        this.tryOpenNextPopup();
    }

    /**
     * 关闭当前弹窗，或关闭指定弹窗。
     */
    public closePopup(id?: UIPanelId): void {
        const targetId = id ?? this._currentPopup;
        if (!targetId) {
            return;
        }

        if (this._currentPopup !== targetId) {
            this._popupQueue = this._popupQueue.filter(
                (request) => request.id !== targetId,
            );
            return;
        }

        const record = this._panels.get(targetId);
        if (!record) {
            this.finalizePopupClose(targetId);
            return;
        }

        this._closingPopup = targetId;
        this.invokePanelClose(record);
    }

    /**
     * 供带异步关闭动画的弹窗在真正关闭后回调。
     */
    public notifyPopupClosed(id: UIPanelId): void {
        if (this._currentPopup !== id && this._closingPopup !== id) {
            return;
        }

        this.finalizePopupClose(id);
    }

    /**
     * 尝试打开队列中的下一个弹窗。
     */
    private tryOpenNextPopup(): void {
        if (this._currentPopup || this._closingPopup) {
            return;
        }

        const next = this._popupQueue.shift();
        if (!next) {
            return;
        }

        this._currentPopup = next.id;
        this.open(next.id, next.params);
    }

    /**
     * 标记弹窗彻底关闭，并继续处理队列。
     */
    private finalizePopupClose(id: UIPanelId): void {
        if (this._currentPopup === id) {
            this._currentPopup = null;
        }
        if (this._closingPopup === id) {
            this._closingPopup = null;
        }
        this.tryOpenNextPopup();
    }

    /**
     * 从缓存和分组索引中安全移除面板记录。
     */
    private removePanelCache(id: UIPanelId): void {
        const record = this._panels.get(id);
        if (!record) {
            return;
        }

        this._panels.delete(id);

        if (record.group && this._currentByGroup.get(record.group) === id) {
            this._currentByGroup.delete(record.group);
        }
    }

    /**
     * 如果被销毁的面板正处于弹窗关闭流程中，同步收尾弹窗状态。
     */
    private finalizePopupIfNeeded(id: UIPanelId): void {
        if (this._currentPopup === id || this._closingPopup === id) {
            this.finalizePopupClose(id);
        }
    }

    /**
     * 统一打开生命周期调度。
     * 先注入 `init(params)`，有动画组件时由 `AnimatedUIBase` 接管入场，
     * 否则走原有生命周期。
     */
    private invokePanelOpen(record: PanelRecord, params?: any): void {
        const animated = this.findAnimatedComponent(record.node);
        if (animated) {
            animated.autoPlayEnter = false;
        }

        if (!record.node.active) {
            record.node.active = true;
        }

        if (record.script && typeof record.script.init === 'function') {
            record.script.init(params);
        }

        if (animated) {
            animated.show();
            return;
        }

        if (record.onOpen) {
            record.onOpen(params);
        } else if (record.script?.onUIOpen) {
            record.script.onUIOpen(params);
        } else if (record.script?.show) {
            record.script.show(params);
        }
    }

    /**
     * 统一关闭生命周期调度。
     * 如果带 `AnimatedUIBase`，则先播放退场动画，动画结束后再执行关闭逻辑。
     */
    private invokePanelClose(record: PanelRecord): void {
        if (!isValid(record.node)) {
            this.removePanelCache(record.id);
            this.finalizePopupIfNeeded(record.id);
            this.finishPopupCloseIfNeeded(record, false);
            return;
        }

        const animated = this.findAnimatedComponent(record.node);
        if (animated) {
            animated.hide(() => {
                this.finalizePanelCloseLifecycle(record, animated);
            });
            return;
        }

        this.finalizePanelCloseLifecycle(record);
    }

    /**
     * 执行真正的关闭生命周期。
     * 面板可能会在 `onClose`、`onUIClose` 或 `hide` 内部自行销毁，
     * 所以每一步都需要重新校验节点有效性。
     */
    private finalizePanelCloseLifecycle(
        record: PanelRecord,
        animated?: AnimatedUIBase | null,
    ): void {
        if (!isValid(record.node)) {
            this.removePanelCache(record.id);
            this.finalizePopupIfNeeded(record.id);
            this.finishPopupCloseIfNeeded(record, false);
            return;
        }

        if (record.onClose) {
            record.onClose();
            if (!isValid(record.node)) {
                this.removePanelCache(record.id);
                this.finalizePopupIfNeeded(record.id);
                this.finishPopupCloseIfNeeded(record, false);
                return;
            }
            this.finishPopupCloseIfNeeded(record, false);
            return;
        }

        if (record.script?.onUIClose) {
            if (animated) {
                record.node.active = false;
            }
            record.script.onUIClose();
            if (!isValid(record.node)) {
                this.removePanelCache(record.id);
                this.finalizePopupIfNeeded(record.id);
            }
            if (!record.node.active) {
                this.checkAndClearCache();
            }
            return;
        }

        if (record.script?.hide && record.script !== animated) {
            if (animated) {
                record.node.active = false;
            }
            record.script.hide();
            if (!isValid(record.node)) {
                this.removePanelCache(record.id);
                this.finalizePopupIfNeeded(record.id);
                this.finishPopupCloseIfNeeded(record, false);
                return;
            }
            if (!record.node.active) {
                this.checkAndClearCache();
            }
            this.finishPopupCloseIfNeeded(record, false);
            return;
        }

        record.node.active = false;
        this.checkAndClearCache();

        if (!isValid(record.node)) {
            this.removePanelCache(record.id);
            this.finalizePopupIfNeeded(record.id);
            this.finishPopupCloseIfNeeded(record, false);
            return;
        }

        this.finishPopupCloseIfNeeded(record, false);
    }

    /**
     * 对同步关闭的弹窗，在生命周期完成后继续消费队列。
     */
    private finishPopupCloseIfNeeded(record: PanelRecord, isAsyncClose: boolean): void {
        if (isAsyncClose) {
            return;
        }

        if (this._closingPopup === record.id && !record.script?.onUIClose) {
            this.finalizePopupClose(record.id);
        }
    }

    /**
     * 控制隐藏面板的缓存数量，避免非主界面面板长期堆积。
     */
    private checkAndClearCache(): void {
        const hiddenPanels: PanelRecord[] = [];

        for (const record of this._panels.values()) {
            if (!isValid(record.node)) {
                this.removePanelCache(record.id);
                continue;
            }

            if (record.group === 'main' || record.node.active) {
                continue;
            }

            hiddenPanels.push(record);
        }

        if (hiddenPanels.length <= this.MAX_CACHED_PANELS) {
            return;
        }

        const overflowCount = hiddenPanels.length - this.MAX_CACHED_PANELS;
        const overflowPanels = hiddenPanels.slice(0, overflowCount);

        for (const record of overflowPanels) {
            if (isValid(record.node)) {
                record.node.destroy();
            }
            this.removePanelCache(record.id);
        }
    }

    /**
     * 根据配置里的 `rootScript` 自动解析根脚本。
     */
    private resolvePanelScript(
        id: UIPanelId,
        node: Node,
    ): IPanelLifecycle | null {
        const cfg = PANEL_LOAD_CONFIG[id];
        if (!cfg?.rootScript) {
            return null;
        }

        return node.getComponent(cfg.rootScript as any) as IPanelLifecycle | null;
    }

    /**
     * 查找面板上的动画组件。
     */
    private findAnimatedComponent(node: Node): AnimatedUIBase | null {
        return node.getComponent(AnimatedUIBase)
            ?? node.getComponentInChildren(AnimatedUIBase);
    }

    /**
     * 解析 prefab 的父节点。
     * 优先级：
     * 1. 显式传入的 `parent`
     * 2. UIRoot 分组层级
     * 3. 配置中的 `parentPath`
     * 4. UIRoot 根节点
     * 5. 默认 Canvas
     */
    private resolveParentNode(
        parent?: Node,
        parentPath?: string,
        group?: PanelGroup,
    ): Node | null {
        if (parent) {
            return parent;
        }

        if (group) {
            const groupLayer = this.findUIRootLayerByGroup(group);
            if (groupLayer) {
                return groupLayer;
            }
        }

        if (parentPath) {
            const found = find(parentPath);
            if (found) {
                return found;
            }

            if (this._uiRootNode && isValid(this._uiRootNode)) {
                const foundInUIRoot = find(parentPath, this._uiRootNode);
                if (foundInUIRoot) {
                    return foundInUIRoot;
                }
            }
        }

        if (this._uiRootNode && isValid(this._uiRootNode)) {
            return this._uiRootNode;
        }

        return director.getScene()?.getChildByName('Canvas') ?? null;
    }

    /**
     * 带并发保护的面板加载入口。
     */
    private async loadAndRegisterPanel(
        id: UIPanelId,
        parent?: Node,
    ): Promise<void> {
        if (this._loadingPanels.has(id)) {
            await this._loadingPanels.get(id);
            return;
        }

        if (this.hasPanel(id)) {
            return;
        }

        this.setBlockerActive(true);

        const task = this.loadAndRegisterPanelInternal(id, parent);
        this._loadingPanels.set(id, task);

        try {
            await task;
        } finally {
            this._loadingPanels.delete(id);
            if (this._loadingPanels.size === 0) {
                this.setBlockerActive(false);
            }
        }
    }

    /**
     * 实际的自动加载逻辑。
     */
    private async loadAndRegisterPanelInternal(
        id: UIPanelId,
        parent?: Node,
    ): Promise<void> {
        const cfg = PANEL_LOAD_CONFIG[id];
        if (!cfg) {
            console.warn('[UIManager] loadAndRegisterPanel missing config:', id);
            return;
        }

        const parentNode = this.resolveParentNode(parent, cfg.parentPath, cfg.group);
        if (!parentNode) {
            console.warn('[UIManager] cannot find parent node for panel:', id, cfg.parentPath);
            return;
        }

        let prefab = RemotePrefabCache.get(cfg.bundleName, cfg.prefabPath) as Prefab | null;
        const loadedFromCache = !!prefab;

        if (!prefab) {
            const bundle = await this.loadBundleAsync(cfg.bundleName);
            prefab = await this.loadPrefabFromBundle(bundle, cfg.prefabPath);
        }

        let node: Node;
        try {
            node = instantiate(prefab as Prefab);
        } finally {
            if (loadedFromCache) {
                RemotePrefabCache.release(cfg.bundleName, cfg.prefabPath);
            }
        }

        node.parent = parentNode;
        node.active = false;

        let script: IPanelLifecycle | null = null;
        if (cfg.rootScript) {
            script = node.getComponent(cfg.rootScript as any) as IPanelLifecycle | null;
            if (!script) {
                console.warn(
                    '[UIManager] root script not found on instantiated node:',
                    cfg.rootScript,
                    'panel:',
                    id,
                );
            }
        }

        this.registerPanel(id, node, {
            group: cfg.group,
            exclusiveInGroup: cfg.exclusiveInGroup,
            order: cfg.order,
            script,
        });

        console.log('[UIManager] panel loaded and registered:', id, 'script=', cfg.rootScript, !!script);
    }

    /**
     * 异步加载 bundle。
     */
    private loadBundleAsync(name: string): Promise<AssetManager.Bundle> {
        return new Promise((resolve, reject) => {
            const existing = assetManager.getBundle(name);
            if (existing) {
                resolve(existing);
                return;
            }

            assetManager.loadBundle(name, (err, bundle) => {
                if (err || !bundle) {
                    reject(err ?? new Error(`Bundle load failed: ${name}`));
                    return;
                }
                resolve(bundle);
            });
        });
    }

    /**
     * 解析 UIRoot 资源路径。
     * 支持：
     * 1. `prefab/ui/UIRoot`，默认走 resources
     * 2. `bundleName:prefab/ui/UIRoot`
     */
    private parsePrefabLocation(rootPrefabPath: string): {
        bundleName: string;
        prefabPath: string;
    } {
        const normalizedPath = rootPrefabPath.trim();
        const separatorIndex = normalizedPath.indexOf(':');

        if (separatorIndex > 0) {
            return {
                bundleName: normalizedPath.slice(0, separatorIndex),
                prefabPath: normalizedPath.slice(separatorIndex + 1),
            };
        }

        return {
            bundleName: 'resources',
            prefabPath: normalizedPath,
        };
    }

    /**
     * 缓存 UIRoot 的直接子节点。
     */
    private cacheUIRootLayers(rootNode: Node): void {
        this._uiRootLayers.clear();

        for (const child of rootNode.children) {
            this._uiRootLayers.set(child.name, child);
        }
    }

    /**
     * 根据 group 在 UIRoot 中查找对应层级节点。
     */
    private findUIRootLayerByGroup(group: PanelGroup): Node | null {
        if (!this._uiRootNode || !isValid(this._uiRootNode)) {
            return null;
        }

        const candidates = this.buildGroupLayerCandidates(group);
        for (const name of candidates) {
            const layerNode = this._uiRootLayers.get(name);
            if (layerNode && isValid(layerNode)) {
                return layerNode;
            }
        }

        return null;
    }

    /**
     * 根据 group 生成候选层级名称。
     * 例如：`popup -> popup / Popup / PopupLayer`
     */
    private buildGroupLayerCandidates(group: PanelGroup): string[] {
        const rawGroup = String(group).trim();
        if (!rawGroup) {
            return [];
        }

        const pascalCase = rawGroup
            .split(/[-_\s]+/)
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('');

        const candidates = new Set<string>();
        candidates.add(rawGroup);

        if (pascalCase) {
            candidates.add(pascalCase);
        }

        if (!/Layer$/i.test(rawGroup)) {
            const capitalized = rawGroup.charAt(0).toUpperCase() + rawGroup.slice(1);
            candidates.add(`${capitalized}Layer`);

            if (pascalCase) {
                candidates.add(`${pascalCase}Layer`);
            }
        }

        return Array.from(candidates);
    }

    /**
     * 从指定 bundle 加载 prefab。
     */
    private loadPrefabFromBundle(
        bundle: AssetManager.Bundle,
        path: string,
    ): Promise<Prefab> {
        return new Promise((resolve, reject) => {
            bundle.load(path, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err ?? new Error(`Prefab load failed: ${bundle.name}/${path}`));
                    return;
                }
                resolve(prefab);
            });
        });
    }

    /**
     * 控制全局防连点遮罩显隐。
     */
    private setBlockerActive(active: boolean): void {
        if (!this._uiRootNode || !isValid(this._uiRootNode)) {
            return;
        }

        const blockerLayer = this._uiRootLayers.get('BlockerLayer');
        if (!blockerLayer || !isValid(blockerLayer)) {
            return;
        }

        const loadingIcon = blockerLayer.getChildByName('LoadingIcon');

        if (this._blockerTimer !== null) {
            globalThis.clearTimeout(this._blockerTimer);
            this._blockerTimer = null;
        }

        if (active) {
            blockerLayer.active = true;

            if (loadingIcon && isValid(loadingIcon)) {
                loadingIcon.active = false;
            }

            this._blockerTimer = globalThis.setTimeout(() => {
                this._blockerTimer = null;

                if (!isValid(blockerLayer) || !blockerLayer.active) {
                    return;
                }

                if (loadingIcon && isValid(loadingIcon)) {
                    loadingIcon.active = true;
                }
            }, 300);

            return;
        }

        if (loadingIcon && isValid(loadingIcon)) {
            loadingIcon.active = false;
        }

        blockerLayer.active = false;
    }
}
