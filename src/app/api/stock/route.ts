import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

const getSheet = async () => {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
  await doc.loadInfo();
  return doc.sheetsByTitle['Orders'];
};

export async function GET() {
  try {
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    
    const allItems = rows
      .filter(r => {
        const status = r.get('Status')?.toString().trim().toUpperCase();
        return status === 'ORDERED' || status === 'COMPLETED';
      })
      .map(r => ({
        rowId: r.rowNumber,
        groupId: r.get('Group_ID'),
        productID: r.get('Product_ID'),
        productName: r.get('Product_Name'),
        orderCarton: r.get('Order_Carton'),
        cartonUnit: r.get('Carton_Unit'),
        qtyPerCarton: r.get('Qty_Per_Carton'),
        innerUnit: r.get('Inner_Unit'),
        supplier: r.get('Supplier'),
        notePur: r.get('Note_Purchase'),
        imageUrl: r.get('Image_URL') || '',
        recvCarton: r.get('Recv_Carton'),
        Recv_Qty: r.get('Recv_Qty'),
        Note_Stock: r.get('Note_Stock'),
        Recv_Date: r.get('Recv_Date') || '', 
        status: r.get('Status')?.toString().trim().toUpperCase()
      }));

    return NextResponse.json(allItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.rowNumber === body.rowId);

    if (row) {
      // 1. บันทึกชื่อผู้รับ (ถ้ามีส่งมา เช่น การตรวจรับครั้งแรก)
      if (body.receiver) {
        row.set('Receiver_Name', body.receiver);
      }
      
      // 2. บันทึกจำนวนลัง (ใช้ค่าที่คำนวณสุทธิมาจากหน้าบ้านแล้ว)
      if (body.recvCarton !== undefined) {
        row.set('Recv_Carton', body.recvCarton);
      }
      
      // 3. หน่วยลัง (ดึงจากต้นทางเสมอ)
      row.set('Recv_Unit', row.get('Carton_Unit'));
      
      // 4. บันทึกจำนวนเศษในกล่อง (ใช้ค่าที่คำนวณสุทธิมาจากหน้าบ้านแล้ว)
      if (body.Recv_Qty !== undefined) {
        row.set('Recv_Qty', body.Recv_Qty);
      }
      
      // 5. หน่วยเศษ (ดึงจากต้นทางเสมอ)
      row.set('Recv_Qty_Unit', row.get('Inner_Unit'));
      
      // 6. บันทึกหมายเหตุ **จุดนี้สำคัญมาก**
      // หน้าบ้านจะส่ง Note_Stock ที่รวมประวัติ [แก้ไข: ลัง +1...] มาให้แล้ว บันทึกทับได้เลย
      if (body.Note_Stock !== undefined) {
        row.set('Note_Stock', body.Note_Stock);
      }
      
      // 7. สถานะเป็น COMPLETED เสมอ
      row.set('Status', 'COMPLETED'); 

      // 8. บันทึกวันที่อัปเดตล่าสุด
      // ใช้ค่าที่ส่งมาจากหน้าบ้านเพื่อให้เวลาใน UI กับใน Sheet ตรงกัน
      const thaiDate = body.Recv_Date || new Date().toLocaleDateString('th-TH');
      row.set('Recv_Date', thaiDate);

      await row.save();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}