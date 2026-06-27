/**
 * 剧情配置加载器
 * 从JSON文件加载剧情配置数据
 */

import { JsonAsset } from 'cc';
import { resourceUtil } from '../client/Script/easyFramework/mgr/resourceUtil';
import {
    IStoryNode,
    IChapter,
    IEnding,
    ICharacterRoute,
} from './StoryTypes';
import { StoryManager } from './StoryManager';
import { AffectionManager } from './AffectionManager';
import { EndingManager } from './EndingManager';

export interface IStoryConfig {
    chapters: IChapter[];
    nodes: IStoryNode[];
    endings: IEnding[];
    characterRoutes?: ICharacterRoute[];
}

export class StoryConfig {
    private static _loadedBundles: Set<string> = new Set();

    /**
     * 从Bundle加载剧情配置
     */
    public static loadFromBundle(
        bundlePath: string,
        callback?: (success: boolean, error?: Error) => void
    ): void {
        resourceUtil.loadResWithBundle(bundlePath, JsonAsset, (err, asset) => {
            if (err || !asset || !asset.json) {
                console.error('[StoryConfig] Load failed:', bundlePath, err);
                callback?.(false, err || new Error('Invalid JsonAsset'));
                return;
            }

            try {
                const config = asset.json as IStoryConfig;
                this.applyConfig(config);
                this._loadedBundles.add(bundlePath);
                callback?.(true);
            } catch (e) {
                console.error('[StoryConfig] Parse failed:', e);
                callback?.(false, e as Error);
            }
        });
    }

    /**
     * 从远程URL加载剧情配置
     */
    public static async loadFromRemote(
        url: string,
        callback?: (success: boolean, error?: Error) => void
    ): Promise<void> {
        if (!url) {
            callback?.(false, new Error('URL is empty'));
            return;
        }

        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }

            const config = await resp.json() as IStoryConfig;
            this.applyConfig(config);
            callback?.(true);
        } catch (e) {
            console.error('[StoryConfig] Remote load failed:', url, e);
            callback?.(false, e as Error);
        }
    }

    /**
     * 应用配置到各个管理器
     */
    private static applyConfig(config: IStoryConfig): void {
        const storyManager = StoryManager.instance;

        // 注册章节
        if (config.chapters && Array.isArray(config.chapters)) {
            storyManager.registerChapters(config.chapters);
            console.log(`[StoryConfig] Registered ${config.chapters.length} chapters`);
        }

        // 注册剧情节点
        if (config.nodes && Array.isArray(config.nodes)) {
            storyManager.registerNodes(config.nodes);
            console.log(`[StoryConfig] Registered ${config.nodes.length} nodes`);
        }

        // 注册结局
        if (config.endings && Array.isArray(config.endings)) {
            EndingManager.instance.registerEndings(config.endings);
            console.log(`[StoryConfig] Registered ${config.endings.length} endings`);
        }

        // 注册角色支线
        if (config.characterRoutes && Array.isArray(config.characterRoutes)) {
            AffectionManager.instance.registerCharacterRoutes(config.characterRoutes);
            console.log(`[StoryConfig] Registered ${config.characterRoutes.length} character routes`);
        }
    }

    /**
     * 清除所有配置
     */
    public static clearAll(): void {
        // TODO: 实现清除配置的逻辑
        this._loadedBundles.clear();
    }

    /**
     * 检查Bundle是否已加载
     */
    public static isBundleLoaded(bundlePath: string): boolean {
        return this._loadedBundles.has(bundlePath);
    }

    /**
     * 加载多个配置文件
     */
    public static loadMultiple(
        bundlePaths: string[],
        callback?: (success: boolean, loaded: number, total: number) => void
    ): void {
        let loaded = 0;
        let failed = 0;
        const total = bundlePaths.length;

        for (const path of bundlePaths) {
            this.loadFromBundle(path, (success) => {
                if (success) {
                    loaded++;
                } else {
                    failed++;
                }

                if (loaded + failed === total) {
                    callback?.(failed === 0, loaded, total);
                }
            });
        }
    }

    /**
     * 创建示例配置（用于测试）
     */
    public static createExampleConfig(): IStoryConfig {
        return {
            chapters: [
                {
                    id: 'chapter_1',
                    type: 'main' as any,
                    order: 1,
                    name: '序章：觉醒',
                    description: '主角在陌生的环境中醒来...',
                    startNodeId: 'ch1_node_1',
                    nodeIds: ['ch1_node_1', 'ch1_node_2', 'ch1_node_3'],
                },
            ],
            nodes: [
                {
                    id: 'ch1_node_1',
                    chapterId: 'chapter_1',
                    type: 'dialog' as any,
                    name: '苏醒',
                    dialogId: 'intro_1',
                    nextNodeId: 'ch1_node_2',
                    isSkippable: false,
                    isOnceOnly: true,
                },
                {
                    id: 'ch1_node_2',
                    chapterId: 'chapter_1',
                    type: 'choice' as any,
                    name: '初次选择',
                    dialogId: 'choice_intro',
                    choices: [
                        {
                            id: 'choice_explore',
                            text: '向前探索',
                            targetNodeId: 'ch1_node_3',
                            flags: { explore_path: true },
                            endingPoints: { hero: 2 },
                        },
                        {
                            id: 'choice_wait',
                            text: '原地等待',
                            targetNodeId: 'ch1_node_3',
                            affection: { companion: 10 },
                            endingPoints: { peace: 2 },
                        },
                    ],
                    isSkippable: false,
                    isOnceOnly: true,
                },
                {
                    id: 'ch1_node_3',
                    chapterId: 'chapter_1',
                    type: 'dialog' as any,
                    name: '继续',
                    dialogId: 'chapter_1_end',
                    isSkippable: false,
                    isOnceOnly: true,
                },
            ],
            endings: [
                {
                    id: 'ending_hero',
                    type: 'good' as any,
                    name: '英雄之路',
                    description: '你成为了一名真正的英雄',
                    conditions: [
                        { type: 'flag', target: 'chapter_1_complete', operator: '==', value: true },
                        { type: 'ending_points', target: 'hero', operator: '>=', value: 10 },
                    ],
                    endingNodeId: 'ending_hero_node',
                    priority: 10,
                },
                {
                    id: 'ending_character_a',
                    type: 'character' as any,
                    name: '永恒的誓言',
                    description: '与角色A的幸福结局',
                    characterId: 'character_a',
                    conditions: [
                        { type: 'affection', target: 'character_a', operator: '>=', value: 90 },
                    ],
                    endingNodeId: 'ending_character_a_node',
                    priority: 20,
                },
            ],
            characterRoutes: [
                {
                    characterId: 'character_a',
                    name: '月光下的约定',
                    stages: [
                        {
                            id: 'chara_a_stage_1',
                            order: 1,
                            name: '初次相遇',
                            requiredAffection: 0,
                            eventNodeIds: ['chara_a_1'],
                        },
                        {
                            id: 'chara_a_stage_2',
                            order: 2,
                            name: '深入了解',
                            requiredAffection: 30,
                            eventNodeIds: ['chara_a_2'],
                        },
                        {
                            id: 'chara_a_stage_3',
                            order: 3,
                            name: '羁绊',
                            requiredAffection: 60,
                            eventNodeIds: ['chara_a_3'],
                        },
                        {
                            id: 'chara_a_stage_4',
                            order: 4,
                            name: '告白',
                            requiredAffection: 80,
                            eventNodeIds: ['chara_a_4'],
                        },
                    ],
                    endings: [
                        {
                            id: 'chara_a_ending',
                            type: 'character' as any,
                            name: '永恒的誓言',
                            description: '与A的幸福结局',
                            characterId: 'character_a',
                            conditions: [
                                { type: 'affection', target: 'character_a', operator: '>=', value: 90 },
                            ],
                            endingNodeId: 'chara_a_ending_node',
                            priority: 5,
                        },
                    ],
                    affectionThresholds: {
                        stage1: 10,
                        stage2: 30,
                        stage3: 60,
                        stage4: 80,
                        ending: 90,
                    },
                },
            ],
        };
    }
}
