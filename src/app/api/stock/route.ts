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
        // 🔥 ดึงมาทั้งคู่เพื่อให้หน้าบ้านคำนวณตัวแจ้งเตือนส่วนต่างได้
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
        status: r.get('Status')?.toString().trim().toUpperCase(),
        Created_At: r.get('Created_At') || r.get('Date') || '',
        Created_At_P: r.get('Created_At_P') || r.get('Date_P') || '',
        invoiceNo: r.get('Invoice_No') || r.get('เลขที่บิล') || '' 
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
    
    // 1. ค้นหาแถวด้วย rowNumber
    const row: any = rows.find(r => r.rowNumber === body.rowId);

    if (row) {
      // เช็คสถานะปัจจุบัน (ยกเว้นกรณีสั่ง Force Complete ซ้ำเพื่อแก้ไข Note)
      const currentStatus = row.get('Status')?.toString().trim();
      if (currentStatus === 'COMPLETED' && body.status !== 'COMPLETED') {
        return NextResponse.json({ 
          success: false, 
          message: `รายการแถวที่ ${body.rowId} นี้ถูกบันทึกไปแล้ว ไม่สามารถ Import ซ้ำได้ครับพี่ชาย` 
        }, { status: 400 });
      }

      // 2. อัปเดตข้อมูลที่ส่งมาจากหน้าบ้าน
      if (body.receiver !== undefined) row.set('Receiver_Name', body.receiver);
      if (body.recvCarton !== undefined) row.set('Recv_Carton', body.recvCarton);
      if (body.Recv_Qty !== undefined) row.set('Recv_Qty', body.Recv_Qty);
      
      // 🔥 บันทึก Note_Stock ให้แม่นยำ
      if (body.Note_Stock !== undefined) row.set('Note_Stock', body.Note_Stock);
      
      // 3. เปลี่ยนสถานะและหน่วย
      row.set('Status', 'COMPLETED');
      row.set('Recv_Unit', row.get('Carton_Unit') || '');
      row.set('Recv_Qty_Unit', row.get('Inner_Unit') || '');
      row.set('Recv_Date', body.Recv_Date || new Date().toLocaleString('th-TH')); 

      // 4. บันทึกเลขที่บิล (Invoice_No) โดยใช้ row.set ตรงๆ เพื่อความชัวร์
      if (body.invoiceNo !== undefined) {
        row.set('Invoice_No', String(body.invoiceNo).trim());
      }

      // เซฟข้อมูลลง Google Sheets
      await row.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'ไม่พบรายการที่ต้องการอัปเดต' }, { status: 404 });
  } catch (error: any) {
    console.error('PATCH Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}