import { describe, expect, it } from 'vitest';
import { DEV_JWT_SECRET, resolveJwtSecret } from './jwt.config.js';

/**
 * The Week-3 auth hardening item: the checked-in demo secret is public, so it
 * must not be able to sign a token in a deployment that thinks it is real.
 */
describe('resolveJwtSecret', () => {
  it('uses JWT_SECRET when one is set, in any environment', () => {
    expect(resolveJwtSecret('a-real-secret', 'production')).toBe('a-real-secret');
    expect(resolveJwtSecret('a-real-secret', 'development')).toBe('a-real-secret');
  });

  it('falls back to the demo secret when unset outside production', () => {
    expect(resolveJwtSecret(undefined, undefined)).toBe(DEV_JWT_SECRET);
    expect(resolveJwtSecret(undefined, 'development')).toBe(DEV_JWT_SECRET);
    // `docker compose up api` and the e2e suite both run without NODE_ENV set,
    // so this path has to keep working or the independent demo breaks.
    expect(resolveJwtSecret(undefined, 'test')).toBe(DEV_JWT_SECRET);
  });

  it('refuses to boot in production without an explicit secret', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(/JWT_SECRET must be set/);
  });

  it('treats an empty JWT_SECRET as unset rather than as a one-character key', () => {
    expect(() => resolveJwtSecret('', 'production')).toThrow(/JWT_SECRET must be set/);
    expect(resolveJwtSecret('', 'development')).toBe(DEV_JWT_SECRET);
  });
});
