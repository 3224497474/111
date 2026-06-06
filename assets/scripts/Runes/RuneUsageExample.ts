import { BattleManager } from '../battle/BattleManager';
import { ElementType, type IUnitConfig } from '../battle/Types';
import { RuneSystem } from './RuneSystem';
import {
    RuneTargetRule,
    RuneTriggerType,
    RuneType,
    type IRuneDefinition,
    type IRoleRuneProfile,
} from './RuneTypes';

/**
 * 符纹系统使用示例。
 * 这个脚本不自动执行，只作为接入参考。
 */
export class RuneUsageExample {
    /**
     * 示例 1：注册角色档案和符纹定义。
     * 一般建议在读取完配置表后统一调用。
     */
    public static registerSampleData(): void {
        const runeSystem = RuneSystem.instance;

        const profiles: IRoleRuneProfile[] = [
            {
                roleId: 'role_1',
                displayName: '角色1',
                description: '示例角色档案',
                exclusiveSkillIds: [1001, 1002],
            },
            {
                roleId: 'role_2',
                displayName: '角色2',
                description: '另一套独立符纹配置',
                exclusiveSkillIds: [1003, 1004],
            },
        ];

        const runeDefinitions: IRuneDefinition[] = [
            {
                runeId: 101,
                name: '复苏',
                description: '生命值 +10',
                type: RuneType.ATTRIBUTE,
                maxStack: 99,
                attributeBonuses: [
                    {
                        attribute: 'maxHp',
                        flat: 10,
                    },
                ],
            },
            {
                runeId: 201,
                name: '血灾',
                description: '受到较高伤害时为技能符纹充能',
                type: RuneType.CHARGE,
                maxStack: 99,
                chargeRules: [
                    {
                        triggerType: RuneTriggerType.DAMAGE_TAKEN,
                        chargeAmount: 20,
                        minRatioOfMaxHp: 0.1,
                        linkedSkillRuneIds: [301],
                        allowUltimate: true,
                    },
                ],
            },
            {
                runeId: 301,
                name: '正义之锤',
                description: '充能满后自动释放技能 1001',
                type: RuneType.SKILL,
                maxStack: 99,
                skillBinding: {
                    skillId: 1001,
                    chargeRequired: 10,
                    autoCastCooldownSeconds: 3,
                    targetRule: RuneTargetRule.ENEMY_SINGLE_FRONT,
                    tags: ['hammer'],
                },
            },
            {
                runeId: 401,
                name: '审判',
                description: '终极符纹，满充能后自动释放',
                type: RuneType.ULTIMATE,
                maxStack: 99,
                skillBinding: {
                    skillId: 1002,
                    chargeRequired: 400,
                    autoCastCooldownSeconds: 8,
                    targetRule: RuneTargetRule.ENEMY_ALL,
                    tags: ['ultimate'],
                },
            },
        ];

        runeSystem.registerRoleProfiles(profiles);
        runeSystem.registerRuneDefinitions(runeDefinitions);
    }

    /** 示例 2：给背包加符纹，并给角色自动装备。 */
    public static setupBagAndLoadout(): void {
        const runeSystem = RuneSystem.instance;

        runeSystem.addRuneToInventory(101, 2);
        runeSystem.addRuneToInventory(201, 1);
        runeSystem.addRuneToInventory(301, 1);
        runeSystem.addRuneToInventory(401, 1);

        runeSystem.autoEquipRune('role_1', 101);
        runeSystem.autoEquipRune('role_1', 201);
        runeSystem.autoEquipRune('role_1', 301);
        runeSystem.autoEquipRune('role_1', 401);
    }

    /**
     * 示例 3：创建战斗时给单位带上 roleId。
     * 同一套 UI 就能显示不同角色各自的符纹槽配置。
     */
    public static createBattleExample(): void {
        const playerTeam: IUnitConfig[] = [
            {
                unitId: 'player_1',
                roleId: 'role_1',
                configId: 1,
                isPlayer: true,
                position: 1,
                level: 1,
                name: '角色1',
                element: ElementType.NEUTRAL,
                skillIds: [1001, 1002],
            },
        ];

        const enemyTeam: IUnitConfig[] = [
            {
                unitId: 'enemy_1',
                roleId: 'enemy_role_1',
                configId: 101,
                isPlayer: false,
                position: 1,
                level: 1,
                name: '敌人1',
                element: ElementType.NEUTRAL,
                skillIds: [],
            },
        ];

        const battleManager = BattleManager.getInstance();
        const battle = battleManager.initializeBattle(playerTeam, enemyTeam);
        if (battle) {
            battleManager.startBattle(battle);
        }
    }
}



// 那就按这个结构更贴合你现在的 UI。

//   RunesPanelPrefab                     挂 RunePanelController
//   ├─ LeftPanel                         左侧：符纹槽区
//   │  ├─ RoleHeader
//   │  │  ├─ RoleNameLabel               Label
//   │  │  └─ RoleDescLabel               Label
//   │  └─ EquippedArea
//   │     ├─ AttributeGroup
//   │     │  ├─ AttributeSlot1           挂 RuneSlotView
//   │     │  ├─ AttributeSlot2           挂 RuneSlotView
//   │     │  └─ ... AttributeSlot12      挂 RuneSlotView
//   │     ├─ ChargeGroup
//   │     │  ├─ ChargeSlot1              挂 RuneSlotView
//   │     │  ├─ ChargeSlot2              挂 RuneSlotView
//   │     │  └─ ChargeSlot3              挂 RuneSlotView
//   │     ├─ SkillGroup
//   │     │  ├─ SkillSlot1               挂 RuneSlotView
//   │     │  ├─ SkillSlot2               挂 RuneSlotView
//   │     │  └─ SkillSlot3               挂 RuneSlotView
//   │     └─ UltimateGroup
//   │        └─ UltimateSlot1            挂 RuneSlotView
//   ├─ RightPanel                        右侧：符纹背包区
//   │  ├─ BagHeader
//   │  │  └─ CapacityLabel               Label
//   │  ├─ BagDropZone                    Node
//   │  │  └─ BagScrollView               ScrollView
//   │  │     └─ view
//   │  │        └─ content
//   │  └─ OptionalTips                   可选
//   └─ ActionPopup                       可选
//      ├─ ConfirmButton                  Button
//      │  └─ Label                       Label
//      └─ CancelButton                   Button

//   RunePanelController 绑定还是这套，只是节点都来自同一个预制体：

//   - bagDropZone -> 右侧 BagDropZone
//   - bagScrollView -> 右侧 BagScrollView
//   - attributeSlots -> 左侧 12 个属性槽
//   - chargeSlots -> 左侧 3 个供能槽
//   - skillSlots -> 左侧 3 个技能槽
//   - ultimateSlot -> 左侧终极槽
//   - roleNameLabel -> 左侧 RoleNameLabel
//   - roleDescLabel -> 左侧 RoleDescLabel
//   - capacityLabel -> 右侧 CapacityLabel

//   拖拽逻辑上，这种布局也正好符合现在脚本：

//   - 左侧槽位拖到右侧 BagDropZone 可卸下
//   - 右侧背包 item 拖到左侧槽位可装备
//   - 点右侧背包 item 可弹“装备”
//   - 点左侧槽位可弹“卸下”




// 符纹item挂载那个脚本，背包item挂载那个脚本


// • - 左侧符纹槽位上的单个 item/槽 挂 assets/scripts/Runes/RuneSlotView.ts
//   - 右侧背包里的单个 item 预制体挂 assets/scripts/Runes/RuneBagItemView.ts
//   - 整个左右合在一起的总面板根节点挂 assets/scripts/Runes/RunePanelController.ts

//   对应关系就是：

//   - 符纹槽 item = RuneSlotView
//   - 背包 item = RuneBagItemView
//   - 整个 UI 预制体根节点 = RunePanelController

//   如果你要，我可以继续直接给你列：

//   1. 左侧槽位 item 内部子节点怎么摆
//   2. 右侧背包 item 预制体内部子节点怎么摆
