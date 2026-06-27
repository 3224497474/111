import { _decorator, Component, Node, sys, director } from 'cc';
import { Const } from '../../config/Const';
import { GameStorage } from '../mgr/gameStorage';
import { GNetUrl } from './conf';
const { ccclass, property } = _decorator;

/**
 * TODO 修改为从服务端获取时间点，设置当前时间，然后用update方法进行累加。
 */
@ccclass('TimeCtrJSF')
export default class TimeCtrJSF extends Component {

    private static instance: TimeCtrJSF = null!;

    public static GetInstance() {
        if (!this.instance) {
            this.instance = new TimeCtrJSF();
            this.instance.InitTimeCtr();
        }
        return this.instance;
    }

    urls: string[] = [

     
    ];

    public serverTime: number = 0; //毫秒的时间
    public diffServerTime: number = 0;

    //是否是服务端时间
    public isRunServerTime: boolean = false;
    public loginTime: string = '';

    InitTimeCtr() {

    }

    UpdateServerTime(time: number) {
        director.getScheduler().unschedule(this.updateTimer, this)
        // time = new Date().getTime();// 修改服务器时间为本地进行测试 !!
        this.serverTime = time;
        // console.log("date:",new Date(time))
        director.getScheduler().schedule(this.updateTimer, this, 1);
        // let now = new Date(time);
        // console.log("now:",now,now.getFullYear(),now.getMonth()+1,now.getDate(),"星期:"+now.getDay())
    }

    UpdateServerTimeByHeartbeat(time: number) {
        // console.warn("---时间同步----", time)
        this.serverTime = time;
    }

    ReInit() {
        director.getScheduler().unschedule(this.updateTimer, this)
    }

    public updateTimer() {
        // this.serverTime += 1000;
        this.isRunServerTime = true;
        // 检查是否隔天了..
        // if (App.center.GetNowDateString() != this.loginTime && this.loginTime != '') {
        //     App.Instance.InitCtr();
        //     this.loginTime = App.center.GetNowDateString();
        // }
    }

    get ServerTime() {
        return Date.now();
        if (this.serverTime != 0) {
            let delay = GameStorage.getInt("modifyTime", 0)
            if (delay > 0) {
                return this.serverTime + delay * 60 * 1000;
            }
            return this.serverTime ;
        }
        return Date.now();
    }

    get ServerDate() {
        if (this.serverTime != 0) {
            return new Date(this.serverTime);
        }
    }

    public static isSameDay(t1: number, t2: number) {
        let time1 = new Date(t1)
        let time2 = new Date(t2)
        if (time1.getFullYear() == time2.getFullYear() && time1.getMonth() == time2.getMonth() && time1.getDate() == time2.getDate()) {
            return true
        }
        return false
    }


    /**
     * 同一上午或者下午
     * @param t1 
     * @param t2 
     * @returns 
     */
    public static isSameHalfDay(t1: number, t2: number) {
        let time1 = new Date(t1)
        let time2 = new Date(t2)
        if (time1.getFullYear() == time2.getFullYear() && time1.getMonth() == time2.getMonth() && time1.getDate() == time2.getDate()) {
            if (this.isMorningTime(t1) && this.isMorningTime(t2)) {
                return true
            }
            if (this.isAfternoonTime(t1) && this.isAfternoonTime(t2)) {
                return true
            }
            return false
        }
        return false
    }

    public static isSameInterval(t1: number, t2: number, interval: number) {
        let time1 = new Date(t1)
        let time2 = new Date(t2)
        if (interval <= 24 * 60) {
            if (time1.getFullYear() == time2.getFullYear() && time1.getMonth() == time2.getMonth() && time1.getDate() == time2.getDate()) {
                let curmin1 = time1.getHours() * 60 + time1.getMinutes()
                let curmin2 = time2.getHours() * 60 + time2.getMinutes()
                if (Math.floor(curmin1 / interval) == Math.floor(curmin2 / interval)) {
                    return true
                }
                return false
            }
        } else if (interval <= 24 * 60 * 7) {
            return TimeCtrJSF.isSameWeek(t1, t2)
        } else {
            if (time1.getFullYear() == time2.getFullYear() && time1.getMonth() == time2.getMonth()) {
                return true
            }
            return false
        }

        return false
    }

    //public static 

    public static isMorningTime(t1: number) {
        let time1 = new Date(t1)
        let hours = time1.getHours()
        return hours < 12
    }

    public static isAfternoonTime(t1: number) {
        let time1 = new Date(t1)
        let hours = time1.getHours()
        return hours >= 12
    }

    public static isSameWeek(t1: number, t2: number) {
        let day1 = new Date(t1).getDay()
        let day2 = new Date(t2).getDay()

        let week1 = t1 + (7 - day1) * 24 * 60 * 60000;
        let week2 = t2 + (7 - day2) * 24 * 60 * 60000;

        let time1 = new Date(week1)
        let time2 = new Date(week2)

        if (time1.getFullYear() == time2.getFullYear() && time1.getMonth() == time2.getMonth() && time1.getDate() == time2.getDate()) {
            return true
        }
        return false
    }

}
