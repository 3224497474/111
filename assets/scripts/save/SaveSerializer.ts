type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

const TYPE_FIELD = '__saveType';

export class SaveSerializer {
  public static serialize<T>(value: T): JsonLike {
    return this.serializeValue(value, new WeakSet<object>());
  }

  public static deserialize<T>(value: JsonLike): T {
    return this.deserializeValue(value) as T;
  }

  private static serializeValue(value: unknown, seen: WeakSet<object>): JsonLike {
    if (value == null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return {
        [TYPE_FIELD]: 'Date',
        value: value.toISOString(),
      };
    }

    if (value instanceof Map) {
      return {
        [TYPE_FIELD]: 'Map',
        entries: Array.from(value.entries()).map(([key, entryValue]) => [
          this.serializeValue(key, seen),
          this.serializeValue(entryValue, seen),
        ]) as unknown as JsonLike,
      };
    }

    if (value instanceof Set) {
      return {
        [TYPE_FIELD]: 'Set',
        values: Array.from(value.values()).map((entryValue) => this.serializeValue(entryValue, seen)),
      };
    }

    if (Array.isArray(value)) {
      return value.map((entryValue) => this.serializeValue(entryValue, seen));
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        throw new Error('Save data contains circular references and cannot be serialized.');
      }

      seen.add(value);
      const result: { [key: string]: JsonLike } = {};
      for (const [key, entryValue] of Object.entries(value)) {
        result[key] = this.serializeValue(entryValue, seen);
      }
      seen.delete(value);
      return result;
    }

    return String(value);
  }

  private static deserializeValue(value: JsonLike): unknown {
    if (value == null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entryValue) => this.deserializeValue(entryValue));
    }

    const typedValue = value as { [key: string]: JsonLike };
    const saveType = typeof typedValue[TYPE_FIELD] === 'string' ? typedValue[TYPE_FIELD] : '';

    if (saveType === 'Date' && typeof typedValue.value === 'string') {
      return new Date(typedValue.value);
    }

    if (saveType === 'Map' && Array.isArray(typedValue.entries)) {
      const map = new Map<unknown, unknown>();
      for (const pair of typedValue.entries) {
        if (!Array.isArray(pair) || pair.length < 2) {
          continue;
        }
        map.set(this.deserializeValue(pair[0]), this.deserializeValue(pair[1]));
      }
      return map;
    }

    if (saveType === 'Set' && Array.isArray(typedValue.values)) {
      const set = new Set<unknown>();
      for (const entryValue of typedValue.values) {
        set.add(this.deserializeValue(entryValue));
      }
      return set;
    }

    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(typedValue)) {
      result[key] = this.deserializeValue(entryValue);
    }
    return result;
  }
}
