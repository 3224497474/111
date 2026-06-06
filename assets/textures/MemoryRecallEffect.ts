import { _decorator, Component, Material, MeshRenderer, Vec4, game, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MemoryRecallEffect')
export class MemoryRecallEffect extends Component {
    @property(Material)
    material: Material | null = null;
    
    @property({ tooltip: "循环周期（秒）" })
    cycleDuration: number = 4.0;
    
    @property({ tooltip: "是否自动开始" })
    autoStart: boolean = true;
    
    @property({ tooltip: "扫描线角度" })
    scanLineAngle: number = 135; // 从右下到左上（45度角 + 90度）
    
    private _time: number = 0;
    private _isPlaying: boolean = false;
    private _startTime: number = 0;
    
    start() {
        if (!this.material) {
            const meshRenderer = this.getComponent(MeshRenderer);
            if (meshRenderer) {
                this.material = meshRenderer.material;
            }
        }
        
        if (this.autoStart) {
            this.play();
        }
    }
    
    update(deltaTime: number) {
        if (!this._isPlaying || !this.material) return;
        
        this._time += deltaTime;
        
        // 更新shader中的时间
        this.material.setProperty('time', this._time);
        this.material.setProperty('cycleDuration', this.cycleDuration);
        this.material.setProperty('scanLineAngle', this.scanLineAngle);
        
        // 可选：动态调整回忆进度，实现手动控制
        // const progress = (this._time % this.cycleDuration) / this.cycleDuration;
        // this.material.setProperty('recallProgress', progress);
    }
    
    /**
     * 开始播放回忆效果
     */
    play() {
        this._isPlaying = true;
        this._time = 0;
        this._startTime = game.totalTime / 1000;
        
        if (this.material) {
            this.material.setProperty('time', 0);
        }
    }
    
    /**
     * 停止效果
     */
    stop() {
        this._isPlaying = false;
        
        if (this.material) {
            // 重置为完全恢复状态
            this.material.setProperty('recallProgress', 1.0);
        }
    }
    
    /**
     * 重置效果
     */
    reset() {
        this._time = 0;
        if (this.material) {
            this.material.setProperty('time', 0);
            this.material.setProperty('recallProgress', 0);
        }
    }
    
    /**
     * 设置回忆进度（手动控制）
     * @param progress 0-1之间的值
     */
    setProgress(progress: number) {
        if (this.material) {
            this.material.setProperty('recallProgress', Math.min(1, Math.max(0, progress)));
        }
    }
    
    /**
     * 设置扫描线宽度
     */
    setScanLineWidth(width: number) {
        if (this.material) {
            this.material.setProperty('scanLineWidth', width);
        }
    }
    
    /**
     * 设置噪点强度
     */
    setNoiseIntensity(intensity: number) {
        if (this.material) {
            this.material.setProperty('noiseIntensity', intensity);
        }
    }
}