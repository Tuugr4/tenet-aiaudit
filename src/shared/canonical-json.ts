/**
 * Canonical JSON serialization for hash-chain records.
 *
 * Rules (must never change once records exist — this is the hashing contract):
 *  - Object keys sorted lexicographically (code-unit order), recursively.
 *  - No whitespace.
 *  - `undefined` properties omitted entirely; explicit `null` is preserved.
 *  - Date instances serialized as ISO-8601 UTC with millisecond precision.
 *  - Numbers serialized via JSON.stringify (no -0, no NaN/Infinity — those throw).
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize non-finite number');
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'object':
      break;
    default:
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Cannot canonicalize invalid Date');
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serialize(v === undefined ? null : v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`);
  return `{${parts.join(',')}}`;
}
