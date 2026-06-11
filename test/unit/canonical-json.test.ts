import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/shared/canonical-json.js';

describe('canonicalJson', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('is independent of key insertion order', () => {
    const a = canonicalJson({ x: 1, y: [{ b: 2, a: 1 }] });
    const b = canonicalJson({ y: [{ a: 1, b: 2 }], x: 1 });
    expect(a).toBe(b);
  });

  it('omits undefined properties but keeps explicit null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('serializes undefined array elements as null (like JSON.stringify)', () => {
    expect(canonicalJson([1, undefined, 3])).toBe('[1,null,3]');
  });

  it('serializes Dates as ISO-8601 UTC milliseconds', () => {
    expect(canonicalJson(new Date('2026-06-11T10:00:00+02:00'))).toBe('"2026-06-11T08:00:00.000Z"');
  });

  it('normalizes -0 to 0', () => {
    expect(canonicalJson(-0)).toBe('0');
  });

  it('handles unicode strings deterministically', () => {
    expect(canonicalJson({ ş: 'günaydın', a: 'çay' })).toBe('{"a":"çay","ş":"günaydın"}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalJson(NaN)).toThrow();
    expect(() => canonicalJson(Infinity)).toThrow();
  });

  it('rejects functions and symbols', () => {
    expect(() => canonicalJson({ f: () => 1 }['f'])).toThrow();
  });
});
