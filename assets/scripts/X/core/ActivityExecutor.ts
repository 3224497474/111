export interface IActivityExecutionContext {
  changeAttribute?(attrId: string, delta: number): void;
  changeMoney?(delta: number): void;
  changeFatigue?(delta: number): void;
  changeMood?(delta: number): void;
  changeAffinity?(npcId: string, delta: number): void;
  setFlag?(flagId: string, value: boolean): void;
  log?(message: string): void;
}

export type ActivityHandler = (ctx: IActivityExecutionContext) => void;

export interface IRegisteredActivity {
  id: string;
  name: string;
  description?: string;
  handler: ActivityHandler;
}

/**
 * 活动执行核心模块
 * - 负责将活动 ID 映射为对角色属性、资源、好感等的具体影响
 * - 不直接依赖角色/经济/社交等系统，只通过 IActivityExecutionContext 回调修改状态
 */
export class ActivityExecutor {
  private static _instance: ActivityExecutor | null = null;

  public static get instance(): ActivityExecutor {
    if (!this._instance) {
      this._instance = new ActivityExecutor();
    }
    return this._instance;
  }

  private activities: Map<string, IRegisteredActivity> = new Map();

  private constructor() {}

  public registerActivity(config: IRegisteredActivity): void {
    this.activities.set(config.id, config);
  }

  public registerActivities(configs: IRegisteredActivity[]): void {
    for (const config of configs) {
      this.registerActivity(config);
    }
  }

  public getActivity(id: string): IRegisteredActivity | undefined {
    return this.activities.get(id);
  }

  public listActivities(): IRegisteredActivity[] {
    return Array.from(this.activities.values());
  }

  /**
   * 执行指定活动 ID 对游戏状态的影响
   */
  public execute(activityId: string, ctx: IActivityExecutionContext): boolean {
    const activity = this.activities.get(activityId);
    if (!activity) {
      if (ctx.log) {
        ctx.log(`Activity not found: ${activityId}`);
      }
      return false;
    }
    activity.handler(ctx);
    if (ctx.log) {
      ctx.log(`Executed activity: ${activityId}`);
    }
    return true;
  }

  /**
   * 注册一批通用基础活动（示例数值，后续可改为配置驱动）
   */
  public registerDefaultActivities(): void {
    this.registerActivities([
      {
        id: "school_class",
        name: "上课",
        description: "提升学习能力，略微增加疲劳",
        handler: (ctx) => {
          ctx.changeAttribute && ctx.changeAttribute("study", 2);
          ctx.changeFatigue && ctx.changeFatigue(1);
          ctx.log && ctx.log("上课：学习+2，疲劳+1");
        },
      },
      {
        id: "self_study",
        name: "自习",
        description: "更高效率的学习，但更累",
        handler: (ctx) => {
          ctx.changeAttribute && ctx.changeAttribute("study", 3);
          ctx.changeFatigue && ctx.changeFatigue(2);
          ctx.log && ctx.log("自习：学习+3，疲劳+2");
        },
      },
      {
        id: "part_time_job",
        name: "打工",
        description: "获取金钱，同时增加疲劳",
        handler: (ctx) => {
          ctx.changeMoney && ctx.changeMoney(50);
          ctx.changeFatigue && ctx.changeFatigue(2);
          ctx.setFlag && ctx.setFlag("HasPartTimeExperience", true);
          ctx.log && ctx.log("打工：金钱+50，疲劳+2");
        },
      },
      {
        id: "club_activity",
        name: "社团活动",
        description: "提升魅力并加深与社团成员的关系",
        handler: (ctx) => {
          ctx.changeAttribute && ctx.changeAttribute("charm", 1);
          ctx.changeFatigue && ctx.changeFatigue(1);
          ctx.changeAffinity && ctx.changeAffinity("club_member_1", 1);
          ctx.log && ctx.log("社团活动：魅力+1，与社团成员好感+1，疲劳+1");
        },
      },
      {
        id: "free_rest",
        name: "自由休息",
        description: "恢复状态，改善心情",
        handler: (ctx) => {
          ctx.changeFatigue && ctx.changeFatigue(-2);
          ctx.changeMood && ctx.changeMood(1);
          ctx.log && ctx.log("休息：疲劳-2，心情+1");
        },
      },
    ]);
  }
}

