import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from '../../src/plugins/auth.js';

describe('API key generation', () => {
  it('generates tenant keys with the ta_live_ prefix', () => {
    const key = generateApiKey('tenant');
    expect(key.secret).toMatch(/^ta_live_[0-9A-Za-z]{43}$/);
    expect(key.keyPrefix).toBe(key.secret.slice(0, 12));
  });

  it('generates admin keys with the ta_admin_ prefix', () => {
    const key = generateApiKey('admin');
    expect(key.secret).toMatch(/^ta_admin_[0-9A-Za-z]{43}$/);
  });

  it('stores only the sha256 of the secret', () => {
    const key = generateApiKey('tenant');
    expect(key.keyHash).toBe(hashApiKey(key.secret));
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.keyHash).not.toContain(key.secret.slice(8));
  });

  it('generates unique secrets', () => {
    const secrets = new Set(Array.from({ length: 100 }, () => generateApiKey('tenant').secret));
    expect(secrets.size).toBe(100);
  });
});
