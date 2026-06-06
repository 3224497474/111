import { _decorator, Component, game, sys, } from 'cc';
const { ccclass, property } = _decorator;
import { WECHAT } from 'cc/env';

@ccclass
export default class GameMemoryStorage {

    //用户登录区服，然后拉取服务端记录，原有代码接口不变，底层存取数据改为内存，另外再备份到磁盘已备修改器修改上传，规避获取不到磁盘数据的情况。
    //修改以后，所有数据存取都是走内存，当用户重新登录的时候，内存自动清空，再清空本地磁盘数据
    static memory: any = {}; //内存
    static publicKey = "JmksO12Ldl60Lsk"
    static isEncrypt = false;

    public static clear() {
        this.memory = {}
    }

    public static getItem(key: string) {
        if (!this.memory.hasOwnProperty(key)) {
            //  return ""
        }
        let res = "";
        // try{
        //  res = this.decrypt(this.memory[key]);
        // }catch (e){
        //     res = this.memory[key]
        // }
        // res = this.memory[key]
        res = sys.localStorage.getItem(key)! //|| this.memory[key]
        return res
    }

    public static setItem(key: string, value: string) {
        this.memory[key] = value + "";
        sys.localStorage.setItem(key, this.encrypt(value));
    }

    public static removeItem(key: string) {
        delete this.memory[key];
        sys.localStorage.removeItem(key);
    }

    public static len() {
        return Object.keys(this.memory).length;
    }

    public static keys() {
        let keys: string[] = [];
        // 获取 localStorage 中所有的键  
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i)!;
            keys.push(key);
        }


        return keys;
    }

    public static encrypt(content: string) {
        return content
        // if(this.isEncrypt==false) return content;
        // return  encrypt.encrypt(JSON.stringify(content),this.publicKey,256);
        //加密解密示例代码
        // var secretkey= 'open_sesame'; // 加密密钥
        // var dataString = content
        // var encrypted = encrypt.encrypt(dataString,secretkey,256);
        // var myString=JSON.parse(encrypt.decrypt(encrypted,secretkey,256))
        // cc.log('原始字符串:'+dataString)
        // cc.log('加密后:'+encrypted)
        // cc.log('解密后看看对不对:'+myString)

    }

    public static decrypt(content: string) {
        return content
        // if(this.isEncrypt==false) return content;
        // return JSON.parse(encrypt.decrypt(content,this.publicKey,256));
    }

}
