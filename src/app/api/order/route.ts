import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

// ฟังก์ชันสร้าง Auth (แยกไว้จะได้ไม่เขียนซ้ำ)
const getAuth = () => new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, groupId, groupName } = body;

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];

    const rows = items.map((item: any) => ({
      'Group_ID': groupId,
      'Group_Name': groupName,
      'Status': 'PENDING',
      'Product_ID': item.productId,
      'Product_Name': item.productName,
      'Supplier': item.supplier,
      'Shop_Qty': item.shopQty,
      'Stock_Qty': item.stockQty,
      'Note_Request': item.note,
      'Created_At': new Date().toLocaleString('th-TH'),
      'Order_Carton': '', 'Carton_Unit': '', 'Order_Qty': '', 'Inner_Unit': '', 'Qty_Per_Carton': '', 'Note_Purchase': '',
      'Recv_Carton': '', 'Recv_Carton_Unit': '', 'Recv_Unit': '', 'Recv_Qty': '', 'Recv_Qty_Unit': '', 'Recv_Date': '', 'Note_Stock': '',
    }));

    await sheet.addRows(rows);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    const data = rows.map(row => ({
      Group_ID: row.get('Group_ID'),
      Group_Name: row.get('Group_Name'),
      Status: row.get('Status'),
      Product_ID: row.get('Product_ID'),
      Product_Name: row.get('Product_Name'),
      Supplier: row.get('Supplier'),
      Shop_Qty: row.get('Shop_Qty'),
      Stock_Qty: row.get('Stock_Qty'),
      Note_Request: row.get('Note_Request'),
      Created_At: row.get('Created_At'),
      Order_Carton: row.get('Order_Carton'),
      Carton_Unit: row.get('Carton_Unit'),
      Inner_Unit: row.get('Inner_Unit'),
      Qty_Per_Carton: row.get('Qty_Per_Carton'),
      Note_Purchase: row.get('Note_Purchase'),
      Recv_Carton: row.get('Recv_Carton'),
      Recv_Unit: row.get('Recv_Unit'),
      Recv_Qty: row.get('Recv_Qty'),
      Recv_Qty_Unit: row.get('Recv_Qty_Unit'),
      Recv_Carton_Unit: row.get('Recv_Carton_Unit'),
      Recv_Date: row.get('Recv_Date') || '',
      Note_Stock: row.get('Note_Stock'),
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // เพิ่ม oldId เพื่อใช้ค้นหาแถวเดิมก่อนที่จะถูกทับด้วยค่าใหม่
    const { oldId, id, groupId, productName, shopQty, stockQty, note, supplier } = await req.json();

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    // ค้นหาแถวโดยใช้ oldId (ไอดีเดิม) และ groupId
    const row = rows.find(r => r.get('Product_ID') === oldId && r.get('Group_ID') === groupId);

    if (row) {
      // บันทึกค่าใหม่ทับลงไป รวมถึง Product_ID และ Supplier
      row.set('Product_ID', id); 
      row.set('Product_Name', productName);
      row.set('Shop_Qty', shopQty);
      row.set('Stock_Qty', stockQty);
      row.set('Note_Request', note);
      row.set('Supplier', supplier);
      
      await row.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการแก้ไข' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ เพิ่มฟังก์ชันลบรายการ (DELETE)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('groupId');

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    // ค้นหาแถวที่ Product_ID และ Group_ID ตรงกัน
    const row = rows.find(r => r.get('Product_ID') === id && r.get('Group_ID') === groupId);

    if (row) {
      await row.delete();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการลบ' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}