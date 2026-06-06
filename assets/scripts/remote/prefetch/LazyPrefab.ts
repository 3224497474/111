import { _decorator, assetManager, Bundle, Component, instantiate, Node, Prefab } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('LazyPrefab')
export class LazyPrefab extends Component {
  @property
  bundleName = 'game';

  @property
  prefabPath = '';

  @property(Node)
  mount: Node | null = null;

  private loading = false;
  private loadedNode: Node | null = null;

  async open() {
    if (this.loadedNode) {
      this.loadedNode.active = true;
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;
    try {
      const bundle = await this.getBundle(this.bundleName);
      await new Promise<void>((resolve, reject) => {
        bundle.load(this.prefabPath, Prefab, (err, prefab) => {
          if (err || !prefab) {
            reject(err);
            return;
          }

          const node = instantiate(prefab);
          (this.mount || this.node).addChild(node);
          this.loadedNode = node;
          resolve();
        });
      });
    } finally {
      this.loading = false;
    }
  }

  close() {
    if (this.loadedNode) {
      this.loadedNode.active = false;
    }
  }

  private getBundle(name: string) {
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
}
