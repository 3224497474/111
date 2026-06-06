import { _decorator, Component, Node, Vec2, Vec3, math } from "cc";
const { ccclass, property } = _decorator;

@ccclass("UtilsMath")
/**
 * Created by 许宇
 *
 * UtilsMath
 * 数学工具
 */

// main
export default class UtilsMath {
    /**
     * 数字变字符串，长度不足前补0
     */
    public textNumString(num: number, len: number = 2) {
        let need = len - String(num).length;
        let str = "";
        for (let i = 0; i < need; i++) {
            str += "0";
        }
        str += num;
        return str;
    }

    /**
    * 已知两点求距离
    * @param {cc.Vec2} pos1
    * @param {cc.Vec2} pos2
    */
    public calcDistance(pos1: Vec2 | Vec3, pos2: Vec2 | Vec3) {
        let xdiff = pos1.x - pos2.x;
        let ydiff = pos1.y - pos2.y;
        let dis = Math.pow((xdiff * xdiff + ydiff * ydiff), 0.5);
        return dis;
    };


    /**
     * 转换ccc的角度
     * @param angle
     */
    public fixAngle(angle: number): number {
        angle = -angle % 360;
        if (angle > 180)
            angle = -180 + angle % 180;
        else if (angle < -180)
            angle = 180 + angle % 180;
        return angle;
    }

    /**
     * 获得随机数
     * @param maxNum 上限
     * @param minNum 下限
     */
    public getRandom(maxNum: number, minNum: number): number {
        return MathRandom.getInstance().randomRange(minNum, maxNum);
    };
    public getRandom2(maxNum: number, minNum: number, floatLen: number = 0): number {
        let ranNum = 0;
        ranNum = MathRandom.getInstance().random() * (maxNum - minNum + 1) + minNum;
        if (floatLen > 0) {
            ranNum = parseFloat(ranNum.toFixed(floatLen));
        } else
            ranNum = parseInt(ranNum + '');
        return ranNum;
    };
    public getRandom3(maxNum: number, minNum: number, floatLen: number = 0): number {
        let ranNum = 0;
        ranNum = Math.random() * (maxNum - minNum + 1) + minNum;
        if (floatLen > 0) {
            ranNum = parseFloat(ranNum.toFixed(floatLen));
        } else
            ranNum = parseInt(ranNum + '');
        return ranNum;
    };

    public setRandomSeed(value: number): void {
        MathRandom.getInstance().setSeed(value);
    };

    /**
     * 不四舍五入保留小数固定几位
     * @param nOriginalNum 原始数字
     * @param nFixed 保留小数的位数
     * @param bCeil 是否取上限
     */
    public toFixedUnRound(nOriginalNum: number, nFixed: number, bCeil: boolean = false) {
        let nNewValue = 0
        let nEqualPower = Math.pow(10, nFixed)
        if (bCeil) {
            nNewValue = Math.ceil(nOriginalNum * nEqualPower) / nEqualPower
        } else {
            nNewValue = Math.floor(nOriginalNum * nEqualPower) / nEqualPower
        }
        return nNewValue
    }
    /**
     * 取小数点后n位
     * @param value
     * @param len 小数位数
     * @param mode 取整方式 1=四舍五入，2=向上取整，3=向下取整
     */
    public toFixed(value: number, len: number = 2, mode: number = 1){
        let pow = Math.pow(10, len);
        switch (mode) {
            case 1: return Math.round(value * pow) / pow;
            case 2: return Math.ceil(value * pow) / pow;
            case 3: return Math.floor(value * pow) / pow;
        }
    };

    /**
     * 根据自身方向转换方向 （保持朝向前进）
     * @param x 
     * @param y 
     * @param z 
     * @param node 获取方向的节点
     */
    public getDirection(x: number, y: number, z: number, node: Node): Vec3 {
        const result = new Vec3(x, y, z);
        math.Vec3.transformQuat(result, result, node.getRotation());
        return result;
    }
};


/**
 * MathRandom
 * 随机数
 */
export class MathRandom {
    private static _instance: MathRandom = null;
    public static getInstance(): MathRandom {
        if (!MathRandom._instance) {
            MathRandom._instance = new MathRandom();
        }
        return this._instance;
    }

    public _seed = 12345;
    // private _seed = 123456789;
    // private m_z = 987654321;
    // private mask = 0xffffffff;

    public setSeed(value: number): void {
        this._seed = value;
    };

    public random(): number {
        // this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
        // this._seed = (18000 * (this._seed & 65535) + (this._seed >> 16)) & this.mask;
        // let result = ((this.m_z << 16) + this._seed) & this.mask;
        // result /= 4294967296;
        // return result + 0.5;
        this._seed = (this._seed * 9301 + 49297) % 233280;
        return Math.ceil(this._seed);
    }

   /**
    * 随机数
    * @param min 包含
    * @param max 包含
    * @returns 
    */
    public randomRange(min: number, max: number): number {
        // if (min == max) {
        //     return max
        // }
        // min = (typeof min !== "undefined") ? min : 0;
        // max = (typeof max !== "undefined") ? max : 1;
        // let range = max - min;
        // let ss = this.random();
        // return Math.floor(min + ss % range);
        return Math.round(Math.random() * (max - min) + min);
    }

    /**
     * 直接随机
     * @param 最小
     * @param 最大 
     */
    public RandomNumBoth(Min: number, Max: number): number {

        var Range = Max - Min;

        var Rand = Math.random();

        var num = Min + Math.round(Rand * Range); //四舍五入

        return num;

    }
};


export class MathUtil {
    private static _instance: MathUtil = null;
    public static getInstance(): MathUtil {
        if (!MathUtil._instance) {
            MathUtil._instance = new MathUtil();
        }
        return this._instance;
    }


    /**
     * 已经点A，角度，半径，求点B
     * @param {number} x
     * @param {number} y
     * @param {number} radius 半径
     * @param {any} angle 角度
     */
    public getPointB(x: number, y: number, radius: number, angle): Vec2 {
        let newX: number = x + radius * Math.cos(this.getEulerAngle(angle));
        let newY: number = y + radius * Math.sin(this.getEulerAngle(angle));
        return cc.v2(newX, newY);
    }

    /**
     * 转换成欧拉角
     * @param angle
     */
    public getEulerAngle(angle: number): number {
        return angle * Math.PI / 180;
    };
    /**
     * 已知两点求角度
     * @param pos1 坐标1 相当于原点
     * @param pos2 坐标2
     * @param is360 是否输出360°的格式
     */
    public getAngle2(pos1: Vec2, pos2: Vec2, is360: boolean = false): number {
        let x: number = pos2.x - pos1.x;
        let y: number = pos2.y - pos1.y;
        let xrad = Math.atan2(y, x) //注意参数（y, x） Y在前，X在后
        let angle: number = xrad / Math.PI * 180;
        if (is360 && angle < 0)
            angle += 360;
        return angle;
    }
    /**
      * 已知两点求角度
      * @param {number} x1
      * @param {number} y1
      * @param {number} x2
      * @param {number} y2
      */
    public getAngle(x1: number, y1: number, x2: number, y2: number): number {
        let radian: number = this.getRadian(x1, y1, x2, y2); //求出弧度
        let angle: number = 180 / (Math.PI / radian); //用弧度算出角度
        let x: number = x2 - x1;
        let y: number = y2 - y1;
        if (y < 0)
            angle = -angle;
        else if ((y == 0) && (x < 0))
            angle = 180;
        return angle;
    }

    /**
     * 已知两点求弧度
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     */
    public getRadian(x1: number, y1: number, x2: number, y2: number): number {
        //两点的x、y值
        let x: number = x2 - x1;
        let y: number = y2 - y1;
        let hypotenuse: number = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
        //斜边长度
        let cos: number = x / hypotenuse;
        let radian: number = Math.acos(cos);
        return radian;
    }


    /**
  * 已知两点求距离(3D)
  * @param {cc.Vec2} pos1
  * @param {cc.Vec2} pos2
  */
    public calcDistance3D(pos1: Vec3, pos2: Vec3) {
        let xdiff = pos1.x - pos2.x;
        let ydiff = pos1.y - pos2.y;
        let zdiff = pos1.z - pos2.z
        let dis = Math.pow((xdiff * xdiff + ydiff * ydiff + zdiff * zdiff), 0.5);
        return dis;
    };

    /**
  * 已知两点求距离
  * @param {cc.Vec2} pos1
  * @param {cc.Vec2} pos2
  */
    public calcDistance(pos1: Vec2 | Vec3, pos2: Vec2 | Vec3) {
        let xdiff = pos1.x - pos2.x;
        let ydiff = pos1.y - pos2.y;
        let dis = Math.pow((xdiff * xdiff + ydiff * ydiff), 0.5);
        return dis;
    };
}