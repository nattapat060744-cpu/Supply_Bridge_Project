import 'server-only';
import {DatabaseRow,supabaseFunction} from './database';
import {getOrFetch} from './sheet-cache';
import {safeErrorResponse} from './api-utils';
type Stored={id:string;rowNumber:number;revision:number;data:Record<string,string|number|null>};
type Result={items?:Stored[];issues?:Stored[];suppliers?:string[];page?:number;total?:number;totalPages?:number;version:string;dataVersion:string;unchanged?:boolean};
const purchaseItem=(r:DatabaseRow)=>({
        id: r.rowNumber.toString(), revision: r.revision,
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
      });
const stockItem=(r:DatabaseRow)=>({
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
      });
export async function getWorkPage(req:Request,kind:'purchase'|'stock'){
 try{
  const params=new URL(req.url).searchParams;
  const payload={kind,page:Math.max(1,Math.trunc(Number(params.get('page'))||1)),q:(params.get('q')||'').slice(0,200),supplier:(params.get('supplier')||'all').slice(0,300),version:(params.get('version')||'').slice(0,120),metadataVersion:(params.get('metadataVersion')||'').slice(0,120)};
  const read=()=>supabaseFunction<Result>('stock_work_page',{payload});
  const result=params.get('fresh')==='1'?await read():await getOrFetch('database:orders:work-page:'+JSON.stringify(payload),read);
  const map=(rows:Stored[])=>rows.map(record=>{const r=new DatabaseRow('Orders',record);return kind==='stock'?stockItem(r):purchaseItem(r);});
  return Response.json({...result,items:result.items?map(result.items):undefined,issues:result.issues?map(result.issues):undefined},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return safeErrorResponse(error,kind+'.page');}
}
