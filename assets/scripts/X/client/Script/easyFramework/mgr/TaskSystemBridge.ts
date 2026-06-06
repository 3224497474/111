import { _decorator, Component } from 'cc';
import GD from '../../config/GD';
import { Notifications } from './notifications';
import { taskManager } from './TaskManager';
import { achievementManager } from './AchievementManager';
import { ProgressMetrics } from './ProgressMetrics';
import { TASK_CONFIGS, ACHIEVEMENT_CONFIGS } from '../../config/TaskConfigData';

const { ccclass } = _decorator;

/**
 * 将 X 框架现有的事件（GD.event / Notifications）和
 * TaskManager / AchievementManager / ProgressMetrics 串起来的桥接组件。
 *
 * 用法：
 * - 挂在一个常驻节点（例如 GameRoot / HomeScene 根节点）上。
 * - onLoad 时初始化任务和成就系统，并监听跨天事件。
 */
@ccclass('TaskSystemBridge')
export class TaskSystemBridge extends Component {

    onLoad() {
        // 1. 初始化任务 & 成就配置
        taskManager.init(TASK_CONFIGS);
        achievementManager.init(ACHIEVEMENT_CONFIGS);

        // 2. 监听跨天事件：日常任务重置
        Notifications.on(GD.event.overDay, this.onOverDay, this);

        // ============================
        // 以下是示例事件绑定，按实际项目需要自行打开/修改：
        // ============================

        // 示例：游戏开始时视为“今日登录一次”
        // Notifications.on(GD.event.gameStart, this.onGameStart, this);

        // 示例：击杀怪物事件（需要你在 GD.event 里定义 killMonster，并在怪物死亡时 emit）
        // Notifications.on(GD.event.killMonster, this.onKillMonster, this);
    }

    onDestroy() {
        Notifications.off(GD.event.overDay, this);
        // 对应 onLoad 里打开的其它事件，这里也要成对 off：
        // Notifications.off(GD.event.gameStart, this);
        // Notifications.off(GD.event.killMonster, this);
    }

    /** 跨天逻辑：重置每日任务 + 重置每日相关的计数 */
    private onOverDay() {
        // 重置每日任务状态
        taskManager.resetDailyTasks();

        // 如果有专门的“每日计数”，在这里清理：
        ProgressMetrics.instance.set('login_today', 0);
        ProgressMetrics.instance.set('kill_monster_daily', 0);

        // 重置后重新评估一次任务 / 成就
        taskManager.evaluateAll();
        achievementManager.handleMetricsUpdated();
    }

    /** 示例：游戏开始事件（作为“今日登录一次”的来源） */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onGameStart(..._args: any[]) {
        ProgressMetrics.instance.update('login_today', 1);
        taskManager.evaluateAll();
        achievementManager.handleMetricsUpdated();
    }

    /** 示例：击杀怪物事件 */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onKillMonster(params: { monsterId: number }) {
        // 累计总击杀数（成就用）
        ProgressMetrics.instance.update('kill_monster_total', 1);
        // 累计今日击杀数（每日任务用）
        ProgressMetrics.instance.update('kill_monster_daily', 1);

        taskManager.evaluateAll();
        achievementManager.handleMetricsUpdated();
    }
}

