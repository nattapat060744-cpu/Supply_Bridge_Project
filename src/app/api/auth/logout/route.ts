import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = Response.json({ success: true }, { status: 200 });
  // ลบ cookie จริงฝั่ง server (ไม่ใช่แค่ localStorage.removeItem ที่ฝั่ง client ทำเดิม)
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return res;
}
