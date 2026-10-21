# ไฟล์พร้อมอัปโหลดเข้าโปรเจกต์เดิม

ตรวจเป้าหมายจาก Dashboard วันที่ 21 ตุลาคม 2569:

- Team: `aemori`
- Project: `spb_warehouse_administration`
- Project ID: `prj_29HwlzKEyyBx0tp4o3pd96NImnwE`
- Repository เดิม: `itamr1109-crypto/stock-system-pro`, production branch `main`
- โดเมนเดิม: `stock-system-pro.vercel.app`
- Root Directory: ราก repository; Framework: Next.js

## ตั้งค่าก่อน Deploy

1. ใน [Environment Variables ของโปรเจกต์](https://vercel.com/aemori/spb_warehouse_administration/settings/environment-variables) ตั้งค่าสำหรับ Production:

   | ชื่อ | ค่า |
   | --- | --- |
   | `SUPABASE_URL` | `https://hbjyxjwrwczgdmzfptns.supabase.co` |
   | `SUPABASE_SECRET_KEY` | server secret key ของ Supabase โปรเจกต์นี้ |
   | `SESSION_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวอักษร ใช้ค่าเดียวกันทุก instance ของ environment นี้ |
   | `ALLOW_LEGACY_PLAINTEXT_PASSWORDS` | `false` |

   ค่า key และ SESSION_SECRET เดิมอยู่ใน `.env.local` ของเครื่องนี้ ไม่รวมใน ZIP และไม่ต้องส่งในแชต ห้ามใช้ชื่อขึ้นต้น `NEXT_PUBLIC_` กับค่าลับ

   หากเปิด Preview ให้ใช้ Supabase สำหรับทดสอบแยกจาก Production เพื่อไม่ให้การทดสอบแก้ข้อมูลจริง

2. แทนที่ source ของ repository ด้วยไฟล์ในแพ็กเกจที่รากเดิม ไม่วางซ้อนเป็น `stock-system-supabase/src` หรือ `spb_warehouse_administration/src` อีกชั้น คงไฟล์ส่วนตัวที่ gitignore ไว้ในเครื่อง

3. ค่าที่เตรียมแล้ว: Install `npm ci`, Build `npm run build` (`next build --webpack`), Output `.next` ตาม Next.js อัตโนมัติ, Node `22.x` ใน `package.json` ซึ่ง override ค่า `24.x` ที่เลือกไว้ใน Dashboard ตามเอกสาร Vercel: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions

4. โค้ดรอบนี้เตรียมไว้แล้ว ยังไม่ได้ push หรือ deploy การ push `main` ของ repository ที่เชื่อมอยู่จะเปิด production deployment อัตโนมัติ ควร deploy และตรวจ Preview ด้วยฐานข้อมูลทดสอบก่อนปล่อย main

## ทางเลือก: Deploy จากเครื่องเข้าโปรเจกต์เดิม

แพ็กเกจมี `.vercel/project.json` เฉพาะรหัสโปรเจกต์ ไม่มี token หรือ environment ใช้บัญชีที่เข้าถึง team `aemori`:

```powershell
# หลังติดตั้ง Vercel CLI ทางการ และตั้ง Production environment ครบแล้ว
vercel --scope aemori project inspect spb_warehouse_administration
# รันคำสั่งนี้เมื่อพร้อมเผยแพร่จริง
vercel deploy --prod --scope aemori
```

ZIP นี้เป็น source ของ Next.js ไม่ใช่ static HTML ต้องแตกไฟล์ก่อนใช้ CLI หรืออัปโหลด source เข้า Git repository ที่ผูกกับโปรเจกต์เดิม

## ฐานข้อมูลและการเปลี่ยนแปลงรอบนี้

- `005_atomic_purchase.sql` และ `006_shared_notifications.sql` ติดตั้งใน Supabase โปรเจกต์นี้แล้ว ไม่ต้องรัน migration เริ่มต้นซ้ำ
- รับสินค้ารายบิล, bulk และ Import Excel ทั้งหมดส่งหนึ่ง request และบันทึกใน transaction เดียว ถ้ารายการใดผิดพลาดไม่มีรายการอื่นค้างบันทึก
- ตรวจ UUID/revision จำนวนไม่ติดลบ รายการซ้ำ และสถานะรับแล้วก่อนบันทึก พร้อมป้องกันการบันทึกจากหน้าจอเก่า
- สถานะอ่าน noti เก็บใน Supabase ตาม username จาก signed session เท่านั้น เครื่องอื่นซิงก์ทุก 30 วินาทีขณะแท็บเปิด หรือทันทีเมื่อกลับมาที่แท็บ คง unread เมื่อออฟไลน์
- ครั้งแรกของบัญชีบนระบบซิงก์จะตั้ง baseline เงียบ ข้อมูลประวัติเก่าไม่ถูกแจ้งเป็นอัปเดตใหม่
- SQL `verify_release.sql` ตรวจ rollback รับสินค้าทั้งชุด, บันทึกสำเร็จทั้งชุด, สถานะอ่านร่วมกันและปฏิเสธข้อมูลเก่า โดย rollback ข้อมูลทดสอบทั้งหมด
- ชุด API, unit tests และ production build ผ่านก่อนจัดแพ็กเกจ

## ตรวจหลัง Deploy

ล็อกอินบัญชีเดิม → เปิดจัดซื้อ/สต็อก/ประวัติ → ทดลองรับทั้งชุดในฐานข้อมูลทดสอบ → เปิดบัญชีเดียวกันบนสองเบราว์เซอร์และตรวจ read status ภายใน 30 วินาที → ตรวจ Logs ไม่มี 500

ขอบเขตรอบนี้แก้รับสินค้าแบบชุดและ noti ข้ามเครื่อง ระบบรีเซ็ตรหัสผ่านและ login rate limit ที่เก็บในหน่วยความจำยังเป็นข้อจำกัดเดิม ไม่ใช่การทดสอบโหลดหรือ security audit ครบระบบ
