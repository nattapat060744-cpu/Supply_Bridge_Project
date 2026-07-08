import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';
import { toSafeNonNegativeNumber, toSafeString, safeErrorResponse } from '@/lib/api-utils';
import { getOrFetch, invalidateCache } from '@/lib/sheet-cache';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const revalidate = 0;

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
}

async function requirePurchaseWriteAccess(req: Request) {
  const token = getCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  const session = await verifySessionToken(token);

  if (!session || (session.department !== 'ADMIN' && session.department !== 'PURCHASE')) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN', message: 'This account cannot update purchase data.' },
      { status: 403 }
    );
  }

  return null;
}

// --- ส่วน GET: เพิ่ม Note_Stock และแก้ไขให้ยอมปล่อย ORDERED ออกไปเช็คเวลาที่หน้าบ้าน ---
export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
      throw new Error("Missing Environment Variables");
    }

    // ✅ cache สั้นๆ 4 วินาที กัน user หลายคน/หลายแท็บที่ poll ทุก 30 วิ ยิง Sheets API ซ้ำพร้อมกัน
    const allItems = await getOrFetch('purchase:list', async () => {
      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0]; 
      const rows = await sheet.getRows();

      return rows
        .filter(r => {
        const s = (r.get('Status') || '').toString().trim().toUpperCase();
        
        // 1. ถ้าเป็น PENDING ให้ผ่านไปโชว์ตามปกติเสมอ
        if (s === 'PENDING') return true;
        
        // 2. ✅ แก้ไขจุดนี้: ถ้าเป็น ORDERED ให้ปล่อยผ่านเพื่อให้หน้าบ้านไปจัดการเช็คเงื่อนไขเวลา 1 วันเองได้เลย
        if (s === 'ORDERED') return true;

        // 3. ถ้าเป็น COMPLETED หรือ RECEIVED ให้ใช้ลอจิกเช็คของดิฟตามเดิม ไม่ไปแตะต้องครับ
        if (s === 'COMPLETED' || s === 'RECEIVED') {
          const orderCarton = Number(r.get('Order_Carton') || 0);
          const recvCartonRaw = r.get('Recv_Carton');
          const recvCarton = Number(recvCartonRaw || 0);
          const qtyPerCarton = Number(r.get('Qty_Per_Carton') || 0);
          const recvQtyRaw = r.get('Recv_Qty');
          const recvQty = Number(recvQtyRaw || 0);
          const hasStartedRecv = (recvCartonRaw !== null && recvCartonRaw !== undefined && recvCartonRaw !== "") ||
                                 (recvQtyRaw !== null && recvQtyRaw !== undefined && recvQtyRaw !== "");
          if (!hasStartedRecv) return false;
          const isMismatch = (recvCarton !== orderCarton) || (recvQty !== qtyPerCarton);
          return isMismatch;
        }
        return false;
      })
      .map(r => ({
        id: r.rowNumber.toString(),
        rowUid: r.get('Row_UID') || '', // ✅ ID ถาวรที่ไม่เลื่อนตามตำแหน่งแถว (ใช้แทน rowNumber เมื่อมี)
        batchId: r.get('Group_ID') || '',
        batchName: r.get('Group_Name') || 'ไม่มีชื่อบิล',
        productId: r.get('Product_ID') || '',
        name: r.get('Product_Name') || 'ไม่มีชื่อสินค้า',
        supplier: r.get('Supplier') || 'ไม่ระบุ',
        storeQty: r.get('Shop_Qty') || 0,
        warehouseQty: r.get('Stock_Qty') || 0,
        orderQty: r.get('Shop_Qty') || 0,
        status: (r.get('Status') || '').toString().trim().toUpperCase(),
        orderCarton: Number(r.get('Order_Carton') || 0),
        recvCarton: r.get('Recv_Carton'), 
        Recv_Qty: Number(r.get('Recv_Qty') || 0),
        qtyPerCarton: Number(r.get('Qty_Per_Carton') || 0),
        cartonUnit: r.get('Carton_Unit') || 'ลัง',
        Recv_Date: r.get('Recv_Date') || '', 
        innerUnit: r.get('Inner_Unit') || 'ชิ้น',
        notePur: r.get('Note_Purchase') || '',
        Note_Request: r.get('Note_Request') || '',
        Note_Stock: r.get('Note_Stock') || '', // ✅ เพิ่มการดึงค่า Note_Stock
        Created_At: r.get('Created_At') || '',
        Created_At_P: r.get('Created_At_P') || '',
      }));
    });

    return NextResponse.json(allItems, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'purchase.GET');
  }
}

// --- ส่วน POST: เพิ่ม Note_Stock ตอนบันทึกแถวใหม่ (คงเดิม ไม่แก้ไข) ---
export async function POST(req: Request) {
  try {
    const forbidden = await requirePurchaseWriteAccess(req);
    if (forbidden) return forbidden;

    const body = await req.json();
    const { items, batchName, groupName, groupId: incomingGroupId, Created_At } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'รายการสินค้า (items) ต้องไม่ว่าง' }, { status: 400 });
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    const groupId = incomingGroupId || `ID-${Date.now()}`;
    
    for (const item of items) {
      const orderCarton = toSafeNonNegativeNumber(item.orderCarton, 0);
      const qtyPerCarton = toSafeNonNegativeNumber(item.qtyPerCarton, 0);

      await sheet.addRow({
        'Group_ID': groupId,
        'Row_UID': crypto.randomUUID(), // ✅ ID ที่ไม่เปลี่ยนตามตำแหน่งแถว (ต่างจาก rowNumber ที่เลื่อนได้ถ้ามีการลบแถวอื่น)
        'Group_Name': toSafeString(groupName || batchName || 'ไม่ได้ระบุชื่อบิล'),
        'Status': 'PENDING',
        'Product_ID': toSafeString(item.productId || item.Product_ID || item.id || ''),
        'Product_Name': toSafeString(item.name || item.Product_Name || item.productName || ''),
        'Supplier': toSafeString(item.supplier || item.Supplier || ''),
        'Shop_Qty': toSafeNonNegativeNumber(item.storeQty ?? item.Shop_Qty, 0),
        'Stock_Qty': toSafeNonNegativeNumber(item.warehouseQty ?? item.Stock_Qty, 0),
        'Note_Request': toSafeString(item.note || item.Note_Request || '-'),
        'Note_Stock': toSafeString(item.Note_Stock || ''), // ✅ เพิ่มการบันทึก Note_Stock
        'Created_At': toSafeString(Created_At || new Date().toLocaleString('th-TH')),
        'Created_At_P': '', 
        'Order_Carton': orderCarton,
        'Carton_Unit': toSafeString(item.cartonUnit || 'ลัง'),
        'Qty_Per_Carton': qtyPerCarton,
        'Inner_Unit': toSafeString(item.innerUnit || 'ชิ้น'),
        'Note_Purchase': toSafeString(item.notePur || item.notePurchase || ''),
        'Purchase_Qty': orderCarton * qtyPerCarton
      });
    }

    invalidateCache('purchase:list');
    invalidateCache('stock:list');
    invalidateCache('history:list');
    return NextResponse.json({ success: true, groupId }, { status: 201 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'purchase.POST');
  }
}

// --- ส่วน PATCH: เพิ่มการอัปเดต Note_Stock (คงเดิม ไม่แก้ไข) ---
export async function PATCH(req: Request) {
  try {
    const forbidden = await requirePurchaseWriteAccess(req);
    if (forbidden) return forbidden;

    const body = await req.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'รายการสินค้า (items) ต้องไม่ว่าง' }, { status: 400 });
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const notFound: (string | number)[] = [];

    for (const item of items) {
      // ✅ ถ้า frontend มี rowUid (แถวที่สร้างหลังอัปเดตนี้) ให้หาด้วย Row_UID ก่อน เพราะไม่เลื่อนตามตำแหน่งแถว
      // ถ้าไม่มี (ข้อมูลเก่า) fallback ไปหาด้วย rowNumber เหมือนเดิม
      const row = (item.rowUid && rows.find(r => r.get('Row_UID') === item.rowUid))
        || rows.find(r => r.rowNumber === Number(item.id));
      if (row) {
        // 🛡️ ถ้า frontend ส่ง productId มาด้วย เช็คว่าตรงกับแถวที่เจอจริงไหม
        // กันบัค rowNumber เลื่อนเพราะมีคนลบ/เพิ่มแถวอื่นไปก่อนหน้า (ข้อมูล cache เก่าฝั่ง client)
        if (item.productId && row.get('Product_ID') !== item.productId) {
          notFound.push(`${item.id} (ข้อมูลไม่ตรง อาจมีการเปลี่ยนแปลงแถว)`);
          continue;
        }

        const orderCarton = toSafeNonNegativeNumber(item.orderCarton, 0);
        const qtyPerCarton = toSafeNonNegativeNumber(item.qtyPerCarton, 0);

        row.set('Status', toSafeString(item.status || 'ORDERED'));
        row.set('Order_Carton', orderCarton);
        row.set('Carton_Unit', toSafeString(item.cartonUnit || ''));
        row.set('Qty_Per_Carton', qtyPerCarton);
        row.set('Inner_Unit', toSafeString(item.innerUnit || ''));
        row.set('Note_Purchase', toSafeString(item.purchaseNote || ''));
        row.set('Purchase_Qty', orderCarton * qtyPerCarton);
        row.set('Note_Request', toSafeString(item.noteRequest || ''));
        row.set('Note_Stock', toSafeString(item.Note_Stock || '')); // ✅ เพิ่มการอัปเดต Note_Stock
        
        if (item.Created_At_P) {
          row.set('Created_At_P', toSafeString(item.Created_At_P));
        }
        
        await row.save();
      } else {
        notFound.push(item.id);
      }
    }

    if (notFound.length > 0) {
      // แจ้งกลับให้รู้ว่ามีบางแถวไม่เจอ (เช่นถูกลบ/rowNumber เปลี่ยนไปแล้ว) แทนที่จะเงียบ
      invalidateCache('purchase:list'); // บางแถวอัปเดตสำเร็จแล้ว ต้อง invalidate ด้วย
      invalidateCache('stock:list');
      invalidateCache('history:list');
      return NextResponse.json({
        success: true,
        partial: true,
        message: `บันทึกสำเร็จบางส่วน แถวที่ไม่พบ: ${notFound.join(', ')} (อาจถูกลบหรือข้อมูลเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าจอ)`,
        notFound,
      }, { status: 207 });
    }

    invalidateCache('purchase:list');
    invalidateCache('stock:list');
    invalidateCache('history:list');
    return NextResponse.json({ success: true, message: "อัปเดตเรียบร้อยครับ" }, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'purchase.PATCH');
  }
}
