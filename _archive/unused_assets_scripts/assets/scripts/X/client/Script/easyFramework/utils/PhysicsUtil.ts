import { _decorator, Vec3,} from "cc";
const { ccclass, property } = _decorator;
 
@ccclass("PhysicsUtil")
export class PhysicsUtil {
    private m_start:Vec3 = null!
    private m_end:Vec3 = null!
    private m_height:number = 0
    private m_gravity:number = 0
    private m_upTime:number =0 
    private m_downTime:number =0
    private m_totalTime:number =0
    private m_velocityStart:Vec3 =null!
    private m_position:Vec3 =null!
    private m_time:number =0
 
    /// <summary> 起点 </summary>
    public get start():Vec3{return this.m_start} 
    /// <summary> 终点 </summary>
    public get end():Vec3 {return this.m_end}
    /// <summary> 目标高度 </summary>
    public get height():number {return this.m_height}
    /// <summary> 重力加速度 </summary>
    public get gravity():number { return this.m_gravity}
    /// <summary> 上升时间 </summary>
    public get upTime():number {return this.m_upTime}
    /// <summary> 下降时间 </summary>
    public get downTime():number {return this.m_downTime}
    /// <summary> 总运动时间 </summary>
    public get totalTime():number {return this.m_totalTime}
    /// <summary> 顶点 </summary>
    public get top():Vec3 {return this.GetPosition(this.m_upTime)}
    /// <summary> 初始速度 </summary>
    public get velocityStart():Vec3 {return this.m_velocityStart}
    /// <summary> 当前位置 </summary>
    public get position():Vec3 {return this.m_position}
    /// <summary> 当前速度 </summary>
    public get velocity():Vec3 {return this.GetVelocity(this.m_time)}
    /// <summary> 当前时间 </summary>
    public get time() {return this.m_time;}
    public set time(val) {
        this.m_time = val;
        this.m_position = this.GetPosition(this.m_time);
    }
 
    /// <summary> 初始化抛物线运动轨迹 </summary>
    /// <param name="start">起点</param>
    /// <param name="end">终点</param>
    /// <param name="height">高度(相对于两个点的最高位置 高出多少)</param>
    /// <param name="gravity">重力加速度(负数)</param>
    init(start:Vec3,end:Vec3,height:number=10,gravity:number=-9.8)
    {
        let topY:number = Math.max(start.y, end.y) + height;
        let d1:number  = topY - start.y;
        let d2:number  = topY - end.y;
        let g2:number  = 2 / -gravity;
        let t1:number  = Math.sqrt(g2 * d1);
        let t2:number  = Math.sqrt(g2 * d2);
        let t:number  = t1 + t2;
        let vX:number  = (end.x - start.x) / t;
        let vZ:number  = (end.z - start.z) / t;
        let vY:number  = -gravity * t1;
        this.m_start = start;
        this.m_end = end;
        this.m_height = height;
        this.m_gravity = gravity;
        this.m_upTime = t1;
        this.m_downTime = t2;
        this.m_totalTime = t;
        this.m_velocityStart = new Vec3(vX, vY, vZ);
        this.m_position = this.m_start;
        this.m_time = 0;
    }
 
    /// <summary> 获取某个时间点的位置 </summary>
    public GetPosition(time:number):Vec3
    {
        if (time == 0) {
            return this.m_start;
        }
        if (time == this.m_totalTime) {
            return this.m_end;
        }
        let dY:number = 0.5 * this.m_gravity * time * time;
        let vector3:Vec3= new Vec3(this.m_velocityStart.x*time,this.m_velocityStart.y*time,this.m_velocityStart.z*time)
        let dYVec3:Vec3=new Vec3(0+this.m_start.x+vector3.x, dY+this.m_start.y+vector3.y, (0+this.m_start.z+vector3.z))
        return dYVec3
    }
 
    /// <summary> 获取某个时间点的速度 </summary>
    public GetVelocity(time:number):Vec3
    {
        if (time == 0) return this.m_velocityStart;
        let dYVec3=new Vec3(0+this.m_velocityStart.x, this.m_velocityStart.y +this.m_velocityStart.y + (this.m_gravity * time), this.m_velocityStart.z)
        return dYVec3
    }
}
