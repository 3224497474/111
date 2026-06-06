import { _decorator, Button, Component, error, log, warn } from 'cc';
import { GameFacade } from '../../app/GameFacade';
import { BattleManager } from '../../battle/BattleManager';
import { BattleState } from '../../battle/Types';
import { RouteMap, RouteType } from './TransitionRoute';
import { TransitionManager } from '../TransitionManager';

const { ccclass, property } = _decorator;

@ccclass('SmartTransitionButton')
export class SmartTransitionButton extends Component {
    @property({
        type: RouteType,
        tooltip: 'Select a predefined scene transition route',
    })
    public route: RouteType = RouteType.None;

    private static readonly DEFAULT_LEVEL_ID = 'level_001';
    private static readonly DEFAULT_HERO_ID = '000001';
    private static readonly DEFAULT_ENEMY_IDS = ['010001', '010001'];
    private static readonly DEFAULT_SKILL_IDS = [1002, 1004];

    private _button: Button | null = null;
    private _isTransitioning = false;

    protected onLoad(): void {
        this._button = this.getComponent(Button);
        if (!this._button) {
            warn('[SmartTransitionButton] Button component not found on node:', this.node.name);
            return;
        }

        this._button.node.on(Button.EventType.CLICK, this.onClickGo, this);
    }

    protected onDestroy(): void {
        this._button?.node.off(Button.EventType.CLICK, this.onClickGo, this);
    }

    public async onClickGo(): Promise<void> {
        if (this._isTransitioning) {
            log('[SmartTransitionButton] transition already in progress, click ignored');
            return;
        }

        if (this.route === RouteType.None) {
            warn('[SmartTransitionButton] route is None, transition cancelled');
            return;
        }

        const config = RouteMap[this.route];
        if (!config) {
            warn(`[SmartTransitionButton] route config not found: ${this.route}`);
            return;
        }

        if (!config.sceneName) {
            warn(`[SmartTransitionButton] route ${RouteType[this.route]} is missing sceneName`);
            return;
        }

        if (!Array.isArray(config.bundles)) {
            warn(`[SmartTransitionButton] route ${RouteType[this.route]} has invalid bundles`);
            return;
        }

        this._isTransitioning = true;
        if (this._button) {
            this._button.interactable = false;
        }

        try {
            const prepared = await this.prepareRouteStateIfNeeded();
            if (!prepared) {
                throw new Error('prepare route state failed');
            }

            await TransitionManager.instance.gotoScene(
                config.sceneName,
                config.bundles,
                config.tips,
            );
        } catch (err) {
            this._isTransitioning = false;
            if (this._button) {
                this._button.interactable = true;
            }

            error(
                `[SmartTransitionButton] failed to execute route ${RouteType[this.route]}`,
                err,
            );
        }
    }

    private async prepareRouteStateIfNeeded(): Promise<boolean> {
        if (this.route === RouteType.HomeToBattle) {
            return this.prepareBattleContext();
        }
        if (this.route === RouteType.BattleToHome) {
            return this.finalizeBattleBeforeLeave();
        }

        return true;
    }

    private async prepareBattleContext(): Promise<boolean> {
        const progress = GameFacade.instance.progress;
        const formation = progress.getFormation();
        const heroBuild = progress.getHeroBuild();
        const battleContext = progress.getBattleContext();
        const heroId = formation.heroId.trim() || SmartTransitionButton.DEFAULT_HERO_ID;
        const equippedSoulIds = [...formation.equippedSoulIds];
        const equippedSkillIds = heroBuild.equippedSkillIds.length > 0
            ? [...heroBuild.equippedSkillIds]
            : [...SmartTransitionButton.DEFAULT_SKILL_IDS];
        const enemyIds = battleContext.currentLevelEnemyIds.length > 0
            ? [...battleContext.currentLevelEnemyIds]
            : [...SmartTransitionButton.DEFAULT_ENEMY_IDS];
        const equippedRuneIds = GameFacade.instance.home.collectEquippedRuneIds(heroId);

        const started = await GameFacade.instance.battle.startBattle({
            levelId: SmartTransitionButton.DEFAULT_LEVEL_ID,
            heroId,
            equippedSoulIds,
            equippedSkillIds,
            builtinSkillId: heroBuild.builtinSkillId,
            equippedRuneIds,
            enemyIds,
        });
        if (!started) {
            warn('[SmartTransitionButton] prepareBattleContext failed.', {
                route: RouteType[this.route],
                levelId: SmartTransitionButton.DEFAULT_LEVEL_ID,
                heroId,
                equippedSoulIds,
                equippedSkillIds,
                builtinSkillId: heroBuild.builtinSkillId,
                equippedRuneIds,
                enemyIds,
            });
            return false;
        }

        GameFacade.instance.saveGame();
        return true;
    }

    private finalizeBattleBeforeLeave(): boolean {
        const currentBattle = BattleManager.getInstance().getCurrentBattle();
        if (currentBattle?.state === BattleState.ONGOING) {
            GameFacade.instance.battle.abortBattle();
        }

        GameFacade.instance.saveGame();
        return true;
    }
}
