import { _decorator, assetManager, Bundle, Component, director } from 'cc';
import { DEFAULT_TYPE, Group, PREFETCH_PLAN } from './PreloadPlan';

const { ccclass, property } = _decorator;

@ccclass('BackgroundPrefetcher')
export class BackgroundPrefetcher extends Component {
  @property
  autoPersist = true;

  @property
  concurrency = 2;

  private running = false;
  private queue: string[] = [];
  private enqueued = new Set<string>();

  onLoad() {
    if (this.autoPersist) {
      director.addPersistRootNode(this.node);
    }
  }

  queueGroup(name: string, front = false) {
    if (!PREFETCH_PLAN[name] || this.enqueued.has(name)) {
      return;
    }

    this.enqueued.add(name);
    if (front) {
      this.queue.unshift(name);
    } else {
      this.queue.push(name);
    }
    void this.kick();
  }

  async ensureGroup(name: string) {
    if (!this.enqueued.has(name)) {
      this.queueGroup(name, true);
    }

    while (this.enqueued.has(name)) {
      await this.sleep(50);
    }
  }

  queueDefaultAfterEnter() {
    this.queueGroup('enterGame');
  }

  queueIdle5s() {
    setTimeout(() => this.queueGroup('idle5s'), 5000);
  }

  private async kick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      while (this.queue.length > 0) {
        const name = this.queue.shift();
        if (!name) {
          continue;
        }

        const group = PREFETCH_PLAN[name];
        if (group) {
          await this.runGroup(group);
        }
        this.enqueued.delete(name);
        await this.yieldFrame();
      }
    } finally {
      this.running = false;
    }
  }

  private async runGroup(group: Group) {
    const bundles = new Set<string>();
    group.dirs?.forEach((task) => bundles.add(task.bundle));
    group.assets?.forEach((task) => bundles.add(task.bundle));

    for (const bundleName of bundles) {
      await this.loadBundle(bundleName);
      await this.yieldFrame();
    }

    if (group.dirs) {
      for (const task of group.dirs) {
        const bundle = assetManager.getBundle(task.bundle);
        if (!bundle) {
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          bundle.preloadDir(task.dir, (task.type || DEFAULT_TYPE) as never, undefined, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
        await this.yieldFrame();
      }
    }

    if (group.assets) {
      for (const task of group.assets) {
        const bundle = assetManager.getBundle(task.bundle);
        if (!bundle) {
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          bundle.preload(task.path, (task.type || DEFAULT_TYPE) as never, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
        await this.yieldFrame();
      }
    }
  }

  private loadBundle(name: string) {
    return new Promise<Bundle>((resolve, reject) => {
      const existing = assetManager.getBundle(name);
      if (existing) {
        resolve(existing);
        return;
      }

      assetManager.loadBundle(name, (err, bundle) => {
        if (err || !bundle) {
          reject(err);
          return;
        }
        resolve(bundle);
      });
    });
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async yieldFrame() {
    await this.sleep(0);
  }
}
