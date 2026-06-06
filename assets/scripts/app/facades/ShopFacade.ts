import { CurrencyType } from '../../EconomicSystem/EconomicTypes';
import { EconomyFacade } from './EconomyFacade';
import { ProgressFacade, type ICommerceRewardItem, type IDailyRewardState } from './ProgressFacade';
import type { IShopItemView } from '../../EconomicSystem/ShopSystem';
import { Economy } from '../../EconomicSystem';
import { NetClient } from '../../../Server/network_v2/NetClient';
import { ActionType } from '../../../Server/network_v2/action/ActionTypes';

type ShopIdLike = string | number;
type GoodsIdLike = string | number;

const DAILY_REWARD_CONFIG: Record<number, ICommerceRewardItem> = {
    1: { kind: 'currency', id: CurrencyType.Gold, amount: 500, name: '金币' },
    2: { kind: 'item', id: '1001', amount: 1, name: '道具1' },
    3: { kind: 'currency', id: CurrencyType.Diamond, amount: 30, name: '钻石' },
    4: { kind: 'currency', id: CurrencyType.Gold, amount: 1000, name: '金币' },
    5: { kind: 'item', id: '1002', amount: 1, name: '道具2' },
    6: { kind: 'currency', id: CurrencyType.Diamond, amount: 50, name: '钻石' },
    7: { kind: 'item', id: 'gacha_ticket', amount: 1, name: '召唤券' },
};

export class ShopFacade {
    constructor(
        private readonly economyFacade: EconomyFacade,
        private readonly progressFacade: ProgressFacade,
    ) {}

    public listGoods(shopId: ShopIdLike, vipLevel: number = 0): IShopItemView[] {
        return Economy.shop.listShopItems(this.normalizeId(shopId), vipLevel);
    }

    public canBuyGoods(
        shopId: ShopIdLike,
        goodsId: GoodsIdLike,
        count: number = 1,
        vipLevel: number = 0,
    ): { success: boolean; reason?: string } {
        const normalizedCount = this.normalizeCount(count);
        if (normalizedCount <= 0) {
            return { success: false, reason: '购买数量无效' };
        }

        return Economy.shop.canBuyItem(
            this.normalizeId(shopId),
            this.normalizeId(goodsId),
            vipLevel,
            normalizedCount,
        );
    }

    public buyGoods(
        shopId: ShopIdLike,
        goodsId: GoodsIdLike,
        count: number = 1,
        vipLevel: number = 0,
    ): boolean {
        const normalizedCount = this.normalizeCount(count);
        if (normalizedCount <= 0) {
            return false;
        }

        const canBuy = this.canBuyGoods(shopId, goodsId, normalizedCount, vipLevel);
        if (!canBuy.success) {
            return false;
        }

        const normalizedShopId = this.normalizeId(shopId);
        const normalizedGoodsId = this.normalizeId(goodsId);
        const unitPrice = this.resolveUnitPrice(normalizedShopId, normalizedGoodsId, vipLevel);
        const success = Economy.shop.buyItem(
            normalizedShopId,
            normalizedGoodsId,
            normalizedCount,
            vipLevel,
        );
        if (!success) {
            return false;
        }

        NetClient.instance.dispatch(ActionType.BUY_ITEM, {
            shopId: normalizedShopId,
            goodsId: normalizedGoodsId,
            count: normalizedCount,
            vipLevel,
            unitPrice,
            totalPrice: unitPrice * normalizedCount,
        });
        return true;
    }

    public refreshShop(shopId: ShopIdLike): boolean {
        return Economy.shop.refreshShop(this.normalizeId(shopId));
    }

    public getDailyRewardState(): IDailyRewardState {
        return this.progressFacade.getDailyRewardState();
    }

    public canClaimDailyReward(dayIndex: number): { success: boolean; reason?: string } {
        const normalizedDayIndex = this.normalizeCount(dayIndex);
        if (normalizedDayIndex <= 0) {
            return { success: false, reason: '签到天数无效' };
        }
        if (!DAILY_REWARD_CONFIG[normalizedDayIndex]) {
            return { success: false, reason: '签到奖励未配置' };
        }

        return this.progressFacade.canClaimDailyReward(normalizedDayIndex);
    }

    public claimDailyReward(dayIndex: number): boolean {
        const normalizedDayIndex = this.normalizeCount(dayIndex);
        if (normalizedDayIndex <= 0) {
            return false;
        }

        const canClaim = this.canClaimDailyReward(normalizedDayIndex);
        if (!canClaim.success) {
            return false;
        }

        const reward = DAILY_REWARD_CONFIG[normalizedDayIndex];
        if (!reward || !this.grantReward(reward)) {
            return false;
        }

        this.progressFacade.recordDailyRewardClaim(normalizedDayIndex);
        return true;
    }

    public onChanged(listener: () => void): void {
        Economy.shop.onChange(listener);
    }

    public offChanged(listener: () => void): void {
        Economy.shop.offChange(listener);
    }

    private grantReward(reward: ICommerceRewardItem): boolean {
        switch (reward.kind) {
            case 'currency':
                return this.economyFacade.addCurrency(reward.id as CurrencyType, reward.amount, 'daily_reward');
            case 'item':
                return this.economyFacade.grantItem(reward.id, reward.amount, 'daily_reward');
            default:
                return false;
        }
    }

    private normalizeId(id: ShopIdLike | GoodsIdLike): string {
        return String(id);
    }

    private normalizeCount(count: number): number {
        if (!Number.isFinite(count)) {
            return 0;
        }

        return Math.floor(count);
    }

    private resolveUnitPrice(shopId: string, goodsId: string, vipLevel: number): number {
        const goods = this.listGoods(shopId, vipLevel).find((item) => item.itemId === goodsId);
        return goods?.currentPrice ?? 0;
    }
}
