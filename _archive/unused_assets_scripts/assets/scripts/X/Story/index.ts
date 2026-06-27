/**
 * 剧情系统入口
 * 统一导出所有剧情系统相关模块
 */

// 类型定义
export {
    StoryNodeType,
    ChapterType,
    EndingType,
    AffectionLevel,
} from './StoryTypes';

export type {
    IStoryNode,
    IStoryChoice,
    IConditionalBranch,
    IStoryEffect,
    IStoryReward,
    IChapter,
    IEnding,
    IEndingCondition,
    IEndingPoints,
    ICharacterAffection,
    ICharacterRoute,
    ICharacterStage,
    IStorySaveData,
    StoryEventCallback,
    ChoiceCallback,
    EndingCallback,
    AffectionCallback,
} from './StoryTypes';

// 管理器
export { StoryManager } from './StoryManager';
export { StoryFlagManager } from './StoryFlagManager';
export { AffectionManager } from './AffectionManager';
export { EndingManager } from './EndingManager';
export { StoryConfig } from './StoryConfig';
export type { IStoryConfig } from './StoryConfig';

// 便捷访问
import { StoryManager } from './StoryManager';
import { StoryFlagManager } from './StoryFlagManager';
import { AffectionManager } from './AffectionManager';
import { EndingManager } from './EndingManager';

/**
 * 剧情系统快捷访问对象
 */
export const Story = {
    /** 剧情管理器 */
    manager: StoryManager.instance,
    /** 标记管理器 */
    flags: StoryFlagManager.instance,
    /** 好感度管理器 */
    affection: AffectionManager.instance,
    /** 结局管理器 */
    endings: EndingManager.instance,

    /**
     * 播放剧情节点
     */
    play(nodeId: string, onComplete?: () => void): boolean {
        return this.manager.playNode(nodeId, onComplete);
    },

    /**
     * 开始章节
     */
    startChapter(chapterId: string, onComplete?: () => void): boolean {
        return this.manager.startChapter(chapterId, onComplete);
    },

    /**
     * 检查结局
     */
    checkEndings() {
        return this.endings.checkAvailableEndings();
    },

    /**
     * 获取最佳结局
     */
    getBestEnding() {
        return this.endings.getBestAvailableEnding();
    },

    /**
     * 触发结局
     */
    triggerEnding(endingId: string): boolean {
        return this.endings.triggerEnding(endingId);
    },

    /**
     * 修改好感度
     */
    addAffection(characterId: string, delta: number): number {
        return this.affection.changeAffection(characterId, delta);
    },

    /**
     * 获取好感度
     */
    getAffection(characterId: string): number {
        return this.affection.getAffectionValue(characterId);
    },

    /**
     * 设置标记
     */
    setFlag(key: string, value: boolean | number | string): void {
        this.flags.setFlag(key, value);
    },

    /**
     * 获取标记
     */
    getFlag(key: string) {
        return this.flags.getFlag(key);
    },

    /**
     * 保存进度
     */
    save() {
        return this.manager.exportToSave();
    },

    /**
     * 加载进度
     */
    load(data: any) {
        this.manager.loadFromSave(data);
    },
};

// UI组件
export {
    StoryDialogView,
    AffectionPanelView,
    ChapterSelectView,
    EndingDisplayView,
} from './ui';
