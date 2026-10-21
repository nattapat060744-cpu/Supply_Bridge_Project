import {supabaseFunction} from '@/lib/database';
import {getOrFetch} from '@/lib/sheet-cache';
import {safeErrorResponse} from '@/lib/api-utils';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 try{
  const version=(new URL(req.url).searchParams.get('version')||'').slice(0,32);
  const result=await getOrFetch(`database:orders:changes:${version}`,()=>supabaseFunction('stock_order_changes',{payload:{version}}));
  return Response.json(result);
 }catch(error){return safeErrorResponse(error,'order.changes');}
}
