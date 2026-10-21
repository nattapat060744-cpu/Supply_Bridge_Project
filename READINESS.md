# ตรวจความพร้อมก่อนเปิดใช้ — 21 ตุลาคม 2569

## แก้แล้ว

- การแก้ไข/ลบจากหน้าธุรการคลัง จัดซื้อ และรับสินค้า ส่ง UUID และ revision ของข้อมูลที่ผู้ใช้เห็น ปฏิเสธ HTTP 409 เมื่อข้อมูลเปลี่ยนก่อนบันทึก
- เลือกแถวด้วย UUID แทนรหัสสินค้ากับกลุ่มที่อาจซ้ำ และไม่ fallback ไปแถวอื่นเมื่อ UUID ที่ระบุไม่พบ
- จัดซื้อ PATCH บันทึกทั้งบิลใน transaction (`005_atomic_purchase.sql`) กรณีขัดแย้งไม่ค้างบางรายการ; POST สร้างทั้งบิลใน RPC เดียว
- จัดซื้อไม่ล้าง Note_Request/Note_Stock ที่ไม่ได้ส่ง และหน้าจออ่าน Note_Purchase ผ่านชื่อฟิลด์ notePur ได้ถูกต้อง
- การปรับยอดของรายการรับแล้วส่งสถานะ COMPLETED จึงแก้ไขได้ตามสิทธิ์
- ฝ่าย STOCK อ่าน /api/purchase ได้ แต่ยังเขียนรายการจัดซื้อไม่ได้
- Excel ค้นหาหัวตารางจริง รองรับไฟล์ส่งออกทั้งสองแบบ เก็บ UUID/revision และอ่านเลขบิลได้ทั้งสองชื่อคอลัมน์ ไฟล์เก่าที่ไม่มี revision ต้องดาวน์โหลดใหม่
- ลดการโหลดหน้า stock/purchase ซ้ำจากสอง effects, stock แจ้งข้อผิดพลาดจาก API แทนแสดงเหมือนไม่มีข้อมูล
- ตรวจ Origin ของคำขอเขียน, ใช้เส้นทาง public แบบตรงตัว, ตรวจโครงสร้างและอายุ session และความยาว SESSION_SECRET
- อัปเดต Next.js เป็น 16.4.2, SheetJS เป็น 0.20.3 จาก CDN ผู้ผลิต, dependencies ที่แก้ได้ และ uuid ของ ExcelJS เป็น 11.1.1

## ตรวจผ่าน

- Production build + TypeScript หลังการแก้ทั้งหมด
- API เดิม 24 กรณี และ verify-readiness.mjs: stale edit/delete, stock conflicts, batch preflight/duplicate, สิทธิ์และ Origin; ไม่แก้ข้อมูลจริง
- ฐานข้อมูลจริง: verify_atomic.sql บันทึกสำเร็จ/ยกเลิกทั้งบิล/คงหมายเหตุ/จำกัดสิทธิ์ แล้ว rollback ข้อมูลทดสอบทั้งหมด หลักฐาน supabase/atomic-verification.png
- Noti 27 กรณี, cache invalidation race, วันที่ไทย และ failed/partial response
- Excel ส่งออก/อ่านกลับทั้งสองรูปแบบ, ยอดรับศูนย์, UUID/revision, invoice และ ExcelJS round trip
- npm audit --omit=dev: 0 vulnerabilities หลังอัปเดต ผล .private/dependency-audit-final.json; audit รวมเครื่องมือพัฒนายังมี 5 high จาก braces → ESLint dependencies ไม่มี safe fix ในช่วงรุ่นปัจจุบัน
- ตรวจหน้าจัดซื้อ สต็อก และประวัติผ่านเบราว์เซอร์

## ข้อจำกัดก่อนเปิดจริง

- แก้เพิ่มแล้ว: รับสินค้ารายบิล, bulk และ Import Excel บันทึกทั้งชุดใน transaction เดียว ตรวจ rollback และ successful receipt batch บน Supabase จริงแล้ว
- ระบบขอรหัสผ่านใหม่ปัจจุบันบันทึก/อนุมัติคำขอ แต่ action GENERATE ไม่ได้สร้างหรือเปลี่ยน credential จริง ต้องทำขั้นตอนยืนยันตัวตนและเปลี่ยนรหัสผ่านให้ครบก่อนเปิดฟังก์ชันนี้
- ยังไม่ทดสอบโหลดหลายผู้ใช้พร้อมกันบนโฮสต์จริง และยังไม่ใช่การตรวจความปลอดภัยครบระบบ
- Login rate limit ยังอยู่ในหน่วยความจำของแต่ละ instance; แก้ noti แล้วให้เก็บ read status ใน Supabase ตามบัญชี ซิงก์ข้ามเครื่องทุก 30 วินาทีและเมื่อกลับมาที่แท็บ มี CAS ป้องกัน stale state และเก็บ unread เมื่อ offline
- ยังเป็นเว็บ local ที่พอร์ต 3002 ไม่มีการ deploy รอบนี้ ก่อนเปิดภายนอกต้องตั้ง environment/HTTPS และตรวจ backup/restore บนโฮสต์ที่จะใช้

เอกสารติดตั้ง SheetJS: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/


แพ็กเกจ Vercel: ดู DEPLOY-VERCEL.md โปรเจกต์ aemori/spb_warehouse_administration เตรียม Node22 และ npm ci + npm run build แล้ว ยังไม่ deploy
