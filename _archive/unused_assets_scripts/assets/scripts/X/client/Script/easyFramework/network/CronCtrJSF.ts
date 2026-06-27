
import { Component, director, _decorator, game } from 'cc';
import { WmSocketJSF } from './WmSocketJSF';
import { GEvent, GNetCmd, GNetConst, GNetUrl } from './conf';
import ServerCtrJSF from './ServerCtrJSF';
import TimeCtrJSF from './TimeCtrJSF';
import { uiManager } from '../mgr/uiManager';
import { Const } from '../../config/Const';
import { GPromptType } from '../../config/global';
import { WECHAT } from 'cc/env';
import { comm } from '../mgr/comm';
const { ccclass, property } = _decorator;

@ccclass('CronCtrJSF')
export default class CronCtrJSF extends comm {

    private static _instance: CronCtrJSF;

    public static GetInstance(): CronCtrJSF {
        if (!this._instance) {
            this._instance = new CronCtrJSF();
            this._instance.init();

        }
        return this._instance;
    }

    msgArr = [];
    msgArrIdx = 0;

    // testTimeDelta:number = 0;

    init() {
        director.off(GNetCmd.Heartbeat.toString(), this.onHeartbeat, this)
        director.off(GNetCmd.SaveUserRecord.toString(), this.respSaveUserRecord, this)
        director.on(GNetCmd.Heartbeat.toString(), this.onHeartbeat, this)
        director.on(GNetCmd.SaveUserRecord.toString(), this.respSaveUserRecord, this)
        this.unschedule(this.reqHeartBeat)
        this.schedule(this.reqHeartBeat, 3);
        // if( WmSocketJSF.getInstance().isConnected()==false){

        // }
        this.startHeartbeat()
    }

    startHeartbeat() {
        ///重连定时器
        WmSocketJSF.getInstance();
       
    }

    onHeartbeat(data: any) {
        return
        if (data.status != GNetConst.ResSuccess) {
            console.error("heartbeat ", data)
            this.unschedule(this.reqHeartBeat)
            ServerCtrJSF.GetInstance().isLogin = false;
            //被抢登了
            if (data.isOccupied) {
                uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                    content: "您的账号已经在其他设备登录，请重新进入游戏！",
                    type: GPromptType.loginOccupy,
                    cb: () => {
                    }
                })
            } else if (data.isExpired) {
                uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                    content: "您账号的登录信息已过期，请重新进入游戏！",
                    type: GPromptType.loginExpired,
                    cb: () => {
                    }
                })
            } else {
                uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                    content: "您账号的登录信息已过期，请重新登录！",
                    type: GPromptType.unkown,
                    cb: () => {
                    }
                })
            }

            TimeCtrJSF.GetInstance().ReInit();

            // App.event(GameEvent.ShowFlyTips,{text:`<color=red>账号已在其他设备登录</c>`})//${i18n.t('txt.login_msg_out')}
        } else {
            TimeCtrJSF.GetInstance().UpdateServerTimeByHeartbeat(data.time * 1000);
            WmSocketJSF.getInstance().lastHeartbeatTime = TimeCtrJSF.GetInstance().ServerTime
        }
    }

    reqHeartBeat() {
        // console.log("-----心跳-----", WmSocket.getInstance().isConnected(), ServerCtr.GetInstance().isLogin);
        return 
        if (WmSocketJSF.getInstance().isConnected() == false) {
            if (ServerCtrJSF.GetInstance().isLogin == true) {
                director.emit(GEvent.connect_fail)
                uiManager.instance.showDialog(Const.Dialogs.prompt_sure, {
                    content: "服务器连接已经断开，请确认重新登录！",
                    type: GPromptType.reconnect,
                    cb: () => {

                    }
                })
            }
        } else {
            if (ServerCtrJSF.GetInstance().isLogin == true) {
                this.heartbeatCheck()
            }
        }
    }

    respSaveUserRecord(data: any) {
        if (data.status == GNetConst.ResFail) {
            console.error("接受ws消息，保存失败--------", data)
        }
    }

    cloudSaveManual(key: string, val: any, isFirst: boolean = false) {
        if (!ServerCtrJSF.GetInstance().isLogin) {
            return;
        }
        if (!WmSocketJSF.getInstance().isConnected()) {
            director.emit(GEvent.connect_fail)
            return
        }
        // cc.log("上传数据时间标记---------", new Date().getTime(),  new Date().getTime()-this.testTimeDelta )
        let data = {
            // "cmd": GNetCmd.SaveUserRecord,
            "cmd": GNetCmd.SaveUserRecord,
            "lang": "zh",
            "type": "single",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
            "key": key,
            "val": String(val),
            "dml": "add upd"
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    UploadEmptyRecord() {
        if (!ServerCtrJSF.GetInstance().isLogin) {
            return;
        }
        if (!WmSocketJSF.getInstance().isConnected()) {
            director.emit(GEvent.connect_fail)
            return
        }
        let data = {
            // "cmd": GNetCmd.SaveUserRecord,
            "cmd": GNetCmd.SaveUserRecordAll,
            "lang": "zh",
            "type": "single",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
            "allData": JSON.stringify({}),
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    UploadMultiRecord(jsonData: {}) {
        if (!ServerCtrJSF.GetInstance().isLogin) {
            return;
        }
        if (!WmSocketJSF.getInstance().isConnected()) {
            director.emit(GEvent.connect_fail)
            return
        }
        let data = {
            "cmd": GNetCmd.SaveUserRecordMulti,
            "lang": "zh",
            "type": "single",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
            "multiData": JSON.stringify(jsonData),
            "ops": "upd"
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

    DelMultiRecord(jsonData: {}) {
        if (!ServerCtrJSF.GetInstance().isLogin) {
            return;
        }
        if (!WmSocketJSF.getInstance().isConnected()) {
            director.emit(GEvent.connect_fail)
            return
        }
        let data = {
            "cmd": GNetCmd.SaveUserRecordMulti,
            "lang": "zh",
            "type": "single",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
            "multiData": JSON.stringify(jsonData),
            "ops": "del"
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }


    cloudDeleteManual(key: string) {
        if (!ServerCtrJSF.GetInstance().isLogin) {
            return;
        }
        if (!WmSocketJSF.getInstance().isConnected()) {
            director.emit(GEvent.connect_fail)
            return
        }
        let data = {
            // "cmd": GNetCmd.SaveUserRecord,
            "cmd": GNetCmd.SaveUserRecord,
            "lang": "zh",
            "type": "single",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
            "key": key,
            "val": "",
            "dml": "del"
        }
        // GEvent.warn("del--------------")
        WmSocketJSF.getInstance().send({ "data": data });
    }

    heartbeatCheck() {
        let data = {
            "cmd": GNetCmd.Heartbeat,
            "lang": "zh",
            "token": ServerCtrJSF.GetInstance().token,//GameStorage.getString("loginToken"),
        }
        WmSocketJSF.getInstance().send({ "data": data });
    }

}
