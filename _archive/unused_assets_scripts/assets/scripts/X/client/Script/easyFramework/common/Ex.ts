// @ts-nocheck

import { Color } from "cc";
let stringEx = String.prototype;

stringEx.format = function () {
    let str = this;
    for (let i in arguments) {
        str = str.replace(/\%\w/, arguments[i]);
    }
    return str;
}
// 拓展String.parseColor方法
stringEx.parseColor = function () {
    let color = new Color(this);

    return color;
}
