import type { IBattleInstance } from '../battle/Types';
import { BattleEventBus } from '../battle/BattleEventBus';
import { GameContext, type IRuneSystemSaveData } from '../data/GameContext';
import { RuneInventory } from './RuneInventory';
import { RuneLoadout } from './RuneLoadout';
import { RuneBattleRuntime, type RuneTriggeredSkillExecutor } from './RuneBattleRuntime';
import {
    DEFAULT_RUNE_BAG_CAPACITY,
    RuneSlotType,
    slotTypeForRuneType,
    type IRuneDefinition,
    type IRuneInventoryStack,
    type IRuneOperationResult,
    type IRoleRuneProfile,
    type IRuneSlotState,
} from './RuneTypes';

/**
 * 符纹系统总入口。
 * 负责注册定义、管理背包、管理角色槽位、绑定战斗运行时。
 */
export class RuneSystem {
    private static _instance: RuneSystem | null = null;

    public static get instance(): RuneSystem {
        if (!this._instance) {
            this._instance = new RuneSystem();
        }
        return this._instance;
    }

    private readonly runeDefinitions = new Map<number, IRuneDefinition>();
    private readonly roleProfiles = new Map<string, IRoleRuneProfile>();
    private readonly loadouts = new Map<string, RuneLoadout>();
    private readonly listeners = new Set<() => void>();
    private readonly inventory: RuneInventory;
    private battleRuntime: RuneBattleRuntime | null = null;
    private gameContextSyncBound = false;
    private suspendGameContextSync = false;

    private constructor() {
        this.inventory = new RuneInventory(
            (runeId) => this.runeDefinitions.get(runeId),
            DEFAULT_RUNE_BAG_CAPACITY,
        );
    }

    /** 批量注册符纹定义。通常在读完配置表后调用。 */
    public registerRuneDefinitions(definitions: IRuneDefinition[]): void {
        for (const definition of definitions) {
            this.runeDefinitions.set(definition.runeId, definition);
        }
        this.notifyChanged();
    }

    /** 注册单个符纹定义。 */
    public registerRuneDefinition(definition: IRuneDefinition): void {
        this.runeDefinitions.set(definition.runeId, definition);
        this.notifyChanged();
    }

    public getRuneDefinition(runeId: number): IRuneDefinition | undefined {
        return this.runeDefinitions.get(runeId);
    }

    /** 批量注册角色档案。 */
    public registerRoleProfiles(profiles: IRoleRuneProfile[]): void {
        for (const profile of profiles) {
            this.roleProfiles.set(profile.roleId, profile);
        }
        this.notifyChanged();
    }

    /**
     * 确保某个 roleId 一定有档案。
     * 没有角色表时，也可以先通过这个方法动态生成。
     */
    public ensureRoleProfile(roleId: string, displayName?: string): IRoleRuneProfile {
        let profile = this.roleProfiles.get(roleId);
        if (!profile) {
            profile = {
                roleId,
                displayName: displayName || roleId,
                exclusiveSkillIds: [],
            };
            this.roleProfiles.set(roleId, profile);
        } else if (displayName && profile.displayName !== displayName) {
            profile.displayName = displayName;
        }
        return profile;
    }

    public getRoleProfile(roleId: string): IRoleRuneProfile | undefined {
        return this.roleProfiles.get(roleId);
    }

    public getAllRoleProfiles(): IRoleRuneProfile[] {
        return Array.from(this.roleProfiles.values());
    }

    public bindGameContextSync(): void {
        this.gameContextSyncBound = true;
    }

    public saveToGameContext(options?: { persistToLocal?: boolean }): void {
        GameContext.instance.userData.runeSystem = this.exportToSave();
        if (options?.persistToLocal) {
            GameContext.instance.saveToLocal();
        }
    }

    public loadFromGameContext(): void {
        this.importFromSave(GameContext.instance.userData.runeSystem);
    }

    public exportToSave(): IRuneSystemSaveData {
        const loadouts: Record<string, IRuneSlotState[]> = {};
        for (const [roleId, loadout] of this.loadouts) {
            loadouts[roleId] = loadout.getAllSlots();
        }

        return {
            bagCapacity: this.inventory.getCapacity(),
            inventory: this.inventory.getStacks(),
            roleProfiles: this.getAllRoleProfiles(),
            loadouts,
        };
    }

    public importFromSave(data: IRuneSystemSaveData): void {
        this.suspendGameContextSync = true;
        try {
            this.roleProfiles.clear();
            this.loadouts.clear();
            this.inventory.setCapacity(data.bagCapacity || DEFAULT_RUNE_BAG_CAPACITY);
            this.inventory.replaceStacks(data.inventory ?? []);

            for (const profile of data.roleProfiles ?? []) {
                this.roleProfiles.set(profile.roleId, {
                    ...profile,
                    exclusiveSkillIds: [...profile.exclusiveSkillIds],
                });
            }

            for (const [roleId, slots] of Object.entries(data.loadouts ?? {})) {
                const loadout = new RuneLoadout();
                for (const slot of slots) {
                    loadout.setSlotRune(slot.slotType, slot.slotIndex, slot.runeId);
                }
                this.loadouts.set(roleId, loadout);
            }
        } finally {
            this.suspendGameContextSync = false;
        }
    }

    /**
     * 每个 roleId 对应一套独立槽位数据。
     * 同一套 UI 只要切换 roleId，就能显示不同角色的符纹配置。
     */
    public getLoadout(roleId: string): RuneLoadout {
        let loadout = this.loadouts.get(roleId);
        if (!loadout) {
            loadout = new RuneLoadout();
            this.loadouts.set(roleId, loadout);
        }
        return loadout;
    }

    public getBagCapacity(): number {
        return this.inventory.getCapacity();
    }

    public setBagCapacity(capacity: number): void {
        this.inventory.setCapacity(capacity);
        this.notifyChanged();
    }

    /** 背包扩容接口。 */
    public expandBagCapacity(extraSlots: number): void {
        this.inventory.expandCapacity(extraSlots);
        this.notifyChanged();
    }

    public getBagUsedSlots(): number {
        return this.inventory.getUsedSlots();
    }

    public getInventoryStacks(): IRuneInventoryStack[] {
        return this.inventory.getStacks();
    }

    /** 向背包中加入符纹。 */
    public addRuneToInventory(runeId: number, count: number = 1): IRuneOperationResult {
        const definition = this.runeDefinitions.get(runeId);
        if (!definition) {
            return { success: false, message: `未找到符纹定义: ${runeId}` };
        }

        const success = this.inventory.addRune(runeId, count);
        if (!success) {
            return { success: false, message: '符纹背包空间不足' };
        }

        this.notifyChanged();
        return { success: true, message: '已加入背包' };
    }

    /**
     * 将背包中的符纹装备到指定槽位。
     * 只有类型匹配且槽位为空时才允许装备。
     */
    public equipRune(roleId: string, runeId: number, slotType: RuneSlotType, slotIndex: number): IRuneOperationResult {
        const definition = this.runeDefinitions.get(runeId);
        if (!definition) {
            return { success: false, message: `未找到符纹定义: ${runeId}` };
        }

        if (slotTypeForRuneType(definition.type) !== slotType) {
            return { success: false, message: '符纹类型与槽位类型不匹配' };
        }

        const loadout = this.getLoadout(roleId);
        if (loadout.getSlotRune(slotType, slotIndex) !== null) {
            return { success: false, message: '目标槽位已被占用' };
        }

        if (!this.inventory.removeRune(runeId, 1)) {
            return { success: false, message: '背包中没有可装备的符纹' };
        }

        loadout.setSlotRune(slotType, slotIndex, runeId);
        this.notifyChanged();
        return { success: true, message: '装备成功' };
    }

    /** 自动装备到第一个同类型空槽位。 */
    public autoEquipRune(roleId: string, runeId: number): IRuneOperationResult {
        const definition = this.runeDefinitions.get(runeId);
        if (!definition) {
            return { success: false, message: `未找到符纹定义: ${runeId}` };
        }

        const slotType = slotTypeForRuneType(definition.type);
        const loadout = this.getLoadout(roleId);
        const slotIndex = loadout.findFirstEmptySlot(slotType);
        if (slotIndex < 0) {
            return { success: false, message: '没有可用的同类型空槽位' };
        }

        return this.equipRune(roleId, runeId, slotType, slotIndex);
    }

    /**
     * 从指定槽位卸下符纹。
     * 如果背包已满，则直接阻止卸下。
     */
    public unequipRune(roleId: string, slotType: RuneSlotType, slotIndex: number): IRuneOperationResult {
        const loadout = this.getLoadout(roleId);
        const runeId = loadout.getSlotRune(slotType, slotIndex);
        if (runeId === null) {
            return { success: false, message: '当前槽位没有已装备的符纹' };
        }

        if (!this.inventory.canAddRune(runeId, 1)) {
            return { success: false, message: '符纹背包已满，无法卸下' };
        }

        const addSuccess = this.inventory.addRune(runeId, 1);
        if (!addSuccess) {
            return { success: false, message: '符纹背包已满，无法卸下' };
        }

        loadout.clearSlot(slotType, slotIndex);
        this.notifyChanged();
        return { success: true, message: '卸下成功' };
    }

    /** UI 订阅刷新回调。 */
    public subscribe(listener: () => void): void {
        this.listeners.add(listener);
    }

    public unsubscribe(listener: () => void): void {
        this.listeners.delete(listener);
    }

    /**
     * 战斗开始时绑定符纹运行时。
     * Runtime 负责属性生效、供能监听、自动施法。
     */
    public bindBattle(
        battle: IBattleInstance,
        eventBus: BattleEventBus,
        executeTriggeredSkill: RuneTriggeredSkillExecutor,
    ): void {
        this.clearBattleRuntime();
        this.battleRuntime = new RuneBattleRuntime(this, battle, eventBus, executeTriggeredSkill);
        this.battleRuntime.bind();
    }

    /** 由 BattleManager.update(deltaSeconds) 调用。 */
    public updateBattle(deltaSeconds: number): void {
        this.battleRuntime?.update(deltaSeconds);
    }

    /** 战斗结束或切场景时清理运行时。 */
    public clearBattleRuntime(): void {
        this.battleRuntime?.dispose();
        this.battleRuntime = null;
    }

    private notifyChanged(): void {
        if (this.gameContextSyncBound && !this.suspendGameContextSync) {
            this.saveToGameContext();
        }
        this.listeners.forEach((listener) => listener());
    }
}
