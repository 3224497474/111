import { Asset, assetManager, AssetManager, error, find, ImageAsset, instantiate, isValid, loader, Node, Prefab, resources, Sprite, SpriteFrame, Texture2D, _decorator } from "cc";
import { UtilPub } from "../utils/UtilPub";
export type Constructor<T = unknown> = new (...args: any[]) => T;
export type AssetType<T = Asset> = Constructor<T>;
export type LoadCompleteCallback<T> = (error: Error | null, asset: T) => void;
export type LoadDirCompleteCallback<T = Asset> = (error: Error | null, asset: Asset[]) => void;
const { ccclass } = _decorator;

declare global {
    namespace globalThis {
        var LZString: any;
    }
}

interface ITextAsset {
    text?: string;
    _file?: string;
    json?: string
}

@ccclass("resourceUtil")
export class resourceUtil {
    public static dialog: { [key: string]: Node } = {}  //瀛樻斁寮圭獥鐢ㄧ殑
    public static prefabs: { [key: string]: Prefab } = {}  //瀛樻斁棰勫埗浣撶敤鐨?
    public static spriteFrames: { [key: string]: SpriteFrame } = {}

    public static preloadPrefabs(ps: any) {
        return new Promise<void>((resolve, reject) => {
            let cnt = Object.keys(ps).length
            UtilPub.log("----------鍔犺浇棰勫埗浣?涓暟", cnt)
            for (let key in ps) {
                if (ps.hasOwnProperty(key)) {
                    let url = ps[key]
                    let bundleName = url.split("|")[0]
                    let pathName = url.split("|")[1]
                    // Public.log("---bundleName pathName---", bundleName, pathName)
                    assetManager.getBundle(bundleName)!.load(pathName, Prefab, (err, res) => {
                        if (err) {
                            error(err.message || err);
                            reject()
                            return;
                        } else {
                            this.prefabs[key] = res
                            UtilPub.log("----------preload prefab", url)
                            cnt -= 1
                            if (cnt == 0) {
                                resolve()
                            }
                        }
                    })
                }
            }
        })
    }

    public static preloadPrefab(ps: string) {
        return new Promise<Prefab>((resolve, reject) => {
            let cnt = 1
            let url = ps
            let bundleName = url.split("|")[0]
            let pathName = url.split("|")[1]
            let arr = url.split("/")
            let key = arr[arr.length - 1]
            // Public.log("---bundleName pathName---", bundleName, pathName)
            assetManager.getBundle(bundleName)!.load(pathName, Prefab, (err, res) => {
                if (err) {
                    error(err.message || err);
                    reject()
                    return;
                } else {
                    this.prefabs[key] = res
                    resolve(res)
                }
            })
        })
    }

    public static loadRes<T extends Asset>(url: string, type: AssetType<T> | null, cb?: LoadCompleteCallback<T>) {
        if (type) {
            resources.load(url, type, (err, res) => {
                if (err) {
                    error(err.message || err);
                    if (cb) {
                        cb(err, res);
                    }

                    return;
                }
                if (cb) { cb(err, res); }
            });
        } else {
            resources.load(url, (err, res) => {
                if (err) {
                    error(err.message || err);
                    if (cb) {
                        cb(err, res as T);
                    }
                    return;
                }
                if (cb) { cb(err, res as T); }
            });
        }
    }

    public static bandleHandler<T extends Asset>(bundleObj: AssetManager.Bundle | null, pathName: string, type: AssetType<T> | null, cb?: LoadCompleteCallback<T>) {
        if (type) {
            bundleObj!.load(pathName, type, (err, res) => {
                if (err) {
                    error(err.message || err);
                    if (cb) {
                        cb(err, res);
                    }

                    return;
                }
                // UtilPub.log("---璋冪敤鍖?1---",res)
                if (cb) { cb(err, res); }
            });
        } else {
            bundleObj!.load(pathName, (err, res) => {
                if (err) {
                    error(err.message || err);
                    if (cb) {
                        cb(err, res as T);
                    }
                    return;
                }
                // UtilPub.log("---璋冪敤鍖?2---",res)
                if (cb) { cb(err, res as T); }
            });
        }
    }


    public static loadResWithBundle<T extends Asset>(url: string, type: AssetType<T> | null, cb?: LoadCompleteCallback<T>) {

        let bundleName = url.split("|")[0]
        let pathName = url.split("|")[1]

        let bundleObj = assetManager.getBundle(bundleName)
        // console.log("---璋冪敤鍖?--", bundleName, pathName, bundleObj)
        if (bundleObj == null) {
            console.log("---寮€濮嬩笅杞?--", bundleName, pathName, bundleObj)
            UtilPub.loadBundle(bundleName).then((bundle: AssetManager.Bundle | null) => {
                this.bandleHandler(bundle, pathName, type, cb)
            })
        } else {
            this.bandleHandler(bundleObj, pathName, type, cb)
        }

    }
    public static loadResDirWithBundle<T extends Asset>(bundleName: string, dir: string, cb?: LoadDirCompleteCallback<T>) {
        let bundleObj = assetManager.getBundle(bundleName)
        bundleObj!.loadDir(dir, (err, res) => {
            if (err) {
                error(err.message || err);
                if (cb) {
                    cb(err, res);
                }

                return;
            }
            if (cb) { cb(err, res); }
        });
    }

    // public static getPrefabWithBundle<Prefab>(url: string, type: Prefab | null, cb?: LoadCompleteCallback<Prefab>) {
    //     this.loadResWithBundle(url, Prefab, (err, prefab) => {
    //     })
    // }

    public static getUIPrefabRes(prefabPath: string, cb?: (err: Error | null, asset?: Prefab) => void) {
        this.loadRes(prefabPath, Prefab, cb);
    }

    //鏀逛负甯undle鐨?
    public static getUIPrefabResWithBundle(prefabPath: string, cb?: (err: Error | null, asset?: Prefab) => void) {
        this.loadResWithBundle(prefabPath, Prefab, cb);
    }

    //鏀归€犱负甯undle鐨勯鍒朵綋璺緞锛?bundleName|pathName" leve1|level1, resources|prefab/ui/mainUI
    /**
     *
     * @param path
     * @param cb
     * @param parent
     */
    public static createUIWithBundle(path: string, cb?: (err: Error | null, node?: Node) => void, parent?: Node | null) {
        this.getUIPrefabResWithBundle(path, (err: Error | null, prefab?: Prefab) => {
            if (err) return;
            let node;
            // @ts-ignore
            if (this.dialog[path] != undefined) {
                // @ts-ignore
                node = this.dialog[path]
            } else {
                node = instantiate(prefab!);
            }

            if (!parent) {
                parent = find("Canvas");
            }
            node.setPosition(0, 0, 0);

            parent!.addChild(node);
            if (cb) {
                cb(null, node);
            }
        });
    }

    public static setSpriteFrame<T extends Asset>(path: string, sprite: Sprite, cb: LoadCompleteCallback<SpriteFrame>) {
        this.loadRes<SpriteFrame>(path + '/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('set sprite frame failed! err:', path, err);
                cb(err, spriteFrame);
                return;
            }

            if (sprite && isValid(sprite) && sprite.node && isValid(sprite.node)) {
                // 仅当节点仍然有效时再赋值，避免销毁/禁用过程中触发渲染异常
                sprite.spriteFrame = spriteFrame;
                cb && cb(null, spriteFrame);
            }
        });
    }

    /**
     * 鏍规嵁鑻遍泟鐨勬枃浠跺悕鑾峰彇澶村儚
     */
    public static setRemoteImage(url: string, sprite: Sprite, cb: LoadCompleteCallback<SpriteFrame>) {
        if (!url || !url.startsWith('http')) {
            return;
        }

        assetManager.loadRemote(url, { ext: ".png" }, (err, texture2d: ImageAsset) => {
            if (err || !texture2d) {
                console.error('set avatar failed! err:', url, err);
                return;
            }
            if (!sprite || !isValid(sprite) || !sprite.node || !isValid(sprite.node)) {
                return; // 目标已失效，放弃赋值
            }
            const texture = new Texture2D();
            texture.image = texture2d;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            sprite.spriteFrame = spriteFrame;
            cb && cb(null, spriteFrame);
        })
     
    }

}

