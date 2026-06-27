// 全局语言管理器
// assets/scripts/X/client/Script/mgr/LocaleManager.ts
import { sys } from 'cc';

export type LocaleCode = 'zh' | 'en' | string;

const STORAGE_KEY = 'app_locale';

type LocaleChangeListener = (locale: LocaleCode) => void;

class LocaleManagerClass {
    private _locale: LocaleCode = 'zh';
    private _listeners: LocaleChangeListener[] = [];

    /** 初始化，从本地存储读取上次设置，应在游戏启动时调用 */
    public init(defaultLocale: LocaleCode = 'zh') {
        const saved = sys.localStorage.getItem(STORAGE_KEY);
        this._locale = saved || defaultLocale;
    }

    public get locale(): LocaleCode {
        return this._locale;
    }

    /** 设置语言，持久化到本地存储，并通知所有监听者 */
    public setLocale(locale: LocaleCode) {
        if (!locale || locale === this._locale) return;
        this._locale = locale;
        sys.localStorage.setItem(STORAGE_KEY, locale);
        this._notifyAll();
    }

    /** 注册语言变更监听，返回取消注册函数 */
    public onChange(listener: LocaleChangeListener): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter(l => l !== listener);
        };
    }

    private _notifyAll() {
        for (const fn of this._listeners) {
            try { fn(this._locale); } catch (e) { console.error('[LocaleManager] listener error', e); }
        }
    }
}

export const LocaleManager = new LocaleManagerClass();
