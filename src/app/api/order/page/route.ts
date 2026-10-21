import {supabaseFunction,DatabaseRow} from '@/lib/database';
import {getOrFetch} from '@/lib/sheet-cache';
import {safeErrorResponse} from '@/lib/api-utils';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 try{
  const q=new URL(req.url).searchParams;
  const payload={page:Math.max(1,Math.trunc(Number(q.get('page'))||1)),pageSize:6,q:(q.get('q')||'').slice(0,200),locateBatch:(q.get('locateBatch')||'').slice(0,500),productId:(q.get('productId')||'').slice(0,500)};
  type Stored={id:string;rowNumber:number;revision:number;signature?:string;data:Record<string,string|number|null>};
  const result=await getOrFetch('database:orders:sorting-page:'+JSON.stringify(payload),()=>supabaseFunction<{items:Stored[];page:number;total:number;totalPages:number;batchIds:string[]}>('stock_sorting_page',{payload}));
  const items=result.items.map(record=>{const row=new DatabaseRow('Orders',record);return {...record.data,Row_UID:record.id,Revision:record.revision,ChangeSignature:record.signature,Created_At:row.get('Created_At'),Created_At_P:row.get('Created_At_P'),Recv_Date:row.get('Recv_Date')};});
  return Response.json({...result,items},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return safeErrorResponse(error,'sorting.page');}
}
