import { Const } from "../../config/Const"
import ServerCtrJSF from "./ServerCtrJSF"

export const GNetUrl = {

	GetWsUrl: ()=>{
		// return "wslocalhost:39101/sh"

	},
	GetH1ttpUrl: ()=>{
		return "https://hth-236940-9-1318967192.sh.run.tcloudbase.com"
	}
}

// 游戏服务器配置
export const GameServerConfig = {
	// 服务器地址
	baseUrl: "https://hth-236940-9-1318967192.sh.run.tcloudbase.com",
	cloudEnv: "prod-2gadq9h4980d8e01",
	cloudService: "hth",
	preferCloudContainer: true,
	// 是否启用服务器
	enabled: true
}


//操作状态
export const GNetCmd = {
	StickPack: 100000, // 粘包
	Heartbeat: 101000, // 用户心跳
	UserLogin: 101001, // 用户登录
	UserRegister: 101002, // 用户注册
	AntiAddiction: 101003, // 防沉迷认证
	SensitiveWordsCheck: 101004, // 用户保存数据
	UniqueLogin: 101005, // ---游客登录,facebook登录, google登录，返回登录的唯一标识，前端保存唯一标识，如果保存成功，那么就是记录一直传

	SaveUserRecord: 102003, // 用户保存数据
	GetRegionData: 102004,// 查询用户某个分区的数据
	GetRegionList: 102005,// 获取分区列表
	SaveUserRecordAll: 102007,// 用户保存所有数据
	UploadAvatar: 102008,//上传头像
	GetUserDataByKey: 102009, // 获得用户数据

	SaveUserRecordMulti: 102010, //用户保存数据多key和val
	GetCodeDataByKey: 102011, // 获得兑换码数据

	ReqWxSession: 103001, // 微信接口返回值
	ReqSendAuthCode: 103002, // 请求发送短信验证码
	ReqPhoneLogin: 103003, // 请求使用手机登录

	BindFaceBook: 104001, //绑定facebook账号，并修改登录状态
	BindGoogle: 104002, //绑定谷歌登录，并修改登录状态
	ToClientNewMail: 104003, //下发邮件ID
	GetActiveCode : 104004, //输入激活码领取激活码

	SetPlayerPkgLog: 105001, //记录玩家背包日志，本地缓存批量入库
	ReceiveGodWealth: 105002, //财神分享

	CreateChargeOrder: 106001, //創建充值订单，根据订单编号进行
	UpdChargeOrderStatus: 106002, //编辑充值订单，修改订单状态

	GetRankInfo: 201001, //请求获得排行数据
	GetInviteCode: 201002, //请求邀请码
	GetInviteCodeReward: 201003, //新玩家，输入邀请码，获得邀请码奖励，标记为老用户
	GetInviteLevelReward: 201004, //老玩家领取奖励
	PushInviteProcess: 201005, //推送邀请进度
	IsRankOpen: 201006, //是否开启排行榜
	GetSomeonePlayerInfo: 201007, //获取其他玩家数据

	GetMidAutumnRank: 301001, //中秋活动排行榜
	SetMidAutumnRank: 301002, //中秋活动排行榜
	GetWorldBossRank: 301003, //世界boss排行榜查看
	SetWorldBossRank: 301004, //世界boss排行榜设置
	PushWorldBossSettle: 301005, //世界boss结算完后推送消息到本地
	SetWorldBossPlayerStatus: 301006, //设置世界boss挑战的状态
	GetWorldBossPlayerStatus: 301007, //读取世界boss挑战的状态

	GetEmpireSpotData: 302001, //帝国战争的数据读取，每秒
	ActionEmpireSpot: 302002, //帝国战争对地块的行为，1占领 2攻占 3发起掠夺 4参与掠夺 5驱赶
}

export const GNetConst = {
	ResSuccess: "success",
	ResFail: "fail",
	DataTypeInt: "int",
	DataTypeString: "string",
	DataTypeBoolean: "boolean",
	DataTypeObject: "object",
	ServerEventHead: "ServerDown_",
	Http_isAlive: "/isAlive",
}

export const GEvent = {
	connect_fail: "connect_fail", //连不上服务器要提示
	ws_reconnect: "ws_reconnect",
	ws_colse: "ws_colse",
	ws_open: "ws_open", //建立链接成功
}
