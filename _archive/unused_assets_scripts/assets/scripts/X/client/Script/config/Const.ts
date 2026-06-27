
import { Camera, color, Node, v2, Vec2, _decorator } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Const')
export class Const {
    // private static _instance: Const;
    // static get instance () {
    //     if (this._instance) {
    //         return this._instance;
    //     }T

    //     this._instance = new Const();
    //     return this._instance;
    // }

    // app打包版本号
    public static appBuildVersion = 0;
    // 热更新版本号
    public static hotupdateVersion = "0.0.0";

    public static gameName: string = "肥啾瘦身馆" //分享用的游戏名称

    public static isOnline: boolean = true //是否上线，上线后关闭日志
    public static isOpenCheat: boolean = false //是否开启作弊器
    public static isDebug: boolean = false //是否调试
    public static version: string = "1.0.9" //版本号 
    public static SaveHead: string = "JSF_" //修改标题头，可以刷新玩家数据
    public static camera3D: Node = null! //3D镜头
    public static cameraParam: number = null! //3D镜头系数
    public static isLow: boolean = true //是否是低端机

    public static CameraScene: Camera = null! //场景相机
    public static SceneNode: Node = null! //场景节点
    public static SceneBottom: Node = null! //场景底部
    public static ShadowParent: Node = null! //阴影的父节点
    public static ShadowWallParent: Node = null! //墙壁阴影的父节点
    public static GridParent: Node = null! //格子的父节点
    public static WallGridParent: Node = null! //墙的格子的父节点
    public static ItemParent: Node = null! //场景道具的父节点
    public static CarpetParent: Node = null! //场景地毯的父节点
    public static PendantParent: Node = null! //挂件的父节点
    public static WallFixedNode: Node = null! //墙体的父节点
    public static StreetFixedNode: Node = null! //街道的父节点
    public static FloorFixedNode: Node = null! //地板的父节点
    public static SelSceneNode: Node = null! //选择的场景节点
    public static GuestStartPos: Node = null! //客人起点位置，地铁口处
    public static LightParent: Node = null! //路灯的父节点
    public static IsShowOpsDialog: boolean = null! //是否显示操作界面
    public static isGodWealthShow: boolean = false // 是否显示财神了

    public static FloatStarParent: Node = null! //浮动星星父节点
    public static SelBuildingParent: Node = null! //操作按钮的父节点

    public static AllItems: Node[] = [] //房间内所有可以touch的点
    public static Guests: Node[] = [] //所有客人节点信息

    public static OriOffset: Vec2 = v2(0, 0) //原始偏移值
    public static MaxStreetX: number = 66 //街区最大x方向,右下角为x方向
    public static MaxStreetY: number = 23 //街区最大y方向
    public static MaxRoomX: number = 88 //88最大x方向，可根据房间解锁情况改变
    public static MaxRoomY: number = 88 //88最大y方向，可根据房间解锁情况改变
    public static MaxWallXRight: number = 24 //88*2最大x方向，可根据房间解锁情况改变
    public static MaxWallXLeft: number = -24 //88*2最大x方向，可根据房间解锁情况改变
    public static MaxWallY: number = 8 //8最大y方向，可根据房间解锁情况改变
    public static GuestSpeedTime: number = 0.66 //客人速度多少倍
    public static UICanvas: Node = null! //UI画布节点
    public static SceneOffsetX: number = 10000 //客人速度多少倍

    public static skillTitleColor: string[] = ['#74e530', '#30d1ff', '#ee51ff', '#ff8230'] //白，绿，蓝，紫，橙，红
    public static skillTitleColorOutline: string[] = ['#026900', '#003270', '#54015e', '#8f3710']  //白，绿，蓝，紫，橙，红

    public static weaponColorOutline: string[] = ['#6f6b54', '#0c5a1a', '#022867', '#4f0059', '#741602', '#6c100e'] //白色，绿色，蓝色，紫色，橙色，红色
    public static weaponColor: string[] = ['#e3dcb9', '#54d240', '#37bfff', '#d45afd', '#ff9437', '#fc3737'] //白色，绿色，蓝色，紫色，橙色，红色
    public static weaponHead: string[] = ['普通', '精良', '稀有', '史诗', '传说', '神话'] //属性列表
    public static weaponColorName: string[] = ['white', 'green', 'blue', 'purple', 'orange', 'red']
    //, "font"可能没有下载成功
    public static bundlesAhead1 = ["json","bitmap-font" ,"d1prefabUI", "d1pub", "d1audio", "d1scene","d1scene2", "prefabUI", "prop1"]
    public static bundlesAhead2 = ["d2audio", "d2prefabUI", "d2scene", "textures", "prop2"]
    public static bundlesGame = ["audio", "img"]

    public static bundles = [...Const.bundlesAhead1, ...Const.bundlesAhead2, ...Const.bundlesGame]

    public static GodWealthRefleshTime = 1  // 财神视频刷新次数
    public static LimitShopRefleshPrice = 20 //商店钻石刷新价格
    public static GodWealthReceiveOtherTime = 2  // 财神领取别人次数


    public static color = {
        white: color(255, 255, 255, 255),
        red: color(244, 0, 2, 255),
        gray: color(49, 49, 49, 255),
        lightGray: color(155, 155, 155, 225),
        black: color(0, 0, 0, 255),
    }

    public static ManagerTypes = {
        // 角色达到%d级
        roleLv: 1,
        // 发射任意发生器次数
        roomClickAdd: 2,
        // 完成订单数量
        taskDone: 3,
        // 解锁粉色手提包次数
        unlockPinkBag: 4,
        // 在棋盘合成次数
        composeCount: 5,
        // 为健身房建造次数
        buildCount: 6,
        // 消耗钻石购买能量次数
        diamondBuyPower: 7,
        // 在棋盘上出售任意物品次数
        roomSell: 8,
        // 加速发射器次数
        roomSpeedUp: 9,
        // 累计消耗能量数量
        powerCost: 10,
        // 合成最高等级金币个数
        composeCoinMaxLv: 11,
        // 合成最高等级能量球个数
        composePowerMaxLv: 12,
        // 累计消耗金币数量
        coinCost: 13,
    };

    public static CacheDataKey = {
        music: "music",
        sound: "sound",
    }

    public static DataKeys = {
        isInitData: "isInitData", //是否初始化过数据
        roleLv: "roleLv", // 玩家等级
        roleName: "roleName", // 玩家名字
        roleID: "roleID", // 玩家ID
        roleAvatar: "roleAvatar", // 玩家头像


        roleExp: "roleExp", // 玩家经验
        coin: "coin", // 金币
        diamonds: "diamonds", // 钻石
        power: "power", //体力

        tujianProp: "tujianProp",  // 图鉴道具
        tujianScene: "tujianScene",  // 图鉴道具

        growUp: "growUp",  // 图鉴道具
        warehouseProp: "warehouseProp", // 仓库道具


        sceneHead: "sceneHead_", //场景存储的头部信息
        sceneItem: "sceneHead_item_", //场景道具类型存储
        sceneCarpet: "sceneHead_carpet_", //场景地垫数据
        scenePendant: "sceneHead_pendant_", //场景挂件数据
        sceneWall: "sceneHead_wall_", //场景墙体
        sceneFloor: "sceneHead_floor_", //场景地板

        // 跨天保存时间点
        saveDayTime: "saveDayTime",

        // 战令积分
        seasonScore: "seasonScore",
        // 战令id
        seasonId: "seasonId",
        // 战令对应id奖励情况
        seasonAwardInfo: "seasonAwardInfo_",
        // 战令解锁
        seasonOpen: "seasonOpen",

        // 主线棋盘数据
        composeRoomData: "composeRoomData",
        // 主线任务列表
        composeTaskArr: "composeTaskArr",
        // 店长值班日
        composeManagerArr: "composeManagerArr",
        // 是否是已经全部完成店长值班日
        composeManagerAllGet: "composeManagerAllGet",
        // 卡片列表
        composeCardArr: "composeCardArr",
        // 合成UI道具获得次数标记
        composePropCount: "composePropCount_",
        // 无限能量时间
        composePowerTime: "composePowerTime",

        // 新手教程-强引导索引
        handIndex: "handIndex",

        sceneSkinIsGotted: "sceneSkinIsGotted_", //+皮肤表ID，场景里的皮肤是否获得，0未获得，1获得，
        sceneRoomIsUnlock: "sceneRoomIsUnlock_", //+房间ID，场景里的房间是否解锁，0未解锁，1解锁，
        sceneRoomIsUnReceive: "sceneRoomIsUnReceive_", //+房间ID，场景里的房间是否已领取，0 、1，

        dailyTime: "dailyTime",
        buyPowerTime: "buyPowerTime1",

        greenStar: "greenStar",
        dressMoney: "dressMoney",
        dressValue: "dressValue",

        isVip: "isVip",
        roleDressUpId: "roleDressUpId",

        timeCD: "timeCD",

        propBuyTime: "propBuyTime",

        emailList: "emailList",

        newEmailIDs: "newEmailIDs",

        signdayReceive: "signdayReceive",

        signdaytime: "signdaytime",

        GodWealthData: "GodWealthData",

        authSetting: "authSetting",

        TaskLineStep: "TaskLineStep",
        TaskLineFinsh: "TaskLineFinsh",
        TaskLineFinshReward: "TaskLineFinshReward",


    }

    public static MoneyKeys = {
        MoneyVip: "Money_Vip",
        FirstCharge: "Money_FirstCharge",
        MonthCharge: "Money_MonthCharge",
        WeekCharge: "Money_WeekCharge",

    }

    public static Tables = {
        scene_item: "scene_item", //场景道具表
        scene_skin: "scene_skin", //场景道具皮肤表
        scene_room: "scene_room", //场景房间表
        scene_guest: "scene_guest", //场景客人表
        scene_guest_ani: "scene_guest_ani", //场景客人动画表
        const: "const", //全局常量表
        ui: "ui_table", //ui文字表
        draw: "draw_table", //ui文字表
        resTable: "res_table", //ui文字表

        // 道具表
        prop: "prop_prop",
        // 合成额外奖励
        composeAward: "prop_composeAward",
        // 背包扩容
        bagGrid: "prop_bagGrid",
        // 订单生成表
        taskType: "task_orderType",

        taskMainType: "taskMain_orderType",
        taskUnlock: "taskMain_taskUnlock",

        // 店长值日表
        manager: "task_manager",
        // 棋盘初始化
        composeRoomInit: "prop_new",
        // 新手引导任务
        handTask: "task_newTask",
        // 保底任务
        leastTask: "task_SafeTask",
        // 战令
        seasonAward: "task_seasonAward",
        // 福袋
        fuBag: "prop_FuBag",

        // 机器人-棋盘初始化
        composeRoomInitRobot: "robot_robotCompose",

        herolevel: "herolevel_table", //角色等级表

        setting: "setting_table", //debug表

        shopTable: "shop_shop",
        recharge: "recharge_recharge",
        privilege: "privilege_table",

        giftFree: "shop_giftFree",

        task_growUp: "task_growUp",

        sign: "sign_sign",


        roleDressUp: "Change_change",

        language: "language_table",
        saleShop: "saleshop_shop",
        saleShopItem: "saleshop_item",

        saleshop_totalRecharge: "saleshop_totalRecharge",
        saleshop_RechargeReward: "saleshop_RechargeReward",
        lockActivity_item: "lockActivity_item",

    }

    public static Shaders = {
        shineColor: 'd1pub|shader/shineColor',
    }

    public static Icons = {
        default: "img|icons/default", //默认图标
    }

    //所有对话框加载的地址
    public static Dialogs = {
        //钱有关的
        gold_no_enough: 'd1prefabUI|UI/money/gold_no_enough',
        diamond_no_enough: 'd1prefabUI|UI/money/diamond_no_enough',
        tick_no_enough: 'd1prefabUI|UI/money/tick_no_enough',
        firstRecharge: "d1prefabUI|UI/money/firstRecharge",
        MonthCard: "d1prefabUI|UI/money/MonthCard",

        SaleDailyDialog: "d2prefabUI|shopLayer/SaleDailyDialog",

        RewardActivityDialog: "d2prefabUI|activity/RewardActivityDialog",

        TotalRechargeDialog: "d2prefabUI|shopLayer/TotalRechargeDialog",


        //装扮切换界面
        scene_ui_skin: 'd1prefabUI|UI/scene/scene_ui_skin/scene_ui_skin',
        scene_ui_skin_detail: 'd1prefabUI|UI/scene/scene_ui_skin/scene_ui_skin_detail',
        scene_ui_skin_detailList: 'd1prefabUI|UI/scene/scene_ui_skin/scene_ui_skin_detailList',

        build_list: 'd1prefabUI|UI/main/build_list', //建造清单列表
        build_prompt: 'd1prefabUI|UI/main/build_prompt', //提示建造的界面
        build_info: 'd1prefabUI|UI/main/build_info', //提示建造的界面


        pop_reward_item: "d1prefabUI|UI/main/pop_reward_item",

        RoleDressUp: 'd2prefabUI|roleDressUp/RoleDressUp',
        RoleInfoDialog: 'd2prefabUI|roleDressUp/RoleInfoDialog',

        // 战令奖励界面
        SeasonAwardLayer: 'd2prefabUI|seasonAward/SeasonAwardLayer',
        SeasonAwardAdLayer: 'd2prefabUI|seasonAward/SeasonAwardAdLayer',
        // 战力说明页面
        SeasonHelpLayer: 'd2prefabUI|seasonAward/SeasonHelpLayer',
        // 战力购买界面
        SeasonBuyLayer: 'd2prefabUI|seasonAward/SeasonBuyLayer',

        // 财神界面
        GodWealthLayer: 'd1prefabUI|godWealth/GodWealthLayer',
        // 福袋界面
        FuBagLayer: 'd1prefabUI|godWealth/FuBagLayer',
        FuBagReceiveLayer: 'd1prefabUI|godWealth/FuBagReceiveLayer',
        GodWealthOther: 'd1prefabUI|godWealth/GodWealthOther',


        // 合成界面
        ComposeLayer: 'prefabUI|UI/ComposeLayer',
        more_game: 'prefabUI|UI/more_game',
        main: 'd1prefabUI|UI/main/main', // 主页
        fly_tip: 'd1prefabUI|UI/main/fly_tip',
        prompt_sure: 'd1prefabUI|UI/main/prompt_sure', //提示确定
        LevelDialog: 'd1prefabUI|UI/LevelDialog/LevelDialog',
        GMInputLayer: 'prefabUI|UI/GMInputLayer',

        // 背包界面
        BagLayer: 'prefabUI|UI/BagLayer',
        // 店长值班日界面
        ManagerLayer: 'prefabUI|UI/ManagerLayer',
        // 新手教程界面
        HandLayer: 'prefabUI|UI/HandLayer',
        // 获得新物品
        NewItemLayer: 'prefabUI|UI/NewItemLayer',
        // 道具详情页
        PropDetailLayer: 'prefabUI|UI/PropDetailLayer',
        // 订单列表
        TaskListLayer: 'prefabUI|UI/TaskListLayer',
        // 新肥鹅
        NewGuest: 'd1prefabUI|UI/main/NewGuest',

        Tujian: "d1prefabUI|UI/Tujian/TujianDialog",

        PropItemInfo: 'd1prefabUI|UI/propInfo/PropItemInfo',
        PropMinInfo: "d1prefabUI|UI/propInfo/PropMinInfo",
        ShopPowerDialog: "d2prefabUI|shopLayer/ShopPowerDialog",

        ShopSynthesisDialog: "d2prefabUI|shopLayer/ShopSynthesisDialog",

        DebugDialog: "d2prefabUI|shopLayer/DebugDialog",
        ShopDialog: "d2prefabUI|shopLayer/ShopDialog",

        SetDialog: "d2prefabUI|setting/SetDialog",
        CodeDialog: "d2prefabUI|setting/DuihuanDialog",

        RewardDialog: "d1prefabUI|common/RewardLayer",
        ActivityDialog: "d2prefabUI|activity/ActivityDialog",
        FreeGiftDialog: "d2prefabUI|activity/FreeGiftDialog",

        SignDialog: "d1prefabUI|UI/sign/SignDialog",

        GrowUpDialog: "d2prefabUI|activity/GrowUpDialog",

        EmailDialog: "d2prefabUI|Email/EmailDialog",
        EmailInfoDialog: "d2prefabUI|Email/EmailInfoDialog",

        FeijiuDialog: "d2prefabUI|setting/FeijiuDialog",

        FeijiuInfoDialog: "d2prefabUI|setting/FeijiuInfoDialog",
        ModifyDailog: "d2prefabUI|setting/ModifyDailog",

        RefleshDialog: "d2prefabUI|shopLayer/RefleshDialog",

        //阿宝的货车
        TreasureDialog: "d2prefabUI|Treasure/TreasureDialog",
        TreasureFinishDialog: "d2prefabUI|Treasure/TreasureFinishDialog",

        PrivacyDialog: "d2prefabUI|setting/PrivacyDialog",

    }

    public static resPath = {
        roleSpine: "d1scene2|guests/",

        icon: "",
        roleIcon: "d1prefabUI|common/roleIcon/",

        freeGiftIcon: "d2prefabUI|activity/",

        heroIcon: "textures|heroIcon/",

        defaultGuestSpine: "d2scene|guests/", //默认场景客人
        defaultSceneIcons: "d2scene|icons/", //默认场景图标
        defaultScenePrefabs: 'd2scene|items/', //默认场景预制体

        Tujian: "d1prefabUI|UI/Tujian/res/",
        composeSpine: "prefabUI|compose/spine/",// 合成模块spine动画目录
        composeIcon: "prefabUI|compose/icon/",
        common: "d1prefabUI|common/",

        icon_diamons: "d1prefabUI|common/icon_diamond",
        icon_coin: "d1prefabUI|common/icon_coin",
        icon_video: "d1prefabUI|common/icon_video",
        propItembg: "d1prefabUI|UI/propInfo/res/",

        buildpicture: "d1prefabUI|UI/main/res/buildpicture/"

    }

    //预制体加载
    public static Prefabs = {

        //UI-主界面
        main_top: 'd1prefabUI|UI/main/main_top',
        fly_tip_item: 'd1prefabUI|UI/main/fly_tip_item',
        build_list_item: 'd1prefabUI|UI/main/build_list_item', //建筑清单的选项
        pop_reward_item: 'd1prefabUI|UI/main/pop_reward_item', //跳出的资源小框
        float_star: 'd1prefabUI|UI/main/float_star', //家具上面飘着的星星
        flash_star: 'd1prefabUI|UI/main/flash_star', //闪烁的星星
        scene_day: 'd1prefabUI|UI/scene/scene_day/scene_day',
        grid: 'd1prefabUI|UI/scene/grid/grid',
        grid_wall: 'd1prefabUI|UI/scene/grid_wall/grid_wall',
        scene_ui_ops: 'd1prefabUI|UI/scene/scene_ui_ops/scene_ui_ops',
        scene_ui_arrow: 'd1prefabUI|UI/scene/scene_ui_ops/scene_ui_arrow',
        store_skin_item: 'd1prefabUI|UI/scene/scene_ui_skin/store_skin_item', //装扮选项
        guest: 'd1scene2|guests/guest',

        Main_top: "d1prefabUI|UI/main/main_top",

        PropItem: "d1prefabUI|UI/propInfo/PropItem",
        PropReceive: "d1prefabUI|UI/propInfo/PropReceive",
        ShopMoneyItem: "d2prefabUI|shopLayer/ShopMoneyItem",
        ShopSynthesisItem: "d2prefabUI|shopLayer/ShopSynthesisItem",

        GetAnimalLayer: "d1prefabUI|common/GetAnimalLayer",

        RedPoint: "d1prefabUI|common/RedPoint",
        FeijiuItem: "d2prefabUI|setting/FeijiuItem",


    }

    public static Audio = {
        bgm: 'd1audio|bgm',
        btn: 'd1audio|btn',
        thunder: 'audio|thunder',
        show_ten: 'audio|show_ten',
        electric: 'audio|electric',
        ten_prompt2: 'audio|ten_prompt2',
        ten_summon: 'audio|ten_summon',
        num: 'audio|num',
        flash_show: 'd1audio|flash_show',
        star_touch: 'd1audio|star_touch',

        sellBack: 'd1audio|sell_back',
        bubble: 'd1audio|bubble',
        bubbleBomb: 'd1audio|bubble_bomb',
        sceneChange: 'd1audio|scene_change',
        createProp: 'd1audio|create_prop',
        taskDone: 'd1audio|task_done',
        clickCoin: 'd1audio|click_coin',
        compose: 'd1audio|compose',

        ack: 'd2audio|ack',
        // bubble: 'd2audio|bubble',
        aim: 'd2audio|aim',
        card: 'd2audio|card',
        fireball: 'd2audio|fireball',
        foot: 'd2audio|foot',
        getGold: 'd2audio|getGold',
        gold_drop1: 'd2audio|gold_drop1',
        hBone: 'd2audio|hBone',
        hGhost: 'd2audio|hGhost',
        hit: 'd2audio|hit',
        hMeat: 'd2audio|hMeat',
        hStone: 'd2audio|hStone',
        hWood: 'd2audio|hWood',
        ice: 'd2audio|ice',
        laser: 'd2audio|laser',
        lose: 'd2audio|lose',
        over_card: 'd2audio|over_card',
        prompt: 'd2audio|prompt',
        show_up: 'd2audio|show_up',
        skill_show: 'd2audio|skill_show',
        summon: 'd2audio|summon',
        uplv: 'd2audio|uplv',
        upstar: 'd2audio|upstar',
        open_box: 'd2audio|open_box',

        absorb: 'd2audio|absorb',
        collect: 'd2audio|collect',
        land: 'd2audio|land',
        sweep: 'd2audio|sweep',
        win: 'd2audio|win',
        wind: 'd2audio|wind',
    }

    public static config = {
        basicGold: 'basicGold',
        basicDiamons: 'basicGem',
        basicDress: 'basicDress',
        basicDressMoney: 'basicDressMoney',
        basicGreenStar: 'basicGreenStar',

        energyMax: "energyMax",
        freePower: "freePower",
        diamonsPower: "diamonsPower",
        CardAddPower: "CardAddPower",
    }

    //声音的长度统计，用于并发控制，单位毫秒
    public static AudioCnt: number = 6
    public static AudioTime: { [key: string]: number } = {
        "alarm": 4640,
        "summon": 2063,
    }

}
