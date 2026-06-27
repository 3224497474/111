import {
    IStoryNode,
    IChapter,
    IStoryChoice,
    IStorySaveData,
    StoryEventCallback,
    ChoiceCallback,
    StoryNodeType,
} from './StoryTypes';
import { StoryFlagManager } from './StoryFlagManager';
import { AffectionManager } from './AffectionManager';
import { EndingManager } from './EndingManager';
import { DialogSystem } from '../Dialog/DialogSystem';
import { GlobalProgressionSystem } from '../core/globalProgress/GlobalProgressionSystem';

type StoryChoiceHistoryEntry = {
    chapterId: string;
    nodeId: string;
    choiceId: string;
    timestamp: number;
};

export class StoryManager {
    private static _instance: StoryManager | null = null;

    public static get instance(): StoryManager {
        if (!this._instance) {
            this._instance = new StoryManager();
        }
        return this._instance;
    }

    private _nodes: Map<string, IStoryNode> = new Map();
    private _chapters: Map<string, IChapter> = new Map();

    private _currentChapterId: string | null = null;
    private _currentNodeId: string | null = null;
    private _isPlaying = false;

    private _completedChapters: Set<string> = new Set();
    private _completedNodes: Set<string> = new Set();
    private _choiceHistory: StoryChoiceHistoryEntry[] = [];
    private _playedDialogs: Set<string> = new Set();
    private _unlockedCGs: Set<string> = new Set();

    private _nodeStartListeners: Set<StoryEventCallback> = new Set();
    private _nodeCompleteListeners: Set<StoryEventCallback> = new Set();
    private _choiceListeners: Set<ChoiceCallback> = new Set();

    private constructor() {}

    public registerNode(node: IStoryNode): void {
        this._nodes.set(node.id, node);
    }

    public registerNodes(nodes: IStoryNode[]): void {
        for (const node of nodes) {
            this.registerNode(node);
        }
    }

    public registerChapter(chapter: IChapter): void {
        this._chapters.set(chapter.id, chapter);
    }

    public registerChapters(chapters: IChapter[]): void {
        for (const chapter of chapters) {
            this.registerChapter(chapter);
        }
    }

    public playNode(nodeId: string, onComplete?: () => void): boolean {
        const node = this._nodes.get(nodeId);
        if (!node) {
            console.error(`[StoryManager] Node not found: ${nodeId}`);
            return false;
        }

        if (node.isOnceOnly && this._completedNodes.has(nodeId)) {
            console.warn(`[StoryManager] Node already completed: ${nodeId}`);
            onComplete?.();
            return true;
        }

        if (node.unlockCondition) {
            const flagManager = StoryFlagManager.instance;
            if (!flagManager.evaluateCondition(node.unlockCondition)) {
                console.warn(`[StoryManager] Node locked: ${nodeId}`);
                return false;
            }
        }

        this._isPlaying = true;
        this._currentNodeId = nodeId;
        this._currentChapterId = node.chapterId ?? this._currentChapterId;

        this.notifyNodeStart(nodeId);

        switch (node.type) {
            case StoryNodeType.Dialog:
                this.playDialogNode(node, onComplete);
                break;
            case StoryNodeType.Choice:
                this.playChoiceNode(node, onComplete);
                break;
            case StoryNodeType.CG:
                this.playCGNode(node, onComplete);
                break;
            case StoryNodeType.Branch:
                this.playBranchNode(node, onComplete);
                break;
            case StoryNodeType.Ending:
                this.playEndingNode(node, onComplete);
                break;
            default:
                console.warn(`[StoryManager] Unknown node type: ${node.type}`);
                this.completeNode(nodeId, onComplete);
                break;
        }

        return true;
    }

    private playDialogNode(node: IStoryNode, onComplete?: () => void): void {
        if (!node.dialogId) {
            this.completeNode(node.id, onComplete);
            return;
        }

        this.applyNodeEffects(node);
        this.recordDialogPlayed(node.dialogId);

        DialogSystem.show(node.dialogId, () => {
            this.completeNode(node.id, onComplete);
        });
    }

    private playCGNode(node: IStoryNode, onComplete?: () => void): void {
        this.applyNodeEffects(node);

        const cgId = this.resolveCGId(node);
        if (cgId) {
            this._unlockedCGs.add(cgId);
            GlobalProgressionSystem.instance.markCGUnlocked(cgId);
        }

        if (node.dialogId) {
            this.recordDialogPlayed(node.dialogId);
            DialogSystem.show(node.dialogId, () => {
                this.completeNode(node.id, onComplete);
            });
            return;
        }

        this.completeNode(node.id, onComplete);
    }

    private playChoiceNode(node: IStoryNode, onComplete?: () => void): void {
        if (!node.choices || node.choices.length === 0) {
            console.warn(`[StoryManager] Choice node has no choices: ${node.id}`);
            this.completeNode(node.id, onComplete);
            return;
        }

        const flagManager = StoryFlagManager.instance;
        const availableChoices = node.choices.filter((choice) => {
            if (!choice.condition) {
                return true;
            }
            return flagManager.evaluateCondition(choice.condition);
        });

        if (availableChoices.length === 0) {
            console.warn(`[StoryManager] No available choices: ${node.id}`);
            this.completeNode(node.id, onComplete);
            return;
        }

        const playChoiceSelection = () => {
            this.notifyChoiceRequired(node.id, availableChoices, (choiceId) => {
                this.handleChoice(node.id, choiceId, onComplete);
            });
        };

        if (node.dialogId) {
            this.recordDialogPlayed(node.dialogId);
            DialogSystem.show(node.dialogId, playChoiceSelection);
        } else {
            playChoiceSelection();
        }
    }

    private playBranchNode(node: IStoryNode, onComplete?: () => void): void {
        if (!node.branches || node.branches.length === 0) {
            this.completeNode(node.id, onComplete);
            return;
        }

        const flagManager = StoryFlagManager.instance;
        for (const branch of node.branches) {
            if (flagManager.evaluateCondition(branch.condition)) {
                this.playNode(branch.targetNodeId, onComplete);
                return;
            }
        }

        if (node.nextNodeId) {
            this.playNode(node.nextNodeId, onComplete);
        } else {
            this.completeNode(node.id, onComplete);
        }
    }

    private playEndingNode(node: IStoryNode, onComplete?: () => void): void {
        this.applyNodeEffects(node);

        if (node.dialogId) {
            this.recordDialogPlayed(node.dialogId);
            DialogSystem.show(node.dialogId, () => {
                this.completeNode(node.id, onComplete);
            });
        } else {
            this.completeNode(node.id, onComplete);
        }
    }

    public handleChoice(nodeId: string, choiceId: string, onComplete?: () => void): void {
        const node = this._nodes.get(nodeId);
        if (!node || !node.choices) {
            return;
        }

        const choice = node.choices.find((item) => item.id === choiceId);
        if (!choice) {
            console.error(`[StoryManager] Choice not found: ${choiceId}`);
            return;
        }

        this.applyChoiceEffects(choice);
        this.recordChoiceSelection(node, choiceId);
        this.notifyChoiceMade(nodeId, choiceId);
        this.playNode(choice.targetNodeId, onComplete);
    }

    private applyNodeEffects(node: IStoryNode): void {
        if (!node.effects) {
            return;
        }

        const flagManager = StoryFlagManager.instance;
        const affectionManager = AffectionManager.instance;
        const endingManager = EndingManager.instance;

        for (const effect of node.effects) {
            switch (effect.type) {
                case 'affection':
                    if (effect.target && typeof effect.value === 'number') {
                        affectionManager.changeAffection(effect.target, effect.value);
                    }
                    break;
                case 'flag':
                    if (effect.key) {
                        flagManager.setFlag(effect.key, effect.value);
                    }
                    break;
                case 'ending':
                    if (effect.target && typeof effect.value === 'number') {
                        endingManager.addEndingPoint(effect.target, effect.value);
                    }
                    break;
            }
        }
    }

    private applyChoiceEffects(choice: IStoryChoice): void {
        const flagManager = StoryFlagManager.instance;
        const affectionManager = AffectionManager.instance;
        const endingManager = EndingManager.instance;

        if (choice.affection) {
            for (const [characterId, delta] of Object.entries(choice.affection)) {
                affectionManager.changeAffection(characterId, delta);
            }
        }

        if (choice.flags) {
            for (const [key, value] of Object.entries(choice.flags)) {
                flagManager.setFlag(key, value);
            }
        }

        if (choice.endingPoints) {
            for (const [endingId, points] of Object.entries(choice.endingPoints)) {
                endingManager.addEndingPoint(endingId, points);
            }
        }
    }

    private completeNode(nodeId: string, onComplete?: () => void): void {
        this._completedNodes.add(nodeId);
        this._isPlaying = false;

        const node = this._nodes.get(nodeId);
        if (node?.rewards) {
            this.applyRewards(node.rewards);
        }

        this.notifyNodeComplete(nodeId);

        if (node?.nextNodeId) {
            this.playNode(node.nextNodeId, onComplete);
        } else {
            onComplete?.();
        }
    }

    private applyRewards(rewards: any[]): void {
        console.log('[StoryManager] Applying rewards:', rewards);
    }

    public startChapter(chapterId: string, onComplete?: () => void): boolean {
        const chapter = this._chapters.get(chapterId);
        if (!chapter) {
            console.error(`[StoryManager] Chapter not found: ${chapterId}`);
            return false;
        }

        if (chapter.unlockCondition) {
            const flagManager = StoryFlagManager.instance;
            if (!flagManager.evaluateCondition(chapter.unlockCondition)) {
                console.warn(`[StoryManager] Chapter locked: ${chapterId}`);
                return false;
            }
        }

        this._currentChapterId = chapterId;

        return this.playNode(chapter.startNodeId, () => {
            this.completeChapter(chapterId, onComplete);
        });
    }

    private completeChapter(chapterId: string, onComplete?: () => void): void {
        this._completedChapters.add(chapterId);

        const chapter = this._chapters.get(chapterId);
        if (chapter?.clearRewards) {
            this.applyRewards(chapter.clearRewards);
        }

        StoryFlagManager.instance.setFlag(`chapter_${chapterId}_complete`, true);
        onComplete?.();
    }

    public isNodeCompleted(nodeId: string): boolean {
        return this._completedNodes.has(nodeId);
    }

    public isChapterCompleted(chapterId: string): boolean {
        return this._completedChapters.has(chapterId);
    }

    public getCurrentNodeId(): string | null {
        return this._currentNodeId;
    }

    public getCurrentChapterId(): string | null {
        return this._currentChapterId;
    }

    public isPlaying(): boolean {
        return this._isPlaying;
    }

    public getChapterProgress(chapterId: string): {
        completed: number;
        total: number;
        percentage: number;
    } {
        const chapter = this._chapters.get(chapterId);
        if (!chapter) {
            return { completed: 0, total: 0, percentage: 0 };
        }

        const total = chapter.nodeIds.length;
        const completed = chapter.nodeIds.filter((id) => this._completedNodes.has(id)).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, total, percentage };
    }

    public onNodeStart(callback: StoryEventCallback): void {
        this._nodeStartListeners.add(callback);
    }

    public onNodeComplete(callback: StoryEventCallback): void {
        this._nodeCompleteListeners.add(callback);
    }

    public onChoiceMade(callback: ChoiceCallback): void {
        this._choiceListeners.add(callback);
    }

    private notifyNodeStart(nodeId: string): void {
        for (const listener of this._nodeStartListeners) {
            try {
                listener(nodeId);
            } catch (error) {
                console.error('[StoryManager] Node start listener error:', error);
            }
        }
    }

    private notifyNodeComplete(nodeId: string): void {
        for (const listener of this._nodeCompleteListeners) {
            try {
                listener(nodeId);
            } catch (error) {
                console.error('[StoryManager] Node complete listener error:', error);
            }
        }
    }

    private notifyChoiceMade(nodeId: string, choiceId: string): void {
        for (const listener of this._choiceListeners) {
            try {
                listener(nodeId, choiceId);
            } catch (error) {
                console.error('[StoryManager] Choice listener error:', error);
            }
        }
    }

    private notifyChoiceRequired(
        nodeId: string,
        choices: IStoryChoice[],
        callback: (choiceId: string) => void
    ): void {
        console.log(`[StoryManager] Choice required for node: ${nodeId}`, choices);

        if (choices.length > 0) {
            callback(choices[0].id);
        }
    }

    public loadFromSave(saveData: IStorySaveData): void {
        this._currentChapterId = saveData.currentChapterId ?? null;
        this._currentNodeId = saveData.currentNodeId ?? null;
        this._completedChapters = new Set(saveData.completedChapters ?? []);
        this._completedNodes = new Set(saveData.completedNodes ?? []);
        this._choiceHistory = Array.isArray(saveData.choiceHistory)
            ? saveData.choiceHistory.map((entry) => ({
                chapterId: entry.chapterId,
                nodeId: entry.nodeId,
                choiceId: entry.choiceId,
                timestamp: entry.timestamp,
            }))
            : [];
        this._playedDialogs = new Set(saveData.playedDialogs ?? []);
        this._unlockedCGs = new Set(saveData.unlockedCGs ?? []);
        this._isPlaying = false;

        for (const dialogId of this._playedDialogs) {
            GlobalProgressionSystem.instance.markDialogRead(dialogId);
        }
        for (const cgId of this._unlockedCGs) {
            GlobalProgressionSystem.instance.markCGUnlocked(cgId);
        }

        StoryFlagManager.instance.loadFromSave(saveData);
        AffectionManager.instance.loadFromSave(saveData.affection ?? {});
        EndingManager.instance.loadFromSave({
            endingPoints: saveData.endingPoints ?? {},
            unlockedEndings: saveData.unlockedEndings ?? [],
            achievedEndings: saveData.achievedEndings ?? [],
        });
    }

    public loadProgressSnapshot(saveData: IStorySaveData): void {
        this.loadFromSave(saveData);
    }

    public exportToSave(): IStorySaveData {
        const endingData = EndingManager.instance.exportToSave();

        return {
            currentChapterId: this._currentChapterId,
            currentNodeId: this._currentNodeId,
            completedChapters: Array.from(this._completedChapters),
            completedNodes: Array.from(this._completedNodes),
            storyFlags: StoryFlagManager.instance.exportToSave(),
            affection: AffectionManager.instance.exportToSave(),
            endingPoints: endingData.endingPoints,
            unlockedEndings: endingData.unlockedEndings,
            achievedEndings: endingData.achievedEndings,
            choiceHistory: this._choiceHistory.map((entry) => ({ ...entry })),
            playedDialogs: Array.from(this._playedDialogs),
            unlockedCGs: Array.from(this._unlockedCGs),
        };
    }

    public debugJumpToNode(nodeId: string): void {
        console.log(`[StoryManager] Debug jump to node: ${nodeId}`);
        this.playNode(nodeId);
    }

    public debugCompleteChapter(chapterId: string): void {
        const chapter = this._chapters.get(chapterId);
        if (!chapter) {
            return;
        }

        for (const nodeId of chapter.nodeIds) {
            this._completedNodes.add(nodeId);
        }
        this._completedChapters.add(chapterId);
        console.log(`[StoryManager] Debug completed chapter: ${chapterId}`);
    }

    private recordChoiceSelection(node: IStoryNode, choiceId: string): void {
        this._choiceHistory.push({
            chapterId: node.chapterId,
            nodeId: node.id,
            choiceId,
            timestamp: Date.now(),
        });
    }

    private recordDialogPlayed(dialogId: string): void {
        this._playedDialogs.add(dialogId);
        GlobalProgressionSystem.instance.markDialogRead(dialogId);
    }

    private resolveCGId(node: IStoryNode): string | null {
        return node.cgId ?? node.dialogId ?? node.id ?? null;
    }
}
