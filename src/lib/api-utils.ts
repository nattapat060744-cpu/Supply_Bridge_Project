import { NextResponse } from 'next/server';

/**
 * แปลงค่าเป็นตัวเลขอย่างปลอดภัย ถ้าแปลงไม่ได้ (NaN, undefined, ค่าว่าง ฯลฯ)
 * จะคืน fallback แทนการปล่อยให้ NaN ไหลลงไปบันทึกใน Google Sheet แบบเงียบๆ
 */
export function toSafeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** บังคับว่าตัวเลขต้องไม่ติดลบ (เช่น จำนวนสินค้า ลังที่สั่ง ฯลฯ ห้ามติดลบ) */
export function toSafeNonNegativeNumber(value: unknown, fallback = 0): number {
  const n = toSafeNumber(value, fallback);
  return n < 0 ? fallback : n;
}

/** ตัด string ให้ปลอดภัย กัน undefined/null และความยาวเกินจำเป็น (กัน payload ขนาดใหญ่ผิดปกติ) */
export function toSafeString(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

/**
 * ห่อ error ไม่ให้หลุดรายละเอียด internal (stack, library name, path) ออกไปให้ client
 * รายละเอียดจริงจะ log ไว้ฝั่ง server เท่านั้นสำหรับ debug
 */
export function safeErrorResponse(error: unknown, context: string, status = 500) {
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { success: false, error: 'INTERNAL_ERROR', message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบครับ' },
    { status }
  );
}

/** ตรวจว่า body ที่ส่งมามี field ที่ต้องการครบ ไม่ปล่อยให้ undefined ไหลเข้า business logic */
export function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return f;
    }
  }
  return null;
}
