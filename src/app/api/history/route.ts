import { supabaseFunction } from '@/lib/database';
import { safeErrorResponse } from '@/lib/api-utils';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 try{
  const q=new URL(req.url).searchParams;
  const number=(v:string|null,fallback:number,max:number)=>{const n=Number(v);return Number.isFinite(n)&&n>=1?Math.min(Math.floor(n),max):fallback;};
  const payload={page:number(q.get('page'),1,1000000),pageSize:number(q.get('pageSize'),20,500),q:(q.get('q')||'').trim().slice(0,200),supplier:(q.get('supplier')||'ALL').slice(0,500),status:['PENDING','ORDERED','COMPLETED','REJECTED'].includes(q.get('status')||'')?q.get('status'):'ALL',sort:['NEWEST','OLDEST','NAME_ASC','NAME_DESC'].includes(q.get('sort')||'')?q.get('sort'):'NEWEST',includeSuppliers:q.get('includeSuppliers')==='1'};
  return Response.json(await supabaseFunction('stock_history',{payload}));
 }catch(error){return safeErrorResponse(error,'history.GET');}
}
