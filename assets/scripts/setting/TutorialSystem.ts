import { SettingsManager } from "./SettingsManager";

// 新手引导 ID 枚举
export type TutorialId =
  | "first_week_flow" // 第一次体验周流程
  | "first_schedule" // 第一次打开日程系统
  | "first_shop" // 第一次进入商店
  | "first_inventory" // 第一次查看背包
  | "first_battle"; // 第一次进入战斗

// 存储已展示过的引导 ID 列表
interface ITutorialStorageData {
  shownIds: TutorialId[];
}

const TUTORIAL_STORAGE_KEY = "NewProjectX1_Tutorials";

/**
 * 新手引导系统：
 * - 记录哪些教程已经展示过
 * - 结合系统设置中的 tutorialEnabled 决定是否需要展示
 */
export class TutorialSystem {
  private static _instance: TutorialSystem | null = null;

  public static get instance(): TutorialSystem {
    if (!this._instance) {
      this._instance = new TutorialSystem();
    }
    return this._instance;
  }

  private shown: Set<TutorialId> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  /** 判断某个教程是否应该展示 */
  public shouldShowTutorial(id: TutorialId): boolean {
    const settings = SettingsManager.instance;
    if (!settings.getSetting("tutorialEnabled")) {
      return false;
    }
    return !this.shown.has(id);
  }

  /** 标记某个教程已经展示过，并写入本地存储 */
  public markTutorialShown(id: TutorialId): void {
    if (this.shown.has(id)) return;
    this.shown.add(id);
    this.saveToStorage();
  }

  /** 重置所有教程状态（例如在调试或设置中提供“重置引导”） */
  public resetAllTutorials(): void {
    this.shown.clear();
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGlobal: any = globalThis as any;
      if (!anyGlobal || !anyGlobal.localStorage) return;
      const json = anyGlobal.localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!json) return;
      const data = JSON.parse(json) as ITutorialStorageData;
      if (Array.isArray(data.shownIds)) {
        for (const id of data.shownIds) {
          this.shown.add(id);
        }
      }
    } catch (_e) {
      // 解析失败时忽略，视为没有任何教程展示记录
    }
  }

  private saveToStorage(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGlobal: any = globalThis as any;
      if (!anyGlobal || !anyGlobal.localStorage) return;
      const data: ITutorialStorageData = {
        shownIds: Array.from(this.shown),
      };
      anyGlobal.localStorage.setItem(
        TUTORIAL_STORAGE_KEY,
        JSON.stringify(data),
      );
    } catch (_e) {
      // 在不支持 localStorage 的环境下静默失败
    }
  }
}

