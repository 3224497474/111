

//游戏战斗数据定义
class GD {

    public event = {
        showTip: "showTip",
        /**开始游戏 */
        gameStart: "gameStart",
        /**结束游戏 */
        gameStop: "gameStop",
        /**继续游戏 */
        gameResume: "gameResume",
        /**结束游戏 */
        gameOver: "gameOver",
        /**重新开始挂机 */
        restartMainGame: "restartMainGame",

        /**刷新货币 */
        updateMoney: "updateMoney",
        updateMoneyAction: "updateMoneyAction",

        SceneNodeScale: "SceneNodeScale",
        cancelOps: "cancelOps", //取消操作
        cancelOpsHandler: "cancelOpsHandler", //取消操作
        sureOps: "sureOps", //确定操作
        showOpsUI: "showOpsUI", //展示操作界面
        clickDressItem: "clickDressItem", //点击装扮
        buyDressSuccess: "buyDressSuccess", //购买成功
        intoTheWaitQueue: "intoTheWaitQueue", //排队到队伍中
        guestLeave: "guestLeave", //客人离开
        goToBuildScene: "goToBuildScene", //去建造场景
        chgGreenStar: "chgGreenStar", //改变绿色星星时的事件
        popOpsWindow: "popOpsWindow", //弹出操作界面
        loadAll: "loadAll",

        // 房间生成新物品了
        composeRoomNew: "composeRoomNew",
        // 房间气泡破了
        composeRoomBubbleBomb: "composeRoomBubbleBomb",
        // 从背包中取出物品
        composeGetOutFromBag: "composeGetOutFromBag",
        // 店长值班日-解锁新任务
        managerCreateTask: "managerCreateTask",
        // 店长值班日-入口刷新
        composeManagerRefresh: "composeManagerRefresh",
        // 刷新卡片列表
        composeCardLayerRefresh: "composeCardLayerRefresh",
        // 获得新元素
        composeGetNewItem: "composeGetNewItem",
        // 刷新新手引导
        refreshHandLayer: "refreshHandLayer",
        // 刷新订单任务
        refreshTask: "refreshTask",
        // 加速装置时间到了
        composeTimeSpeedUpEnd: "composeTimeSpeedUpEnd",

        // 显示toast
        showToast: "showToast",

        // 解锁新系统了
        unlockSystem: "unlockSystem",
        // 跨天了
        overDay: "overDay",
        // 跨月了
        overMonth: "overMonth",

        updateShopItem: "updateShopItem",


        updateDressUp: "updateDressUp",

        updateTreasure: "updateTreasure",

        canvasTouchEvent: "canvasTouchEvent",

        onClickTaskDone: "onClickTaskDone",

    }
}

export default new GD;
