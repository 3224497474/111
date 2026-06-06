
import { Component, sys, _decorator } from 'cc';
import { Const } from '../../config/Const';
import ServerCtrJSF from '../network/ServerCtrJSF';
import GameMemoryStorage from './GameMemoryStorage';
const { ccclass, property } = _decorator;



@ccclass('GameStorageJSF')
export class GameStorageJSF extends Component {
    private static readonly GLOBAL_KEY_PREFIXES = ['login_', 'server_', 'auth_'];

    private static _instance: GameStorageJSF;
    static get ins() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new GameStorageJSF();
        return this._instance;
    }

    //是否是机器人，1为ture，0为否
    public setRobot(isRobot:boolean=false){
        let val = isRobot?"1":"0"
        sys.localStorage.setItem("login_isRobot", val);
    }

    public get isRobot(){
        let n =  sys.localStorage.getItem("login_isRobot");
        return n=="1"
    }

    GameKey = Const.SaveHead;
    private _activeUserScope: string = sys.localStorage.getItem(`${Const.SaveHead}auth_active_uid`) || '';

    private isGlobalDiskKey(key: string) {
        if (key === 'prod_url_version') {
            return true;
        }
        return GameStorageJSF.GLOBAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
    }

    private getScopedPrefix() {
        if (!this._activeUserScope) {
            return this.GameKey;
        }
        return `${this.GameKey}${this._activeUserScope}_`;
    }

    private getLegacyKey(key: string) {
        return this.GameKey + key;
    }

    private getDiskKey(key: string) {
        if (this.isGlobalDiskKey(key)) {
            return this.getLegacyKey(key);
        }
        return this.Key(key);
    }

    private getDataKeyCandidates(key: string) {
        const scopedKey = this.Key(key);
        const legacyKey = this.getLegacyKey(key);
        if (scopedKey === legacyKey) {
            return [scopedKey];
        }
        return [scopedKey, legacyKey];
    }

    private getStoredValue(key: string) {
        const candidates = this.getDataKeyCandidates(key);
        for (const candidate of candidates) {
            const value = this.getStorage().getItem(candidate);
            if (value != null && value !== "") {
                return value;
            }
        }
        return null;
    }

    public setActiveUserScope(uid: string = '') {
        this._activeUserScope = uid.trim();
        sys.localStorage.setItem(this.getLegacyKey('auth_active_uid'), this._activeUserScope);
    }

    public getActiveUserScope() {
        return this._activeUserScope;
    }

    public  Key(key: string) {
        return this.getScopedPrefix() + key;
    }

    public  GetRawKey(key: string) {
        return key.replace(GameStorage.GameKey + "_", "")
    }

     getStorage() {
        return GameMemoryStorage
        // return Const.isActiveMemoryTmp?GameMemoryStorageTmp: GameMemoryStorage
    }

     getInt(key: string, def: number = 0) {
        let n = this.getStoredValue(key);
        if (n != null && n != "") {
            return Number(n);
        }
        return def;
    }

     setInt(key: string, num: number) {
        key = this.Key(key);
        this.getStorage().setItem(key, num + "");
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudSaveManual(key, num);
    }

     setIntMulti(dataObj: { [key: string]: number }) {
        for (let key of Object.keys(dataObj)) {
            let val = dataObj[key];
            key = this.Key(key);
            this.getStorage().setItem(key, val + "");
        }
        if(!this.isRobot)  ServerCtrJSF.GetInstance().reqUploadMultiRecord(dataObj);
    }

     setIntMemory(key: string, num: number) {
        key = this.Key(key);
        this.getStorage().setItem(key, num + "");
    }

     getBoolean(key: string, def: boolean = false) {
        let n = this.getStoredValue(key);
        if (n != null && n != "") {
            return Number(n) == 1 ? true : false;
        }
        return def;
    }

     setBoolean(key: string, is: boolean) {
        key = this.Key(key);
        let v = is ? 1 : 0;
        this.getStorage().setItem(key, v + "");
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudSaveManual(key, v);
    }

     setBooleanMulti(dataObj: { [key: string]: boolean }) {
        for (let key of Object.keys(dataObj)) {
            let v = dataObj[key] ? 1 : 0;
            key = this.Key(key);
            this.getStorage().setItem(key, v + "");
        }
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqUploadMultiRecord(dataObj);
    }

     setBooleanMemory(key: string, is: boolean) {
        key = this.Key(key);
        let v = is ? 1 : 0;
        this.getStorage().setItem(key, v + "");
    }

     getString(key: string, def: string = '') {
        let n = this.getStoredValue(key);
        if (n != null && n != "") {
            return n;
        }
        return def;
    }
    //登录部分信息才用
     getStringDisk(key: string, def: string = '') {
        let n = sys.localStorage.getItem(this.getDiskKey(key));
        if (n != null && n != "") {
            return n;
        }
        return def;
    }
     setIntDisk(key: string, num: number) {
        key = this.getDiskKey(key);
        this.getStorage().setItem(key, num + "");
    }
     getIntDisk(key: string, def: number = 0) {
        let n = sys.localStorage.getItem(this.getDiskKey(key));
        if (n != null && n != "") {
            return Number(n);
        }
        return def;
    }
     setStringDisk(key: string, val: string) {
        sys.localStorage.setItem(this.getDiskKey(key), val);
    }

     setStringMemory(key: string, val: string) {
        const storageKey = this.Key(key);
        this.getStorage().setItem(storageKey, val);
        sys.localStorage.setItem(storageKey, val);
    }

     setString(key: string, str: string) {
        const storageKey = this.Key(key);
        this.getStorage().setItem(storageKey, str);
        if (key == 'login_account') {
            return;
        }
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudSaveManual(storageKey, str);
    }

    setStringMulti(dataObj: { [key: string]: string }) {
        for (let key of Object.keys(dataObj)) {
            let val = dataObj[key];
            key = this.Key(key);
            this.getStorage().setItem(key, val);
            if (key == GameStorage.GameKey + 'login_account') {
                continue;
            }
        }
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqUploadMultiRecord(dataObj);
    }

    getObject(key: string, def: any = null) {
        let n = this.getStoredValue(key);
        if (n != null && n != "") {
            try {
                let json = JSON.parse(n);
                return json || def;
            } catch (error) {
                return def;
            }

        }
        return def;
    }

     setObject(key: string, obj: any) {
        key = this.Key(key);
        let v = JSON.stringify(obj);
        this.getStorage().setItem(key, v);
        if(!this.isRobot)  ServerCtrJSF.GetInstance().reqCloudSaveManual(key, v);
    }

     setObjectMulti(dataObj: { [key: string]: {} }) {
        let tmpObj:{ [key: string]: {} } = {}
        for (let key of Object.keys(dataObj)) {
            let v = JSON.stringify(dataObj[key]);
            key = this.Key(key);
            this.getStorage().setItem(key, v);
            tmpObj[key] = v;
        }
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqUploadMultiRecord(tmpObj);
    }

     sendObject(key: string, obj: any) {
        key = this.Key(key);
        let v = JSON.stringify(obj);
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudSaveManual(key, v);
    }


     setObjectMemory(key: string, obj: any) {
        key = this.Key(key);
        let v = JSON.stringify(obj);
        this.getStorage().setItem(key, v);
    }

     removeItem(key: string) {
        key = this.Key(key);
        this.getStorage().removeItem(key);
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudDeleteManual(key);
    }

     removeMulti(keyArr: string[]) {
        let tmpObj: any = {};
        keyArr.forEach((key) => {
            key = this.Key(key);
            this.getStorage().removeItem(key);
            tmpObj[key] = 0;
        });
        if(!this.isRobot) ServerCtrJSF.GetInstance().reqDelMultiRecord(tmpObj);
    }

     clear() {
        // console.log('清除数据:',localStorage.length)

        let list: string[] = [];
        const scopedPrefix = this.getScopedPrefix();
        const shouldClearLegacy = !this._activeUserScope;

        for (let i = 0; i < sys.localStorage.length; i++) {
            let key: string = sys.localStorage.key(i)!; //获取本地存储的Key
            const canClearScoped = key.indexOf(scopedPrefix) === 0;
            const canClearLegacy = shouldClearLegacy && key.indexOf(this.GameKey) >= 0 && key.indexOf('login') == -1;
            if (canClearScoped || canClearLegacy) {
                list.push(key);
            }
        }

        let keys = this.getStorage().keys();
        for (let i = 0; i < keys.length; i++) {
            let key: string = keys[i]; //获取本地存储的Key
            const canClearScoped = key.indexOf(scopedPrefix) === 0;
            const canClearLegacy = shouldClearLegacy && key.indexOf('login') == -1 && key.indexOf(this.GameKey) >=0;
            if (canClearScoped || canClearLegacy) {
                list.push(key);
            }
        }

        for (let i = 0; i < list.length; i++) {
            const key = list[i];
            this.getStorage().removeItem(key);
            // this.removeItem(key);
        }
        this.getStorage().clear()
        //清空本地无用的缓存

        // sys.localStorage.clear();
    }

    //老用户不用改为内存
     clearByKey(gameKey: string) {
        let list: string[] = [];
        const scopedKey = this.Key(gameKey);
        for (let i = 0; i < sys.localStorage.length; i++) {
            let key: string = sys.localStorage.key(i)!; //获取本地存储的Key
            if (key.indexOf(scopedKey) != -1 || key.indexOf(gameKey) != -1) {
                list.push(key);
            }
        }
        for (let i = 0; i < list.length; i++) {
            const key = list[i];
            this.getStorage().removeItem(key);
            if(!this.isRobot) ServerCtrJSF.GetInstance().reqCloudDeleteManual(key);
        }
    }

     getStringArrayByKey(str: string) {
        // console.log("获取列表:",str)
        let list: any[] = [];
        let list2: any[] = [];
        let keys = this.getStorage().keys();
        for (let i = 0; i < keys.length; i++) {
            const key: string = keys[i]; //获取本地存储的Key
            //console.log("key:",key);
            if (key.indexOf(str) != -1) {
                let n = this.getStorage().getItem(key);
                // console.log("=====n:",n)
                list.push(n);
                list2.push(key)
            }
        }
        return { keys: list2, values: list };
    }

     getObjectArrayByKey(str: string) {
        // console.log("获取列表:",str)
        let list: any[] = [];
        let list2: any[] = [];
        let keys = this.getStorage().keys();
        str = this.Key(str);
        for (let i = 0; i < keys.length; i++) {
            const key: string = keys[i]; //获取本地存储的Key
            // console.log("key:",key);
            if (key.indexOf(str) == 0) {
                let n = this.getStorage().getItem(key);
                //console.log("n:",n)
                let value = null;
                if (n != null && n != "") {
                    try {
                        let json = JSON.parse(n);
                        value = json || null;
                    } catch (error) {
                        value = null;
                    }
                }
                if (value) {
                    list.push(value);
                    let myKey = key.substring(this.GameKey.length, key.length);
                    list2.push(myKey);
                }
            }

        }
        return { keys: list2, values: list };
    }

    //老用户兼容使用，不改动，以及GM也使用这个接口上传数据到云端
     getAll(isFirst: boolean = false) {
        let jsonData: any = {}
        for (let i = 0; i < sys.localStorage.length; i++) {
            const key: string = sys.localStorage.key(i)!; //获取本地存储的Key
            if (key.indexOf('login') != -1) {
                continue;
            }
            if (isFirst) {
                let oldKey = key;
                let newKey = key.replace('zzdl', GameStorage.GameKey);
                jsonData[newKey] = sys.localStorage.getItem(oldKey)
            }
            else {
                if (key.indexOf('zzdl') != -1) {
                    continue;
                }
                jsonData[key] = sys.localStorage.getItem(key)
            }

            // console.log(key);
            // console.log(localStorage.getItem(key));//所有value
            // console.log("---------------------------------");
        }

        if (isFirst) {
            let spliceDatas: any = {};
            for (const key in jsonData) {
                if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
                    const value = jsonData[key];
                    // 大数据拆分.
                    // 1.装备
                    // 2.玄天宝录
                    // console.log("老用户数据处理key:",key,value);
                    switch (key) {
                        case GameStorage.GameKey + '_sect_xtbls':
                            {
                                let datas = JSON.parse(value);
                                // console.log("xtbl datas:",datas.length,datas);
                                for (let i = 0; i < datas.length; i++) {
                                    const xtbl = datas[i];
                                    let data = {
                                        id: xtbl.id,
                                        star: xtbl.star,
                                        debris: xtbl.debris
                                    }
                                    // GameStorage.setObject('SectXtbl_'+xtbl.id,data);
                                    spliceDatas[GameStorage.GameKey + '_SectXtbl_' + xtbl.id] = JSON.stringify(data);
                                }
                            }
                            break;
                        case GameStorage.GameKey + '_pack_equips':
                            {
                                let datas = JSON.parse(value);
                                // console.log("equip datas:",datas.length,datas);
                                for (let i = 0; i < datas.length; i++) {
                                    const equip = datas[i];
                                    let data = {
                                        id: equip.id,
                                        index: equip.index,
                                        level: equip.level,
                                        star: equip.star,
                                        partner: equip.partner,
                                        score: equip.score,
                                        skill_skr: equip.skill_skr,
                                        skill_skr_attr: equip.skill_skr_attr,
                                        skill_star: equip.skill_star,
                                        skill_star_attr: equip.skill_star_attr,
                                    };
                                    // GameStorage.setObject('pack_equip_'+equip.index,data);
                                    spliceDatas[GameStorage.GameKey + 'pack_equip_' + equip.index] = JSON.stringify(data);
                                }
                            }
                            break;
                        default:
                            {
                                sys.localStorage.setItem(key, value);
                            }
                            break;
                    }

                }
            }
            delete jsonData['zzdl_sect_xtbls'];
            delete jsonData['zzdl_pack_equips'];

            // console.log("spliceDatas:",spliceDatas);

            for (const key in spliceDatas) {
                const data = spliceDatas[key];
                jsonData[key] = data;
            }
        }

        return jsonData
    }

     async setAll(jsonData: any) {
        // console.log("11111覆盖数据")
        await this.clear();
        // console.log("覆盖前清除所有数据........",jsonData)

        for (let key in jsonData) {
            await this.getStorage().setItem(key, jsonData[key])
        }
    }

}

export const GameStorage = GameStorageJSF.ins
