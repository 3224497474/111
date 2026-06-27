import { LocaleManager } from '../mgr/LocaleManager';

const _texts: Record<string, typeof _zh> = {};

const _zh = {
    capcity: "当前容量：%d/%d",
    lv: "级",
    sellBackHint: "你卖出了一个%s(等级%d)，点击右侧按钮撤销操作。",
    lvMax: "已满级",
    unlocking: "同时只能解锁一个",
    godWealthHint: "财神将在%s后离开，请及时领奖",
    adAwardHint: "完整观看视频获得奖励",
    noRewardAd: "暂无广告可观看，请稍后再试",
    lackDiamond: "钻石不足",
    lockNoLook: "还未解锁，无法查看",
    notInBag: "该元素无法放入背包哦！",
    hotupdate: {
        checking: "检查是否有新版本...",
        updating: "下载更新中...",
        alreadyNew: "已经是最新版本",
        newVersionHint: "发现新版本%s, 大小为%dKB，确定下载吗？",
        sureUpdate: "确认更新",
        exitGame: "退出游戏",
        noLocalManifest: "未加载本地配置文件",
        remoteManifestError: "远程配置文件加载失败",
        updateEnd: "已全部更新完毕",
        updateFail: "更新失败：%s",
        autoRestart: "已全部更新完毕，自动重启中...",
    },
};

const _en: typeof _zh = {
    capcity: "Capacity: %d/%d",
    lv: "Lv",
    sellBackHint: "You sold a %s (Lv%d). Click the button on the right to undo.",
    lvMax: "Max Level",
    unlocking: "Only one unlock at a time",
    godWealthHint: "Fortune God leaves in %s, claim your reward in time",
    adAwardHint: "Watch the full video to get rewards",
    noRewardAd: "No ads available, please try again later",
    lackDiamond: "Not enough diamonds",
    lockNoLook: "Not unlocked yet",
    notInBag: "This item cannot be placed in the bag!",
    hotupdate: {
        checking: "Checking for updates...",
        updating: "Downloading update...",
        alreadyNew: "Already up to date",
        newVersionHint: "New version %s found, size %dKB. Download now?",
        sureUpdate: "Update",
        exitGame: "Exit Game",
        noLocalManifest: "Local manifest not loaded",
        remoteManifestError: "Failed to load remote manifest",
        updateEnd: "All updates complete",
        updateFail: "Update failed: %s",
        autoRestart: "All updates complete, restarting...",
    },
};

_texts['zh'] = _zh;
_texts['en'] = _en;

/** 获取当前语言的文本表，找不到时回退到 zh */
function getLocalText(): typeof _zh {
    return _texts[LocaleManager.locale] ?? _zh;
}

/** 注册额外语言包，供外部扩展 */
function registerLocaleText(locale: string, texts: typeof _zh) {
    _texts[locale] = texts;
}

export { getLocalText, registerLocaleText };

// 兼容旧代码的默认导出（始终反映当前语言）
export const localText = new Proxy({} as typeof _zh, {
    get(_target, prop) {
        return (getLocalText() as any)[prop];
    },
});
