import { Color, Enum, Node, Vec2, Vec3 } from "cc";

export interface GSceneItemData {
    id: number, //scene_item 表的id
    pos: Vec2, //当前的坐标点
    curFace: GCurFace, //当前的朝向，如果朝向超过faceMax，那么就等于faceMax
    curGridPoint: Vec2, //当前坐标点
    lockState: GLockState, //如果锁定状态，必须是皮肤ID
    type: GSceneItemType, //场景的道具类型
    skin: number, //皮肤
}

//网格数据
export interface GIGridData {
    wps: Vec3, //世界坐标
    point: Vec2, //x, y坐标
}

// //动画状态
// export enum GGuestAniState{
//     idle="idle", //待机
//     move="move", //移动
//     work="work", //工作
//     pose="pose", //姿态
// }

//动画
export enum GSpineAni {
    idle1 = "idle1",
    idle2 = "idle2",
    pose1 = "pose1",
    pose2 = "pose1",
    walk1 = "walk1",
    walk2 = "walk2",
    work1 = "work1",
    work2 = "work2",
}

//提示类型
export enum GPromptType {
    reconnect = "reconnect", //重连
    blockAccount = "blockAccount", //封号
    loginOccupy = "loginOccupy", //抢登
    loginExpired = "loginExpired", //登录过期
    unkown = "unkown", //服务器未知错误
    resNotNewest = "resNotNewest", //资源不是最新的
}

//订单状态
export enum GOrderStatus {
    noHandle = 1, //未处理
    cancelPay = 2, //取消支付
    paidWithoutGoods = 3, //已支付未发货
    success = 4, //成功
}

//账号方式--于后端对应
export enum GAccountWay {
    guest = 0,
    facebook = 1,
    google = 2,
}

//账号方式--于后端对应
export enum GPlatform {
    H5 = 0,
    Google = 1,
    WeChat = 2,
}

//客人状态
export enum GGuestState {
    nothing = 0, //什么也不做 
    subway = 101, //从地铁口出来 
    subwaying = 102,
    streetWalk = 201,  //在街道上游走
    streetWalking = 202,
    waitInQueueToRoom = 301,  //在街道上门口等待进入等待队列
    waitInQueueToRooming = 302,
    //房间内的状态切换是随机的
    roomDoorStay = 400, //在房间待着
    roomWalk = 401,  //在房间里面游走
    roomWalking = 402,
    goToWork = 501, //在对应的节点上进行游走
    goToWorking = 502,
    work = 601, //在对应的节点上工作
    working = 602,
    back = 701, //在房间返回到出口，无法出去时，继续游走
    backing = 702, //返回中
}

export enum GResType {
    gold = 101,
    diamond = 102,
    strength = 103,
    exp = 104,
    tick = 305, //装扮券
}

//每个场景道具是否在播放状态
export enum GWorkState {
    isWorking = 1, //在工作中
    idle = 0, //待机
}

export enum GLockState {
    locked = 0, //未解锁
    unlock = 1, //已解锁
}
export enum GGridType {
    green = "green", //绿色
    red = "red", //红色
    shadow = "shadow", //阴影
}

export enum GSceneItemType {
    item = 1, //item就是跑步机那些
    carpet = 2, //carpet就是地垫
    pendant = 3, //pendant就是挂件，类似钟、镜子
    wall = 4,  //wall就是墙体，不需要位置固定的
    floor = 5,  //floor就是地板，不需要位置固定的
    street = 6,  //floor就是街道上面的建筑
    room = 7,  //room未解锁的房间，不能操作，但是参与碰撞计算。这样玩家不能在房间里面乱搞
    guest = 8,  //room未解锁的房间，不能操作，但是参与碰撞计算。这样玩家不能在房间里面乱搞
    other = 9, //其他
}

/**
 * 选中的道具的属性
 */
export interface GISceneItemParent {
    node: Node, //脚本所在节点
    id: number, //唯一标识
    skin: number, //皮肤
    faceMax: GFace, //有几个面，0是不能旋转，2是可以转，只能2下，4是可以转4下。
    curFace: GCurFace, //当前面向
    itemSize: Vec2, //x几格，y几格
    curGridPoint: Vec2, //当前格子的位置, 房间为原点的偏移的情况
    type: GSceneItemType, //道具的类型
    lockState: GLockState, //道具锁定类型
    row: any, //配表信息
    workState: GWorkState, //工作状态
    guestNode: Node, //客人节点
    initByConfigTable(row: any): void, //初始化场景方法
    getPointsArr(): Array<Array<number>>,//获得点位信息
    getCurIconNode(): Node, //返回当前图标节点
    rotateItem(): void, //旋转场景道具
    setPendantFace(): void, //设置挂件的朝向
    setFace(curFace: GCurFace): void //设置朝向
    switchIcon(skinId: number): void //切换图片
    flashOnce(): void, //闪白1次
    flashForever(isShow: boolean): void, //一直闪
}

/**
 * 商店中商品的状态
 */
export enum GStoreItemType {
    new = 1, //新品，还未获得
    gotted = 2, //已获得未用
    using = 3, //正在使用
}
export enum GSceneSkinState {
    noGotted = "0", //未获得
    gotted = "1", //已获得
}

export enum GSceneRoomState {
    locked = "0", //未解锁
    unlock = "1", //解锁
}

export enum GSceneRoomReceiveState {
    unReceive = "0", //未解锁
    received = "1", //解锁
}


export enum GBuildType {
    room = "room", //房间
    item = "item", //场景道具
}

//街道排队的标记位
export enum GStreetQueueFlag {
    noOccupy = 0, //未占用
    occupy = 1, //占用
}

export enum GFace {
    face1 = 1, //不能转
    face2 = 2, //拖动就取消
    face4 = 4, //触发建筑中
}
export enum GCurFace { //当前面
    face1 = 1, //东，右下角
    face2 = 2, //
    face3 = 3,
    face4 = 4,
}

export enum GTouchState {
    noYet = "noYet", //还没点击
    touchEmptyArea = "touchEmptyArea", //拖动就取消
    touchBuildingReady = "touchBuildingReady", //触发建筑中
    touchBuildingArrow = "touchBuildingArrow", //触发箭头阶段
    touchBuildingAlready = "touchBuildingAlready", //已触发建筑
    touchOpsArea = "touchOpsArea", //触发操作领域
}


//#region 战斗动画协议

//#endregion

//飞起来的文字内容
export enum GFlyType {
    crit = "crit",
    lost = "lost",
    damage = "damage",
    recover = "recover",
}


export enum WidgetType {
    top = 1 << 1,
    bottom = 1 << 2,
    left = 1 << 3,
    right = 1 << 4,
}

export enum TujianState {
    unGet = 0,
    geted = 1,
    received = 2,
}

export enum GoodsType {
    Coin = 101,
    Diamonds,
    Power,
    Exp,
    GreenStar,
    DressMoney = 27,
}


// 设计支付。慎重修改
export enum PriceType {
    Free = 0,
    Video = 1,
    Coin = 101,
    Diamonds = 102,
    RMB = 107,
    Dollar = 108,
}

export enum CodeState {
    reward = 1, // 奖励领取
    timeOut, //时间过期
    receiced, //已经领取过
    codeSame, // 已兑换过同类型
}

export enum RoleSex {
    men = 1, // 男
    women = 2, //女
}

export enum GoodsType {
    prop = 1,
    skin = 2,
}

export interface GTypeStrNum {
    [key: string]: number;
}

export interface GTypeStrStr {
    [key: string]: string;
}

export interface GTypeStrNode {
    [key: string]: Node;
}
export interface GTypeNumNode {
    [key: number]: Node;
}

/**
 * 活动开启类型
 */
export enum ActivityLockType {
    type_Level = 1,   // 等级解锁
    type_FixTime = 2, // 定时开启
}

/**
 * 邮件类型
 */
export enum EmailType {
    type_sys = 1,      // 系统邮件
    type_reward = 2, //运营补偿
    type_notice = 3, //系统公告
}
/**
 * 邮件奖励领取情况
 */
export enum EmailRewardState {
    unReceive = 1,  // 未领取
    received = 2,  // 已领取
}

/**
 * 邮件阅读状态
 */
export enum EmailState {
    unRead = 1,   //未读
    readFinish = 2, //已读
    timeOut = 3,  // 过期
}
export interface EmailReward {
    "propId": number,
    "cnt": number,
}
export interface Email {
    "id": number,
    "type": EmailType,
    "time": number,
    "title": string,
    "content": string,
    "reward": EmailReward[],
    "receicedState": EmailRewardState,
    "readState": EmailState,
}

export interface GodWealthReceiveUser {
    "userID": string,
    "avatar": string,
}

export interface GodWealthData {
    "shareUserId": string,  // 发起分享用户ID
    "shareName": string,  // 发起分享用户名字
    "propList": [] // 领取的道具列表
    "receiveUser": GodWealthReceiveUser[]
    "shareTime": number  // 发起分享时间
}

export enum shopType {

    MoreMonery = 1,
    FirstRecharge = 2,
    MonthCard = 3,
    ToolBox = 4,
    ResourceBox = 5,
    LimitProp = 6,
    StarBox = 7,

}

//红点埋点
export const GRedPoint = Enum({
    //皮肤升级
    skinHead: 0,
    skinNeck: 1,
    skinBody: 2,
    skinBelt: 3,
    skinWrist: 4,
    skinShoes: 5,

    //菜单提示
    menu1: 100,
    menu2: 101,
    menu3: 102,
    menu4: 103,
    menu5: 104,
    menu1petItem: 1001, //宠物菜单
    menu1detailItem: 1002, //宠物详情升级
    menu1petDetailUpStar: 1003, //升星
    menu1petDetailUnlock: 1004, //解锁
    menu1petDetailEquip: 1005, //装备龙
    menu2UpGradeRole: 1011, //菜单升级
    menu3Battle: 1021, //开始挑战
    menu3BattleSwitchMap: 1022, //切换地图
    menu4UpGradeSkill: 1031, //升级技能
    menu4UpGradeSkillItem: 1032, //技能的选项
    menu5tenFree: 1041, //免费十连抽提示
    menu5Orangeten: 1042, //橙色十连抽提示

    //在线奖励
    online: 2001,
    onlineItem: 2002, //奖励项目

    //每日任务
    daily: 3001,
    dailyTaskItem: 3002, //任务项目

    tomorrow: 4001, //明日领取
    seven: 5001, //七日签到
    offline: 6001, //离线奖励

});

//每日任务
export enum GDailyTask {
    login = 1,
    getOnlineReward = 2,
    getOfflineReward = 3,
    killLittleMonster = 4,
    killSpecMonster = 5,
    killBossMonster = 6,
    killDragon = 7,
    breakBox = 8,
    useHpItem = 9,
    revive = 10,
    useLittleSkill = 11,
    useDragonSkill = 12,
    getGoldCnt = 13,
    getGreenCnt = 14,
    getBlueCnt = 15,
    getPurpleCnt = 16,
    breakLevel10 = 17,
    breakLevel20 = 18,
    breakOneMap = 19,
    getRedWeapon = 20,
}


export enum GLoadPhase {
    one = 0,
    two = 1,
    three = 2,
    none = 99,
    clearPool = 100,
}


//广告埋点文字
export enum GBury {
    step1EnterLoading = "a1进入加载页",
    step2EnterGame = "a2进入战斗界面",
    step3EnterUI = "a3进入UI界面",
    guide1 = "b1新手进入战斗1层",

    clickChallengeBtn = "点击挑战",
    clickPet = "点击展示宠物-",
    clickForTen = "点击普通十连",
    showForHpAd = "展示欧米噶祝福",
    noAdToShare = "无视频转分享",
    videoForHead = "观看激励视频-头部",
    videoForHeadDone = "观看完激励视频-头部",

}