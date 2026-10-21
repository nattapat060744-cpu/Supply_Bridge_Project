import { NextResponse } from 'next/server';

/**
 * แปลงค่าเป็นตัวเลขอย่างปลอดภัย ถ้าแปลงไม่ได้จะคืน fallback
 */
export function toSafeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** บังคับให้ตัวเลขไม่ติดลบ */
export function toSafeNonNegativeNumber(value: unknown, fallback = 0): number {
  const n = toSafeNumber(value, fallback);
  return n < 0 ? fallback : n;
}

/** ตัด string ให้ปลอดภัย กัน undefined/null และความยาวเกินจำเป็น */
export function toSafeString(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

/**
 * ห่อ error ไม่ให้รายละเอียด internal หลุดไปให้ client
 */
export function safeErrorResponse(error: unknown, context: string, status = 500) {
  if(error instanceof Error && 'code' in error){
    if(error.code==='40001')return NextResponse.json({success:false,message:'รายการนี้มีการเปลี่ยนแปลงแล้ว กรุณารีเฟรชก่อนบันทึกอีกครั้ง'},{status:409});
    if(error.code==='22023')return NextResponse.json({success:false,message:'ข้อมูลไม่ถูกต้อง หรือมีรายการซ้ำ กรุณาตรวจจำนวนและรายการก่อนบันทึก'},{status:400});
    if(error.code==='23505')return NextResponse.json({success:false,message:'มีข้อมูลนี้ในระบบแล้ว กรุณาตรวจสอบรายการซ้ำ'},{status:409});
    if(error.code==='P0002')return NextResponse.json({success:false,message:'ไม่พบรายการนี้ กรุณารีเฟรชข้อมูล'},{status:404});
  }
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { success: false, error: 'INTERNAL_ERROR', message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบครับ' },
    { status }
  );
}

/** ตรวจว่า body ที่ส่งมามี field ที่ต้องการครบ */
export function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return f;
    }
  }
  return null;
}
