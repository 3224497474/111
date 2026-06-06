import {
    _decorator,
    Label,
    Sprite,
    Color,
    Node,
    Button,
    Prefab,
    instantiate,
    UIOpacity,
} from 'cc';
import { DialogConfig, DialogLine, DialogChoice } from './DialogConfig';
import { DialogSystem } from './DialogSystem';
import { GlobalProgressionSystem } from '../core/globalProgress/GlobalProgressionSystem';
import { AffectionManager } from '../Story/AffectionManager';
import BaseView from '../client/Script/easyFramework/mgr/BaseView';
import { resourceUtil } from '../client/Script/easyFramework/mgr/resourceUtil';
import { audioManager } from '../client/Script/easyFramework/mgr/audioManager';
import { LocaleManager } from '../client/Script/mgr/LocaleManager';
import { UIAnimation } from '../ui/UIAnimation';

const { ccclass, property } = _decorator;
const { EventType } = Node;
type DialogVisualLine = DialogLine & { backgroundPath?: string };
type DialogVisualEffect
    = { type: 'shakeMask'; duration?: number; intensity?: number; count?: number }
    | { type: 'bounceAvatar'; duration?: number; height?: number; count?: number }
    | { type: 'pulseAvatar'; duration?: number; scale?: number };
type DialogEffectLine = DialogVisualLine & {
    affectionChanges?: Record<string, number>;
    visualEffects?: DialogVisualEffect[];
};

interface DialogArgs {
    dialogId?: string;
    lines?: DialogLine[];
    onFinish?: () => void;
    autoPlay?: boolean;
    autoInterval?: number;
    skip?: boolean;
    params?: Record<string, string>;
    conditionEvaluator?: (condition: string) => boolean;
}

@ccclass('DialogView')
export class DialogView extends BaseView {
    @property(Label)
    nameLabel: Label = null!;

    @property(Label)
    contentLabel: Label = null!;

    @property(Sprite)
    avatarSprite: Sprite = null!;

    @property(Sprite)
    backgroundSprite: Sprite | null = null;

    @property(Node)
    maskNode: Node = null!;

    @property(Node)
    contentClickArea: Node = null!;

    @property(Node)
    choiceContainer: Node = null!;

    @property(Prefab)
    choiceButtonPrefab: Prefab | null = null;

    @property(Button)
    skipButton: Button | null = null;

    private readonly _normalNameColor = new Color(255, 255, 255, 255);
    private readonly _normalTextColor = new Color(255, 255, 255, 255);
    private readonly _flashbackNameColor = new Color(180, 180, 180, 255);
    private readonly _flashbackTextColor = new Color(200, 200, 200, 255);
    private readonly _normalTypewriterInterval = 0.03;
    private readonly _skipAutoAdvanceDelay = 0.1;
    private readonly _skipVisualDebounceDelay = 0.05;

    private _lines: DialogLine[] = [];
    private _index = 0;
    private _onFinish: (() => void) | null = null;
    private _autoPlay = false;
    private _autoInterval = 1.2;
    private _params: Record<string, string> = {};
    private _conditionEvaluator: ((condition: string) => boolean) | null = null;
    private _choiceActive = false;
    private _currentDialogId: string | null = null;

    private _isTyping = false;
    private _fullText = '';
    private _shownLength = 0;
    private _typewriterComplete: (() => void) | null = null;
    private _pendingVisualLine: DialogVisualLine | null = null;

    private isSkipping = false;

    show(args: DialogArgs) {
        super.show(args);

        this.clearAdvanceSchedules();
        this.cancelPendingVisualUpdate();
        this._lines = [];
        this._index = 0;
        this._onFinish = args?.onFinish || null;
        this._autoPlay = !!args?.autoPlay;
        this._autoInterval = Math.max(0.05, args?.autoInterval ?? 1.2);
        this._params = args?.params ?? {};
        this._conditionEvaluator = args?.conditionEvaluator ?? null;
        this._choiceActive = false;
        this._currentDialogId = args?.dialogId ?? null;
        this.isSkipping = false;
        this.updateSkipButtonState();

        if (args?.dialogId) {
            const def = DialogConfig.getDialog(args.dialogId);
            if (!def) {
                console.warn('[DialogView] Dialog not found:', args.dialogId);
            } else {
                this._currentDialogId = def.id;
                this._lines = def.lines.map((line) => this.applyParamsToLine({ ...line }, this._params));
            }
        } else if (args?.lines) {
            this._lines = args.lines.map((line) => this.applyParamsToLine({ ...line }, this._params));
        }

        if (this.contentLabel) {
            // @ts-ignore
            if (typeof this.contentLabel.useRichText !== 'undefined') {
                // @ts-ignore
                this.contentLabel.useRichText = true;
            }
        }

        if (this.maskNode) {
            this.maskNode.on(EventType.TOUCH_END, this.onClickNext, this);
        }
        if (this.contentClickArea) {
            this.contentClickArea.on(EventType.TOUCH_END, this.onClickNext, this);
        }

        if (!this._lines.length || args?.skip) {
            this.finishDialog();
            return;
        }

        this.showCurrentLine();
    }

    public toggleSkip(): void {
        this.isSkipping = !this.isSkipping;
        this.updateSkipButtonState();

        if (!this.isSkipping) {
            this.unschedule(this.advanceAfterSkip);
            this.renderCurrentVisualsImmediately();
            return;
        }

        if (!this.canSkipCurrentDialog()) {
            this.isSkipping = false;
            this.updateSkipButtonState();
            return;
        }

        if (this._isTyping) {
            this.finishTypingImmediately();
            return;
        }

        if (!this._choiceActive) {
            this.scheduleOnce(this.advanceAfterSkip, this._skipAutoAdvanceDelay);
        }
    }

    private applyParamsToLine(line: DialogLine, params: Record<string, string>): DialogLine {
        const replace = (text: string) =>
            text.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);

        line.text = replace(line.text ?? '');
        line.name = replace(line.name ?? '');
        return line;
    }

    private showCurrentLine() {
        this.clearAdvanceSchedules();

        if (this._index < 0 || this._index >= this._lines.length) {
            this.finishDialog();
            return;
        }

        const line = this._lines[this._index] as DialogEffectLine;
        this._choiceActive = !!(line.choices && line.choices.length);

        if (this.nameLabel) {
            this.nameLabel.string = line.name ?? '';
        }

        const isFlashback = !!line.isFlashback;
        if (this.nameLabel) {
            this.nameLabel.color = isFlashback ? this._flashbackNameColor : this._normalNameColor;
        }
        if (this.contentLabel) {
            this.contentLabel.color = isFlashback ? this._flashbackTextColor : this._normalTextColor;
        }

        const canSkipCurrentLine = this.isSkipping && this.canSkipCurrentDialog();
        if (this.isSkipping && !canSkipCurrentLine) {
            this.isSkipping = false;
            this.updateSkipButtonState();
        }

        this.applyLineDataEffects(line);
        this.updateVisualsWithDebounce(line as DialogVisualLine);
        this.playLineVisualEffects(line);

        if (line.voicePath && !this.isSkipping) {
            audioManager.instance.playSound(line.voicePath);
        }

        this.startTypewriter(line.text ?? '', () => {
            if (line.choices && line.choices.length > 0) {
                this.isSkipping = false;
                this.updateSkipButtonState();
                this.showChoices(line.choices);
                return;
            }

            if (this.isSkipping) {
                this.scheduleOnce(this.advanceAfterSkip, this._skipAutoAdvanceDelay);
                return;
            }

            if (this._autoPlay) {
                this.scheduleOnce(this.advanceAfterAutoPlay, this._autoInterval);
            }
        }, canSkipCurrentLine);

        if (line.sfxPath && !this.isSkipping) {
            audioManager.instance.playSound(line.sfxPath);
        }
    }

    private startTypewriter(text: string, onComplete?: () => void, instant = false) {
        this._fullText = text;
        this._shownLength = 0;
        this._isTyping = true;
        this._typewriterComplete = onComplete ?? null;

        if (this.contentLabel) {
            this.contentLabel.string = '';
        }

        this.unschedule(this.updateTypewriter);

        if (this.isSkipping || instant) {
            this.finishTypingImmediately();
            return;
        }

        this.schedule(this.updateTypewriter, this._normalTypewriterInterval);
    }

    private updateVisualsWithDebounce(line: DialogVisualLine): void {
        if (!this.isSkipping) {
            this.cancelPendingVisualUpdate();
            this.renderVisualsImmediately(line);
            return;
        }

        this._pendingVisualLine = line;
        this.unschedule(this.flushPendingVisualUpdate);
        this.scheduleOnce(this.flushPendingVisualUpdate, this._skipVisualDebounceDelay);
    }

    private cancelPendingVisualUpdate(): void {
        this._pendingVisualLine = null;
        this.unschedule(this.flushPendingVisualUpdate);
    }

    private renderCurrentVisualsImmediately(): void {
        this.cancelPendingVisualUpdate();

        if (this._index < 0 || this._index >= this._lines.length) {
            return;
        }

        this.renderVisualsImmediately(this._lines[this._index] as DialogVisualLine);
    }

    private readonly flushPendingVisualUpdate = () => {
        const line = this._pendingVisualLine;
        this._pendingVisualLine = null;

        if (!line) {
            return;
        }

        this.renderVisualsImmediately(line);
    };

    private renderVisualsImmediately(line: DialogVisualLine): void {
        this.applySpriteFrame(this.avatarSprite, line.avatarPath, 'Avatar');
        this.applySpriteFrame(this.backgroundSprite, line.backgroundPath, 'Background');
    }

    private applySpriteFrame(target: Sprite | null, path: string | undefined, label: string): void {
        if (!target) {
            return;
        }

        if (!path) {
            target.spriteFrame = null;
            return;
        }

        resourceUtil.setSpriteFrame(path, target, (err) => {
            if (err) {
                console.warn(`[DialogView] ${label} load failed:`, path);
                target.spriteFrame = null;
            }
        });
    }

    private applyLineDataEffects(line: DialogEffectLine): void {
        if (!line.affectionChanges) {
            return;
        }

        for (const [characterId, delta] of Object.entries(line.affectionChanges)) {
            if (!Number.isFinite(delta) || delta === 0) {
                continue;
            }

            AffectionManager.instance.changeAffection(characterId, delta, this._currentDialogId ?? undefined);
        }
    }

    private playLineVisualEffects(line: DialogEffectLine, onComplete?: () => void): void {
        const effects = line.visualEffects ?? [];
        if (effects.length === 0) {
            onComplete?.();
            return;
        }

        let pending = effects.length;
        const completeOne = () => {
            pending--;
            if (pending <= 0) {
                onComplete?.();
            }
        };

        for (const effect of effects) {
            this.playVisualEffectSafely(effect, completeOne);
        }
    }

    private playVisualEffectSafely(effect: DialogVisualEffect, onComplete?: () => void): void {
        if (this.isSkipping) {
            onComplete?.();
            return;
        }

        switch (effect.type) {
            case 'shakeMask':
                if (!this.maskNode) {
                    onComplete?.();
                    return;
                }
                UIAnimation.shake(this.maskNode, effect.intensity ?? 10, effect.count ?? 3, {
                    duration: effect.duration ?? 0.4,
                    onComplete,
                });
                return;
            case 'bounceAvatar':
                if (!this.avatarSprite?.node) {
                    onComplete?.();
                    return;
                }
                UIAnimation.bounce(this.avatarSprite.node, effect.height ?? 20, effect.count ?? 3, {
                    duration: effect.duration ?? 0.5,
                    onComplete,
                });
                return;
            case 'pulseAvatar':
                if (!this.avatarSprite?.node) {
                    onComplete?.();
                    return;
                }
                UIAnimation.pulse(this.avatarSprite.node, effect.scale ?? 1.08, {
                    duration: effect.duration ?? 0.3,
                    onComplete,
                });
                return;
            default:
                onComplete?.();
                return;
        }
    }

    private readonly updateTypewriter = () => {
        if (!this._isTyping) {
            this.unschedule(this.updateTypewriter);
            return;
        }

        this._shownLength++;
        if (this._shownLength >= this._fullText.length) {
            this.finishTypingImmediately();
            return;
        }

        if (this.contentLabel) {
            this.contentLabel.string = this._fullText.slice(0, this._shownLength);
        }
    };

    private showChoices(choices: DialogChoice[]) {
        if (!choices || choices.length === 0) {
            return;
        }

        this.isSkipping = false;
        this.updateSkipButtonState();
        this.unschedule(this.advanceAfterSkip);
        this.renderCurrentVisualsImmediately();

        if (this.choiceContainer) {
            this.choiceContainer.removeAllChildren();
            choices.forEach((choice) => {
                if (choice.condition && this._conditionEvaluator && !this._conditionEvaluator(choice.condition)) {
                    return;
                }

                if (this.choiceButtonPrefab) {
                    const node = instantiate(this.choiceButtonPrefab) as Node;
                    const label = node.getComponentInChildren(Label);
                    if (label) {
                        label.string = choice.text;

                        if (choice.textColor) {
                            try {
                                const color = new Color().fromHEX(choice.textColor);
                                label.color = color;
                            } catch (err) {
                                console.warn('[DialogView] Invalid choice textColor:', choice.textColor, choice.text);
                            }
                        }
                    }

                    const bgSprite = node.getComponent(Sprite);
                    if (bgSprite && choice.bgPath) {
                        resourceUtil.setSpriteFrame(choice.bgPath, bgSprite, (err) => {
                            if (err) {
                                console.warn('[DialogView] Choice background load failed:', choice.bgPath, choice.text, err);
                            }
                        });
                    } else if (!bgSprite && choice.bgPath) {
                        console.warn('[DialogView] Choice button Sprite missing for bgPath:', choice.bgPath, choice.text);
                    }
                    node.on(EventType.TOUCH_END, () => this.onChoiceSelected(choice), this);
                    this.choiceContainer.addChild(node);
                } else {
                    console.warn('[DialogView] ChoiceButtonPrefab not set:', choice.text);
                }
            });
        } else {
            console.warn('[DialogView] ChoiceContainer not bound:', choices.map((item) => item.text).join(', '));
        }
    }

    private onChoiceSelected(choice: DialogChoice) {
        this._choiceActive = false;

        if (choice.targetDialogId) {
            this.close();
            DialogSystem.show(choice.targetDialogId, this._onFinish ?? undefined, {
                autoPlay: this._autoPlay,
                autoInterval: this._autoInterval,
                params: this._params,
                locale: LocaleManager.locale,
            });
            return;
        }

        if (typeof choice.targetLineIndex === 'number') {
            this._index = Math.max(0, Math.min(choice.targetLineIndex, this._lines.length - 1));
            this.showCurrentLine();
            return;
        }

        this.onClickNext();
    }

    private onClickNext() {
        if (this._choiceActive) {
            return;
        }

        // Design choice: manual taps do not cancel skip mode.
        if (this._isTyping) {
            this.finishTypingImmediately();
            return;
        }

        this.clearAdvanceSchedules();

        const currentLine = this._lines[this._index];
        if (currentLine?.nextDialogId) {
            const nextDialogId = currentLine.nextDialogId;
            this.finishDialog();
            DialogSystem.show(nextDialogId, this._onFinish ?? undefined, {
                autoPlay: this._autoPlay,
                autoInterval: this._autoInterval,
                params: this._params,
                locale: LocaleManager.locale,
            });
            return;
        }

        this._index++;
        if (this._index >= this._lines.length) {
            this.finishDialog();
        } else {
            this.showCurrentLine();
        }
    }

    private finishDialog() {
        this.clearAdvanceSchedules();
        this.cancelPendingVisualUpdate();

        if (this.maskNode) {
            this.maskNode.off(EventType.TOUCH_END, this.onClickNext, this);
        }
        if (this.contentClickArea) {
            this.contentClickArea.off(EventType.TOUCH_END, this.onClickNext, this);
        }

        if (this.choiceContainer) {
            this.choiceContainer.removeAllChildren();
        }

        this.isSkipping = false;
        this.updateSkipButtonState();

        if (this._onFinish) {
            this._onFinish();
        }

        this.close();
    }

    private canSkipCurrentDialog(): boolean {
        return !!this._currentDialogId
            && GlobalProgressionSystem.instance.isDialogRead(this._currentDialogId);
    }

    private finishTypingImmediately(): void {
        this._isTyping = false;
        this._shownLength = this._fullText.length;
        this.unschedule(this.updateTypewriter);

        if (this.contentLabel) {
            this.contentLabel.string = this._fullText;
        }

        if (this._typewriterComplete) {
            const callback = this._typewriterComplete;
            this._typewriterComplete = null;
            callback();
        }
    }

    private updateSkipButtonState(): void {
        if (!this.skipButton) {
            return;
        }

        this.skipButton.interactable = true;
        const opacity = this.skipButton.node.getComponent(UIOpacity)
            ?? this.skipButton.node.addComponent(UIOpacity);
        opacity.opacity = this.isSkipping ? 255 : 170;
        this.skipButton.node.setScale(this.isSkipping ? 0.96 : 1, this.isSkipping ? 0.96 : 1, 1);
    }

    private clearAdvanceSchedules(): void {
        this.unschedule(this.advanceAfterSkip);
        this.unschedule(this.advanceAfterAutoPlay);
    }

    private readonly advanceAfterSkip = () => {
        if (!this.isSkipping || this._choiceActive) {
            return;
        }
        this.onClickNext();
    };

    private readonly advanceAfterAutoPlay = () => {
        if (this._choiceActive || this.isSkipping) {
            return;
        }
        this.onClickNext();
    };
}
