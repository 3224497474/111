import type { ISettingsData, SettingKey } from "./SettingsTypes";
import { loadSettings, saveSettings } from "./SettingsStorage";

type SettingsListener = (settings: Readonly<ISettingsData>) => void;

/**
 * 系统设置管理器：
 * - 维护当前设置的内存副本
 * - 负责从本地存储读取 / 写入
 * - 提供订阅机制，便于 UI 或系统在设置变化时更新
 */
export class SettingsManager {
  private static _instance: SettingsManager | null = null;

  public static get instance(): SettingsManager {
    if (!this._instance) {
      this._instance = new SettingsManager();
    }
    return this._instance;
  }

  // 默认设置值，可以根据项目实际需求调整
  private readonly defaultSettings: ISettingsData = {
    volumeMaster: 1.0,
    volumeBgm: 0.8,
    volumeSe: 0.8,
    textSpeed: 1.0,
    autoPlayText: false,
    skipReadText: false,
    language: "zh-CN",
    tutorialEnabled: true,
  };

  private current: ISettingsData = { ...this.defaultSettings };
  private listeners: Set<SettingsListener> = new Set();

  private constructor() {
    this.initialize();
  }

  /**
   * 初始化设置：
   * 1. 以 defaultSettings 作为基础
   * 2. 叠加传入的 defaults（可选）
   * 3. 再叠加本地存储中的设置（如果有）
   */
  public initialize(defaults?: Partial<ISettingsData>): void {
    let merged: ISettingsData = { ...this.defaultSettings };

    if (defaults) {
      merged = { ...merged, ...defaults };
    }

    const stored = loadSettings();
    if (stored) {
      merged = { ...merged, ...stored };
    }

    this.current = merged;
    this.emit();
  }

  /** 获取所有设置的只读副本 */
  public getAll(): Readonly<ISettingsData> {
    return this.current;
  }

  /** 获取某个设置项的值 */
  public getSetting<K extends SettingKey>(key: K): ISettingsData[K] {
    return this.current[key];
  }

  /**
   * 设置某个设置项的值，并立即持久化与通知监听者
   */
  public setSetting<K extends SettingKey>(key: K, value: ISettingsData[K]): void {
    if (this.current[key] === value) {
      return;
    }
    this.current = { ...this.current, [key]: value };
    saveSettings(this.current);
    this.emit();
  }

  /** 注册设置变更监听器 */
  public onSettingsChanged(listener: SettingsListener): void {
    this.listeners.add(listener);
  }

  /** 取消注册设置变更监听器 */
  public offSettingsChanged(listener: SettingsListener): void {
    this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) {
      l(this.current);
    }
  }
}

