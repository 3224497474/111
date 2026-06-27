
import { AssetManager, AudioClip, Color, Component, Label, Node, Prefab, SpriteFrame, TextAsset, Tween, UIOpacity, UITransform, Vec2, Vec3, _decorator, assetManager, renderer, sp, tween, v2, v3 } from 'cc';
import { Const } from '../../config/Const';
import DataManager from '../../config/DataManager';
import { audioManager } from '../mgr/audioManager';
import { poolManager } from '../mgr/poolManager';
import { resourceUtil } from '../mgr/resourceUtil';
import { MathRandom, MathUtil } from './UtilsMath';
const { ccclass, property } = _decorator;

// @ts-ignore
import md5 from "./md5.js";

/**
 * 公共工具类
 */
@ccclass('UtilPub')
export class UtilPub extends Component {

    public static isStartGame: boolean = false

    public static randomString(len: number) {
        len = len || 32;
        var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
        var maxPos = $chars.length;
        var pwd = '';
        for (let i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    }

    public static md5(info: any) {
        return md5(info);
    }

    /**
     * 判断一个坐标点是否在多边形内
     * @param polygon [[0,0],[3,0],[0,3]]
     * @param point [4,4]
     * @returns 
     */
    public static insidePolygon(polygon: Array<Array<number>>, point: Array<number>) {
        // UtilPub.log("----inside--", polygon, point)
        var x = point[0], y = point[1];
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var xi = polygon[i][0], yi = polygon[i][1];
            var xj = polygon[j][0], yj = polygon[j][1];
            var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * 设置节点位置，位置与参考节点一致
     * @param node 节点
     * @param otherNode 参考节点
     */
    public static setNodePositionByOtherNode(node: Node, otherNode: Node) {
        let pos = this.convertToWorldSpace(otherNode);
        pos = this.convertToNodeSpace(node, pos);
        node.position = pos;
    }

    /**
     * 数组排序
     * @param arr 
     * @param compareFunc 
     */
    public static sortArr(arr: any, compareFunc: Function) {
        if (!arr || arr.length <= 1) {
            return arr;
        }
        for (let i = 0; i < arr.length - 1; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                let item1 = arr[i];
                let item2 = arr[j];
                if (compareFunc(item1, item2)) {
                    arr[i] = item2;
                    arr[j] = item1;
                }
            }
        }
    }

    /**
     * 根据权重从数组中返回指定的个数元素
     * @param arr 数组
     * @param num 返回个数
     * @param canRepeat 是否可以重复取，默认不可以
     * @returns {Array} 返回结果数组
     */
    public static getRowsByWeightAndNum(arr: any, num: number, canRepeat?: boolean) {
        if (!num) {
            num = 1;
        }
        var ret = [];
        arr = JSON.parse(JSON.stringify(arr));
        for (var i = 0; i < num; i++) {
            if (arr.length <= 0) {
                break;
            }
            var row = this.getRowByWeight(arr);
            ret.push(row);
            if (!canRepeat) {
                var index = arr.indexOf(row);
                arr.splice(index, 1);
            }
        }
        return ret;
    }

    /**
     * 根据权重从数组中返回一个元素
     * @param arr
     * @param totalWeight
     */
    public static getRowByWeight(arr: any, totalWeight?: number) {
        if (!totalWeight) {
            totalWeight = 0;
            for (var i in arr) {
                var weight = arr[i].weight;
                if (!weight) {
                    weight = 0;
                }
                totalWeight += weight;
            }
        }
        var random = Math.random() * totalWeight;
        var left = 0;
        var row = null;
        for (var i in arr) {
            var tmpRow = arr[i];
            var weight = tmpRow.weight;
            if (!weight) {
                weight = 0;
            }
            if (random >= left && random < left + weight) {
                row = tmpRow;
                break;
            }
            left += weight;
        }

        return row;
    }

    /**
     * 从给定的数组中，随机取出一个元素
     * @param arr 数组
     * @param isRemove 是否将该元素从数组中移除
     * @return {null|*} 返回随机到的元素
     */
    public static getRandomItemByArr(arr: any, isRemove: boolean = false) {
        if (!arr || arr.length <= 0) {
            return null;
        }
        let index = Math.floor(Math.random() * arr.length);
        let item = arr[index];
        if (isRemove) {
            arr.splice(index, 1);
        }

        return item;
    }


    public static forArr(arr: any, cb: Function) {
        for (let i = 0, len = arr.length; i < len; i++) {
            if (cb(arr[i], i)) {
                return;
            }
        }
    }

    public static for2Arr(arr: any, cb: Function, isReverse: boolean = false) {
        if (isReverse) {
            for (let i = arr.length - 1; i >= 0; i--) {
                let tmpArr = arr[i];
                for (let j = 0, len2 = tmpArr.length; j < len2; j++) {
                    if (cb(tmpArr[j], i, j)) {
                        return;
                    }
                }
            }
            return;
        }
        for (let i = 0, len = arr.length; i < len; i++) {
            let tmpArr = arr[i];
            for (let j = 0, len2 = tmpArr.length; j < len2; j++) {
                if (cb(tmpArr[j], i, j)) {
                    return;
                }
            }
        }
    }

    /**
     * 将node坐标转换为世界坐标
     * @param node 
     * @param isCenter 是否强制是node的中心点坐标
     */
    public static convertToWorldSpace(node: Node, isCenter?: boolean): Vec3 {
        let transform = node.parent!.getComponent(UITransform);

        let pos = node.getPosition();
        if (isCenter) {
            let tf = node.getComponent(UITransform)!;
            pos.x = pos.x + (0.5 - tf.anchorX) * tf.width;
            pos.y = pos.y + (0.5 - tf.anchorY) * tf.height;
        }

        return transform!.convertToWorldSpaceAR(pos);
    }

    public static convertToWorldSpaceWithPos(node: Node, pos: Vec3): Vec3 {
        let transform = node.parent!.getComponent(UITransform);
        pos = transform!.convertToWorldSpaceAR(pos);

        return pos;
    }

    /**
     * 获得以node父节点锚点位置为原点的坐标系下的坐标
     * @param node 注意，是同坐标系下的节点
     * @param pos 世界坐标
     */
    public static convertToNodeSpace(node: Node, pos: Vec3): Vec3 {
        if (node.parent == null) {
            return Vec3.ZERO
        }
        let transform = node.parent!.getComponent(UITransform);

        return transform!.convertToNodeSpaceAR(pos);
    }

    public static IsEmptyObject(obj: any) {
        for (let key in obj) {
            return false
        }
        return true
    }

    public static debug(...parameters: any[]) {
        if (Const.isDebug == true) {
            console.debug(...parameters)
        }
    }

    public static log(...parameters: any[]) {
        if (Const.isOnline == false) {
            console.log(...parameters)
        }
    }
    public static warn(...parameters: any[]) {
        console.warn(...parameters)
    }
    public static error(...parameters: any[]) {
        console.error(...parameters)
    }

    //保留2位小数
    public static num2(num: number) {
        return Number(num.toFixed(2))
    }

    public static numToStr2(num: number) {
        if (num < 10) {
            return "0" + num
        } else {
            return "" + num
        }
    }

    public static numToStr3(num: number) {
        if (num < 10) {
            return "00" + num
        } else if (num < 100) {
            return "0" + num
        } else {
            return num + ""
        }
    }

    //加载包
    public static loadBundle(name: string) {
        return new Promise<AssetManager.Bundle>(result => {
            let b = assetManager.getBundle(name)
            if (b != null) return result(b);
            assetManager.loadBundle(name, (err, bundle) => {
                result(bundle);
                if (err) {
                    return console.error(err);
                }
                if (err) {
                    console.error('加载bundle错误:', name, err)
                    return;
                }
                UtilPub.log("加载完成", name)
            })
        })
    }

    //加载音乐包
    public static loadAudio(bundleName: string) {
        return new Promise<void>((resolve, reject) => {
            resourceUtil.loadResDirWithBundle(bundleName, "./", (err, res) => {
                UtilPub.log("加载音乐数据----------", res.length)
                for (let i = 0; i < res.length; i++) {
                    let audioClip = res[i] as AudioClip
                    audioManager.instance.clips[audioClip.name] = audioClip
                }
                resolve()
            })
        })
    }

    //加载配置
    public static loadConfig() {
        return new Promise<void>((resolve, reject) => {
            resourceUtil.loadResDirWithBundle('config', "./", (err, res) => {
                //表格数据处理
                //Public.log("table err----------", err)
                //Public.log("table data----------", res)
                for (let i = 0; i < res.length; i++) {
                    let textAsset = res[i] as TextAsset
                    let items = textAsset.text.split("\n");
                    DataManager.handleData(textAsset.name, items);
                }
                resolve()
            })
        })
    }

    //加载图片
    public static loadPic() {
        return new Promise<void>((resolve, reject) => {
            resourceUtil.loadResDirWithBundle('img', "./icons", (err, res) => {
                //表格数据处理
                //Public.log("table err----------", err)
                UtilPub.log("spriteFrames data----------", res.length)
                for (let i = 0; i < res.length; i++) {
                    let spAsset = res[i] as SpriteFrame
                    resourceUtil.spriteFrames[spAsset.name] = spAsset
                }
                UtilPub.log("spriteFrames data----------", resourceUtil.spriteFrames.length)
                resolve()
            })
        })
    }

    public static loadSpineSkeletonData(url: any, cb?: Function) {
        let bundleName = url.split("|")[0]
        let pathName = url.split("|")[1]

        let bundleObj = assetManager.getBundle(bundleName)!;

        let res = bundleObj.get(pathName, sp.SkeletonData);
        if (res) {
            if (cb) {
                cb(null, res);
            }
            return;
        }
        bundleObj!.load(pathName, sp.SkeletonData, (err, res) => {
            if (cb) {
                cb(err, res);
            }
        });
    }

    public static getPic(pname: any, cb: Function) {
        // console.log("图片----------", pname)
        // UtilPub.log("图片----------", pname)
        //如果有缓存预制体，那么直接返回
        if (resourceUtil.spriteFrames.hasOwnProperty(pname)) {
            let p = resourceUtil.spriteFrames[pname]
            cb(p)
        } else {
            resourceUtil.loadResWithBundle(pname + "/spriteFrame", SpriteFrame, (err, sf) => {
                // Public.log("-----------sf", sf)
                if (err) {
                    console.error("-----------not find pname", pname)
                    return
                }
                resourceUtil.spriteFrames[pname] = sf;
                cb(resourceUtil.spriteFrames[pname])
            })
        }
    }

    public static getPic2(pname: any, cb: Function) {
        // UtilPub.log("图片----------", pname)
        //UtilPub.log("图片----------", pname)
        //如果有缓存预制体，那么直接返回
        if (resourceUtil.spriteFrames.hasOwnProperty(pname)) {
            let p = resourceUtil.spriteFrames[pname]
            cb(p)
        } else {
            resourceUtil.loadResWithBundle(pname + "/spriteFrame", SpriteFrame, (err, sf) => {
                // Public.log("-----------sf", sf)
                if (err) {
                    // console.log("-----------not find pname", pname)
                    cb();
                    return
                }
                resourceUtil.spriteFrames[pname] = sf;
                cb(resourceUtil.spriteFrames[pname])
            })
        }
    }

    public static getPrefab(prefabPath: string, cb: Function) {
        let arr = prefabPath.split("/")
        let pname = arr[arr.length - 1]
        //如果有缓存预制体，那么直接生成
        if (resourceUtil.prefabs.hasOwnProperty(pname)) {
            let p = resourceUtil.prefabs[pname]
            cb(p)
        } else {
            resourceUtil.loadResWithBundle(prefabPath, Prefab, (err, prefab) => {
                if (err) {
                    console.log("========loadResWithBundle error:", prefabPath, err.message);
                }
                resourceUtil.prefabs[pname] = prefab
                cb(prefab)
            })
        }
    }


    /**
     * 获取性能等级
     * -Android
     * 设备性能等级，取值为：
     * -2 或 0（该设备无法运行小游戏）
     * -1（性能未知）
     * >=1（设备性能值，该值越高，设备性能越好，目前最高不到50)
     * -IOS
     * 微信不支持IO性能等级
     * iPhone 5s 及以下
     * 设定为超低端机 benchmarkLevel = 5
     * iPhone 6 ～ iPhone SE
     * 设定为超低端机 benchmarkLevel = 15
     * iPhone 7 ~ iPhone X
     * 设定为中端机 benchmarkLevel = 25
     * iPhone XS 及以上
     * 设定为高端机 benchmarkLevel = 40
     * -H5或其他
     * -1（性能未知）
     */
    public static getBenchmarkLevel(): number {
        // @ts-ignore
        if (window.wx) {
            //@ts-ignore
            const sys = window.wx.getSystemInfoSync();
            const isIOS = sys.system.indexOf('iOS') >= 0;
            if (isIOS) {
                const model = sys.model;
                // iPhone 5s 及以下
                const ultraLowPhoneType = ['iPhone1,1', 'iPhone1,2', 'iPhone2,1', 'iPhone3,1', 'iPhone3,3', 'iPhone4,1', 'iPhone5,1', 'iPhone5,2', 'iPhone5,3', 'iPhone5,4', 'iPhone6,1', 'iPhone6,2'];
                // iPhone 6 ~ iPhone SE
                const lowPhoneType = ['iPhone6,2', 'iPhone7,1', 'iPhone7,2', 'iPhone8,1', 'iPhone8,2', 'iPhone8,4'];
                // iPhone 7 ~ iPhone X
                const middlePhoneType = ['iPhone9,1', 'iPhone9,2', 'iPhone9,3', 'iPhone9,4', 'iPhone10,1', 'iPhone10,2', 'iPhone10,3', 'iPhone10,4', 'iPhone10,5', 'iPhone10,6', 'iPhone11,2', 'iPhone11,4', 'iPhone11,6', 'iPhone11,8'];
                // iPhone XS 及以上
                const highPhoneType = ['iPhone12,1', 'iPhone12,3', 'iPhone12,5', 'iPhone12,8', 'iPhone13', 'iPhone14', 'iPhone15', 'iPhone16', 'iPhone17', 'iPhone18', 'iPhone19', 'iPhone20'];
                for (let i = 0; i < ultraLowPhoneType.length; i++) {
                    if (model.indexOf(ultraLowPhoneType[i]) >= 0)
                        return 5;
                }
                for (let i = 0; i < lowPhoneType.length; i++) {
                    if (model.indexOf(lowPhoneType[i]) >= 0)
                        return 10;
                }
                for (let i = 0; i < middlePhoneType.length; i++) {
                    if (model.indexOf(middlePhoneType[i]) >= 0)
                        return 20;
                }
                for (let i = 0; i < highPhoneType.length; i++) {
                    if (model.indexOf(highPhoneType[i]) >= 0)
                        return 21;
                }

                return -1;
            } else {
                return sys.benchmarkLevel;
            }
        } else {
            return 50;
        }
    }

    /**
     * 数字跳跃通用接口
     * @param label 标签组件
     * @param oriVal 原始值
     * @param addVal 增加值
     * @param perVal 每次增加多少
     * @param perTime 每次增加的时间
     * @returns 
     */
    public static numberJump(label: Label, oriVal: number, addVal: number, cnt: number, cb: Function, perTime: number = 0.1) {
        if (cnt <= 0) {
            cb && cb()
            return
        }
        label.string = Math.round(oriVal + Math.round(addVal / cnt)) + ""
        cnt--
        tween(label.node).delay(perTime).call(() => {
            this.numberJump(label, oriVal, addVal, cnt, cb, perTime)
        }).start()
    }

    /**
     * 低端机判断
     */
    public static checkIsLowPhone() {
        UtilPub.log("----判断低端机的性能等级", UtilPub.getBenchmarkLevel())
        let checkBenchmark = 22; //判断低端机的性能等级
        return UtilPub.getBenchmarkLevel() < checkBenchmark
    }

    /**
    * 通用贝塞尔接口
    * @param startNode 起始节点
    * @param endNode 目标节点
    * @param radio 控制点偏移量 0.1-0.9 0.5是中点
    * @param deltaX 控制点的相对中点的偏移量
    * @param deltaY 控制点的相对中点的偏移量
    * @param duration 总动画时长
    * @param cb 回调函数
    */
    public static Bezier2DShow(startNode: Node, endNode: Node, radio: number, deltaX: number, deltaY: number, duration: number, cb: Function) {
        let e = endNode.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(0, 0, 0))
        let eNode = startNode.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(e)
        // console.log("eNode--------", startNode.position.x, startNode.position.y, eNode.x, eNode.y)
        // tween(startNode).to(0.5, {position:eNode}).start()

        let pArr = []
        let p1 = startNode.position
        let p2 = eNode
        let cp = UtilPub.Bezier2DGetCtlPoint(p1, p2, radio, deltaX, deltaY)
        // console.log("----ppc----", p1, p2, cp)
        for (let i = 0; i < 30; i++) {
            let p = UtilPub.BezierTwo(i / 30, p1, cp, p2)
            pArr.push(new Vec3(p[0], p[1], startNode.position.z))
            // console.log("------p------", p)
        }
        pArr.push(eNode)
        UtilPub.Bezier2DRun(pArr, startNode, 0, duration, cb)
    }

    /**
     * 通用贝塞尔接口
     * @param startNode 起始节点
     * @param delta 坐标差
     * @param radio 控制点偏移量 0.1-0.9 0.5是中点
     * @param deltaX 控制点的相对中点的偏移量
     * @param deltaY 控制点的相对中点的偏移量
     * @param duration 总动画时长
     * @param cb 回调函数
     */
    public static Bezier2DShowPoint(startNode: Node, delta: Vec3, radio: number, deltaX: number, deltaY: number, duration: number, cb: Function) {
        // tween(startNode).to(0.5, {position:eNode}).start()

        let pArr = []
        let p1 = startNode.position
        let p2 = new Vec3(startNode.position.x + delta.x, startNode.position.y + delta.y, startNode.position.z + delta.z)
        let cp = UtilPub.Bezier2DGetCtlPoint(p1, p2, radio, deltaX, deltaY)
        // console.log("----ppc----", p1, p2, cp)
        for (let i = 0; i < 30; i++) {
            let p = UtilPub.BezierTwo(i / 30, p1, cp, p2)
            pArr.push(new Vec3(p[0], p[1], 0))
            // console.log("------p------", p)
        }
        pArr.push(p2)
        UtilPub.Bezier2DRun(pArr, startNode, 0, duration, cb)
    }

    /**
 * 通用贝塞尔接口
 * @param startNode 起始节点
 * @param endPoint 终点
 * @param radio 控制点偏移量 0.1-0.9 0.5是中点
 * @param deltaX 控制点的相对中点的偏移量
 * @param deltaY 控制点的相对中点的偏移量
 * @param duration 总动画时长
 * @param cb 回调函数
 */
    public static Bezier3DShowPoint(startNode: Node, endPoint: Vec3, radio: number, deltaX: number, deltaY: number, duration: number, cb: Function) {
        // tween(startNode).to(0.5, {position:eNode}).start()

        let pArr = []
        let p1 = startNode.worldPosition
        let p2 = endPoint
        let cp = UtilPub.Bezier2DGetCtlPoint(p1, p2, radio, deltaX, deltaY)
        // console.log("----ppc----", p1, p2, cp)
        for (let i = 0; i < 30; i++) {
            let p = UtilPub.BezierTwo(i / 30, p1, cp, p2)
            pArr.push(new Vec3(p[0], p[1], 0))
            console.log("------通用贝塞尔接口------", p)
        }
        pArr.push(p2)
        UtilPub.Bezier2DRun(pArr, startNode, 0, duration, cb)
    }

    /**
     *
     * @param pArr
     * @param startNode
     * @param i
     * @param cb
     * @param duration 总动画时长
     * @constructor
     */
    public static Bezier2DRun(pArr: Vec3[], startNode: Node, i: number, duration: number, cb: Function) {
        if (i > pArr.length) {
            cb && cb()
            return;
        }
        if (startNode == undefined) return
        tween(startNode).to(duration / pArr.length, { position: pArr[i] }).call(() => {
            UtilPub.Bezier2DRun(pArr, startNode, i + 1, duration, cb)
        }).start()
    }

    /**
     * 获得贝塞尔曲线的控制点
     * @param p1 起始点
     * @param p2 结束点
     * @param radio 0.1-0.9  0.5就是中线
     * @param deltaX 中点为原点的偏移量
     * @param deltaY 中点为原点的偏移量
     * @constructor
     */
    public static Bezier2DGetCtlPoint(p1: any, p2: any, radio: any, deltaX: any, deltaY: any) {
        return new Vec3((p1.x + p2.x) * radio + deltaX, (p1.y + p2.y) * radio + deltaY, 1)
    }
    /**
    * @desc 一阶贝塞尔
    * @param  t 当前百分比
    * @param  p1 起点坐标
    * @param  p2 终点坐标
    */
    public static BezierOne(t: number, p1: any, p2: any) {
        const x1 = p1.x
        const x2 = p2.x
        const y1 = p1.y
        const y2 = p2.y

        let x = x1 + (x2 - x1) * t;
        let y = y1 + (y2 - y1) * t;
        return [x, y];
    }

    /**
     * @desc 二阶贝塞尔
     * @param {number} t 当前百分比
     * @param {Array} p1 起点坐标
     * @param {Array} cp 控制点
     * @param {Array} p2 终点坐标
     */
    public static BezierTwo(t: number, p1: any, cp: any, p2: any) {
        const x1 = p1.x
        const x2 = p2.x
        const y1 = p1.y
        const y2 = p2.y
        const cx = cp.x
        const cy = cp.y
        let x = (1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2;
        let y = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * cy + t * t * y2;
        return [Math.round(x), Math.round(y)];
    }
    //
    // /** TODO 改造为可用代码
    //  * @desc 三阶贝塞尔
    //  * @param {number} t 当前百分比
    //  * @param {Array} p1 起点坐标
    //  * @param {Array} p2 终点坐标
    //  * @param {Array} cp1 控制点1
    //  * @param {Array} cp2 控制点2
    //  */
    // threeBezier(t, p1, cp1, cp2, p2) {
    //     const [x1, y1] = p1;
    //     const [x2, y2] = p2;
    //     const [cx1, cy1] = cp1;
    //     const [cx2, cy2] = cp2;
    //     let x =
    //         x1 * (1 - t) * (1 - t) * (1 - t) +
    //         3 * cx1 * t * (1 - t) * (1 - t) +
    //         3 * cx2 * t * t * (1 - t) +
    //         x2 * t * t * t;
    //     let y =
    //         y1 * (1 - t) * (1 - t) * (1 - t) +
    //         3 * cy1 * t * (1 - t) * (1 - t) +
    //         3 * cy2 * t * t * (1 - t) +
    //         y2 * t * t * t;
    //     return [x, y];
    // }

    /**
     * 震动摄像机
     * @constructor
     * @param times 震动的次数
     * @param range 震动的幅度 建议是5
     */
    public static ShakeCamera(target: Node, times: number = 8, range: number = 0.1) {
        let oriPos = target.position
        UtilPub._ShakeCamera(target, new Vec3(oriPos.x, oriPos.y, oriPos.z), times, range)
    }

    private static _ShakeCamera(target: Node, oriPos: Vec3, times: number, range: number) {
        let randOffsetX = UtilPub.ranInt(0, 1) == 1 ? range : -range
        let randOffsetY = UtilPub.ranInt(0, 1) == 1 ? range : -range
        let randOffsetZ = UtilPub.ranInt(0, 1) == 1 ? range : -range
        tween(target)
            .to(0.05, { position: new Vec3(oriPos.x + randOffsetX, oriPos.y + randOffsetY, oriPos.z + randOffsetZ) })
            .call(() => {
                times--
                if (times > 0) {
                    UtilPub._ShakeCamera(target, oriPos, times, range)
                } else {
                    target.setPosition(oriPos)
                }
            }).start()
    }

    //包含最大值，最小值
    public static ranInt(min: number, max: number) {
        if (min > max) {
            let tmp = min
            min = max
            max = tmp
        } else if (min == max) {
            return min
        }
        return Math.round(Math.random() * (max - min) + min);
    }

    //得到对象列表中某一列的值
    public static getObjKeysArr(obj: any[], key: string): any[] {
        let res = []
        for (let i = 0; i < obj.length; i++) {
            let row = obj[i]
            UtilPub.log("-------row", row, key, row[key])
            res.push(row[key])
        }
        return res
    }

    //随机n个数，不重复
    public static ranInts(min: number, max: number, num: number) {
        let arr = []
        for (let i = min; i < max; i++) {
            arr.push(i)
        }
        let res: number[] = []
        UtilPub.getRandVal(arr, num, res)
        return res
    }

    private static getRandVal(arr: number[], num: number, res: number[]) {
        // let rIdx= Public.ranInt(0, arr.length-1)
        // res.push(arr[rIdx])
        // delete arr[rIdx]
        UtilPub.shuffle(arr)
        let element = arr.shift()
        if (element) {
            res.push(element)
        }
        num -= 1
        if (num >= 0) {
            this.getRandVal(arr, num, res)
        } else {
            return res
        }
    }

    //工具权重随机数据
    public static randInts(dataArr: any[], num: number) {
        let res = [] //返回随机出来的数组下标
        if (dataArr.length < num) {
            UtilPub.log("--------参数违规----!!!")
            return []
        }
        while (true) {
            let idx = UtilPub.ranInt(0, dataArr.length - 1)
            let isExist = res.find(e => e === idx)
            if (isExist == null) {
                res.push(idx)
            }
            // Public.log("-------寻找---", idx, isExist, res)
            if (res.length >= num) break;
        }
        return res
    }

    //工具权重随机数据
    public static randIntsByWeight(dataArr: any[], num: number) {
        let weightIds = []
        let res: number[] = []
        for (let i = 0; i < dataArr.length; i++) {
            weightIds.push(dataArr[i].weight)
        }
        while (true) {
            let idx = UtilPub.randomWeights(weightIds)
            let isExist = res.find(e => e === idx)
            if (isExist == null) {
                res.push(idx)
            }
            // Public.log("-------寻找---", idx, isExist, res)
            if (res.length >= num) break;
        }
        return res
    }

    public static shuffle(array: number[]) {
        var j, x, i;
        for (i = array.length; i; i--) {
            j = Math.floor(Math.random() * i);
            x = array[i - 1];
            array[i - 1] = array[j];
            array[j] = x;
        }
        return array;
    }

    public static turnTo(cur: Node, target: Node, isAni: boolean = false, aniTween: Tween<any> = null!, cb?: Function) {
        let oriX = cur.eulerAngles.x
        let oriZ = cur.eulerAngles.z
        let oriY = cur.eulerAngles.y
        if (isAni) {
            cur.lookAt(target.worldPosition)
            let final = v3(oriX, cur.eulerAngles.y, oriZ)
            cur.eulerAngles = v3(oriX, oriY, oriZ)
            let t = Math.abs(oriY - final.y) / 180
            aniTween.stop()
            aniTween = tween(cur).to(t, { position: final }).call(() => {
                cb && cb()
            }).start()
        } else {
            cur.lookAt(target.worldPosition)
            cur.eulerAngles = v3(oriX, cur.eulerAngles.y, oriZ)
        }

    }
    public static turnToPos(cur: Node, target: Vec3, isAni: boolean = false, aniTween: Tween<any> = null!, cb?: Function) {
        let oriX = cur.eulerAngles.x
        let oriZ = cur.eulerAngles.z
        let oriY = cur.eulerAngles.y
        if (isAni) {
            cur.lookAt(target)
            let final = v3(oriX, cur.eulerAngles.y, oriZ)
            cur.eulerAngles = v3(oriX, oriY, oriZ)
            let t = Math.abs(oriY - final.y) / 180
            aniTween.stop()
            aniTween = tween(cur).to(t, { position: final }).call(() => {
                cb && cb()
            }).start()
        } else {
            cur.lookAt(target)
            cur.eulerAngles = v3(oriX, cur.eulerAngles.y, oriZ)
        }
        // cur.lookAt(target)
        // cur.eulerAngles = v3(oriX, cur.eulerAngles.y, oriZ)
    }


    //传入配表行信息
    public static getParam(row: any, lv: number) {
        let p = []
        for (let i = 1; i < 7; i++) {
            let val = row[`p${i}`]
            if (val) {
                if (val[lv]) {
                    p.push(val[lv])
                } else {
                    p.push(val[val.length - 1])
                }
            }
        }
        return p
    }

    //解析说明
    public static formatDesc(desc: string, ...args: any) {
        let str = desc;
        let len = args.length;
        for (let i = 1; i < len + 1; i++) {
            const value = args[i - 1];
            let key = `{p${i}}`;
            UtilPub.log("------key", key, value)
            str = str.replace(key, value + "");
        }
        return str
    }

    public static getDis(pos1: Vec3, pos2: Vec3) {
        let xdiff = pos1.x - pos2.x;
        let ydiff = pos1.y - pos2.y;
        let zdiff = pos1.z - pos2.z
        let dis = Math.pow((xdiff * xdiff + ydiff * ydiff + zdiff * zdiff), 0.5);
        return dis;
    }

    public static getDis2D(pos1: Vec3, pos2: Vec3) {
        let xdiff = pos1.x - pos2.x;
        let ydiff = pos1.y - pos2.y;
        let dis = Math.pow((xdiff * xdiff + ydiff * ydiff), 0.5);
        return dis;
    }

    /**
     * @description: 使用一个id数组，一个权重数组，根据权重数组刷一个id出来，配合randomWeightsByAttr可以随领域词条
     * @author ctj
     * @date 2021/9/6 11:30
     * @version 1.0
     * @return 返回idsArr中的id
     */
    public static randomWeightsArrByArr(idsArr: any[], weightArr: number[]) {
        let totalWeight = 0;
        for (let i = 0; i < weightArr.length; i++) {
            totalWeight += weightArr[i];
        }
        let ran = UtilPub.ranInt(1, totalWeight); //200
        let calWeight = 0;
        for (let i = 0; i < weightArr.length; i++) {
            calWeight += weightArr[i]; //30...210,
            // cc.log("---------calWeight----", calWeight, ran, totalWeight)
            if (ran <= calWeight) { //200<=30, 200<=210
                return idsArr[i];
            }
        }
        return idsArr[Math.floor(Math.random() * (idsArr.length - 1))]
    }

    public static randomWeights(weights: number[]) {
        let totalWeight = 0;
        for (let i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        let ran = UtilPub.ranInt(1, totalWeight);
        for (let i = 0; i < weights.length; i++) {
            const weight = weights[i];
            if (ran <= weight) {
                // Public.log("---------随机算法---", ran, totalWeight)
                return i;
            }
            else {
                ran -= weight;
            }
        }
        return 0
    }

    /**
     * 只有一个子节点的情况，用于构筑场景中的唯一建筑
     * @param prefabName 
     * @param parentNode 
     * @returns 
     */
    public static loadOneRes(prefabName: string, parentNode: Node) {
        return new Promise<Node>((resolve, reject) => {
            if (parentNode.children.length == 0) {
                resourceUtil.loadResWithBundle(prefabName, Prefab, (err, prefab) => {
                    let item = poolManager.instance.getNode(prefab, parentNode)!
                    item.worldPosition = parentNode.worldPosition
                    resolve(item)
                })
            } else {
                resolve(parentNode.children[0])
            }
        })
    }

    //传入秒，获得倒计时 单位秒
    public static timerFormat(_time: number) {
        // console.log("timerFormat:",_time);
        let time = Math.round(_time);
        let t = Number(time);
        let h = Math.floor(t / 3600);
        let m = Math.floor((t - h * 3600) / 60);
        let s = t % 60;
        let str_h = h < 10 ? '0' + h : h;
        let str_m = m < 10 ? '0' + m : m;
        let str_s = s < 10 ? '0' + s : s;
        if (h != 0) {
            let str = `${str_h}:${str_m}:${str_s}`;
            return str;
        }
        else {
            let str = `${str_m}:${str_s}`;
            return str;
        }
    }

    public static getTimeStr(d: number) {
        var ret = "";
        if (d < 0) {
            d = 0;
        }

        d = d / 1000;
        var hours = Math.floor(d / 3600);
        var mins = Math.floor((d - hours * 3600) / 60);
        var seconds = Math.floor(d - hours * 3600 - mins * 60);

        if (hours >= 10) {
            ret = ret + hours + ":";
        } else {
            ret = ret + "0" + hours + ":";
        }

        if (mins >= 10) {
            ret = ret + mins + ":";
        } else {
            ret = ret + "0" + mins + ":";
        }
        if (seconds >= 10) {
            ret = ret + seconds;
        } else {
            ret = ret + "0" + seconds;
        }

        return ret;
    }

    /**
     * 获取一段时长的显示字符串，如 1d2h5m6s
     * @param duration 时长，单位：毫秒
     */
    public static getDurationStr(duration: number) {
        if (duration < 0) {
            duration = 0;
        }
        let dt = Math.ceil(duration / 1000);
        let d = Math.floor(dt / (3600 * 24));
        let h = Math.floor((dt - d * 24 * 3600) / 3600);
        let m = Math.floor((dt - d * 24 * 3600 - h * 3600) / 60);
        let s = dt - d * 24 * 3600 - h * 3600 - m * 60;
        let str = "";
        if (d > 0) {
            str = d + "d";
        }
        if (h > 0) {
            str += h + "h";
        }
        if (m > 0) {
            str += m + "m";
        }
        str += s + "s";

        return str;
    }

    /**
     * 获取一段时长的显示字符串，只显示最高的两位，如 1d2h5m6s，则返回 1d2h
     * @param duration 时长，单位：毫秒
     */
    public static getDurationStr2(duration: number) {
        if (duration < 0) {
            duration = 0;
        }
        let dt = Math.ceil(duration / 1000);
        let d = Math.floor(dt / (3600 * 24));
        let h = Math.floor((dt - d * 24 * 3600) / 3600);
        let m = Math.floor((dt - d * 24 * 3600 - h * 3600) / 60);
        let s = dt - d * 24 * 3600 - h * 3600 - m * 60;
        let str = "";
        if (d > 0) {
            str = d + "d" + h + "h";
        } else if (h > 0) {
            str = h + "h" + m + "m";
        } else if (m > 0) {
            str = m + "m" + s + "s";
        } else {
            str = s + "s";
        }

        return str;
    }

    public static breathScale(node: Node, s: number = 0.98) {
        let oriScale = node.scale
        return tween(node).repeatForever(
            tween()
                .to(0.5, { scale: new Vec3(s * oriScale.x, s * oriScale.y, s * oriScale.z) })
                .to(0.5, { scale: new Vec3(1 * oriScale.x, 1 * oriScale.y, 1 * oriScale.z) })
            // .to(0.5, {scale:new Vec3(0.95*oriScale.x,0.95*oriScale.y,0.95*oriScale.z)})
            // .to(0.5, {scale:new Vec3(1*oriScale.x,1*oriScale.y,1*oriScale.z)})
        ).start()
    }

    public static shakeScale(node: Node, s: number = 1.2) {
        let oriScale = node.scale
        return tween(node).repeatForever(
            tween()
                .to(0.2, { scale: new Vec3(s * oriScale.x, s * oriScale.y, s * oriScale.z) })
                .to(0.2, { scale: new Vec3(1 * oriScale.x, 1 * oriScale.y, 1 * oriScale.z) })
                .to(0.2, { scale: new Vec3(s * oriScale.x, s * oriScale.y, s * oriScale.z) })
                .to(0.2, { scale: new Vec3(1 * oriScale.x, 1 * oriScale.y, 1 * oriScale.z) })
                .delay(2.5)
        ).start()
    }

    public static breathOpacity(node: UIOpacity) {
        return tween(node).repeatForever(
            tween()
                .to(0.5, { opacity: 50 })
                .to(0.5, { opacity: 255 })
                .to(0.5, { opacity: 50 })
                .to(0.5, { opacity: 255 })
        ).start()
    }

    public static breathFloat(node: Node, y: number = 1) {
        return tween(node).repeatForever(
            tween()
                .to(3, { position: v3(0, 15 + y, 0) })
                .to(3, { position: v3(0, y, 0) })
                .to(3, { position: v3(0, 30 + y, 0) })
                .to(3, { position: v3(0, y, 0) })
        ).start()
    }

    /**
     * 显示子节点
     * @param node 
     * @param idx 
     */
    public static showSubNode(node: Node, idx: number) {
        for (let i = 0; i < node.children.length; i++) {
            node.children[i].active = (idx == i)
        }
    }

    public static randPos(pos: Vec3, x: number, y: number, z: number) {
        let r1 = MathRandom.getInstance().randomRange(-x * 100, x * 100) / 100
        let r2 = MathRandom.getInstance().randomRange(-y * 100, y * 100) / 100
        let r3 = MathRandom.getInstance().randomRange(-z * 100, z * 100) / 100
        pos.x += r1
        pos.y += r2
        pos.z += r3
        return pos
    }

    /** 
     * 中点坐标求法  left  mid  right 
     * (x + y)/2 = mid 所以 y = 2z -x 
    */
    public static getBehindPoint(left: Vec3, mid: Vec3): Vec3 {
        let vec = v3(0, 0, 0)
        vec.x = 2 * mid.x - left.x
        vec.y = 2 * mid.y - left.y
        vec.z = 2 * mid.z - left.z
        return vec
    }

    //爆炸动作
    public static ExplodeMotion(node: Node, center: Vec3 = null!) {
        let enemy = node.getChildByName("root")!
        let bottom = node.getChildByName("bottom")!
        enemy.eulerAngles = v3(0, 0, 0)
        let pos = enemy.getWorldPosition().clone()
        let nodePos = node.worldPosition
        let h = MathRandom.getInstance().randomRange(20, 40) / 10
        let t = 1 + (h / 4) / 3
        let delta = v3(0, 0, 0)
        if (center) {
            let dis = MathUtil.getInstance().calcDistance3D(center, node.worldPosition)
            Vec3.subtract(delta, node.worldPosition, center)
            //距离越大，系数越低
            let range = 2
            if (dis > range) dis = range
            let mul = 4.2 * ((range - dis) / range)
            delta.multiplyScalar(mul)
            // Public.log("-----------delta", delta, dis, mul)
        }
        pos.x += delta.x
        pos.z += delta.z

        tween(bottom).to(0.6 * t, { worldPosition: v3(pos.x, bottom.worldPosition.y, pos.z) }).start()

        tween(enemy)
            .to(0.6 * t, { worldPosition: v3(pos.x, pos.y + h, pos.z) }).call(() => { })
            .delay(0.3)
            .to(0.1, { worldPosition: v3(pos.x, (pos.y + h) * 0.8, pos.z) })
            .to(0.1, { worldPosition: v3(pos.x, (pos.y + h) * 0.5, pos.z) })
            .to(0.1, { worldPosition: v3(pos.x, (pos.y + h) * 0.3, pos.z) })
            .to(0.1, { worldPosition: v3(pos.x, (pos.y + h) * 0.1, pos.z) })
            .to(0.1, { worldPosition: v3(pos.x, 0, pos.z) })
            .start()
        let randAngle1 = MathRandom.getInstance().randomRange(-360, 360)
        let randAngle2 = MathRandom.getInstance().randomRange(-360, 360)
        let randAngle3 = MathRandom.getInstance().randomRange(-360, 360)
        let randAngle4 = MathRandom.getInstance().randomRange(-360, 360)
        let randAngle5 = MathRandom.getInstance().randomRange(-360, 360)
        let randAngle6 = MathRandom.getInstance().randomRange(-360, 360)
        tween(enemy)
            .to(1.5, { eulerAngles: v3(randAngle1, randAngle2, randAngle3) })
            .to(0.1, { eulerAngles: v3(0, randAngle2, 0) })
            // .to(0.5, {eulerAngles:v3(randAngle4,randAngle5,randAngle6)})
            // .to(0.3, {eulerAngles:v3(0,randAngle4,0)})
            .start()


    }

    // public static getSoldier(node:Node):soldier{
    //     let role:soldier = null!
    //     let s1 = node.getComponent(prefab_soldier)!
    //     if(s1) role= s1
    //     let s2 = node.getComponent(prefab_enemy)!
    //     if(s2) role= s2
    //     let s3 = node.getComponent(player)!
    //     if(s3) role= s3
    //     return role
    // }

    /**
     * 获得2个点之间的点
     * @param sPos
     * @param ePos
     * @param cnt
     */
    public static GetPoints(sPos: Vec3, ePos: Vec3, cnt: number = 30): Vec3[] {
        let pArr = []
        let p1 = v2(sPos.x, sPos.z)
        let p2 = v2(ePos.x, sPos.z)
        for (let i = 0; i < cnt; i++) {
            let p = UtilPub.BezierOne(i / cnt, p1, p2)
            pArr.push(v3(p[0], ePos.y, p[1]))
            // //Public.log("------p------", p)
        }
        pArr.push(ePos)
        return pArr
    }

    /**
     * 一个点是否在这个节点的区域内
     * @param node 节点
     * @param pos 触点坐标
     * @constructor
     */
    public static IsPointInNodeArea2D(node: Node, pos: Vec2) {
        const nodeUIT = node.getComponent(UITransform)!;
        let wordPos = nodeUIT.convertToWorldSpaceAR(new Vec3(0, 0, 0))
        // UtilPub.log("-------触点到节点世界坐标---", wordPos, "----pos", pos, nodeUIT.width, nodeUIT.height)
        //判断点击的位置是否在矩形区域内
        if (pos.x < wordPos.x + nodeUIT.width / 2 && pos.x > wordPos.x - nodeUIT.width / 2) {
            // UtilPub.log("-------触点到节点世界坐标1---", wordPos.x + nodeUIT.width/2)
            if (pos.y < wordPos.y + nodeUIT.height / 2 && pos.y > wordPos.y - nodeUIT.height / 2) {
                // UtilPub.log("-------触点到节点世界坐标2---", wordPos.x + nodeUIT.width/2)
                return true
            }
        }
        return false
    }
    /**
    * 一个点是否在这个区域内
    * @param node 节点
    * @param pos 触点坐标
    * @constructor
    */
    public static IsPointInArea2D(pos: Vec3, wordPos: Vec3, width: number, height: number) {
        // const nodeUIT = node.getComponent(UITransform)!;
        // let wordPos = nodeUIT.convertToWorldSpaceAR(new Vec3(0, 0, 0))
        // UtilPub.log("-------触点到节点世界坐标---", wordPos, "----pos", pos)
        //判断点击的位置是否在矩形区域内
        if (pos.x < wordPos.x + width / 2 && pos.x > wordPos.x - width / 2) {
            // UtilPub.log("-------触点到节点世界坐标1---", pos, wordPos )
            if (pos.y < wordPos.y + height / 2 && pos.y > wordPos.y - height / 2) {
                // UtilPub.log("@@@@@@-------触点到节点世界坐标2---", pos, wordPos)
                return true
            }
        }
        return false
    }

    public static decimal2(num: number) {
        return Math.floor(num * 100) / 100
    }

    /**
     * 渐变功能
     * @param duration 秒 1.1
     * @param frame 每秒多少帧，30
     * @param cnt 总共需要调用多少次， 1.1 * 30 ， 每调用一次减1
     * @param pass 渲染管线对象
     * @param color 颜色，new Color(r,g,b,a)
     * @param meshNode 网格节点
     * @constructor
     */
    public static FadePlane(duration: number, frame: number, cnt: number, pass: renderer.Pass, color: Color, meshNode: Node) {
        // const pass = this.frameMesh.getMaterial(0)!.passes[0];

        if (cnt <= 0) {
            return
        }
        let interval = duration / frame
        let total = duration * frame
        let opacity = Math.round(255 * (cnt / total))
        // //Public.log("pass--------", cnt, color.a, opacity)
        tween(meshNode).call(() => {
            const h = pass.getHandle('mainColor');
            // pass.setUniform(h, new Color().fromHEX('#0000ff'));
            color.a = opacity
            pass.setUniform(h, color)
            cnt -= 1
        }).delay(interval).call(() => {
            UtilPub.FadePlane(duration, frame, cnt, pass, color, meshNode)
        }).start()
    }

    //统一
    public static cntDown(node: Node, sec: number, cbEach: Function, cbFinal: Function) {
        setTimeout(() => {
            if (node.active) {
                if (sec > 0) {
                    sec -= 1
                    cbEach && cbEach(sec)
                    this.cntDown(node, sec, cbEach, cbFinal)
                } else {
                    //领取奖励
                    cbFinal && cbFinal()
                }
            }
        }, 1000)
    }

    public static setCustomSize(node: Node, size: number) {
        let nodeH = node.getComponent(UITransform)?.height
        let nodeW = node.getComponent(UITransform)?.width

        let scale = Math.min(size / nodeW!, size / nodeH!)
        node.scale = v3(scale, scale, scale)

    }

}

