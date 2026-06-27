import { JsonAsset } from 'cc';
import { resourceUtil } from '../client/Script/easyFramework/mgr/resourceUtil';
import { LocaleManager } from '../client/Script/mgr/LocaleManager';

export interface DialogChoice {
    text: string;                 // option text
    targetDialogId: string;       // target dialog id after selection
    targetLineIndex?: number;     // optional target line index in current dialog
    condition?: string;           // optional condition expression
    textColor?: string;           // hex text color, for example "#FFFFFF"
    bgPath?: string;              // choice button background resource path
}

export interface DialogLine {
    name: string;                 // speaker name
    text: string;                 // dialog content
    avatarPath?: string;          // avatar spriteFrame path
    isFlashback?: boolean;        // flashback style flag
    voicePath?: string;           // voice path, for example "bundle|path/to/voice"
    sfxPath?: string;             // sfx path
    nextDialogId?: string;        // next dialog id after this line
    choices?: DialogChoice[];     // branch choices on this line
    params?: Record<string, string>; // parameter replacements
}

export interface DialogDefinition {
    id: string;
    lines: DialogLine[];
    locale?: string;
}

export class DialogConfig {
    private static _dialogs: Record<string, DialogDefinition> = {
        intro_1_zh: {
            id: 'intro_1',
            locale: 'zh',
            lines: [
                {
                    name: '主角',
                    text: '……这里是第一句对话内容。',
                    avatarPath: 'avatar/hero1',
                    voicePath: 'resources|audio/dialog_hero1_1',
                },
                {
                    name: '同伴',
                    text: '这是第二句回复，对话继续进行。',
                    avatarPath: 'avatar/hero2',
                    sfxPath: 'resources|audio/dialog_type',
                },
                {
                    name: '主角',
                    text: '这一句是回忆中的内容，会用回忆效果展示。',
                    avatarPath: 'avatar/hero1',
                    isFlashback: true,
                    nextDialogId: 'intro_2',
                },
            ],
        },
        intro_1_en: {
            id: 'intro_1',
            locale: 'en',
            lines: [
                {
                    name: 'Hero',
                    text: '...This is the first line.',
                    avatarPath: 'avatar/hero1',
                },
                {
                    name: 'Companion',
                    text: 'This is the second reply, the dialogue goes on.',
                    avatarPath: 'avatar/hero2',
                },
            ],
        },
    };

    public static registerDialog(dialog: DialogDefinition) {
        const key = this.makeKey(dialog.id, dialog.locale ?? LocaleManager.locale);
        this._dialogs[key] = dialog;
    }

    public static registerDialogs(dialogs: DialogDefinition[]) {
        if (!Array.isArray(dialogs)) return;
        for (const dialog of dialogs) {
            this.registerDialog(dialog);
        }
    }

    private static makeKey(dialogId: string, locale: string) {
        return `${dialogId}_${locale}`;
    }

    public static getDialog(id: string): DialogDefinition | null {
        const keys = [
            this.makeKey(id, LocaleManager.locale),
            id,
        ];

        for (const key of keys) {
            const item = this._dialogs[key];
            if (item) {
                return JSON.parse(JSON.stringify(item));
            }
        }

        return null;
    }

    public static loadFromJson(bundlePath: string, callback?: (success: boolean, error?: Error) => void): void {
        resourceUtil.loadResWithBundle(bundlePath, JsonAsset, (err, asset) => {
            if (err || !asset || !asset.json) {
                console.error('[DialogConfig] loadFromJson failed', bundlePath, err);
                callback?.(false, err || new Error('Invalid JsonAsset'));
                return;
            }

            try {
                const data = asset.json as any;
                const dialogs = Array.isArray(data.dialogs) ? data.dialogs : [];
                this.registerDialogs(dialogs);
                callback?.(true);
            } catch (e) {
                console.error('[DialogConfig] loadFromJson parse failed', e);
                callback?.(false, e as Error);
            }
        });
    }

    public static async loadFromRemote(url: string, callback?: (success: boolean, error?: Error) => void): Promise<void> {
        if (!url) {
            callback?.(false, new Error('url cannot be empty'));
            return;
        }

        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const dialogs = Array.isArray(data.dialogs) ? data.dialogs : [];
            this.registerDialogs(dialogs);
            callback?.(true);
        } catch (e) {
            console.error('[DialogConfig] loadFromRemote failed', url, e);
            callback?.(false, e as Error);
        }
    }

    public static clearAll() {
        this._dialogs = {};
    }
}
