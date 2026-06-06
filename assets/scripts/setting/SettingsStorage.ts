import type { ISettingsData } from "./SettingsTypes";

// 本地存储使用的 key，后续如需兼容可增加版本号
const SETTINGS_STORAGE_KEY = "NewProjectX1_Settings";

// 从 localStorage 读取设置数据
export function loadSettings(): ISettingsData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyGlobal: any = globalThis as any;
    if (!anyGlobal || !anyGlobal.localStorage) return null;
    const json = anyGlobal.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!json) return null;
    const data = JSON.parse(json) as ISettingsData;
    return data;
  } catch (_e) {
    // 解析失败时返回 null，由上层决定使用默认设置
    return null;
  }
}

// 写入设置数据到 localStorage
export function saveSettings(data: ISettingsData): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyGlobal: any = globalThis as any;
    if (!anyGlobal || !anyGlobal.localStorage) return;
    const json = JSON.stringify(data);
    anyGlobal.localStorage.setItem(SETTINGS_STORAGE_KEY, json);
  } catch (_e) {
    // 在不支持 localStorage 的环境下静默失败即可
  }
}

