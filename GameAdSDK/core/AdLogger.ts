import { GameAdInitConfig, GameAdLogLevel } from "../GameAdTypes";

export class AdLogger {
    private static config: GameAdInitConfig | null = null;

    /**
     * 注入日志配置，支持外部替换日志上报函数。
     */
    public static init(config: GameAdInitConfig): void {
        this.config = config;
    }

    /**
     * 输出调试日志，仅 debug=true 时生效。
     */
    public static debug(message: string, data?: unknown): void {
        this.log("debug", message, data);
    }

    /**
     * 输出普通信息日志。
     */
    public static info(message: string, data?: unknown): void {
        this.log("info", message, data);
    }

    /**
     * 输出警告日志。
     */
    public static warn(message: string, data?: unknown): void {
        this.log("warn", message, data);
    }

    /**
     * 输出错误日志。
     */
    public static error(message: string, data?: unknown): void {
        this.log("error", message, data);
    }

    /**
     * 统一日志出口，后续接入远程埋点时只需要替换这里或传入 logger。
     */
    private static log(level: GameAdLogLevel, message: string, data?: unknown): void {
        const config = this.config;
        if (!config?.debug && level == "debug") {
            return;
        }

        if (config?.logger) {
            config.logger(level, message, data);
            return;
        }

        const text = `[GameAd][${level}] ${message}`;
        if (level == "error") {
            console.error(text, data || "");
        } else if (level == "warn") {
            console.warn(text, data || "");
        } else {
            console.log(text, data || "");
        }
    }
}
