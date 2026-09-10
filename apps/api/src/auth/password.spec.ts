import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('accepts the correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('resqnet-demo');
    expect(await verifyPassword('resqnet-demo', stored)).toBe(true);
    expect(await verifyPassword('resqnet-dem0', stored)).toBe(false);
  });

  it('salts, so the same password never produces the same hash twice', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('returns false instead of throwing on a malformed or empty stored hash', async () => {
    for (const stored of ['', 'not-a-hash', 'scrypt$only-one-part', 'bcrypt$a$b']) {
      expect(await verifyPassword('anything', stored)).toBe(false);
    }
  });
});
