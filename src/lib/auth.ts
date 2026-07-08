export interface SessionPayload {
  username: string;
  name: string;
  department: string;
  iat: number; // issued at (ms)
  exp: number; // expires at (ms)
}

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // ป้องกันการรันแบบไม่มี secret โดยไม่รู้ตัว (จะ sign ด้วย key ที่เดาได้)
    throw new Error(
      'Missing SESSION_SECRET in environment variables. กรุณาตั้งค่า SESSION_SECRET ใน .env.local (ความยาวอย่างน้อย 32 ตัวอักษร)'
    );
  }
  return secret;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function strToBytes(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const buf = new Uint8Array(new ArrayBuffer(encoded.length));
  buf.set(encoded);
  return buf;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function strToArrayBuffer(str: string): ArrayBuffer {
  return bytesToArrayBuffer(strToBytes(str));
}

// Web Crypto API ใช้ได้ทั้งใน Node.js runtime และ Edge runtime (middleware)
// ต่างจาก require('crypto') ของ Node ที่ใช้ใน Edge middleware ไม่ได้
async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    strToArrayBuffer(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(data: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, strToArrayBuffer(data));
  return base64url(new Uint8Array(signature));
}

async function verify(data: string, signature: string): Promise<boolean> {
  const key = await getHmacKey();
  try {
    return await crypto.subtle.verify(
      'HMAC',
      key,
      bytesToArrayBuffer(base64urlToBytes(signature)),
      strToArrayBuffer(data)
    );
  } catch {
    return false;
  }
}

/** สร้าง token ลงนามด้วย HMAC สำหรับเก็บใน cookie (ไม่ใช่ JWT มาตรฐาน แต่หลักการเดียวกัน) */
export async function createSessionToken(user: { username: string; name: string; department: string }): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = {
    username: user.username,
    name: user.name,
    department: (user.department || '').toUpperCase(),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadStr = base64url(strToBytes(JSON.stringify(payload)));
  const signature = await sign(payloadStr);
  return `${payloadStr}.${signature}`;
}

/** ตรวจสอบและ decode token จาก cookie คืนค่า null ถ้าไม่ถูกต้อง/หมดอายุ/ถูกแก้ไข */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;

  const isValid = await verify(payloadStr, signature);
  if (!isValid) return null;

  try {
    const payload: SessionPayload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadStr)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
