import { webcrypto } from 'node:crypto';

const HASH_PREFIX = 'pbkdf2';
const DEFAULT_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

globalThis.crypto ??= webcrypto;

function bytesToBase64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

async function derivePasswordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', textBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await derivePasswordHash(password, salt, iterations);
  return [HASH_PREFIX, String(iterations), bytesToBase64url(salt), bytesToBase64url(hash)].join('$');
}

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}

console.log(await hashPassword(password));
