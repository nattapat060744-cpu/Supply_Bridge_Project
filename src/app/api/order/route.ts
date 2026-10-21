import { StockDatabase } from '@/lib/database';
import { NextResponse } from 'next/server';
import { toSafeNonNegativeNumber, toSafeString, safeErrorResponse } from '@/lib/api-utils';
import { invalidateCache } from '@/lib/sheet-cache';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

type OrderRequestItem = Record<string, unknown>;

function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

async function requireOrderWriteAccess(req: Request) {
  const token = getCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  const session = await verifySessionToken(token);

  if (!session || (session.department !== 'ADMIN' && session.department !== 'SORTING' && session.department !== 'STOCK_SORTING_MANAGER')) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN', message: 'บัญชีนี้มีสิทธิ์ดูข้อมูลธุรการคลังเท่านั้นครับ' },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const forbidden = await requireOrderWriteAccess(req);
    if (forbidden) return forbidden;

    const body = await req.json();
    const { items, groupId, groupName } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'รายการสินค้า (items) ต้องไม่ว่าง' }, { status: 400 });
    }

    const doc = new StockDatabase();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];

    const rows = items.map((item: OrderRequestItem) => ({
      'Group_ID': toSafeString(groupId),
      'Row_UID': crypto.randomUUID(),
      'Group_Name': toSafeString(groupName),
      'Status': 'PENDING',
      'Product_ID': toSafeString(item.productId),
      'Product_Name': toSafeString(item.productName),
      'Supplier': toSafeString(item.supplier),
      'Shop_Qty': toSafeNonNegativeNumber(item.shopQty, 0),
      'Stock_Qty': toSafeNonNegativeNumber(item.stockQty, 0),
      'Note_Request': toSafeString(item.note),
      'Created_At': new Date().toLocaleString('th-TH', {timeZone:'Asia/Bangkok'}),
      'Created_At_P': toSafeString(item.Created_At_P || ''),
      'Order_Carton': '', 'Carton_Unit': '', 'Order_Qty': '', 'Inner_Unit': '', 'Qty_Per_Carton': '', 'Note_Purchase': '',
      'Recv_Carton': '', 'Recv_Carton_Unit': '', 'Recv_Unit': '', 'Recv_Qty': '', 'Recv_Qty_Unit': '', 'Recv_Date': '', 'Note_Stock': '',
    }));

    await sheet.addRows(rows);
    invalidateCache('purchase:list');
    invalidateCache('stock:list');
    invalidateCache('history:list');
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'order.POST');
  }
}

export async function GET() {
  try {
    const doc = new StockDatabase();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    const data = rows.map(row => ({
      Row_UID: row.id,
      Revision: row.revision,
      ChangeSignature:row.signature,
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
      Created_At_P: row.get('Created_At_P'),
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

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'order.GET');
  }
}

export async function PUT(req: Request) {
  try {
    const forbidden = await requireOrderWriteAccess(req);
    if (forbidden) return forbidden;

    const { rowUid, revision, id, productName, shopQty, stockQty, note, supplier } = await req.json();

    const doc = new StockDatabase();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    const row = rows.find(r => r.id === rowUid);

    if (row) {
      row.expectRevision(revision);
      row.set('Product_ID', id);
      row.set('Product_Name', productName);
      row.set('Shop_Qty', shopQty);
      row.set('Stock_Qty', stockQty);
      row.set('Note_Request', note);
      row.set('Supplier', supplier);

      await row.save();
      invalidateCache('purchase:list');
      invalidateCache('stock:list');
      invalidateCache('history:list');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการแก้ไข' }, { status: 404 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'order.PUT');
  }
}

export async function DELETE(req: Request) {
  try {
    const forbidden = await requireOrderWriteAccess(req);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const rowUid = searchParams.get('rowUid');
    const revision = searchParams.has('revision') ? Number(searchParams.get('revision')) : undefined;

    const doc = new StockDatabase();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Orders'];
    const rows = await sheet.getRows();

    const row = rows.find(r => r.id === rowUid);

    if (row) {
      row.expectRevision(revision);
      await row.delete();
      invalidateCache('purchase:list');
      invalidateCache('stock:list');
      invalidateCache('history:list');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการลบ' }, { status: 404 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'order.DELETE');
  }
}
