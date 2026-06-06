import { StateType, ICharacterState } from "./CharacterTypes";

/**
 * CHAR-STATE: 状态管理系统
 * 管理角色的短期状态：情绪、身体状态、特殊状态
 * 支持状态叠加和过期处理
 */
export class CharacterStateManager {
    private states: Map<StateType, ICharacterState[]> = new Map();
    private stateUpdateCallbacks: Array<() => void> = [];

    constructor() {
        this.initializeStateMap();
    }

    /**
     * 初始化状态索引
     * 使用 Object.keys 避免对 ES2017 的 Object.values 依赖
     */
    private initializeStateMap(): void {
        const keys = Object.keys(StateType) as Array<keyof typeof StateType>;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const stateType = StateType[key];
            this.states.set(stateType, []);
        }
    }

    /**
     * 添加状态
     */
    addState(state: ICharacterState): boolean {
        const stateList = this.states.get(state.type);
        if (!stateList) {
            return false;
        }

        stateList.push(state);
        this.notifyStateUpdate();
        return true;
    }

    /**
     * 移除指定状态实例
     */
    removeState(stateType: StateType, index?: number): boolean {
        const stateList = this.states.get(stateType);
        if (!stateList || stateList.length === 0) {
            return false;
        }

        if (index !== undefined && index >= 0 && index < stateList.length) {
            stateList.splice(index, 1);
        } else {
            stateList.pop();
        }

        this.notifyStateUpdate();
        return true;
    }

    /**
     * 移除某类型所有状态
     */
    removeAllStates(stateType: StateType): boolean {
        const stateList = this.states.get(stateType);
        if (!stateList) {
            return false;
        }

        stateList.length = 0;
        this.notifyStateUpdate();
        return true;
    }

    /**
     * 是否拥有某状态
     */
    hasState(stateType: StateType): boolean {
        const stateList = this.states.get(stateType);
        return !!stateList && stateList.length > 0;
    }

    /**
     * 获取某类型所有状态
     */
    getStates(stateType: StateType): ICharacterState[] {
        const stateList = this.states.get(stateType);
        return stateList ? stateList.slice() : [];
    }

    /**
     * 获取所有激活状态
     */
    getAllActiveStates(): ICharacterState[] {
        const allStates: ICharacterState[] = [];
        this.states.forEach((stateList: ICharacterState[]) => {
            allStates.push.apply(allStates, stateList);
        });
        return allStates;
    }

    /**
     * 获取状态数量
     */
    getStateCount(stateType: StateType): number {
        const stateList = this.states.get(stateType);
        return stateList ? stateList.length : 0;
    }

    /**
     * 更新状态持续时间（模拟时间流）
     * 返回本次过期的状态列表
     */
    updateStateDuration(deltaTime: number = 1): ICharacterState[] {
        const expiredStates: ICharacterState[] = [];

        this.states.forEach((stateList: ICharacterState[]) => {
            for (let i = stateList.length - 1; i >= 0; i--) {
                const state: ICharacterState = stateList[i];

                // -1 表示永久状态
                if (state.duration !== -1) {
                    state.duration -= deltaTime;

                    if (state.duration <= 0) {
                        expiredStates.push(state);
                        stateList.splice(i, 1);
                    }
                }
            }
        });

        if (expiredStates.length > 0) {
            this.notifyStateUpdate();
        }

        return expiredStates;
    }

    /**
     * 平均强度
     */
    getAverageStateIntensity(stateType: StateType): number {
        const stateList = this.states.get(stateType);
        if (!stateList || stateList.length === 0) {
            return 0;
        }

        const totalIntensity = stateList.reduce(
            (sum: number, state: ICharacterState) => sum + state.intensity,
            0
        );

        return totalIntensity / stateList.length;
    }

    /**
     * 最大强度
     */
    getMaxStateIntensity(stateType: StateType): number {
        const stateList = this.states.get(stateType);
        if (!stateList || stateList.length === 0) {
            return 0;
        }

        const intensities = stateList.map((state: ICharacterState) => state.intensity);
        return Math.max.apply(Math, intensities);
    }

    /**
     * 清空所有状态
     */
    clearAllStates(): void {
        this.states.forEach((stateList: ICharacterState[]) => {
            stateList.length = 0;
        });
        this.notifyStateUpdate();
    }

    /**
     * 注册状态变更回调
     */
    onStateChanged(callback: () => void): void {
        this.stateUpdateCallbacks.push(callback);
    }

    /**
     * 移除状态变更回调
     */
    offStateChanged(callback: () => void): void {
        const index = this.stateUpdateCallbacks.indexOf(callback);
        if (index >= 0) {
            this.stateUpdateCallbacks.splice(index, 1);
        }
    }

    /**
     * 通知状态更新
     */
    private notifyStateUpdate(): void {
        this.stateUpdateCallbacks.forEach((callback: () => void) => callback());
    }

    /**
     * 导出状态数据（存档）
     */
    exportData(): Record<string, ICharacterState[]> {
        const data: Record<string, ICharacterState[]> = {};
        this.states.forEach((stateList: ICharacterState[], key: StateType) => {
            data[key] = stateList.map((state: ICharacterState) => ({
                ...state,
            }));
        });
        return data;
    }

    /**
     * 导入状态数据（读档）
     * 使用 for...in + hasOwnProperty 避免 Object.entries 依赖 ES2017
     */
    importData(data: Record<string, ICharacterState[]>): boolean {
        try {
            this.clearAllStates();

            for (const key in data) {
                if (!Object.prototype.hasOwnProperty.call(data, key)) {
                    continue;
                }

                const stateType = key as StateType;
                const sourceList = data[key];
                const targetList = this.states.get(stateType);

                if (!targetList || !sourceList || sourceList.length === 0) {
                    continue;
                }

                for (let i = 0; i < sourceList.length; i++) {
                    const state: ICharacterState = sourceList[i];
                    targetList.push({ ...state });
                }
            }

            this.notifyStateUpdate();
            return true;
        } catch (error) {
            console.error("Failed to import state data:", error);
            return false;
        }
    }
}
