import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { DatabaseTable } from '@/lib/database';
import { verifyPassword } from '@/lib/password';
import { safeErrorResponse } from '@/lib/api-utils';
const attempts = new Map<string,{count:number;until:number}>();
export async function POST(req:Request){
 try{
  const {username,password}=await req.json();
  if(typeof username!=='string'||typeof password!=='string'||!username.trim()||!password||password.length>1024) return Response.json({success:false,message:'กรุณากรอกข้อมูลให้ครบ'},{status:400});
  const key=username.trim().toLowerCase(),old=attempts.get(key);
  if(old&&old.until>Date.now()&&old.count>=10) return Response.json({success:false,message:'กรุณารอ 15 นาทีแล้วลองใหม่'},{status:429});
  const current=old&&old.until>Date.now()?old:{count:0,until:Date.now()+900000}; attempts.set(key,{...current,count:current.count+1});
  for(const [name,a] of attempts) if(a.until<Date.now()) attempts.delete(name);
  const users=await new DatabaseTable('Users').getRows();
  let user;
  for(const candidate of users.filter(u=>String(u.get('Username')).trim()===username.trim())){
   if(candidate.get('Password')&&await verifyPassword(password,String(candidate.get('Password')))){user=candidate;break;}
  }
  if(!user) return Response.json({success:false,message:'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งรหัสผ่านใหม่'},{status:401});
  attempts.delete(key);
  const profile={username:String(user.get('Username')),name:String(user.get('Name')),department:String(user.get('Department')).toUpperCase()};
  const token=await createSessionToken(profile),res=Response.json({success:true,user:{...profile,loginDate:new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}});
  res.headers.append('Set-Cookie',`${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${process.env.NODE_ENV==='production'?'; Secure':''}`);
  return res;
 }catch(error){return safeErrorResponse(error,'login');}
}
