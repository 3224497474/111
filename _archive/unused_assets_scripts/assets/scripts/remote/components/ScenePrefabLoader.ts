import {
  _decorator,
  assetManager,
  AssetManager,
  Component,
  error,
  instantiate,
  log,
  Node,
  Prefab,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ScenePrefabLoader')
export class ScenePrefabLoader extends Component {
  @property({
    tooltip: 'Prefab 所在的 Asset Bundle 名称',
    displayName: 'Bundle 名称',
  })
  public bundleName = '';

  @property({
    tooltip: 'Prefab 相对路径，不包含扩展名',
    displayName: 'Prefab 路径',
  })
  public prefabPath = '';

  @property({
    type: Node,
    tooltip: '实例挂载节点，留空则挂到当前节点',
    displayName: '挂载节点',
  })
  public targetNode: Node | null = null;

  @property({
    tooltip: '是否在 start 时自动加载',
    displayName: '自动加载',
  })
  public loadOnStart = true;

  @property({
    tooltip: '加载前是否清空目标节点的子节点',
    displayName: '清空现有内容',
  })
  public clearTargetBeforeLoad = false;

  @property({
    tooltip: '加载失败时的重试次数',
    displayName: '重试次数',
  })
  public retryCount = 0;

  @property({
    tooltip: '重试间隔，单位毫秒',
    displayName: '重试间隔(ms)',
    visible(this: ScenePrefabLoader) {
      return this.retryCount > 0;
    },
  })
  public retryInterval = 1000;

  private loadedInstance: Node | null = null;
  private isLoading = false;
  private loadCallbacks: {
    onStart?: () => void;
    onSuccess?: (node: Node) => void;
    onFail?: (err: Error) => void;
    onProgress?: (progress: number) => void;
  } = {};

  onLoad() {
    if (!this.targetNode) {
      this.targetNode = this.node;
    }
  }

  async start() {
    if (this.loadOnStart && this.bundleName && this.prefabPath) {
      await this.load();
    }
  }

  public async load(customBundle?: string, customPath?: string): Promise<Node | null> {
    if (this.isLoading) {
      log('[ScenePrefabLoader] 正在加载中，请勿重复调用');
      return null;
    }

    const bundleName = customBundle || this.bundleName;
    const prefabPath = customPath || this.prefabPath;

    if (!bundleName) {
      const err = new Error('[ScenePrefabLoader] Bundle 名不能为空');
      error(err.message);
      this.triggerFail(err);
      return null;
    }

    if (!prefabPath) {
      const err = new Error('[ScenePrefabLoader] Prefab 路径不能为空');
      error(err.message);
      this.triggerFail(err);
      return null;
    }

    this.isLoading = true;
    this.triggerStart();

    try {
      const result = await this.loadWithRetry(bundleName, prefabPath, this.retryCount);
      this.loadedInstance = result;
      this.triggerSuccess(result);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.triggerFail(errorObj);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  public unload() {
    if (!this.loadedInstance) {
      return;
    }

    if (this.loadedInstance.parent) {
      this.loadedInstance.removeFromParent();
    }

    const bundle = assetManager.getBundle(this.bundleName);
    if (bundle) {
      bundle.release(this.prefabPath, Prefab);
    }

    this.loadedInstance.destroy();
    this.loadedInstance = null;
    log('[ScenePrefabLoader] 已卸载 Prefab');
  }

  public async reload(): Promise<Node | null> {
    this.unload();
    return this.load();
  }

  public getLoadedInstance(): Node | null {
    return this.loadedInstance;
  }

  public onLoadStart(callback: () => void): this {
    this.loadCallbacks.onStart = callback;
    return this;
  }

  public onLoadSuccess(callback: (node: Node) => void): this {
    this.loadCallbacks.onSuccess = callback;
    return this;
  }

  public onLoadFail(callback: (err: Error) => void): this {
    this.loadCallbacks.onFail = callback;
    return this;
  }

  public onLoadProgress(callback: (progress: number) => void): this {
    this.loadCallbacks.onProgress = callback;
    return this;
  }

  onDestroy() {
    this.unload();
  }

  private async loadWithRetry(bundleName: string, prefabPath: string, retriesLeft: number): Promise<Node> {
    try {
      const bundle = await this.loadBundleAsync(bundleName);
      const prefab = await this.loadPrefabFromBundle(bundle, prefabPath);

      if (this.clearTargetBeforeLoad && this.targetNode) {
        this.targetNode.removeAllChildren();
      }

      const instance = instantiate(prefab);
      if (this.targetNode) {
        this.targetNode.addChild(instance);
      }
      return instance;
    } catch (err) {
      if (retriesLeft > 0) {
        log(`[ScenePrefabLoader] 加载失败，${retriesLeft} 次重试机会，${this.retryInterval}ms 后重试`);
        await this.delay(this.retryInterval);
        return this.loadWithRetry(bundleName, prefabPath, retriesLeft - 1);
      }
      throw err;
    }
  }

  private triggerStart() {
    if (this.loadCallbacks.onStart) {
      this.loadCallbacks.onStart();
    }
  }

  private triggerSuccess(node: Node) {
    if (this.loadCallbacks.onSuccess) {
      this.loadCallbacks.onSuccess(node);
    }
  }

  private triggerFail(err: Error) {
    if (this.loadCallbacks.onFail) {
      this.loadCallbacks.onFail(err);
    }
  }

  private loadBundleAsync(name: string): Promise<AssetManager.Bundle> {
    return new Promise((resolve, reject) => {
      const existing = assetManager.getBundle(name);
      if (existing) {
        log(`[ScenePrefabLoader] Bundle 已存在: ${name}`);
        resolve(existing);
        return;
      }

      log(`[ScenePrefabLoader] 开始加载 Bundle: ${name}`);
      assetManager.loadBundle(name, (err, bundle) => {
        if (err || !bundle) {
          reject(err || new Error(`Bundle 加载失败: ${name}`));
          return;
        }
        log(`[ScenePrefabLoader] Bundle 加载成功: ${name}`);
        resolve(bundle);
      });
    });
  }

  private loadPrefabFromBundle(bundle: AssetManager.Bundle, path: string): Promise<Prefab> {
    return new Promise((resolve, reject) => {
      log(`[ScenePrefabLoader] 开始加载 Prefab: ${path}`);
      bundle.load(path, Prefab, (err, prefab) => {
        if (err || !prefab) {
          reject(err || new Error(`Prefab 加载失败: ${path}`));
          return;
        }
        log(`[ScenePrefabLoader] Prefab 加载成功: ${path}`);
        resolve(prefab);
      });
    });
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
