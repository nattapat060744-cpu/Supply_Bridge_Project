import {syncNotifications} from '@/lib/shared-notifications';
import {notificationSummary} from '@/lib/sorting-notifications';
import {safeErrorResponse} from '@/lib/api-utils';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:Request){
 try{return Response.json(notificationSummary(await syncNotifications(req.headers.get('x-session-user')!)),{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){return safeErrorResponse(error,'notifications.GET');}
}
export async function POST(req:Request){
 try{
  const body=await req.json();
  if(body?.all===true)return Response.json(notificationSummary(await syncNotifications(req.headers.get('x-session-user')!,{all:true})),{headers:{'Cache-Control':'private, no-store'}});
  if(typeof body?.batchId!=='string'||body.batchId.length>500||!Array.isArray(body.rows)||body.rows.length>5000||!body.rows.every((row:unknown)=>row&&typeof row==='object'))return Response.json({success:false,message:'ข้อมูลบิลไม่ถูกต้อง'},{status:400});
  return Response.json(notificationSummary(await syncNotifications(req.headers.get('x-session-user')!,{batchId:body.batchId,rows:body.rows})),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return safeErrorResponse(error,'notifications.POST');}
}
