 import { _decorator, Component, Slider, Toggle, Label } from "cc";
import { SettingsManager } from "./SettingsManager";
  const { ccclass, property } = _decorator;

  @ccclass("SettingsUI")
  export class SettingsUI extends Component {
    @property(Slider)
    public masterVolumeSlider: Slider = null!;

    @property(Slider)
    public bgmVolumeSlider: Slider = null!;

    @property(Slider)
    public seVolumeSlider: Slider = null!;

    @property(Toggle)
    public autoPlayToggle: Toggle = null!;

    @property(Toggle)
    public skipReadToggle: Toggle = null!;

    @property(Label)
    public languageLabel: Label = null!;

    // 简单示例：两种语言循环切换
    private _languages: ("zh-CN" | "en-US")[] = ["zh-CN", "en-US"];
    private _langIndex = 0;

    onLoad() {
      // 从 SettingsManager 读取当前设置，初始化 UI 控件
      const settings = SettingsManager.instance.getAll();

      if (this.masterVolumeSlider) {
        this.masterVolumeSlider.progress = settings.volumeMaster;
      }
      if (this.bgmVolumeSlider) {
        this.bgmVolumeSlider.progress = settings.volumeBgm;
      }
      if (this.seVolumeSlider) {
        this.seVolumeSlider.progress = settings.volumeSe;
      }
      if (this.autoPlayToggle) {
        this.autoPlayToggle.isChecked = settings.autoPlayText;
      }
      if (this.skipReadToggle) {
        this.skipReadToggle.isChecked = settings.skipReadText;
      }
      if (this.languageLabel) {
        this.languageLabel.string = settings.language;
      }

      // 可选：监听设置变化，在其他地方修改设置时同步 UI
      SettingsManager.instance.onSettingsChanged((data) => {
        if (this.masterVolumeSlider) {
          this.masterVolumeSlider.progress = data.volumeMaster;
        }
        if (this.languageLabel) {
          this.languageLabel.string = data.language;
        }
      });
    }

    // 下面这些方法可以在编辑器中挂到 Slider / Toggle 的事件回调上

    public onChangeMasterVolume(slider: Slider) {
      SettingsManager.instance.setSetting("volumeMaster", slider.progress);
    }

    public onChangeBgmVolume(slider: Slider) {
      SettingsManager.instance.setSetting("volumeBgm", slider.progress);
    }

    public onChangeSeVolume(slider: Slider) {
      SettingsManager.instance.setSetting("volumeSe", slider.progress);
    }

    public onToggleAutoPlay(toggle: Toggle) {
      SettingsManager.instance.setSetting("autoPlayText", toggle.isChecked);
    }

    public onToggleSkipRead(toggle: Toggle) {
      SettingsManager.instance.setSetting("skipReadText", toggle.isChecked);
    }

    public onClickSwitchLanguage() {
      this._langIndex = (this._langIndex + 1) % this._languages.length;
      const lang = this._languages[this._langIndex];
      SettingsManager.instance.setSetting("language", lang);
      if (this.languageLabel) {
        this.languageLabel.string = lang;
      }
    }
  }