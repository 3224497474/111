import {
    TaskConfig,
    TaskType,
    AchievementConfig,
    AchievementCategory,
} from '../easyFramework/mgr/TaskTypes';

/**
 * 任务配置示例（模拟养成向）：
 * - 真正项目中可以改为从 tables.ts / DataManager 读取表格，再映射为 TaskConfig[]。
 * - 文案字段使用多语言 key（例如 localText 中的 key）。
 */
export const TASK_CONFIGS: TaskConfig[] = [
    // 主线 1：角色达到 5 级
    {
        id: 1101,
        type: TaskType.Main,
        titleKey: 'task_main_1101_title',
        descKey: 'task_main_1101_desc',
        rewardTextKey: 'task_main_1101_reward',
        groupKey: 'main',
        sortOrder: 1,
        unlockExpr: '',
        completeExpr: 'char_level>=5',
        progressMetricKey: 'char_level',
        progressTarget: 5,
        isHiddenBeforeUnlock: false,
    },
    // 主线 2：解锁训练系统
    {
        id: 1102,
        type: TaskType.Main,
        titleKey: 'task_main_1102_title',
        descKey: 'task_main_1102_desc',
        rewardTextKey: 'task_main_1102_reward',
        groupKey: 'main',
        sortOrder: 2,
        preTaskId: 1101,
        unlockExpr: '',
        completeExpr: 'unlock_training>=1',
        progressMetricKey: 'unlock_training',
        progressTarget: 1,
        isHiddenBeforeUnlock: true,
    },
    // 主线 3：亲密度达到 50
    {
        id: 1103,
        type: TaskType.Main,
        titleKey: 'task_main_1103_title',
        descKey: 'task_main_1103_desc',
        rewardTextKey: 'task_main_1103_reward',
        groupKey: 'main',
        sortOrder: 3,
        preTaskId: 1102,
        unlockExpr: '',
        completeExpr: 'intimacy>=50',
        progressMetricKey: 'intimacy',
        progressTarget: 50,
        isHiddenBeforeUnlock: true,
    },

    // 每日 1：进行 3 次训练
    {
        id: 2101,
        type: TaskType.Daily,
        titleKey: 'task_daily_train_title',
        descKey: 'task_daily_train_desc',
        rewardTextKey: 'task_daily_train_reward',
        groupKey: 'daily',
        sortOrder: 1,
        unlockExpr: '',
        completeExpr: 'train_count_daily>=3',
        progressMetricKey: 'train_count_daily',
        progressTarget: 3,
        isHiddenBeforeUnlock: false,
    },
    // 每日 2：与角色对话 2 次
    {
        id: 2102,
        type: TaskType.Daily,
        titleKey: 'task_daily_talk_title',
        descKey: 'task_daily_talk_desc',
        rewardTextKey: 'task_daily_talk_reward',
        groupKey: 'daily',
        sortOrder: 2,
        unlockExpr: '',
        completeExpr: 'talk_count_daily>=2',
        progressMetricKey: 'talk_count_daily',
        progressTarget: 2,
        isHiddenBeforeUnlock: false,
    },
    // 一次性成长：解锁 3 件服装
    {
        id: 3101,
        type: TaskType.OneShot,
        titleKey: 'task_growth_costume_title',
        descKey: 'task_growth_costume_desc',
        rewardTextKey: 'task_growth_costume_reward',
        groupKey: 'growth',
        sortOrder: 1,
        unlockExpr: '',
        completeExpr: 'costume_unlock_count>=3',
        progressMetricKey: 'costume_unlock_count',
        progressTarget: 3,
        isHiddenBeforeUnlock: false,
    },
];

/**
 * 成就配置示例（模拟养成向）：
 * - 完成条件语法与任务一致。
 * - 成就不需要“接受”，只要条件达成就可领奖。
 */
export const ACHIEVEMENT_CONFIGS: AchievementConfig[] = [
    // 初次亲密：亲密度达到 30
    {
        id: 3001,
        titleKey: 'achv_intimacy_30_title',
        descKey: 'achv_intimacy_30_desc',
        rewardTextKey: 'achv_intimacy_30_reward',
        category: AchievementCategory.Growth,
        sortOrder: 1,
        completeExpr: 'intimacy>=30',
        score: 10,
        isHiddenBeforeUnlock: false,
    },
    // 深厚羁绊：亲密度达到 100
    {
        id: 3002,
        titleKey: 'achv_intimacy_100_title',
        descKey: 'achv_intimacy_100_desc',
        rewardTextKey: 'achv_intimacy_100_reward',
        category: AchievementCategory.Growth,
        sortOrder: 2,
        completeExpr: 'intimacy>=100',
        score: 30,
        isHiddenBeforeUnlock: false,
    },
    // 训练达人：累计训练 50 次
    {
        id: 3101,
        titleKey: 'achv_train_50_title',
        descKey: 'achv_train_50_desc',
        rewardTextKey: 'achv_train_50_reward',
        category: AchievementCategory.General,
        sortOrder: 3,
        completeExpr: 'train_count_total>=50',
        score: 20,
        isHiddenBeforeUnlock: false,
    },
    // 衣柜收藏家：解锁 10 件服装
    {
        id: 3201,
        titleKey: 'achv_costume_10_title',
        descKey: 'achv_costume_10_desc',
        rewardTextKey: 'achv_costume_10_reward',
        category: AchievementCategory.General,
        sortOrder: 4,
        completeExpr: 'costume_unlock_count>=10',
        score: 25,
        isHiddenBeforeUnlock: false,
    },
];

