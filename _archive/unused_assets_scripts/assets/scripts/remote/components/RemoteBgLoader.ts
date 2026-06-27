import {
  _decorator,
  assetManager,
  Color,
  Component,
  error,
  log,
  Sprite,
  SpriteFrame,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RemoteBgLoader')
export class RemoteBgLoader extends Component {
  @property({
    tooltip: '背景图所在的 Asset Bundle 名称',
    displayName: 'Bundle 名称',
  })
  public bundleName = 'remote';

  @property({
    tooltip: '背景图相对路径，不包含扩展名',
    displayName: '图片路径',
  })
  public spritePath = '';

  @property({
    type: Sprite,
    tooltip: '目标 Sprite，留空时自动取当前节点上的 Sprite',
    displayName: 'Sprite 组件',
  })
  public bgSprite: Sprite | null = null;

  @property({
    tooltip: '是否在 onLoad 时自动加载',
    default: true,
    displayName: '自动加载',
  })
  public loadOnStart = true;

  @property({
    tooltip: '加载失败时是否显示默认颜色',
    default: false,
    displayName: '失败显示默认色',
  })
  public showDefaultColorOnFail = false;

  @property({
    type: Color,
    default: new Color(0, 0, 0, 255),
    tooltip: '加载失败时的默认颜色',
    displayName: '默认颜色',
    visible(this: RemoteBgLoader) {
      return this.showDefaultColorOnFail;
    },
  })
  public defaultColor = new Color(0, 0, 0, 255);

  private onLoadStartCallback: (() => void) | null = null;
  private onLoadSuccessCallback: ((spriteFrame: SpriteFrame) => void) | null = null;
  private onLoadFailCallback: ((err: Error) => void) | null = null;

  onLoad() {
    if (!this.bgSprite) {
      this.bgSprite = this.getComponent(Sprite);
    }

    if (this.loadOnStart && this.bgSprite) {
      void this.load();
    }
  }

  public async load(customBundle?: string, customPath?: string) {
    if (!this.bgSprite) {
      this.bgSprite = this.getComponent(Sprite);
      if (!this.bgSprite) {
        const err = new Error('[RemoteBgLoader] 找不到 Sprite 组件，请手动指定');
        error(err.message);
        this.onFail(err);
        return;
      }
    }

    const bundleName = customBundle || this.bundleName;
    const spritePath = customPath || this.spritePath;

    if (!bundleName) {
      const err = new Error('[RemoteBgLoader] Bundle 名不能为空');
      error(err.message);
      this.onFail(err);
      return;
    }

    if (!spritePath) {
      const err = new Error('[RemoteBgLoader] 图片路径不能为空');
      error(err.message);
      this.onFail(err);
      return;
    }

    try {
      this.onStart();

      let bundle = assetManager.getBundle(bundleName);
      if (!bundle) {
        bundle = await this.loadBundleAsync(bundleName);
      }

      const spriteFrame = await this.loadSpriteFrameFromBundle(bundle, spritePath);
      this.bgSprite.spriteFrame = spriteFrame;
      log(`[RemoteBgLoader] 背景加载成功: ${bundleName}/${spritePath}`);
      this.onSuccess(spriteFrame);
    } catch (err) {
      error('[RemoteBgLoader] 加载失败:', err);
      this.onFail(err instanceof Error ? err : new Error(String(err)));
      if (this.showDefaultColorOnFail) {
        this.showDefaultColor();
      }
    }
  }

  public async reload() {
    const bundle = assetManager.getBundle(this.bundleName);
    if (bundle) {
      bundle.release(this.spritePath, SpriteFrame);
    }
    await this.load();
  }

  public onLoadStart(callback: () => void): this {
    this.onLoadStartCallback = callback;
    return this;
  }

  public onLoadSuccess(callback: (spriteFrame: SpriteFrame) => void): this {
    this.onLoadSuccessCallback = callback;
    return this;
  }

  public onLoadFail(callback: (err: Error) => void): this {
    this.onLoadFailCallback = callback;
    return this;
  }

  public getStatus() {
    const bundle = assetManager.getBundle(this.bundleName);
    return {
      bundleName: this.bundleName,
      spritePath: this.spritePath,
      isBundleLoaded: !!bundle,
      spriteFrame: this.bgSprite?.spriteFrame || null,
    };
  }

  public release() {
    if (!this.bgSprite?.spriteFrame) {
      return;
    }

    const bundle = assetManager.getBundle(this.bundleName);
    if (bundle) {
      bundle.release(this.spritePath, SpriteFrame);
    }
    this.bgSprite.spriteFrame = null;
  }

  onDestroy() {
    this.release();
  }

  private onStart() {
    if (this.onLoadStartCallback) {
      this.onLoadStartCallback();
    }
  }

  private onSuccess(spriteFrame: SpriteFrame) {
    if (this.onLoadSuccessCallback) {
      this.onLoadSuccessCallback(spriteFrame);
    }
  }

  private onFail(err: Error) {
    if (this.onLoadFailCallback) {
      this.onLoadFailCallback(err);
    }
  }

  private showDefaultColor() {
    if (this.bgSprite) {
      this.bgSprite.color = this.defaultColor;
    }
  }

  private loadBundleAsync(name: string) {
    return new Promise<NonNullable<ReturnType<typeof assetManager.getBundle>>>((resolve, reject) => {
      const existing = assetManager.getBundle(name);
      if (existing) {
        resolve(existing);
        return;
      }

      assetManager.loadBundle(name, (err, bundle) => {
        if (err || !bundle) {
          reject(err || new Error(`Bundle 加载失败: ${name}`));
          return;
        }
        log(`[RemoteBgLoader] Bundle 加载成功: ${name}`);
        resolve(bundle);
      });
    });
  }

  private loadSpriteFrameFromBundle(
    bundle: NonNullable<ReturnType<typeof assetManager.getBundle>>,
    path: string,
  ) {
    return new Promise<SpriteFrame>((resolve, reject) => {
      bundle.load(path, SpriteFrame, (err, spriteFrame) => {
        if (err || !spriteFrame) {
          reject(err || new Error(`图片加载失败: ${path}`));
          return;
        }
        resolve(spriteFrame);
      });
    });
  }
}
