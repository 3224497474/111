import { assert, AudioClip, AudioSource, clamp01, Component, director } from "cc";
import { Const } from "../../config/Const";
import { GTypeStrNum } from "../../config/global";
import { UtilPub } from "../utils/UtilPub";
import { GameStorage } from "./gameStorage";
import { resourceUtil } from "./resourceUtil";

export class audioManager extends Component {
    private static _instance: audioManager;
    private static _audioSource?: AudioSource;
    private static _audioSourceOne?: AudioSource = new AudioSource();


    effectCache: GTypeStrNum = {} // key 是名称，vale是时间
    effectConcurrency: number[] = [] //并发数， 标记为世界结束的点，按照当前时间进行清理

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new audioManager();
        return this._instance;
    }
    curMusic: string = ""
    soundVolume: number = 1;
    clips: { [key: string]: AudioClip } = {}

    // init AudioManager in GameRoot.
    init(audioSource: AudioSource) {
        this.soundVolume = this.getConfiguration(false) ? 1 : 0;

        audioManager._audioSource = audioSource;
        // audioManager._audioSourceOne = new AudioSource()
        //如果刚刚进入，那么配置为ok
        // let isMusicOpen = gameStorage.getString(Const.CacheDataKey.music)
        // if(isMusicOpen==undefined){
        //     gameStorage.getString(Const.CacheDataKey.music,'true')
        // }
        // let isSoundOpen = gameStorage.getString(Const.CacheDataKey.sound)
        // if(isSoundOpen==undefined){
        //     gameStorage.getString(Const.CacheDataKey.sound,'true')
        // }
        // //Public.log("---------检查默认配置---", isSoundOpen)

        //开始循环检测
    }

    initMusic() {
        let stat = GameStorage.getString('music', 'true');
        //Public.log("----------initMusic----", stat)
        if (stat == 'true') {
            audioManager.instance.openMusic()
        } else {
            audioManager.instance.closeMusic()
        }

        let stat2 = GameStorage.getString('sound', 'true');
        if (stat2 == 'true') {
            audioManager.instance.openSound()
        } else {
            audioManager.instance.closeSound()
        }
    }

    check() {
        let now = new Date().getTime()
        let newArr = []
        for (let i = 0; i < this.effectConcurrency.length; i++) {
            // Public.log("--------this.effectConcurrency[i]", this.effectConcurrency[i]-now)
            if (this.effectConcurrency[i] - now > 0) {
                // Public.log("--------this.effectConcurrency[i]", this.effectConcurrency[i])
                newArr.push(this.effectConcurrency[i])
            }
        }

        // for(let i=0; i<newArr.length; i++){
        //     delete this.effectConcurrency[delArr[i]]
        // }
        this.effectConcurrency = newArr
        // Public.log("------并发数--",this.effectConcurrency)
    }


    getConfiguration(isMusic: boolean) {
        let state;
        if (isMusic) {
            state = GameStorage.getString(Const.CacheDataKey.music);
        } else {
            state = GameStorage.getString(Const.CacheDataKey.sound);
        }

        //Public.log('Config for [' + (isMusic ? 'Music' : 'Sound') + '] is ' + state);

        return state === undefined || state === 'true';
    }

    playMusicInit(loop: boolean) {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        audioSource.loop = loop;
        // .maxAudioChannel;
        // audioSource.chanell(20)
        UtilPub.log("---AudioSource.maxAudioChannel----", AudioSource.maxAudioChannel)
        if (!audioSource.playing) {
            audioSource.play();
        }
    }

    /**
     * 播放音乐
     * @param {String} name 音乐名称可通过Const.AUDIO_MUSIC 获取
     * @param {Boolean} loop 是否循环播放
     */
    playMusic(loop: boolean, audioName: string = "bgm") {

        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        let name = audioName.split("|")[1]

        if (this.curMusic != name) {
            this.curMusic = name
        } else {
            if (audioSource.state == 1) {
                UtilPub.warn("--------跳过重复播放---", this.curMusic, name)
                return
            }
        }

        let playFn = (clip: AudioClip) => {
            this.clips[name] = clip
            audioSource.stop()
            audioSource.clip = clip
            audioSource.loop = loop;
            audioSource.volume = 0.3;
            if (!audioSource.playing) {
                audioSource.play();
                if (this.isOpenMusic() == false) {
                    audioSource.stop()
                }
                audioSource.volume = 0.6 //this.soundVolume
            }
        }


        if (this.clips[name]) {
            playFn(this.clips[name])
        } else {
            //  Public.log("playMusic 读取声音----------")
            resourceUtil.loadResWithBundle(audioName, AudioClip, (err, clip) => {
                // //Public.log("audio err----------", err)
                // //Public.log("audio data----------", clip)
                if (err) {
                    //Public.log('load sound error: ', err);
                    return;
                }
                if (clip) {
                    playFn(clip)
                }
            })
        }

    }

    /**
     * 播放音效
     * @param {String} name 音效名称可通过Const.AUDIO_SOUND 获取
     */
    playSound(audioName: string) {
        if (director.getScene()!.name == "hotupdate") {
            return;
        }
        if (this.isOpenSound() == false) return
        // const audioSource = audioManager._audioSourceOne!;
        // assert(audioSource, 'AudioManager not inited!');

        // @ts-ignore
        if (window.wx) {
            //@ts-ignore
            const sys = window.wx.getSystemInfoSync();
            const isIOS = sys.system.indexOf('iOS') >= 0;
            if (isIOS) {

            } else {
                UtilPub.warn("------安卓用户-声音特殊处理")
                if (audioManager._audioSourceOne) {
                    audioManager._audioSourceOne.stop()
                }
                audioManager._audioSourceOne = new AudioSource()
            }
        } else {

        }


        let name = audioName.split("|")[1]
        if (this.clips[name]) {
            this.playSoundCtl(name, this.clips[name])
        } else {
            // Public.log("playSound 读取声音----------")
            resourceUtil.loadResWithBundle(audioName, AudioClip, (err, clip) => {
                // //Public.log("audio err----------", err)
                // //Public.log("audio data----------", clip)
                if (err) {
                    //Public.log('load sound error: ', err);
                    return;
                }
                if (clip) {
                    this.clips[name] = clip
                    this.playSoundCtl(name, this.clips[name])
                }
            })

        }

    }

    playOneShotFake(clip: AudioClip) {
        if (this.isOpenSound() && audioManager._audioSourceOne) {
            if (Const.AudioTime[clip.name] != null) {
                this.check()
                if (this.effectConcurrency.length > Const.AudioCnt) { return }
                let num = new Date().getTime() + Const.AudioTime[clip.name]
                // Public.log("-------------时间---",num,this.effectConcurrency.join(",") )
                this.effectConcurrency.push(num)
                audioManager._audioSourceOne.playOneShot(clip, 1);
            } else {
                audioManager._audioSourceOne.playOneShot(clip, 1);
            }
        }
        // if(audioSource.volume==0){
        //     audioSource.volume=1
        //     let scale = audioSource.volume ? this.soundVolume / audioSource.volume : 0
        //     // //Public.log("#######volume scale----------", scale, audioSource.volume, this.soundVolume)
        //     audioSource.playOneShot(clip, scale);
        //     audioSource.volume=0
        // }else{
        //     let scale = audioSource.volume ? this.soundVolume / audioSource.volume : 0
        //     // Public.log("#######volume scale----------", scale, audioSource.volume, this.soundVolume)
        //     audioSource.playOneShot(clip, scale);
        // }
    }

    playSoundCtl(name: string, clip: AudioClip) {
        //防止并发请求音效导致声音过大
        if (this.effectCache[name] == undefined) {
            this.effectCache[name] = new Date().getTime()
            this.playOneShotFake(clip)
        } else {
            let diff = new Date().getTime() - this.effectCache[name]
            if (diff > 88) {
                this.effectCache[name] = new Date().getTime()
                this.playOneShotFake(clip)
            }
        }
    }

    setMusicVolume(flag: number) {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;

        flag = clamp01(flag);
        audioSource.volume = flag;
    }

    setSoundVolume(flag: number) {
        this.soundVolume = flag;
    }

    openMusic() {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        audioSource.play()
        GameStorage.setString(Const.CacheDataKey.music, 'true');
    }

    closeMusic() {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        audioSource.stop()
        GameStorage.setString(Const.CacheDataKey.music, 'false');
    }

    clickMusic() {
        if (this.isOpenMusic()) {
            this.closeMusic()
        } else {
            this.openMusic()
        }
    }

    isOpenMusic() {
        return GameStorage.getString(Const.CacheDataKey.music, 'true') == "true";
    }

    openSound() {
        GameStorage.setString(Const.CacheDataKey.sound, 'true');
    }

    isOpenSound() {
        return GameStorage.getString(Const.CacheDataKey.sound, 'true') == "true";
    }

    closeSound() {
        GameStorage.setString(Const.CacheDataKey.sound, 'false');
    }


    clickSound() {
        if (this.isOpenSound()) {
            this.closeSound()
        } else {
            this.openSound()
        }
    }
    pauseMusic() {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        audioSource.stop()
        // this.setMusicVolume(0);
    }

    resumeMusic() {
        const audioSource = audioManager._audioSource;
        if (!audioSource) return;
        audioSource.play()
        // audioSource.stop()
        // this.setMusicVolume(1)
    }

}
