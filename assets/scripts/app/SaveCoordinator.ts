import { SaveSerializer } from '../save/SaveSerializer';
import { SaveStorage } from '../save/SaveStorage';
import { SaveModuleRegistry } from '../save/modules/SaveModuleRegistry';
import type { IDirtySaveModule, ISaveModule } from '../save/modules/SaveModule';

interface ISaveEnvelope {
    version: number;
    updatedAt: number;
    modules: Record<string, unknown>;
}

export class SaveCoordinator {
    private static readonly STORAGE_VERSION = 1;

    private readonly moduleRegistry = new SaveModuleRegistry();
    private readonly modules = new Map<string, ISaveModule>();
    private readonly snapshotCache: Record<string, unknown> = {};
    private readonly storage: SaveStorage;
    private pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
    private isRestoring = false;

    constructor(private readonly storageKey: string, keyPrefix = 'game_facade_save_') {
        this.storage = new SaveStorage(keyPrefix);
    }

    public register(module: ISaveModule): void {
        this.modules.set(module.key, module);
        this.moduleRegistry.register(module);
    }

    public unregister(key: string): void {
        this.modules.delete(key);
        delete this.snapshotCache[key];
        this.moduleRegistry.unregister(key);
    }

    public hasSave(): boolean {
        return this.storage.hasItem(this.storageKey);
    }

    public requestSave(): void {
        if (this.isRestoring || this.pendingSaveTimer !== null) {
            return;
        }

        this.pendingSaveTimer = setTimeout(() => {
            this.pendingSaveTimer = null;
            this.save();
        }, 0);
    }

    public flushPendingSave(): boolean {
        if (this.pendingSaveTimer === null) {
            return false;
        }

        clearTimeout(this.pendingSaveTimer);
        this.pendingSaveTimer = null;
        return this.save();
    }

    public save(): boolean {
        if (this.isRestoring) {
            return false;
        }

        const modulesToCapture = this.getModulesToCapture();
        if (modulesToCapture.length === 0) {
            return true;
        }

        this.captureChangedModules(modulesToCapture);
        const envelope: ISaveEnvelope = {
            version: SaveCoordinator.STORAGE_VERSION,
            updatedAt: Date.now(),
            modules: { ...this.snapshotCache },
        };

        try {
            const serialized = SaveSerializer.serialize(envelope);
            const saved = this.storage.setItem(this.storageKey, JSON.stringify(serialized));
            if (saved) {
                this.clearDirtyModules(modulesToCapture);
            }
            return saved;
        } catch (error) {
            console.error('[SaveCoordinator] save failed:', error);
            return false;
        }
    }

    public load(serverSnapshot?: Record<string, unknown> | null): boolean {
        if (this.pendingSaveTimer !== null) {
            clearTimeout(this.pendingSaveTimer);
            this.pendingSaveTimer = null;
        }

        try {
            const envelope = serverSnapshot
                ? this.deserializeExternalSnapshot(serverSnapshot)
                : this.readLocalEnvelope();
            if (!envelope) {
                return false;
            }
            const modules = this.getModuleSnapshots(envelope);

            Object.keys(this.snapshotCache).forEach((key) => {
                delete this.snapshotCache[key];
            });
            Object.assign(this.snapshotCache, modules);

            this.isRestoring = true;
            try {
                this.moduleRegistry.restoreAll(this.snapshotCache);
            } finally {
                this.isRestoring = false;
            }

            this.clearDirtyFlags();
            return true;
        } catch (error) {
            this.isRestoring = false;
            console.error('[SaveCoordinator] load failed:', error);
            return false;
        }
    }

    public clear(): void {
        if (this.pendingSaveTimer !== null) {
            clearTimeout(this.pendingSaveTimer);
            this.pendingSaveTimer = null;
        }
        this.storage.removeItem(this.storageKey);
    }

    public refreshSnapshotCache(): void {
        this.captureChangedModules(Array.from(this.modules.values()));
    }

    public clearDirtyFlags(): void {
        this.clearDirtyModules(this.getDirtyAwareModules());
    }

    private captureChangedModules(modules: ISaveModule[]): void {
        for (const module of modules) {
            const snapshot = module.capture();
            if (snapshot === undefined) {
                continue;
            }
            this.snapshotCache[module.key] = snapshot ?? null;
        }
    }

    private getModulesToCapture(): ISaveModule[] {
        const dirtyAwareModules = this.getDirtyAwareModules();
        if (dirtyAwareModules.length > 0) {
            return dirtyAwareModules.filter((module) => module.isDirty());
        }

        return Array.from(this.modules.values());
    }

    private getDirtyAwareModules(): IDirtySaveModule[] {
        return Array.from(this.modules.values()).filter((module): module is IDirtySaveModule => this.isDirtyModule(module));
    }

    private clearDirtyModules(modules: ISaveModule[]): void {
        modules.forEach((module) => {
            if (this.isDirtyModule(module)) {
                module.clearDirty();
            }
        });
    }

    private isDirtyModule(module: ISaveModule): module is IDirtySaveModule {
        return typeof (module as IDirtySaveModule).isDirty === 'function'
            && typeof (module as IDirtySaveModule).markDirty === 'function'
            && typeof (module as IDirtySaveModule).clearDirty === 'function';
    }

    private getModuleSnapshots(envelope: ISaveEnvelope): Record<string, unknown> {
        if (!envelope || typeof envelope !== 'object') {
            return {};
        }

        if (typeof envelope.version !== 'number') {
            return {};
        }

        return envelope.modules && typeof envelope.modules === 'object'
            ? envelope.modules
            : {};
    }

    private readLocalEnvelope(): ISaveEnvelope | null {
        const raw = this.storage.getItem(this.storageKey);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        return SaveSerializer.deserialize<ISaveEnvelope>(parsed);
    }

    private deserializeExternalSnapshot(serverSnapshot: Record<string, unknown>): ISaveEnvelope {
        const candidate = serverSnapshot as Partial<ISaveEnvelope>;
        if (candidate.modules && typeof candidate.modules === 'object') {
            return {
                version: typeof candidate.version === 'number'
                    ? candidate.version
                    : SaveCoordinator.STORAGE_VERSION,
                updatedAt: Date.now(),
                modules: candidate.modules as Record<string, unknown>,
            };
        }

        return {
            version: SaveCoordinator.STORAGE_VERSION,
            updatedAt: Date.now(),
            modules: serverSnapshot,
        };
    }
}
