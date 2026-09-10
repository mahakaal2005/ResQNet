import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from './password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = pathToFileURL(path.resolve(__dirname, '../../../../database/seeds/seed.mjs')).href;

/**
 * database/seeds/seed.mjs is plain JavaScript so it runs with a bare `node`,
 * which means it re-implements the scrypt encoding in password.ts. This test
 * is the thing that stops the two drifting: if the seed ever writes a hash the
 * API cannot verify, every seeded account silently stops being able to log in.
 */
describe('seed script password compatibility', () => {
  it('produces hashes the API can verify', async () => {
    const { hashPassword, DEMO_PASSWORD } = await import(SEED);

    const stored = await hashPassword(DEMO_PASSWORD);
    expect(await verifyPassword(DEMO_PASSWORD, stored)).toBe(true);
    expect(await verifyPassword('not-the-demo-password', stored)).toBe(false);
  });
});
