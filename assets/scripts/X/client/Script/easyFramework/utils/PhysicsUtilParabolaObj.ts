import { _decorator, Component, Node,Vec3, Prefab, CCInteger, CCFloat, director } from "cc";
import {PhysicsUtil} from "./PhysicsUtil"
const { ccclass, property } = _decorator;
@ccclass("PhysicsUtilParabolaObj")
export class PhysicsUtilParabolaObj extends Component {

    lineList:Vec3[] = []; //抛物线位置信息

    _Physics:PhysicsUtil =null!  //抛物线运动轨迹

    // @property({ type: Node, tooltip: "飞行对象" })
    // play:Node = null!    // 飞行对象
    // @property({ type: Node, tooltip: "目标" })
    // target:Node = null!    // 目标
    @property({ type: CCFloat, tooltip: "高度" })
    height:number=16      // 高度
    @property({ type: CCFloat, tooltip: "重力加速度" })
    gravity:number = -9.8;   // 重力加速度
    @property({ type: Prefab, tooltip: "描点的预制体" })
    pointPrefab:Prefab = null!;   
    @property({ type: CCInteger, tooltip: "抛物线预测计数" })
    segmentCount:number=20  //抛物线预测计数
 
    private playPos:Vec3 = null!    // 飞行对象位置点
    private targetPos:Vec3 = null!    // 目标位置点

    private targetFinalPos:Vec3 = null! //终点坐标
    private targetFinalEulerAngles:Vec3 = null! //终点旋转角度
    private flyNode:Node = null! //飞行的对象
 
    isStart:boolean = false
    isLine:boolean=false
    isLookAtTarget:boolean=false 
    calTime:number=0

    cb:Function = null!
    _deltaTime:number=0

    init(targetFinalPos:Vec3, targetFinalEulerAngles:Vec3, cb:Function, height:number=5, gravity:number=-5.8, isLookAtTarget:boolean=true, pointPrefab:Prefab=null!, segmentCount:number=3){
        this.flyNode = this.node;
        this.targetFinalPos = targetFinalPos; 
        this.targetFinalEulerAngles = targetFinalEulerAngles;
        this.height=height
        this.gravity=gravity
        this.pointPrefab=pointPrefab
        this.segmentCount=segmentCount
        this.isLookAtTarget=isLookAtTarget
        this.SetStart(cb)
    }
 
    //控制物体开始移动
    SetStart(cb:Function)
    {
        this.cb = cb 
        this.CreateLinePos()
        this._Physics = new PhysicsUtil();
        this.DrawLine()

        this.isStart=true
        this.StartMove()
    }
 
    update (deltaTime: number) {
        this._deltaTime=deltaTime

        this.calTime+=deltaTime
        if(this.isStart){
            this.StartMove()
        }
       
    }
 
    //创建虚拟轨迹线
    CreateLinePos()
    {
        this.lineList=[]
        for(let i=0;i<this.segmentCount;i++){
            this.lineList[i]=Vec3.ZERO
        }
    }
 
    //根据目标点画轨迹线
    DrawLine()
    {
        this.playPos=this.flyNode.worldPosition.clone()
        this.targetPos=this.targetFinalPos.clone()
        this._Physics.init(this.playPos,this.targetPos,this.height, this.gravity)
        // this.play.lookAt(this._Physics.GetPosition(this._Physics.time + this._deltaTime));
 
        let timeStep = this._Physics.totalTime/this.segmentCount
        if(this.lineList!=null)
        {
            for(let i=0;i<this.segmentCount;i++)
            {
                let pos = this._Physics.GetPosition(timeStep*i)
                this.lineList[i] = pos
            }
        }
    }
 
    //物体沿着抛物线轨迹开始移动
    StartMove()
    {
     
        this._Physics.time=this._Physics.time+this._deltaTime
        this.flyNode.worldPosition =  this._Physics.position;
        this.playPos=this.flyNode.worldPosition.clone()
        // 计算转向
        if(this.isLookAtTarget){
            this.flyNode.lookAt(this._Physics.GetPosition(this._Physics.time + this._deltaTime));
        }
        // 简单模拟一下碰撞检测
        if (this._Physics.time >= this._Physics.totalTime) 
        {
           this.flyNode.worldPosition=this.targetFinalPos.clone()
           this.flyNode.eulerAngles=this.targetFinalEulerAngles.clone()
        //    //Public.log("==简单模拟一下碰撞检测==")
           this.cb && this.cb()
           this.isStart=false
           this.isLine=true
           
        }      
    }
}