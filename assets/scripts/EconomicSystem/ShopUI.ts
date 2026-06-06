import {
    _decorator,
    Animation,
    Button,
    Component,
    instantiate,
    Node,
    Prefab,
    Sprite,
} from 'cc';
import { ChargeUI } from '../ChargeUI';
import { HomeUI } from '../HomeUI';
import { PanelType } from '../PanelType';
import { GameFacade } from '../app/GameFacade';
import { GuideOverlay, type GuideStepConfig } from '../setting/GuideOverlay';
import { TutorialSystem } from '../setting/TutorialSystem';
import { type GuideStepData, SHOP_TUTORIAL_STEPS } from '../setting/TutorialConfigs';
import { Popup } from '../X/ui/Popup';
import { type IShopItemView } from './ShopSystem';

const { ccclass, property } = _decorator;

type ShopItemUIComponent = Component & {
    init?: (
        itemData: IShopItemView,
        clickCallback: (itemId: string) => void,
    ) => void;
};

@ccclass('ShopUI')
export class ShopUI extends Component {
    @property(Animation)
    public anim: Animation = null!;

    @property(Sprite)
    public figure: Sprite = null!;

    @property(Node)
    public btnsNode: Node = null!;

    @property(ChargeUI)
    public chargeUI: ChargeUI = null!;

    @property(Node)
    public contentNode: Node = null!;

    @property(Prefab)
    public shopItemPrefab: Prefab = null!;

    @property(GuideOverlay)
    public guideOverlay: GuideOverlay = null!;

    @property(Node)
    public mainBuyButton: Node = null!;

    private _panelType = PanelType.Home;
    private _home: HomeUI = null!;
    private _shopId = 'general_shop';
    private _currentItems: IShopItemView[] = [];

    public init(home: HomeUI, panelType: PanelType): void {
        this._home = home;
        this._panelType = panelType;
        this.node.active = false;

        if (this.anim) {
            this.anim.play('shop_reset');
        }

        if (this.chargeUI) {
            this.chargeUI.init(home, this.btnsNode);
        } else {
            console.warn('ShopUI.chargeUI is not assigned.');
        }

        this.refreshGoodsList();

        if (this.mainBuyButton) {
            const btn = this.mainBuyButton.getComponent(Button);
            if (btn) {
                btn.node.off(Button.EventType.CLICK, this.onClickMainBuyButton, this);
                btn.node.on(Button.EventType.CLICK, this.onClickMainBuyButton, this);
            }
        }
    }

    public show(): void {
        this.node.active = true;
        this._home.curPanel = this._panelType;
        this.refreshGoodsList();

        if (this.anim) {
            this.anim.play('shop_intro');
        }

        if (TutorialSystem.instance.shouldShowTutorial('first_shop')) {
            this.startShopGuide();
            TutorialSystem.instance.markTutorialShown('first_shop');
        }
    }

    public hide(): void {
        this.node.active = false;
    }

    public onClickBuyItem(itemId: string): void {
        const itemInfo = this._currentItems.find((item) => item.itemId === itemId);
        const itemName = itemInfo?.itemConfig?.name ?? itemId;
        const canBuy = GameFacade.instance.shop.canBuyGoods(this._shopId, itemId, 1);

        if (!canBuy.success) {
            Popup.toast(canBuy.reason ?? '当前无法购买');
            return;
        }

        const success = GameFacade.instance.shop.buyGoods(this._shopId, itemId, 1);
        if (success) {
            Popup.success(`成功购买 ${itemName}`);
            this.refreshGoodsList();
            return;
        }

        Popup.error('购买失败');
    }

    private onClickMainBuyButton(): void {
        if (this.guideOverlay) {
            this.guideOverlay.nextStep();
        }
    }

    private showShopTutorial(): void {
        if (!this.guideOverlay) {
            console.warn('GuideOverlay is not assigned.');
            return;
        }

        const step1: GuideStepConfig = {
            message: '第一步：这里是主要商品区域。',
            position: { x: 300, y: 300 },
            size: { width: 260, height: 120 },
        };

        const step2: GuideStepConfig = {
            message: '第二步：这里是确认购买按钮。',
            position: { x: 600, y: 450 },
            size: { width: 200, height: 80 },
        };

        this.guideOverlay.startGuide([step1, step2]);
    }

    private startShopGuide(): void {
        if (!this.guideOverlay) {
            console.warn('GuideOverlay is not assigned.');
            return;
        }

        const targetMap: Record<string, Node | null> = {
            mainBuyButton: this.mainBuyButton,
        };

        const runtimeSteps: GuideStepConfig[] = SHOP_TUTORIAL_STEPS.map((data: GuideStepData) => {
            const step: GuideStepConfig = {
                message: data.message,
                position: data.position,
                size: data.size,
                padding: data.padding,
            };

            if (data.uiKey) {
                const node = targetMap[data.uiKey];
                if (node) {
                    step.target = node;
                } else {
                    console.warn(`ShopUI guide target not found for uiKey=${data.uiKey}`);
                }
            }

            return step;
        });

        this.guideOverlay.startGuide(runtimeSteps);
    }

    private refreshGoodsList(): void {
        this._currentItems = GameFacade.instance.shop.listGoods(this._shopId);

        if (!this.contentNode) {
            console.warn('ShopUI.contentNode is not assigned.');
            return;
        }

        this.contentNode.removeAllChildren();

        if (!this.shopItemPrefab) {
            console.warn('ShopUI.shopItemPrefab is not assigned.');
            return;
        }

        for (const item of this._currentItems) {
            const itemNode = instantiate(this.shopItemPrefab);
            this.contentNode.addChild(itemNode);

            const itemUI = itemNode.getComponent('ShopItemUI') as ShopItemUIComponent | null;
            if (itemUI?.init) {
                itemUI.init(item, (clickedItemId: string) => this.onClickBuyItem(clickedItemId));
            }
        }
    }
}
