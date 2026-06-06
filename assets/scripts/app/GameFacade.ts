import { HomeUI } from '../HomeUI';
import { PanelType } from '../PanelType';
import { Economy } from '../EconomicSystem';
import type { CurrencyChangeCallback, ItemChangeCallback } from '../EconomicSystem/EconomicTypes';
import { CurrencySystem } from '../EconomicSystem/CurrencySystem';
import { InventorySystem } from '../EconomicSystem/InventorySystem';
import { ShopSystem } from '../EconomicSystem/ShopSystem';
import { HomeStatusModel } from '../home/HomeStatusModel';
import { RuneSystem } from '../Runes/RuneSystem';
import { SoulSystem } from '../Souls/SoulSystem';
import { TimeSystem } from '../X/core/TimeSystem';
import { UIManager, UIPanelId } from '../X/ui/UIManager';
import { SyncManager } from '../network/sync/SyncManager';
import { LegacyGameContextBridge } from './LegacyGameContextBridge';
import { SaveCoordinator } from './SaveCoordinator';
import { BattleFacade } from './facades/BattleFacade';
import { EconomyFacade } from './facades/EconomyFacade';
import { GachaFacade } from './facades/GachaFacade';
import { HomeFacade } from './facades/HomeFacade';
import { ProgressFacade } from './facades/ProgressFacade';
import { ShopFacade } from './facades/ShopFacade';
import { EconomySaveModule } from './save/modules/EconomySaveModule';
import { HomeSaveModule } from './save/modules/HomeSaveModule';
import { ProgressSaveModule } from './save/modules/ProgressSaveModule';
import { RuneSaveModule } from './save/modules/RuneSaveModule';
import { SoulSaveModule } from './save/modules/SoulSaveModule';
import { SyncSaveModule } from './save/modules/SyncSaveModule';
import { TimeSaveModule } from './save/modules/TimeSaveModule';
import { StartupPerfTracker } from '../tools/StartupPerfTracker';

export class GameFacade {
    private static _instance: GameFacade | null = null;

    public static get instance(): GameFacade {
        if (!this._instance) {
            this._instance = new GameFacade();
        }
        return this._instance;
    }

    public readonly economy: EconomyFacade;
    public readonly home: HomeFacade;
    public readonly progress: ProgressFacade;
    public readonly shop: ShopFacade;
    public readonly gacha: GachaFacade;
    public readonly battle: BattleFacade;

    private readonly saveCoordinator = new SaveCoordinator('home_scene_main');
    private readonly legacyBridge = new LegacyGameContextBridge();
    private readonly homeStatusModel = HomeStatusModel.instance;
    private readonly soulSystem = SoulSystem.instance;
    private readonly runeSystem = RuneSystem.instance;
    private readonly timeSystem = TimeSystem.instance;
    private readonly syncManager = SyncManager.instance;
    private systemsInitialized = false;
    private saveModulesRegistered = false;
    private autoSaveBound = false;
    private isRestoring = false;
    private lastLoadGameResult: boolean | null = null;
    private homeBootstrapTask: Promise<HomeUI | null> | null = null;
    private readonly handleHomeStatusChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleSoulChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleRuneChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleTimeChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleCurrencyChanged: CurrencyChangeCallback = () => {
        this.handleStateChanged();
    };
    private readonly handleInventoryChanged: ItemChangeCallback = () => {
        this.handleStateChanged();
    };
    private readonly handleEconomyStateChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleShopChanged = (): void => {
        this.handleStateChanged();
    };
    private readonly handleSyncQueueChanged = (): void => {
        this.handleStateChanged();
    };

    private constructor() {
        this.economy = new EconomyFacade();
        this.home = new HomeFacade(this.homeStatusModel, this.soulSystem, this.runeSystem);
        this.progress = new ProgressFacade();
        this.shop = new ShopFacade(this.economy, this.progress);
        this.gacha = new GachaFacade(this.economy, this.progress, this.soulSystem);
        this.battle = new BattleFacade(this.economy, this.progress);
    }

    public hasAnySave(): boolean {
        this.ensureSystemsInitialized();
        this.registerSaveModules();
        return this.saveCoordinator.hasSave() || this.legacyBridge.hasLocalSave();
    }

    public async bootstrapHomeScene(): Promise<HomeUI | null> {
        if (this.homeBootstrapTask) {
            return this.homeBootstrapTask;
        }

        const task = this.bootstrapHomeSceneInternal();
        this.homeBootstrapTask = task;

        try {
            return await task;
        } finally {
            if (this.homeBootstrapTask === task) {
                this.homeBootstrapTask = null;
            }
        }
    }

    public loadGame(): boolean {
        if (this.lastLoadGameResult !== null) {
            return this.lastLoadGameResult;
        }

        this.ensureSystemsInitialized();
        this.registerSaveModules();

        this.isRestoring = true;
        try {
            if (this.saveCoordinator.load()) {
                this.syncLegacyRuntimeState();
                this.lastLoadGameResult = true;
                return this.lastLoadGameResult;
            }

            const legacySnapshot = this.legacyBridge.load();
            if (!legacySnapshot) {
                this.syncLegacyRuntimeState();
                this.saveCoordinator.refreshSnapshotCache();
                this.lastLoadGameResult = false;
                return this.lastLoadGameResult;
            }

            this.economy.importSnapshot(legacySnapshot.economy);
            this.home.importHomeSave(legacySnapshot.home);
            this.home.importSoulSave(legacySnapshot.souls);
            this.home.importRuneSave(legacySnapshot.runeSystem);
            this.progress.importSave(legacySnapshot.progress);
            this.syncLegacyRuntimeState();
            this.saveCoordinator.refreshSnapshotCache();
            this.lastLoadGameResult = true;
            return this.lastLoadGameResult;
        } finally {
            this.isRestoring = false;
            this.saveCoordinator.clearDirtyFlags();
        }
    }

    public saveGame(): boolean {
        this.syncLegacyRuntimeState(true);
        return this.saveCoordinator.flushPendingSave() || this.saveCoordinator.save();
    }

    public restoreFromServerSnapshot(serverSnapshot: Record<string, unknown> | null | undefined): boolean {
        if (!serverSnapshot) {
            return false;
        }

        this.ensureSystemsInitialized();
        this.registerSaveModules();

        this.isRestoring = true;
        try {
            this.syncManager.clearPendingActions();
            const loaded = this.saveCoordinator.load(serverSnapshot);
            if (loaded) {
                this.syncLegacyRuntimeState();
                this.lastLoadGameResult = true;
            }
            return loaded;
        } finally {
            this.isRestoring = false;
            this.saveCoordinator.clearDirtyFlags();
        }
    }

    private ensureSystemsInitialized(): void {
        if (this.systemsInitialized) {
            return;
        }

        Economy.init({ bindLegacyGameContextSync: false });
        this.homeStatusModel.bindEconomySync();
        this.systemsInitialized = true;
    }

    private registerSaveModules(): void {
        if (this.saveModulesRegistered) {
            return;
        }

        this.saveCoordinator.register(new EconomySaveModule(this.economy));
        this.saveCoordinator.register(new HomeSaveModule(this.homeStatusModel));
        this.saveCoordinator.register(new SoulSaveModule(this.soulSystem));
        this.saveCoordinator.register(new RuneSaveModule(this.runeSystem));
        this.saveCoordinator.register(new TimeSaveModule(this.timeSystem));
        this.saveCoordinator.register(new ProgressSaveModule(this.progress));
        this.saveCoordinator.register(new SyncSaveModule(this.syncManager));
        this.saveModulesRegistered = true;
    }

    private bindAutoSave(): void {
        if (this.autoSaveBound) {
            return;
        }

        this.homeStatusModel.onStatusChanged(this.handleHomeStatusChanged);
        this.economy.onChanged(this.handleEconomyStateChanged);
        CurrencySystem.instance.onChange(this.handleCurrencyChanged);
        InventorySystem.instance.onChange(this.handleInventoryChanged);
        ShopSystem.instance.onChange(this.handleShopChanged);
        this.soulSystem.subscribe(this.handleSoulChanged);
        this.runeSystem.subscribe(this.handleRuneChanged);
        this.timeSystem.onTimeChanged(this.handleTimeChanged);
        this.syncManager.onChanged(this.handleSyncQueueChanged);
        this.autoSaveBound = true;
    }

    private handleStateChanged(): void {
        if (this.isRestoring) {
            return;
        }

        this.syncLegacyRuntimeState();
        this.saveCoordinator.requestSave();
    }

    private syncLegacyRuntimeState(persistToLocal = false): void {
        this.legacyBridge.sync({
            economy: this.economy.getSnapshot(),
            home: this.home.exportHomeSave(),
            souls: this.home.exportSoulSave(),
            runeSystem: this.home.exportRuneSave(),
            progress: this.progress.exportSave(),
        }, persistToLocal);
    }

    private async bootstrapHomeSceneInternal(): Promise<HomeUI | null> {
        this.ensureSystemsInitialized();
        this.registerSaveModules();
        this.loadGame();

        const homeUI = await this.openHomePanel();
        await StartupPerfTracker.waitForNextFrame();
        this.bindAutoSave();
        return homeUI;
    }

    private async openHomePanel(): Promise<HomeUI | null> {
        const uiMgr = UIManager.instance;
        await uiMgr.openWithLoad(UIPanelId.Home);

        const homeNode = uiMgr.getNode(UIPanelId.Home);
        if (!homeNode) {
            console.error('[GameFacade] 未找到已加载的 Home 面板节点');
            return null;
        }

        const homeUI = homeNode.getComponent(HomeUI);
        if (!homeUI) {
            console.error('[GameFacade] Home 节点上未找到 HomeUI 组件');
            return null;
        }

        homeUI.curPanel = PanelType.Home;
        uiMgr.registerPanel(UIPanelId.Home, homeUI.node, {
            isMain: true,
            order: 10,
            onOpen: () => {
                homeUI.node.active = true;
                homeUI.curPanel = PanelType.Home;
            },
            onClose: () => {
                homeUI.node.active = false;
            },
        });
        uiMgr.open(UIPanelId.Home);

        return homeUI;
    }
}
