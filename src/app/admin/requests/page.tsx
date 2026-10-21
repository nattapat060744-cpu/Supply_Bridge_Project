'use client';
import {useState,useEffect,useCallback} from 'react';
type Member={id:string;username:string;name:string;department:string};
const labels:Record<string,string>={ADMIN:'ผู้ดูแลระบบ',SORTING:'ธุรการคลัง',PURCHASE:'จัดซื้อ',STOCK:'สต็อก',SORTING_VIEWER:'ธุรการคลัง (ดูอย่างเดียว)',STOCK_SORTING_MANAGER:'หัวหน้าสต็อกและธุรการคลัง'};
export default function MembersPage(){
 const [members,setMembers]=useState<Member[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch('/api/register?view=members',{cache:'no-store'});const data=await r.json();if(!r.ok||!data.success)throw new Error(r.status===403?'หน้านี้สำหรับผู้ดูแลระบบ':data.message||'โหลดสมาชิกไม่สำเร็จ');setMembers(data.members);}catch(e){setError(e instanceof Error?e.message:'โหลดสมาชิกไม่สำเร็จ');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <div className="app-shell"><div className="app-container"><section className="app-hero p-6 mb-6"><h1 className="page-title font-display">สมาชิกในระบบ</h1><p className="mt-3 text-slate-600">สมัครสมาชิกแล้วใช้งานได้ทันที ไม่ต้องรออนุมัติ</p><button onClick={load} disabled={loading} className="primary-action mt-4">รีเฟรช</button></section>{error&&<p role="alert" className="p-4 text-rose-700">{error}</p>}<section className="app-card overflow-x-auto"><p className="p-5 font-bold">สมาชิกทั้งหมด {members.length} บัญชี</p><table className="w-full text-left"><thead><tr>{['ชื่อผู้ใช้','ชื่อ','แผนก','สถานะ'].map(t=><th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>{members.map(m=><tr key={m.id} className="border-t border-slate-100"><td className="p-4">{m.username}</td><td className="p-4">{m.name}</td><td className="p-4">{labels[m.department]||m.department}</td><td className="p-4 text-emerald-700">พร้อมใช้งาน</td></tr>)}</tbody></table>{loading&&<p role="status" className="p-5">กำลังโหลดสมาชิก...</p>}</section></div></div>;
}
