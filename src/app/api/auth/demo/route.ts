import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

// เข้าใช้งานแบบเดโมเป็นแอดมินได้เลยโดยไม่ต้องใช้รหัสผ่าน
// เปิดใช้เฉพาะเมื่อตั้ง DEMO_MODE=true (ค่าเริ่มต้นปิด) เพื่อไม่ให้เว็บจริงถูกเข้าได้โดยไม่ล็อกอิน
export async function POST() {
  if (process.env.DEMO_MODE !== 'true') {
    return Response.json({ success: false, message: 'ไม่พบหน้าที่ต้องการ' }, { status: 404 });
  }

  const profile = { username: 'demo-admin', name: 'ผู้ใช้เดโม (แอดมิน)', department: 'ADMIN' };
  const token = await createSessionToken(profile);
  const res = Response.json({
    success: true,
    user: {
      ...profile,
      loginDate: new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
    },
  });
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
  return res;
}
