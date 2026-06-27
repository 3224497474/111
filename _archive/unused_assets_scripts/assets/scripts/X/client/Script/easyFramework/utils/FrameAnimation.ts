import { Component, error, EventHandler, Sprite, SpriteAtlas , _decorator} from "cc";


const {ccclass, property} = _decorator;

@ccclass
export class FrameAnimation extends Component {

    @property({
        type: SpriteAtlas,
        tooltip : "帧动画合图"
    })
    protected atlas : SpriteAtlas|null = null;
    
    @property({tooltip:"切割下标的符号"})
    private splitter : string = "=";

    @property({tooltip:"每多少秒播放一张图"})
    protected interval : number = 0.05;
    
    @property({tooltip:"是否循环播放"})
    private loop : boolean = false;

    @property({tooltip:"载入时播放"})
    private runAtStart : boolean = false;

    @property({tooltip:"是否要添加下标"})
    protected fixedZero : boolean = true;

    @property({
        type : EventHandler,
        tooltip:"一轮动画完成时回调，"
    })
    protected completeCallback: Array<EventHandler> = [];

    @property({
        type: EventHandler,
        tooltip:"所有动画完成时回调"
    })
    protected endCallback: Array<EventHandler> = [];


    /**是否在播放中 */
    private running : boolean = false;

    /**当前展示的图片索引*/
    private currentIndex : number = 0;
    
    private frameStep = 0;

    /**是否循环播放*/
    public get Loop() : boolean { return this.loop; }

    /**是否在播放中 */
    public get Running () : boolean { return this.running; }

    private frameCount : number = 0;

    //名字头
    private frameNamHead : string = "";

    protected onLoad () : void {
        this.InitAtlas();
    }

    private InitAtlas(){
        if(!this.atlas) {
            error("atlas not exist!")
            return;
        }
        let frames = this.atlas.getSpriteFrames();
        let firstFrame = frames[0];
        this.frameCount = frames.length;
        if(firstFrame) {
            let lastIndexOf = firstFrame.name.lastIndexOf(this.splitter) + 1;
            this.frameNamHead = firstFrame.name.substring(0, lastIndexOf);
        }
    }

    protected start () : void {
        if(this.runAtStart) {
            this.Play(this.Loop);
        }
    }

    protected update(dt: number): void {
        if(!this.running) {
            return;
        }
        this.frameStep += dt;
        if(this.frameStep >= this.interval) {
            this.frameStep-= this.interval;
            this.ChangeFrame();
        }
   
    }

    /**
     * 改变帧动画的图片
     */
    private ChangeFrame() : void{
        let isIndexEnd = this.currentIndex >= this.frameCount;

        if(!this.loop && isIndexEnd) {
            this.completeCallback.forEach(callback => { callback.emit([]); });
            this.endCallback.forEach(callback => { callback.emit([]); });
            this.running = false;
            return;
        }

        if(isIndexEnd) {
            this.completeCallback.forEach(callback => { callback.emit([]); });
            this.currentIndex = 0;
        }
        //这儿还加了1
        let tail : any = this.currentIndex + 1;
        if(tail < 10 && this.fixedZero) {
            tail = "0" + tail;
        }
        if(!this.atlas) {
            error("atlas not exist!")
            return;
        }
        let frameName = this.frameNamHead + tail;
        let sprite = this.node.getComponent(Sprite);
        let spriteFrame = this.atlas.getSpriteFrame(frameName);
        if(sprite) {
            sprite.spriteFrame = spriteFrame;
        }
        ++this.currentIndex;
    }

    /**
     * 更换图集
     * @param atlas cc.SpriteAtlas
     */
    public setAtlas(atlas: SpriteAtlas) : void {
        this.atlas = atlas;
        this.InitAtlas();
    }

    /**
     * 执行帧动画,执行时会从第一张图开始
     * @param loop 是否循环播放
     */
    public Play(loop : boolean = false) : void {
        
        this.loop = loop;
        this.running = true;

        this.currentIndex = 0;

        //调用一次，马上生效
        this.ChangeFrame();
    }

    /**
     * 恢复执行帧动画，会从当前帧继续执行
     */
    public Resume(loop : boolean = false) : void {
        this.loop = loop;
        this.running = true;
        //调用一次，马上生效
        this.ChangeFrame();
    }

    public Pause() : void {
        this.running = false;
    }

    /**
     * 停止
     */
    public Stop() : void {
        this.running = false;
        this.runAtStart = false;
    }
}
