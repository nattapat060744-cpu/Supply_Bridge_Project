import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, groupId, groupName } = body;

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
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
        'Created_At': new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
        
        'Order_Carton': item.orderCarton || '',
        'Carton_Unit': item.cartonUnit || '',
        'Order_Qty': item.orderQty || '',
        'Inner_Unit': item.innerUnit || '',
        'Qty_Per_Carton': item.qtyPerCarton || '',
        'Note_Purchase': item.notePurchase || '',
        
        'Recv_Carton': item.recvCarton || '',
        'Recv_Unit': item.recvUnit || '',
        'Recv_Qty': item.recvQty || '',
        'Recv_Qty_Unit': item.recvQtyUnit || '',
        'Recv_Date': item.recvDate || '', // เพิ่มรองรับ Recv_Date
        'Note_Stock': item.noteStock || '',
    }));

    await sheet.addRows(rows);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
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
      Order_Qty: row.get('Order_Qty'),
      Inner_Unit: row.get('Inner_Unit'),
      Qty_Per_Carton: row.get('Qty_Per_Carton'),
      Note_Purchase: row.get('Note_Purchase'),
      PO_Number: row.get('PO_Number'),

      Recv_Carton: row.get('Recv_Carton'),
      Recv_Unit: row.get('Recv_Unit'),
      Recv_Qty: row.get('Recv_Qty'),
      Recv_Qty_Unit: row.get('Recv_Qty_Unit'), 
      // แก้ไขตรงนี้: เปลี่ยนจาก recvDate เป็น Recv_Date ให้ตรงกับ interface ของหน้าบ้าน
      Recv_Date: row.get('Recv_Date') || '', 
      Note_Stock: row.get('Note_Stock'),
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}