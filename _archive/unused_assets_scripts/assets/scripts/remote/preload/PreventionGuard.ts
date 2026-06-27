import { _decorator, assetManager, Bundle, Component, director, Label, Node, ProgressBar } from 'cc';
import {
  CRITICAL_ASSETS,
  CRITICAL_DIRS,
  DEFAULT_ASSET_TYPE,
  GAME_SCENE,
  GAME_SCENE_BUNDLE,
  PRELOAD_BUNDLES,
  WEIGHTS,
} from './PreloadConfig';

const { ccclass, property } = _decorator;

@ccclass('PreventionGuard')
export class PreventionGuard extends Component {
  @property(Node)
  overlay: Node | null = null;

  @property(ProgressBar)
  progressBar: ProgressBar | null = null;

  @property(Label)
  percentLabel: Label | null = null;

  @property(Label)
  tipLabel: Label | null = null;

  @property({ type: [String] })
  preloadBundles: string[] = PRELOAD_BUNDLES.slice();

  @property
  gameSceneName: string = GAME_SCENE;

  @property
  gameSceneBundle: string = GAME_SCENE_BUNDLE;

  @property
  autoStart = true;

  @property
  makePersistent = true;

  @property
  cleanupOnEnter = true;

  private bundlesLoaded = 0;
  private bundlesTotal = 0;
  private dirSlots: number[] = [];
  private assetCount = 0;
  private assetDone = 0;
  private sceneProgress = 0;

  onLoad() {
    if (this.makePersistent) {
      director.addPersistRootNode(this.node);
    }
  }

  start() {
    if (this.autoStart) {
      void this.run();
    }
  }

  async run() {
    this.setOverlay(true);
    this.setTip('正在准备资源…');

    try {
      assetManager.downloader.maxConcurrency = Math.max(assetManager.downloader.maxConcurrency ?? 6, 8);
      assetManager.downloader.retryCount = 2;
      assetManager.downloader.retryInterval = 400;
    } catch {}

    const needBundles = new Set<string>([
      ...this.preloadBundles,
      ...Object.keys(CRITICAL_DIRS),
      ...Object.keys(CRITICAL_ASSETS),
      this.gameSceneBundle || 'main',
    ]);

    this.bundlesLoaded = 0;
    this.bundlesTotal = needBundles.size;

    const loadBundle = (name: string) => new Promise<Bundle>((resolve, reject) => {
      const existing = assetManager.getBundle(name);
      if (existing) {
        this.bundlesLoaded += 1;
        this.updateUI();
        resolve(existing);
        return;
      }

      assetManager.loadBundle(name, (err, bundle) => {
        if (err || !bundle) {
          reject(err);
          return;
        }

        this.bundlesLoaded += 1;
        this.updateUI();
        resolve(bundle);
      });
    });

    try {
      await Promise.all([...needBundles].map(loadBundle));
    } catch (err) {
      this.failAndStop('Bundle 加载失败', err);
      return;
    }

    const dirPairs: Array<{ bundle: string; dir: string }> = [];
    for (const [bundleName, dirs] of Object.entries(CRITICAL_DIRS)) {
      for (const dir of dirs) {
        dirPairs.push({ bundle: bundleName, dir });
      }
    }
    this.dirSlots = Array.from({ length: dirPairs.length }, () => 0);

    const assetPairs: Array<{ bundle: string; path: string }> = [];
    for (const [bundleName, assets] of Object.entries(CRITICAL_ASSETS)) {
      for (const path of assets) {
        assetPairs.push({ bundle: bundleName, path });
      }
    }
    this.assetCount = assetPairs.length;
    this.assetDone = 0;

    for (let i = 0; i < dirPairs.length; i++) {
      const pair = dirPairs[i];
      const bundle = assetManager.getBundle(pair.bundle);
      if (!bundle) {
        this.failAndStop(`缺少 Bundle: ${pair.bundle}`);
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          bundle.preloadDir(pair.dir, DEFAULT_ASSET_TYPE as never, (completed, total) => {
            this.dirSlots[i] = total > 0 ? completed / total : 1;
            this.updateUI();
          }, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } catch (err) {
        this.failAndStop(`预加载目录失败: ${pair.bundle}/${pair.dir}`, err);
        return;
      }
    }

    for (const pair of assetPairs) {
      const bundle = assetManager.getBundle(pair.bundle);
      if (!bundle) {
        this.failAndStop(`缺少 Bundle: ${pair.bundle}`);
        return;
      }

      try {
        await new Promise<void>((resolve, reject) => {
          bundle.preload(pair.path, DEFAULT_ASSET_TYPE as never, (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.assetDone += 1;
            this.updateUI();
            resolve();
          });
        });
      } catch (err) {
        this.failAndStop(`预加载资源失败: ${pair.bundle}/${pair.path}`, err);
        return;
      }
    }

    const sceneBundle = assetManager.getBundle(this.gameSceneBundle) || assetManager.getBundle('main');
    if (!sceneBundle) {
      this.failAndStop('未找到用于加载场景的 Bundle');
      return;
    }

    this.setTip('即将进入游戏…');
    try {
      await new Promise<void>((resolve, reject) => {
        sceneBundle.preloadScene(this.gameSceneName, (completed, total) => {
          this.sceneProgress = total > 0 ? completed / total : 1;
          this.updateUI();
        }, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    } catch (err) {
      this.failAndStop(`预加载场景失败: ${this.gameSceneName}`, err);
      return;
    }

    this.setTip('资源就绪，正在进入…');
    this.setOverlay(false);
    if (this.cleanupOnEnter && this.makePersistent) {
      director.loadScene(this.gameSceneName, () => {
        try {
          director.removePersistRootNode(this.node);
        } catch {}
        this.node.destroy();
      });
      return;
    }

    director.loadScene(this.gameSceneName);
  }

  private overallProgress() {
    const bundlesProgress = this.bundlesTotal > 0 ? this.bundlesLoaded / this.bundlesTotal : 1;
    const dirCount = this.dirSlots.length;
    const dirSum = this.dirSlots.reduce((sum, value) => sum + value, 0);
    const criticalUnits = dirCount + this.assetCount;
    const criticalProgress = criticalUnits > 0 ? (dirSum + this.assetDone) / criticalUnits : 1;
    const progress = WEIGHTS.bundles * bundlesProgress + WEIGHTS.critical * criticalProgress + WEIGHTS.scene * this.sceneProgress;
    return Math.min(Math.max(progress, 0), 1);
  }

  private updateUI() {
    const progress = this.overallProgress();
    if (this.progressBar) {
      this.progressBar.progress = progress;
    }
    if (this.percentLabel) {
      this.percentLabel.string = `${Math.round(progress * 100)}%`;
    }
  }

  private setOverlay(active: boolean) {
    if (this.overlay) {
      this.overlay.active = active;
    }
  }

  private setTip(message: string) {
    if (this.tipLabel) {
      this.tipLabel.string = message;
    }
  }

  private failAndStop(message: string, err?: unknown) {
    console.error(`[PreventionGuard] ${message}`, err);
    this.setTip(`${message}，请检查网络或远程资源。`);
  }
}
