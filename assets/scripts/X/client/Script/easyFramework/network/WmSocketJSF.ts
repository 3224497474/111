import { _decorator, Component, Node, director } from 'cc';
import {NATIVE} from 'cc/env';
import { GEvent, GNetCmd, GNetUrl } from './conf';
import ServerCtrJSF from './ServerCtrJSF';
const { ccclass, property } = _decorator;

@ccclass('WmSocketJSF')
export class WmSocketJSF{
    eventHandlers:any = [];

    public lastHeartbeatTime:number=0;
    public isWsConnect:boolean=false;
	ws:WebSocket = null!;
	wxws:any= null;
	msgBuff:any = {}; //key为stickId, val为stick数组
	// Stick_Id = "stick_id"
	// Stick_Len = "stick_len"
	// Stick_No = "stick_no" //服务端不处理，只判断字符总长度，前端自己用是否发送结束
	// Stick_Body = "stick_val"
	/**
     * 单例
     */
    private static _instance: WmSocketJSF;
    public static getInstance(): WmSocketJSF {
        if (!this._instance) {
            this._instance = new WmSocketJSF();
			this._instance.addListener();
        }
        return this._instance;
    }

    private isFirst = true;

    addListener(){
		director.off(GEvent.ws_reconnect, this.onReconnect,this);
        director.off(GEvent.ws_colse, this.onClose,this);
		director.off(GNetCmd.StickPack, this.respStickPack, this)

        director.on(GEvent.ws_reconnect, this.onReconnect,this);
        director.on(GEvent.ws_colse, this.onClose,this);
		director.on(GNetCmd.StickPack, this.respStickPack, this)
    }

	respStickPack(data:any){
    	// cc.log("粘包接受情况--", data)
		if(data["isEnd"]==false){
			this.sendStickPack(data["stick_id"], data["idx"]+1)
		}else{
			delete this.msgBuff[data["stick_id"]] //清空本地缓存
		}
	}

	getGuid(){
		let d = new Date().getTime();
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			let r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
		});
	}

	getTotalLen(arr:any[]){
    	let len = 0;
    	for(let i=0;i<arr.length; i++){
    		len += arr[i].length;
		}
    	return len;
	}

	sendStickPack(uuid:string, i:number){
		let data = {
			"cmd": GNetCmd.StickPack,
			"stick_id": uuid,
			"stick_len": this.getTotalLen(this.msgBuff[uuid]),
			"stick_val":this.msgBuff[uuid][i],
			"isEnd": i==this.msgBuff[uuid].length-1,
			"isStart": i==0,
			"idx":i
		}
		// cc.log("分段存储", data)
		WmSocketJSF.getInstance().sendSP(JSON.stringify(data));
	}

    onReconnect(){
        // 重连..
		if(this.isFirst){
			this.isFirst = false;
			this.connect();
			console.log("发起第一次连-------")
		}else{
			if(!this.isConnected()){
				this.connect();
				console.log("发起重连-------")
			}
		}
    }

    onClose(){
        // 断开连接..
        if (!this.isConnected()) {
            return;
        }
        else{
            this.ws.close();
        }
    }


    connect(){
        this.ws_connect();
    }

    ws_connect(){
	
    }

    onMessage(resp:string){
		let respJson = JSON.parse(resp)
		// console.log("------接受来自服务器的数据----：",respJson)
		director.emit(respJson.cmd+"" , respJson)
    }

    isConnected(){
    	return this.isWsConnect;
    }
    sendSP(jsonData:string){
	
	}

    send(netdata:any){
		// console.log("###请求参数 :", netdata)

    }
    
}

