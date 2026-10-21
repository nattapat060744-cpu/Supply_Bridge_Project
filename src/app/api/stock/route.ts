import { StockDatabase, saveDatabaseRows } from '@/lib/database';
import {prepareReceiptRows} from '@/lib/stock-receipts';
import { NextResponse } from 'next/server';
import { safeErrorResponse } from '@/lib/api-utils';
import { getOrFetch, invalidateCache } from '@/lib/sheet-cache';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
export const maxDuration=60;

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
const doc = new StockDatabase();
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
        rowId: r.rowNumber, revision:r.revision,
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

async function saveReceipt(req:Request,allowCompleted:boolean){
 try{
  const forbidden=await requireStockWriteAccess(req);if(forbidden)return forbidden;
  const body=await req.json();
  const items=body.items===undefined?[body]:body.items;
  if(!Array.isArray(items)||!items.length||items.length>5000||!items.every(item=>item&&typeof item==='object'&&!Array.isArray(item)))return NextResponse.json({success:false,message:'รายการรับสินค้าต้องมี 1–5000 รายการ'},{status:400});
  const sheet=await getSheet();
  const updates=prepareReceiptRows(await sheet.getRows(),items,allowCompleted && body.items===undefined);
  await saveDatabaseRows(updates);
  for(const key of ['stock:list','purchase:list','history:list'])invalidateCache(key);
  return NextResponse.json({success:true,count:updates.length});
 }catch(error){return safeErrorResponse(error,'stock.save');}
}
export async function PATCH(req:Request){return saveReceipt(req,true);}
export async function POST(req:Request){return saveReceipt(req,false);}
