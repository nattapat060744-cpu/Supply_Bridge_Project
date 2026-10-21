import { DatabaseTable, supabaseFunction } from '@/lib/database';
import { sessionFor } from '@/lib/access';
import { hashPassword } from '@/lib/password';
import { safeErrorResponse, toSafeString } from '@/lib/api-utils';
import {createSessionToken,SESSION_COOKIE_NAME,SESSION_MAX_AGE_SECONDS} from '@/lib/auth';
import { thaiTimestamp } from '@/lib/password-requests';
const departments=['SORTING','PURCHASE','STOCK','SORTING_VIEWER','STOCK_SORTING_MANAGER'];
export async function POST(req:Request){
 try{
  const b=await req.json(),username=toSafeString(b.username,120),name=toSafeString(b.name,120),department=toSafeString(b.department).toUpperCase();
  if(username.length<3||!name||typeof b.password!=='string'||b.password.length<8||b.password.length>1024||!departments.includes(department)) return Response.json({success:false,message:'กรอกข้อมูลให้ครบและใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร'},{status:400});
  const user=await supabaseFunction<{username:string;name:string;department:string}>('stock_register',{payload:{username,name,department,passwordHash:await hashPassword(b.password),createdAt:thaiTimestamp()}});
  const token=await createSessionToken(user);
  const response=Response.json({success:true,message:'สมัครสำเร็จ พร้อมใช้งานทันที',user:{...user,loginDate:new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}},{status:201});
  response.headers.append('Set-Cookie',`${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${process.env.NODE_ENV==='production'?'; Secure':''}`);
  return response;
 }catch(error){return safeErrorResponse(error,'register.POST');}
}
export async function GET(req:Request){
 try{
  if((await sessionFor(req))?.department!=='ADMIN') return Response.json({success:false},{status:403});
  if(new URL(req.url).searchParams.get('view')==='members'){
    const users=await new DatabaseTable('Users').getRows();
    return Response.json({success:true,members:users.map(u=>({id:u.id,username:u.get('Username'),name:u.get('Name'),department:u.get('Department')}))});
  }
  const rows=await new DatabaseTable('User_Requests').getRows();
  const requests=rows.map(r=>({id:r.get('Request_ID'),username:r.get('Username'),name:r.get('Name'),department:r.get('Department'),status:r.get('Status'),createdAt:r.get('Created_At'),reviewedAt:r.get('Reviewed_At'),reviewedBy:r.get('Reviewed_By'),rowNumber:r.rowNumber})).sort((a,b)=>Number(b.status==='PENDING')-Number(a.status==='PENDING'));
  return Response.json({success:true,requests});
 }catch(error){return safeErrorResponse(error,'register.GET');}
}
export async function PATCH(req:Request){
 if((await sessionFor(req))?.department!=='ADMIN')return Response.json({success:false},{status:403});
 return Response.json({success:false,message:'ระบบสมัครสมาชิกใช้งานได้ทันทีแล้ว ไม่ต้องอนุมัติ'},{status:410});
}
