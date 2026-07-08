const HASH_PREFIX = 'pbkdf2';
const DEFAULT_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToBase64url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textBytes(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return bytes;
}

function timingSafeEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', textBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  crypto.getRandomValues(salt);
  const hash = await derivePasswordHash(password, salt, iterations);
  return [HASH_PREFIX, String(iterations), bytesToBase64url(salt), bytesToBase64url(hash)].join('$');
}

export async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  const stored = storedPassword.trim();
  const parts = stored.split('$');

  if (parts.length === 4 && parts[0] === HASH_PREFIX) {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100_000) return false;

    const salt = base64urlToBytes(parts[2]);
    const expected = base64urlToBytes(parts[3]);
    const actual = await derivePasswordHash(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  }

  if (process.env.ALLOW_LEGACY_PLAINTEXT_PASSWORDS === 'false') {
    return false;
  }

  return stored === password.trim();
}
