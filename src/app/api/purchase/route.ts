import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// --- ฟังก์ชันดึงข้อมูล (GET) ---
export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
      throw new Error("Missing Environment Variables");
    }

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; 
    const rows = await sheet.getRows();

    const allItems = rows
      .filter(r => {
        const s = (r.get('Status') || '').toString().trim().toUpperCase();
        if (s === 'PENDING') return true;
        if (s === 'ORDERED' || s === 'COMPLETED' || s === 'RECEIVED') {
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
        rowId: r.rowNumber.toString(), // เพิ่ม rowId เพื่อความชัดเจน
        batchId: r.get('Group_ID') || 'ไม่มีกลุ่ม',
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
      }));

    return NextResponse.json(allItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- ฟังก์ชันสร้างบิลใหม่ (POST) - คงเดิมไว้เพราะใช้สำหรับสร้างบิลแรกเริ่ม ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, batchName, groupName, groupId: incomingGroupId } = body;
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const groupId = incomingGroupId || `จัดซื้อสั่งของ-${Date.now()}`;
    const createdAt = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    for (const item of items) {
      await sheet.addRow({
        'Group_ID': groupId,
        'Group_Name': batchName || groupName || 'ไม่ได้ระบุชื่อบิล', 
        'Status': 'PENDING',
        'Product_ID': item.productId || item.Product_ID || item.id || '',
        'Product_Name': item.name || item.Product_Name || item.productName || '',
        'Supplier': item.supplier || item.Supplier || '',
        'Shop_Qty': item.storeQty || item.Shop_Qty || '0',
        'Stock_Qty': item.warehouseQty || item.Stock_Qty || '0',
        'Note_Request': item.note || item.Note_Request || '-',
        'Created_At': createdAt,
        'Order_Carton': item.orderCarton || '0',
        'Carton_Unit': item.cartonUnit || 'ลัง',
        'Qty_Per_Carton': item.qtyPerCarton || '0',
        'Inner_Unit': item.innerUnit || 'ชิ้น',
        'Note_Purchase': item.notePur || item.notePurchase || '',
        'Purchase_Qty': Number(item.orderCarton || 0) * Number(item.qtyPerCarton || 0)
      });
    }
    return NextResponse.json({ success: true, groupId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- ✅ แก้ไขฟังก์ชัน PATCH: ให้บันทึกทั้งของเก่าและของใหม่ ---
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { items, batchId } = body; // รับ batchId มาเพื่อระบุกลุ่มสำหรับของใหม่
    
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    for (const item of items) {
      // 1. ลองหาแถวเดิมด้วย rowId หรือ id
      const row = rows.find(r => r.rowNumber === Number(item.rowId || item.id));

      if (row) {
        // --- กรณี: มีแถวเดิมอยู่แล้ว (Update) ---
        row.set('Status', item.status || 'ORDERED');
        row.set('Order_Carton', item.orderCarton?.toString() || '0');
        row.set('Carton_Unit', item.cartonUnit || '');
        row.set('Qty_Per_Carton', item.qtyPerCarton?.toString() || '0');
        row.set('Inner_Unit', item.innerUnit || '');
        row.set('Note_Purchase', item.purchaseNote || '');
        row.set('Purchase_Qty', (Number(item.orderCarton || 0) * Number(item.qtyPerCarton || 0)).toString());
        await row.save();
      } else if (item.isAddedByPurchase) {
        // --- กรณี: เป็นรายการใหม่ที่กดเพิ่มเข้ามา (Insert New Row) ---
        await sheet.addRow({
          'Group_ID': batchId || 'ไม่มีกลุ่ม',
          'Status': 'ORDERED',
          'Product_ID': item.id || '',
          'Product_Name': item.name || '',
          'Supplier': item.supplier || '',
          'Order_Carton': item.orderCarton?.toString() || '0',
          'Carton_Unit': item.cartonUnit || 'ลัง',
          'Qty_Per_Carton': item.qtyPerCarton?.toString() || '0',
          'Inner_Unit': item.innerUnit || 'ชิ้น',
          'Note_Purchase': item.purchaseNote || '',
          'Purchase_Qty': (Number(item.orderCarton || 0) * Number(item.qtyPerCarton || 0)).toString(),
          'Created_At': new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
        });
      }
    }
    return NextResponse.json({ success: true, message: "บันทึกข้อมูลและเพิ่มรายการใหม่เรียบร้อยครับ" });
  } catch (error: any) {
    console.error("PATCH Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}