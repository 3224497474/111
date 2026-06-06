import { Base64Codec } from './Base64Codec';
import { GameStateSerializer } from './GameStateSerializer';
import {
  CURRENT_SAVE_VERSION,
  IDecodeSaveResult,
  IGameSave,
  ISaveEnvelope,
  SAVE_FORMAT,
} from './SaveTypes';

type MigrationFn = (payload: unknown, slotId: string) => unknown;

export class SaveDataCodec {
  private readonly migrations = new Map<number, MigrationFn>();

  constructor(
    private readonly currentVersion = CURRENT_SAVE_VERSION,
    private readonly encodeWithBase64 = true,
  ) {
    this.migrations.set(0, (payload, slotId) => this.migrateLegacySave(payload, slotId));
    this.migrations.set(1, (payload, slotId) => this.migrateVersionOneSave(payload, slotId));
  }

  public encode(slotId: string, save: IGameSave): string {
    const serializedSave = GameStateSerializer.serialize(save);
    const payloadJson = JSON.stringify(serializedSave);
    const encoding = this.encodeWithBase64 ? 'base64' : 'plain';
    const payload = this.encodeWithBase64 ? Base64Codec.encode(payloadJson) : payloadJson;

    const envelope: ISaveEnvelope = {
      format: SAVE_FORMAT,
      version: this.currentVersion,
      slotId,
      savedAt: Date.now(),
      encoding,
      checksum: '',
      payload,
    };
    envelope.checksum = this.computeChecksum(
      envelope.version,
      envelope.slotId,
      envelope.savedAt,
      envelope.encoding,
      envelope.payload,
    );

    return JSON.stringify(envelope);
  }

  public decode(raw: string, slotId: string): IDecodeSaveResult<IGameSave> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        data: null,
        upgraded: false,
        error: 'Save data is not valid JSON.',
      };
    }

    if (this.isEnvelope(parsed)) {
      if (parsed.version > this.currentVersion) {
        return {
          ok: false,
          data: null,
          upgraded: false,
          error: 'Save version is newer than the current game build.',
        };
      }

      const expectedChecksum = this.computeChecksum(
        parsed.version,
        parsed.slotId,
        parsed.savedAt,
        parsed.encoding,
        parsed.payload,
      );
      if (expectedChecksum !== parsed.checksum) {
        return {
          ok: false,
          data: null,
          upgraded: false,
          error: 'Save checksum mismatch.',
        };
      }

      if (parsed.slotId !== slotId) {
        return {
          ok: false,
          data: null,
          upgraded: false,
          error: 'Save slot mismatch.',
        };
      }

      let payloadJson = parsed.payload;
      if (parsed.encoding === 'base64') {
        try {
          payloadJson = Base64Codec.decode(parsed.payload);
        } catch {
          return {
            ok: false,
            data: null,
            upgraded: false,
            error: 'Save payload decode failed.',
          };
        }
      }

      try {
        const payload = JSON.parse(payloadJson);
        const decoded = GameStateSerializer.deserialize<unknown>(payload);
        const migrated = this.applyMigrations(decoded, parsed.version, slotId);
        const validated = this.validateSave(migrated, slotId);
        return {
          ok: !!validated,
          data: validated,
          upgraded: parsed.version !== this.currentVersion,
          error: validated ? undefined : 'Save payload shape is invalid.',
        };
      } catch {
        return {
          ok: false,
          data: null,
          upgraded: false,
          error: 'Save payload parse failed.',
        };
      }
    }

    const migrated = this.applyMigrations(parsed, 0, slotId);
    const validated = this.validateSave(migrated, slotId);
    return {
      ok: !!validated,
      data: validated,
      upgraded: true,
      error: validated ? undefined : 'Legacy save payload shape is invalid.',
    };
  }

  private applyMigrations(payload: unknown, fromVersion: number, slotId: string): unknown {
    let currentPayload = payload;
    let version = fromVersion;

    while (version < this.currentVersion) {
      const migration = this.migrations.get(version);
      if (!migration) {
        break;
      }

      currentPayload = migration(currentPayload, slotId);
      version += 1;
    }

    return currentPayload;
  }

  private migrateLegacySave(payload: unknown, slotId: string): IGameSave {
    const legacy = (payload ?? {}) as Partial<IGameSave>;
    const time = this.extractTimeState(legacy.time);

    return {
      id: typeof legacy.id === 'string' && legacy.id.length > 0 ? legacy.id : slotId,
      createdAt: typeof legacy.createdAt === 'number' ? legacy.createdAt : Date.now(),
      version: this.currentVersion,
      time,
      modules: {},
    };
  }

  private migrateVersionOneSave(payload: unknown, slotId: string): IGameSave {
    const save = this.validateSave(payload, slotId);
    return {
      id: save?.id ?? slotId,
      createdAt: save?.createdAt ?? Date.now(),
      version: this.currentVersion,
      time: save?.time ?? this.extractTimeState(null),
      modules: save?.modules ?? {},
    };
  }

  private validateSave(payload: unknown, slotId: string): IGameSave | null {
    const save = payload as Partial<IGameSave> | null;
    if (!save || typeof save !== 'object') {
      return null;
    }

    return {
      id: typeof save.id === 'string' && save.id.length > 0 ? save.id : slotId,
      createdAt: typeof save.createdAt === 'number' ? save.createdAt : Date.now(),
      version: typeof save.version === 'number' ? save.version : this.currentVersion,
      time: this.extractTimeState(save.time),
      modules: this.extractModules(save.modules),
    };
  }

  private extractTimeState(value: unknown): IGameSave['time'] {
    const time = (value ?? {}) as Record<string, unknown>;

    const slot = time.timeSlot;
    const normalizedTimeSlot = slot === 'morning' || slot === 'afternoon' || slot === 'evening'
      ? slot
      : 'morning';

    return {
      year: typeof time.year === 'number' ? time.year : 1,
      weekIndex: typeof time.weekIndex === 'number' ? time.weekIndex : 1,
      dayIndex: typeof time.dayIndex === 'number' ? time.dayIndex : 1,
      timeSlot: normalizedTimeSlot,
    };
  }

  private extractModules(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  private computeChecksum(
    version: number,
    slotId: string,
    savedAt: number,
    encoding: ISaveEnvelope['encoding'],
    payload: string,
  ): string {
    const source = `${version}|${slotId}|${savedAt}|${encoding}|${payload}`;
    let hash = 0x811c9dc5;

    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }

  private isEnvelope(value: unknown): value is ISaveEnvelope {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const envelope = value as Partial<ISaveEnvelope>;
    return envelope.format === SAVE_FORMAT
      && typeof envelope.version === 'number'
      && typeof envelope.slotId === 'string'
      && typeof envelope.savedAt === 'number'
      && (envelope.encoding === 'plain' || envelope.encoding === 'base64')
      && typeof envelope.checksum === 'string'
      && typeof envelope.payload === 'string';
  }
}
