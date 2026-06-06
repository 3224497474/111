import { WmSocketJSF } from "./WmSocketJSF";

//normal， new，hot，maintain
export const ServerState = {
    Normal: 'normal',
    New: 'new',
    Hot: 'hot',
    Maintain: 'maintain'
}

import { game, _decorator } from 'cc';
import { HTML5 } from "cc/env";
import { Const } from "../../config/Const";
import GD from "../../config/GD";
import { GAccountWay, GOrderStatus, GPlatform, GPromptType } from "../../config/global";
import { composeModel } from "../../game/comm/composeModel";
import { GameStorage } from "../mgr/gameStorage";
import { Notifications } from "../mgr/notifications";
import { uiManager } from "../mgr/uiManager";
import { UtilPub } from "../utils/UtilPub";
import { GNetCmd } from "./conf";
import CronCtrJSF from "./CronCtrJSF";
const { ccclass, property } = _decorator;

@ccclass('ServerCtrJSF')
export default class ServerCtrJSF {

    private static instance: ServerCtrJSF = null!;

    public static GetInstance() {
        if (!this.instance) {
            this.instance = new ServerCtrJSF();
            this.instance.InitServerCtr();
        }
        return this.instance;
    }

    serverId: number = 1;
    account: string = '';
    accountWay: number = GAccountWay.guest;
    password: string = 'autoLogin123';
    authCode: string = "";
    token: string = '';
    regionDataList: any[] = [];
    uid: string = '';
    regionId: string = '';
    nickName: string = '胖啾啾啊';
    isLogin: boolean = true;
    isLoadAll: boolean = false; //是否完全加载


    avatar: string = '';

    regionList: any = {};
    serverList: any = {};

    InitServerCtr() {
        this.account = GameStorage.getStringDisk('login_account', '');
        this.password = GameStorage.getStringDisk('login_password', this.password);
        this.authCode = GameStorage.getStringDisk('login_authCode', this.authCode);
        this.serverId = GameStorage.getIntDisk('login_serverId', 1);
    }

    CheckIsHaveAccount() {
        if (!this.account || this.account == '') {
            // 没有账号
            return false;
        }
        return true;
    }

    CheckHaveDataById(regionId: number) {
        for (let i = 0; i < this.regionDataList.length; i++) {
            const data = this.regionDataList[i];
            if (data.regionId == regionId) {
                return true;
            }
        }
        return false;
    }
    gameTime() {
        return GameStorage.getInt('login_gameTime', 0);
    }

    addGameTime(num: number) {
        num += this.gameTime()
        GameStorage.setInt('login_gameTime', num);
    }

    //_prodUrlVersion:string =""; //生产环境的url版本
    get prodUrlVersion() {
        return GameStorage.getStringDisk('prod_url_version', "");
    }

    set prodUrlVersion(str: string) {
        console.log("-@@@@@@@@@@@--------设置生产环境的url版本--", str)
        GameStorage.setStringDisk('prod_url_version', str);
    }

    //version 就是服务端版本号，如果本地缓存不等于服务端，那么提示重进游戏，并且标记本地缓存未服务端缓存。
    get version() {
        return GameStorage.getStringDisk('login_version', "");
    }

    set version(str: string) {
        console.log("-@@@@@@@@@@@--------设置服务端版本号--", str)
        GameStorage.setStringDisk('login_version', str);
    }

    get Account() {
        if (this.account == "") {
            this.account = UtilPub.randomString(8)
        }
        return this.account;
    }

    set Account(str: string) {
        this.account = str;
        console.log("-@@@@@@@@@@@--------账号被修改--", str)
        GameStorage.setStringDisk('login_account', this.account);
    }

    get PassWord() {
        return this.password;
    }

    set PassWord(str: string) {
        this.password = str;
        GameStorage.setStringDisk('login_password', this.password);
    }
    get AuthCode() {
        return this.authCode;
    }

    set AuthCode(str: string) {
        this.authCode = str;
        GameStorage.setStringDisk('login_authCode', this.authCode);
    }

    get ServerId() {
        return this.serverId;
    }
    set ServerId(id: number) {
        this.serverId = id;
        GameStorage.setStringDisk('login_serverId', this.serverId + "");
    }

    isOkToDownload() {
        return composeModel.isHandDone() == true && ServerCtrJSF.GetInstance().gameTime() > 3 * 60
    }

    UpdateRegions(regions: any) {
        for (const key in regions) {
            const data = regions[key];
            this.regionList[key] = JSON.parse(data);
        }
    }

    UpdateServers(servers: any) {
        for (const key in servers) {
            const data = servers[key];
            this.serverList[key] = JSON.parse(data);
        }
    }

    public GetServerData(serverId: number) {
        for (const key in this.serverList) {
            const data = this.serverList[key];
            if (data.id == serverId) {
                return data;
            }
        }
        return null;
    }
    public GetStateIcon(status: string) {
        switch (status) {
            case ServerState.Normal:
                return;
            case ServerState.New:
                return 'fm_tb_xin';
            case ServerState.Hot:
                return 'fm_tb_bao';
            case ServerState.Maintain:
                return 'fm_tb_wei';
            default:
                break;
        }
    }

    // 获取最新的不在维护中服务器
    public GetLastNewServer() {
        let id = 1;
        for (const key in this.serverList) {
            const data = this.serverList[key];
            let did = Number(data.id)
            if (did > id && data.status != ServerState.Maintain) {
                id = did;
            }
        }
        return id;
    }

    // public reqConnect() {
    //     WmSocketJSF.getInstance().connect();
    // }

    public reqRegister(account: any, password: any) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.UserRegister,
            "lang": "zh",
            "account": account,
            "password": password,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqLogin() {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.UserLogin,
            "lang": "zh",
            "account": this.account,
            "password": this.password,
            'nickName': this.nickName + this.account
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }


    public wxLoginBegin(failCb?: Function) {
        wx.login({
            success(loginResult) {
                console.warn("-----微信登录--", loginResult);
                let data = {
                    "cmd": GNetCmd.ReqWxSession,
                    "lang": "zh",
                    "channel": "wx",
                    "nickName": "",
                    jscode: loginResult.code,
                };
                console.warn('发送登录数据：', data);
                WmSocketJSF.getInstance().send({ "data": data });
            },
            fail(res) {
                let msg = "登录失败：" + res.errMsg;
                if (failCb) failCb(msg);
            }
        });
    }

    public reqLoginByAccount(account: string, password: string, authCode: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.UserLogin,
            "lang": "zh",
            "account": account,
            "password": password,
            "authCode": authCode,
            'nickName': this.nickName + this.account
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    //领取别人的财神奖励  receicveIndex:0-5  ; -1查询
    public reqReceiveGodWealth(shareUserID: string, receicveIndex: number) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.ReceiveGodWealth,
            "lang": "zh",
            "token": this.token,
            "shareUserID": shareUserID,
            "receicveIndex": receicveIndex,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    //请求背包日志
    public reqSetPlayerPkgLog(propId: string, propName: string, num: number, coming: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.SetPlayerPkgLog,
            "lang": "zh",
            "token": this.token,
            "propId": propId,
            "propName": propName,
            'num': num,
            'coming': coming,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqUniqueLoginByAccount(account: string, accountWay: GAccountWay = GAccountWay.guest) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let platform = GPlatform.Google
        if (HTML5) {
            platform = GPlatform.H5
        }
        let data = {
            "cmd": GNetCmd.UniqueLogin,
            "lang": "zh",
            "account": account,
            "accountWay": accountWay,
            "platform": platform,
            "nickName": "测试账号",
        }
        console.log("--请求测试账号---", data)
        WmSocketJSF.getInstance().send({ "data": data });
    }


    public reqGetActiveCode(code: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetActiveCode,
            "lang": "zh",
            "token": this.token,
            "code": code,
        }
        console.log("--请求激活码---", data)
        WmSocketJSF.getInstance().send({ "data": data });
        //{
        // 	"msg":  "CodeIsNotExist", // "RewardsAlreadyGotted", //ActiveCodeExpired
        // 	"status": util.RES_MSG_FAIL,
        // }
        //{
        // 	"rewards": [{propId:xx, cnt:1}],
        // 	"status":  util.RES_MSG_SUCCESS,
        // }
    }


    /**
     * 创建充值订单
     * @param orderNo 充值订单ID
     * @param chargeVal 充值的金额，单位渠道默认
     * @param chargeItemId 充值表ID
     * @param chargeItemCnt 充值表奖励列表[[],[],[]] 转为字符串保存
     * @param orderStatus 订单状态
     * @returns 
     */
    public reqCreateChargeOrder(orderNo: string, chargeVal: number, chargeItemId: number, chargeItemCnt: string, orderStatus: GOrderStatus) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.CreateChargeOrder,
            "lang": "zh",
            "token": this.token,
            "orderNo": orderNo,
            "chargeVal": chargeVal,
            "chargeItemId": chargeItemId,
            "chargeItemCnt": chargeItemCnt,
            "orderStatus": orderStatus,
        }
        console.log("--创建充值订单---", data)
        WmSocketJSF.getInstance().send({ "data": data });
    }

    /**
     * 修改充值订单
     * @param orderNo 充值订单ID
     * @param orderStatus 订单状态
     * @returns 
     */
    public reqUpdChargeOrderStatus(orderNo: string, orderStatus: GOrderStatus) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.UpdChargeOrderStatus,
            "lang": "zh",
            "token": this.token,
            "orderNo": orderNo,
            "orderStatus": orderStatus,
        }
        console.log("--修改充值订单---", data)
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqRegionList() {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetRegionList,
            "lang": "zh",
            "token": this.token,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqRegionData() {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetRegionData,
            "lang": "zh",
            "token": this.token,
            "regionId": this.ServerId.toString()
        }
        console.log("--请求服务器数据---", data)
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqGetUserDataByKey(key: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetUserDataByKey,
            "lang": "zh",
            "key": key,
            "token": this.token,
            "type": "normal", //object
            'model': "normal", //array
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public reqGetUserDataObjByKey(key: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetUserDataByKey,
            "lang": "zh",
            "key": key,
            "token": this.token,
            "type": "object", //object
            'model': "normal", //array
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public getUserDataByKey(value: any, key: string) {
        if (value.status != 'success') {
            console.log("请求失败~!")
            return null;
        }
        switch (value.cmd) {
            case GNetCmd.GetUserDataByKey:
                if (value.key == GameStorage.Key(key)) {
                    return value
                }
                break;
        }
        return null;
    }

    public reqGetCodeDataObjByKey(code: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.GetCodeDataByKey,
            "lang": "zh",
            "token": this.token,
            "code": code,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public getCodeDataByKey(value: any, key: string) {
        if (value.status != 'success') {
            console.log("请求失败~!")
            return null;
        }
        switch (value.cmd) {
            case GNetCmd.GetUserDataByKey:
                if (value.key == GameStorage.Key(key)) {
                    return value
                }
                break;
        }
        return null;
    }


    public reqDelMultiRecord(jsonData: {}) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        CronCtrJSF.GetInstance().DelMultiRecord(jsonData);
    }

    public reqUploadMultiRecord(jsonData: {}) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        CronCtrJSF.GetInstance().UploadMultiRecord(jsonData);
    }

    public reqUploadEmptyRecord() {
        if (!WmSocketJSF.getInstance().isConnected()) return
        CronCtrJSF.GetInstance().UploadEmptyRecord();
    }

    public reqCloudSaveManual(key: string, val: any, isFirst: boolean = false) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        CronCtrJSF.GetInstance().cloudSaveManual(key, val, isFirst);
    }

    public reqCloudDeleteManual(key: string) {
        if (!WmSocketJSF.getInstance().isConnected()) return
        CronCtrJSF.GetInstance().cloudDeleteManual(key);
    }

    public UnloadAvatarUrl() {
        if (!WmSocketJSF.getInstance().isConnected()) return
        let data = {
            "cmd": GNetCmd.UploadAvatar,
            "lang": "zh",
            "token": this.token,
            "avatar": this.avatar,
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    public loginHandler(value: any) {
        return
        console.log("onMessageEvent:", value);
        if (value.status != 'success') {
            console.log("请求失败~!")
            ServerCtrJSF.GetInstance().isLogin = false;

            if (value.cmd == GNetCmd.GetRegionData) {
                if (value.isBlock) {
                    uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                        content: "您的账号已经被封，禁止登录，请联系社群。",
                        type: GPromptType.blockAccount,
                        cb: () => {

                        }
                    })
                }
            }
            return;
        }
        let ctr = ServerCtrJSF.GetInstance();
        switch (value.cmd) {
            case GNetCmd.ReqWxSession:
            case GNetCmd.UniqueLogin:
                ctr.accountWay = value.accountWay
                ctr.account = value.account;
                ctr.Account = value.account;
                ctr.token = value.token;
                ctr.regionDataList = value.regionDataList;
                ctr.uid = value.uid
                if (value.nickName && value.nickName != '') {
                    ctr.nickName = value.nickName;
                }
                ServerCtrJSF.GetInstance().reqRegionData()
                break;
            case GNetCmd.GetRegionData:
                ctr.token = value.token;

                ctr.prodUrlVersion = value.prodUrlVersion
                if (ctr.version == "" || ctr.version == value.version) {
                    console.log("----版本资源匹配--通过")
                } else {
                    uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                        content: "您当前游戏版本不是最新的，请重新进入游戏！",
                        type: GPromptType.resNotNewest,
                        cb: () => {
                        }
                    })
                    ctr.version = value.version
                    return
                }

                //配置机器人逻辑
               
                GameStorage.clear()
                let isRobot = GameStorage.isRobot
                if(isRobot==true){
                    //设置初始逻辑，机器人要资源全加载
                    Notifications.emit(GD.event.loadAll, () => {
                        this.isLoadAll = true
                    })
                }else{
                    if (value.jsonData != "") {
                        GameStorage.setAll(JSON.parse(value.jsonData))
                    }
                    GameStorage.setStringDisk('login_account', ctr.Account);
                }
                

                //如果玩家过了新手那么加载全部资源
                if (ServerCtrJSF.GetInstance().isOkToDownload() == true) {
                    Notifications.emit(GD.event.loadAll, () => {
                        this.isLoadAll = true
                    })
                } else {
                    this.isLoadAll = true
                }

                ctr.isLogin = true;

                break;
            default:
                break;
        }
    }
}
