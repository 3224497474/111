import { PlayerState } from "./PlayerState";
import { GameLoop } from "./GameLoop";
import {
  ActivityExecutor,
  IActivityExecutionContext,
} from "./ActivityExecutor";

export function createExecutionContext(
  player: PlayerState,
  logger?: (message: string) => void,
): IActivityExecutionContext {
  const logFn = logger ?? ((msg: string) => console.log(msg));

  return {
    changeAttribute: (attrId, delta) => {
      player.changeAttribute(attrId, delta);
    },
    changeMoney: (delta) => {
      player.changeMoney(delta);
    },
    changeFatigue: (delta) => {
      player.changeFatigue(delta);
    },
    changeMood: (delta) => {
      player.changeMood(delta);
    },
    changeAffinity: (npcId, delta) => {
      logFn(
        `(TODO) 好感变化：${npcId} ${delta >= 0 ? "+" : ""}${delta}`,
      );
    },
    setFlag: (flagId, value) => {
      logFn(`(TODO) Flag 变化：${flagId} = ${value}`);
    },
    log: (message) => {
      logFn(`[Activity] ${message}`);
    },
  };
}

/**
 * 便捷函数：执行当前时间段对应的活动并作用到玩家状态
 */
export function executeCurrentTimeSlotForPlayer(
  player: PlayerState,
  logger?: (message: string) => void,
): void {
  const activityId = GameLoop.instance.executeCurrentDayTimeSlot();
  const logFn = logger ?? ((msg: string) => console.log(msg));

  if (!activityId) {
    logFn("当前时间段没有安排活动");
    return;
  }

  const ctx = createExecutionContext(player, logFn);
  ActivityExecutor.instance.execute(activityId, ctx);
}

