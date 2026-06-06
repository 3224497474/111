// 系统设置相关的类型定义

// 语言代码：后续可以扩展更多语言
export type LanguageCode = "zh-CN" | "en-US";

// 所有设置项的 key 枚举，便于统一管理
export type SettingKey =
  | "volumeMaster" // 总音量
  | "volumeBgm" // BGM（背景音乐）音量
  | "volumeSe" // SE（效果音）音量
  | "textSpeed" // 文字显示速度
  | "autoPlayText" // 是否自动播放文本
  | "skipReadText" // 是否跳过已读文本
  | "language" // 当前语言
  | "tutorialEnabled"; // 是否开启新手引导

// 整体设置数据结构
export interface ISettingsData {
  /** 总音量，范围建议使用 0.0 ~ 1.0 */
  volumeMaster: number;
  /** 背景音乐音量 */
  volumeBgm: number;
  /** 音效音量 */
  volumeSe: number;
  /** 文字显示速度，数值越大越快（具体由 UI 自行解释） */
  textSpeed: number;
  /** 是否自动播放文本（如自动前进对话） */
  autoPlayText: boolean;
  /** 是否跳过已读文本 */
  skipReadText: boolean;
  /** 当前语言 */
  language: LanguageCode;
  /** 是否开启新手引导（全局开关） */
  tutorialEnabled: boolean;
}

