/**
 * 红点Key枚举
 * 
 * 使用枚举替代手动字符串，避免拼写错误，便于维护和重构
 * 命名规则：父节点/子节点 格式，使用帕斯卡命名
 */

export enum RedPointKey {
    // ==================== 根节点 ====================
    Root = 'Root',

    // ==================== 任务系统 ====================
    Task = 'Root/Task',
    TaskDaily = 'Root/Task/Daily',
    TaskWeekly = 'Root/Task/Weekly',
    TaskAchievement = 'Root/Task/Achievement',
    TaskMain = 'Root/Task/Main',

    // ==================== 邮件系统 ====================
    Mail = 'Root/Mail',
    MailSystem = 'Root/Mail/System',
    MailFriend = 'Root/Mail/Friend',
    MailGuild = 'Root/Mail/Guild',

    // ==================== 社交系统 ====================
    Friend = 'Root/Friend',
    FriendRequest = 'Root/Friend/Request',
    FriendChat = 'Root/Friend/Chat',

    // ==================== 公会系统 ====================
    Guild = 'Root/Guild',
    GuildApply = 'Root/Guild/Apply',
    GuildDonate = 'Root/Guild/Donate',
    GuildMail = 'Root/Guild/Mail',
    GuildTask = 'Root/Guild/Task',

    // ==================== 商店系统 ====================
    Shop = 'Root/Shop',
    ShopDaily = 'Root/Shop/Daily',
    ShopWeekly = 'Root/Shop/Weekly',
    ShopLimit = 'Root/Shop/Limit',

    // ==================== 活动系统 ====================
    Activity = 'Root/Activity',
    ActivityDaily = 'Root/Activity/Daily',
    ActivityLimited = 'Root/Activity/Limited',
    ActivitySignin = 'Root/Activity/Signin',

    // ==================== 背包系统 ====================
    Bag = 'Root/Bag',
    BagFull = 'Root/Bag/Full',

    // ==================== 养成系统 ====================
    Equip = 'Root/Equip',
    EquipUpgrade = 'Root/Equip/Upgrade',
    EquipRefine = 'Root/Equip/Refine',

    Hero = 'Root/Hero',
    HeroLevelup = 'Root/Hero/Levelup',
    HeroStar = 'Root/Hero/Star',
    HeroSkill = 'Root/Hero/Skill',

    // ==================== 排行榜 ====================
    Rank = 'Root/Rank',
    RankReward = 'Root/Rank/Reward',

    // ==================== 成就系统 ====================
    Achievement = 'Root/Achievement',
    AchievementReward = 'Root/Achievement/Reward',

    // ==================== 福利系统 ====================
    Welfare = 'Root/Welfare',
    WelfareDaily = 'Root/Welfare/Daily',
    WelfareOnline = 'Root/Welfare/Online',
    WelfareLevel = 'Root/Welfare/Level',
    WelfareVip = 'Root/Welfare/Vip',

    // ==================== 聊天系统 ====================
    Chat = 'Root/Chat',
    ChatWorld = 'Root/Chat/World',
    ChatGuild = 'Root/Chat/Guild',
    ChatPrivate = 'Root/Chat/Private',
    ChatSystem = 'Root/Chat/System',

    // ==================== 公告系统 ====================
    Notice = 'Root/Notice',

    // ==================== 副本系统 ====================
    Dungeon = 'Root/Dungeon',
    DungeonElite = 'Root/Dungeon/Elite',
    DungeonBoss = 'Root/Dungeon/Boss',

    // ==================== 竞技场 ====================
    Arena = 'Root/Arena',
    ArenaReward = 'Root/Arena/Reward',

    // ==================== 抽卡系统 ====================
    Gacha = 'Root/Gacha',
    GachaFree = 'Root/Gacha/Face',
    GachaLimit = 'Root/Gacha/Limit',
}

/**
 * 红点Key分组信息（用于编辑器显示和分类）
 */
export interface RedPointKeyGroup {
    name: string;
    keys: RedPointKey[];
}

/**
 * 红点Key分组列表（用于编辑器下拉选择）
 */
export const RED_POINT_KEY_GROUPS: RedPointKeyGroup[] = [
    { name: '根节点', keys: [RedPointKey.Root] },
    { name: '任务系统', keys: [RedPointKey.Task, RedPointKey.TaskDaily, RedPointKey.TaskWeekly, RedPointKey.TaskAchievement, RedPointKey.TaskMain] },
    { name: '邮件系统', keys: [RedPointKey.Mail, RedPointKey.MailSystem, RedPointKey.MailFriend, RedPointKey.MailGuild] },
    { name: '社交系统', keys: [RedPointKey.Friend, RedPointKey.FriendRequest, RedPointKey.FriendChat] },
    { name: '公会系统', keys: [RedPointKey.Guild, RedPointKey.GuildApply, RedPointKey.GuildDonate, RedPointKey.GuildMail, RedPointKey.GuildTask] },
    { name: '商店系统', keys: [RedPointKey.Shop, RedPointKey.ShopDaily, RedPointKey.ShopWeekly, RedPointKey.ShopLimit] },
    { name: '活动系统', keys: [RedPointKey.Activity, RedPointKey.ActivityDaily, RedPointKey.ActivityLimited, RedPointKey.ActivitySignin] },
    { name: '背包系统', keys: [RedPointKey.Bag, RedPointKey.BagFull] },
    { name: '养成系统', keys: [RedPointKey.Equip, RedPointKey.EquipUpgrade, RedPointKey.EquipRefine, RedPointKey.Hero, RedPointKey.HeroLevelup, RedPointKey.HeroStar, RedPointKey.HeroSkill] },
    { name: '排行榜', keys: [RedPointKey.Rank, RedPointKey.RankReward] },
    { name: '成就系统', keys: [RedPointKey.Achievement, RedPointKey.AchievementReward] },
    { name: '福利系统', keys: [RedPointKey.Welfare, RedPointKey.WelfareDaily, RedPointKey.WelfareOnline, RedPointKey.WelfareLevel, RedPointKey.WelfareVip] },
    { name: '聊天系统', keys: [RedPointKey.Chat, RedPointKey.ChatWorld, RedPointKey.ChatGuild, RedPointKey.ChatPrivate, RedPointKey.ChatSystem] },
    { name: '公告系统', keys: [RedPointKey.Notice] },
    { name: '副本系统', keys: [RedPointKey.Dungeon, RedPointKey.DungeonElite, RedPointKey.DungeonBoss] },
    { name: '竞技场', keys: [RedPointKey.Arena, RedPointKey.ArenaReward] },
    { name: '抽卡系统', keys: [RedPointKey.Gacha, RedPointKey.GachaFree, RedPointKey.GachaLimit] },
];

/**
 * 获取所有红点Key
 */
export function getAllRedPointKeys(): RedPointKey[] {
    return Object.values(RedPointKey);
}

/**
 * 获取红点Key的显示名称
 */
export function getRedPointKeyDisplayName(key: RedPointKey): string {
    const parts = key.split('/');
    return parts[parts.length - 1];
}
