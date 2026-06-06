import { JsonAsset, error, resources } from 'cc';
import { Tables } from '../schema/schema';

export class ConfigManager {
    public static tables: Tables;

    private static loadPromise: Promise<void> | null = null;

    public static async loadAllConfigs(): Promise<void> {
        if (this.tables) {
            return;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        const pendingLoad = new Promise<void>((resolve, reject) => {
            resources.loadDir('config', JsonAsset, (err, assets) => {
                if (err) {
                    error('[ConfigManager] Failed to load config directory.', err);
                    reject(err);
                    return;
                }

                try {
                    const configMap = new Map<string, any>();

                    for (const asset of assets) {
                        configMap.set(asset.name, asset.json);
                    }

                    this.tables = new Tables((fileName: string) => configMap.get(fileName));
                    resolve();
                } catch (loadError) {
                    error('[ConfigManager] Failed to initialize Luban tables.', loadError);
                    reject(loadError);
                }
            });
        });

        this.loadPromise = pendingLoad;

        try {
            await pendingLoad;
        } catch (loadError) {
            this.tables = undefined as unknown as Tables;
            throw loadError;
        } finally {
            if (this.loadPromise === pendingLoad) {
                this.loadPromise = null;
            }
        }
    }

    public static async initConfig(): Promise<void> {
        await this.loadAllConfigs();
    }
}
