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
        status: r.get('Status')?.toString().trim().toUpperCase(),
        Created_At: r.get('Created_At') || r.get('Date') || '',
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
    
    // 1. ค้นหาแถว: ใช้ rowId (rowNumber) เป็นหลักเพื่อความแม่นยำที่สุดในตำแหน่ง Google Sheets
    const row: any = rows.find(r => r.rowNumber === body.rowId);

    if (row) {
      // 🔥 [จุดที่เพิ่ม] เช็คสถานะปัจจุบันก่อน ถ้าบันทึกเสร็จไปแล้ว (COMPLETED) ให้บล็อกทันที
      const currentStatus = row.get('Status')?.toString().trim();
      if (currentStatus === 'COMPLETED') {
        return NextResponse.json({ 
          success: false, 
          message: `รายการแถวที่ ${body.rowId} นี้ถูกบันทึกไปแล้ว ไม่สามารถ Import ซ้ำได้ครับพี่ชาย` 
        }, { status: 400 });
      }

      // 2. จัดการเลขที่บิล (Invoice_No) 
      const incomingInvoice = body.invoiceNo; 
      
      // 3. อัปเดตข้อมูลทั่วไปที่ส่งมาจากหน้าบ้าน
      if (body.receiver !== undefined) row.set('Receiver_Name', body.receiver);
      if (body.recvCarton !== undefined) row.set('Recv_Carton', body.recvCarton);
      if (body.Recv_Qty !== undefined) row.set('Recv_Qty', body.Recv_Qty);
      if (body.Note_Stock !== undefined) row.set('Note_Stock', body.Note_Stock);
      
      // เปลี่ยนสถานะเป็นสำเร็จ
      row.set('Status', 'COMPLETED');
      row.set('Recv_Unit', row.get('Carton_Unit') || '');
      row.set('Recv_Qty_Unit', row.get('Inner_Unit') || '');
      row.set('Recv_Date', body.Recv_Date); 

      // 4. บังคับเขียนลง Invoice_No (คอลัมน์ V) 
      const headers = sheet.headerValues;
      const invoiceColIndex = headers.findIndex(h => h.trim() === 'Invoice_No');

      if (invoiceColIndex !== -1) {
        if (incomingInvoice !== undefined) {
          row._rawData[invoiceColIndex] = String(incomingInvoice).trim();
        }
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