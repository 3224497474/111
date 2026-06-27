import { UIManager, UIPanelId } from '../ui/UIManager';
import { DialogConfig, DialogDefinition } from './DialogConfig';
import { LocaleManager } from '../client/Script/mgr/LocaleManager';
import { GlobalProgressionSystem } from '../core/globalProgress/GlobalProgressionSystem';

export interface DialogSystemOptions {
    onFinish?: () => void;
    onError?: (err: Error) => void;
    locale?: string;
    autoPlay?: boolean;
    autoInterval?: number;
    skip?: boolean;
    params?: Record<string, string>;
    panelId?: UIPanelId;
}

export class DialogSystem {
    public static show(
        dialogId: string,
        onFinish?: () => void,
        options?: DialogSystemOptions,
    ): void {
        const opts: DialogSystemOptions = {
            onFinish,
            panelId: UIPanelId.Dialog,
            autoPlay: false,
            autoInterval: 1.2,
            skip: false,
            ...options,
        };

        if (opts.locale) {
            LocaleManager.setLocale(opts.locale);
        }

        const def: DialogDefinition | null = DialogConfig.getDialog(dialogId);
        if (!def) {
            const err = new Error(`[DialogSystem] dialog config not found: ${dialogId}`);
            console.warn(err.message);
            opts.onError?.(err);
            opts.onFinish?.();
            return;
        }

        GlobalProgressionSystem.instance.markDialogRead(dialogId);

        if (opts.skip) {
            opts.onFinish?.();
            return;
        }

        void UIManager.instance.openPopup(opts.panelId!, {
            dialogId,
            lines: def.lines,
            onFinish: opts.onFinish,
            autoPlay: opts.autoPlay,
            autoInterval: opts.autoInterval,
            params: opts.params,
        });
    }
}
