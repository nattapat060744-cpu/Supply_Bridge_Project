import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';
import { toSafeNonNegativeNumber, toSafeString, safeErrorResponse } from '@/lib/api-utils';
import { getOrFetch, invalidateCache } from '@/lib/sheet-cache';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
}

async function requireStockWriteAccess(req: Request) {
  const token = getCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  const session = await verifySessionToken(token);

  if (!session || (session.department !== 'ADMIN' && session.department !== 'STOCK' && session.department !== 'STOCK_SORTING_MANAGER')) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN', message: 'This account cannot update stock data.' },
      { status: 403 }
    );
  }

  return null;
}

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
    // ✅ cache สั้นๆ 4 วินาที กัน user หลายคน/หลายแท็บที่ poll ทุก 30 วิ ยิง Sheets API ซ้ำพร้อมกัน
    const allItems = await getOrFetch('stock:list', async () => {
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      return rows
        .filter(r => {
        const status = r.get('Status')?.toString().trim().toUpperCase();
        // 🔥 ดึงมาทั้งคู่เพื่อให้หน้าบ้านคำนวณตัวแจ้งเตือนส่วนต่างได้
        return status === 'ORDERED' || status === 'COMPLETED';
      })
      .map(r => ({
        rowId: r.rowNumber,
        rowUid: r.get('Row_UID') || '', // ✅ ID ถาวร ไม่เลื่อนตามตำแหน่งแถว
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
    });
    return NextResponse.json(allItems, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'stock.GET');
  }
}

export async function PATCH(req: Request) {
  try {
    const forbidden = await requireStockWriteAccess(req);
    if (forbidden) return forbidden;

    const body = await req.json();

    if (body.rowId === undefined || body.rowId === null) {
      return NextResponse.json({ success: false, message: 'ไม่พบ rowId ที่ต้องการอัปเดต' }, { status: 400 });
    }

    const sheet = await getSheet();
    const rows = await sheet.getRows();
    
    // 1. ค้นหาแถวด้วย Row_UID ก่อน (ถ้ามี) เพราะไม่เลื่อนตามตำแหน่งแถว ไม่งั้น fallback ไป rowNumber
    const row = (body.rowUid && rows.find(r => r.get('Row_UID') === body.rowUid))
      || rows.find(r => r.rowNumber === Number(body.rowId));

    if (row) {
      // 🛡️ ถ้า frontend ส่ง productID มาด้วย ให้เช็คว่าตรงกับแถวที่เจอจริงไหม
      // กันบัค rowNumber เลื่อนเพราะมีคนลบแถวอื่นไปก่อนหน้า (ข้อมูล cache เก่าฝั่ง client)
      if (body.productID && row.get('Product_ID') !== body.productID) {
        return NextResponse.json({
          success: false,
          message: `ข้อมูลแถวที่ ${body.rowId} ไม่ตรงกับสินค้าที่เลือก (อาจมีการเปลี่ยนแปลงแถวจากการลบ/แก้ไขรายการอื่น) กรุณารีเฟรชหน้าจอแล้วลองใหม่ครับ`,
        }, { status: 409 });
      }

      // เช็คสถานะปัจจุบัน (ยกเว้นกรณีสั่ง Force Complete ซ้ำเพื่อแก้ไข Note)
      const currentStatus = row.get('Status')?.toString().trim().toUpperCase() || '';
      if (currentStatus === 'COMPLETED' && body.status?.toUpperCase() !== 'COMPLETED') {
        return NextResponse.json({ 
          success: false, 
          message: `รายการแถวที่ ${body.rowId} นี้ถูกบันทึกไปแล้ว ไม่สามารถ Import ซ้ำได้ครับพี่ชาย` 
        }, { status: 400 });
      }

      // 2. อัปเดตข้อมูลที่ส่งมาจากหน้าบ้าน
      if (body.receiver !== undefined) row.set('Receiver_Name', toSafeString(body.receiver));
      if (body.recvCarton !== undefined) row.set('Recv_Carton', toSafeNonNegativeNumber(body.recvCarton));
      if (body.Recv_Qty !== undefined) row.set('Recv_Qty', toSafeNonNegativeNumber(body.Recv_Qty));
      
      // 🔥 บันทึก Note_Stock ให้แม่นยำ
      if (body.Note_Stock !== undefined) row.set('Note_Stock', toSafeString(body.Note_Stock));
      
      // 3. เปลี่ยนสถานะและหน่วย
      row.set('Status', 'COMPLETED');
      row.set('Recv_Unit', row.get('Carton_Unit') || '');
      row.set('Recv_Qty_Unit', row.get('Inner_Unit') || '');
      row.set('Recv_Date', toSafeString(body.Recv_Date) || new Date().toLocaleString('th-TH')); 

      // 4. บันทึกเลขที่บิล (Invoice_No) โดยใช้ row.set ตรงๆ เพื่อความชัวร์
      if (body.invoiceNo !== undefined) {
        row.set('Invoice_No', toSafeString(body.invoiceNo));
      }

      // เซฟข้อมูลลง Google Sheets
      await row.save();
      invalidateCache('stock:list');
      invalidateCache('purchase:list');
      invalidateCache('history:list');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ success: false, message: 'ไม่พบรายการที่ต้องการอัปเดต (อาจถูกลบหรือข้อมูลเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าจอ)' }, { status: 404 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'stock.PATCH');
  }
}

export async function POST(req: Request) {
  try {
    const forbidden = await requireStockWriteAccess(req);
    if (forbidden) return forbidden;

    const body = await req.json();

    if (body.rowId === undefined || body.rowId === null) {
      return NextResponse.json({ success: false, message: 'ไม่พบ rowId ที่ต้องการอัปเดต' }, { status: 400 });
    }

    const sheet = await getSheet();
    const rows = await sheet.getRows();
    
    // ค้นหาแถวด้วย Row_UID ก่อน (ถ้ามี) ไม่งั้น fallback ไป rowId
    const row = (body.rowUid && rows.find(r => r.get('Row_UID') === body.rowUid))
      || rows.find(r => r.rowNumber === Number(body.rowId));

    if (row) {
      // 🛡️ เช็คเดียวกันกับ PATCH กันบัค rowNumber เลื่อน
      if (body.productID && row.get('Product_ID') !== body.productID) {
        return NextResponse.json({
          success: false,
          message: `ข้อมูลแถวที่ ${body.rowId} ไม่ตรงกับสินค้าที่เลือก กรุณารีเฟรชหน้าจอแล้วลองใหม่ครับ`,
        }, { status: 409 });
      }

      const currentStatus = row.get('Status')?.toString().trim().toUpperCase();
      if (currentStatus === 'COMPLETED') {
        return NextResponse.json({ 
          success: false, 
          message: `รายการแถวที่ ${body.rowId} นี้ถูกบันทึกไปแล้วครับพี่ชาย` 
        }, { status: 400 });
      }

      // ✅ แก้ไขจุดนี้: รองรับทั้งคีย์ receiver (แบบใหม่) และ receiverName (แบบเดิม)
      const finalReceiver = body.receiver !== undefined ? body.receiver : body.receiverName;
      if (finalReceiver !== undefined) row.set('Receiver_Name', toSafeString(finalReceiver));
      
      if (body.recvCarton !== undefined) row.set('Recv_Carton', toSafeNonNegativeNumber(body.recvCarton));
      if (body.Recv_Qty !== undefined) row.set('Recv_Qty', toSafeNonNegativeNumber(body.Recv_Qty));
      if (body.Note_Stock !== undefined) row.set('Note_Stock', toSafeString(body.Note_Stock));
      
      // เปลี่ยนสถานะและบันทึกหน่วยตามเงื่อนไขของสต็อก
      row.set('Status', 'COMPLETED');
      row.set('Recv_Unit', row.get('Carton_Unit') || '');
      row.set('Recv_Qty_Unit', row.get('Inner_Unit') || '');
      row.set('Recv_Date', toSafeString(body.Recv_Date) || new Date().toLocaleString('th-TH')); 

      if (body.invoiceNo !== undefined) {
        row.set('Invoice_No', toSafeString(body.invoiceNo));
      }

      await row.save();
      invalidateCache('stock:list');
      invalidateCache('purchase:list');
      invalidateCache('history:list');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ success: false, message: 'ไม่พบรายการที่ต้องการอัปเดต (อาจถูกลบหรือข้อมูลเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าจอ)' }, { status: 404 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'stock.POST');
  }
}
