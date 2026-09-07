import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// scrypt ships with Node, so the API image needs no native build step and the
// team's `docker compose up api` works on any machine. Parameters are the
// Node defaults (N=16384, r=8, p=1), encoded into the stored string so a
// future cost bump can be rolled out without invalidating existing hashes.
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PREFIX = 'scrypt';

/** Returns `scrypt$<salt-base64>$<hash-base64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_BYTES);
  return `${PREFIX}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Constant-time comparison. Returns false rather than throwing on a malformed hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = (stored ?? '').split('$');
  if (scheme !== PREFIX || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, 'base64');
  if (expected.length !== KEY_BYTES) return false;

  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), KEY_BYTES);
  return timingSafeEqual(actual, expected);
}
