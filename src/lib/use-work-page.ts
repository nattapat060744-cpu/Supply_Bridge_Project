'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

type WorkData<T>={items:T[];issues:T[];suppliers:string[];page:number;total:number;totalPages:number;version:string;dataVersion:string};
export function useWorkPage<T>({kind,page,q,supplier='all',enabled,onPage}:{kind:'purchase'|'stock';page:number;q:string;supplier?:string;enabled:boolean;onPage:(page:number)=>void}){
 const [data,setData]=useState<WorkData<T>>({items:[],issues:[],suppliers:[],page:1,total:0,totalPages:1,version:'',dataVersion:''});
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [search,setSearch]=useState(q);
 const current=useRef({key:'',version:'',metadataVersion:''});const sequence=useRef(0);const controller=useRef<AbortController|null>(null);const inFlight=useRef(false);
 useEffect(()=>{const timer=setTimeout(()=>setSearch(q),250);return()=>clearTimeout(timer);},[q]);
 const key=JSON.stringify([kind,page,search,supplier]);
 const request=useCallback(async(force=false)=>{
  if(!enabled||q!==search||(!force&&inFlight.current))return;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  const id=++sequence.current;inFlight.current=true;setLoading(true);
  const params=new URLSearchParams({page:String(page),q:search,supplier,metadataVersion:current.current.metadataVersion});
  if(force)params.set('fresh','1');
  if(!force&&current.current.key===key&&current.current.version)params.set('version',current.current.version);
  const timer=setTimeout(()=>abort.abort(),15000);
  try{
   const response=await fetch(`/api/${kind}/page?${params}`,{cache:'no-store',signal:abort.signal});
   if(!response.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองรีเฟรชอีกครั้ง');
   const next=await response.json();if(id!==sequence.current)return;
   if(next.unchanged){setError('');return;}
   if(!Array.isArray(next.items))throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
   current.current={key,version:next.version,metadataVersion:next.dataVersion};
   setData(previous=>({...next,issues:next.issues??previous.issues,suppliers:next.suppliers??previous.suppliers}));
   onPage(next.page);setError('');
  }catch(e){if(id===sequence.current)setError(abort.signal.aborted?'โหลดข้อมูลนานเกินไป กรุณารีเฟรชอีกครั้ง':e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}
  finally{clearTimeout(timer);if(id===sequence.current){inFlight.current=false;setLoading(false);}}
 },[enabled,key,kind,onPage,page,q,search,supplier]);
 useEffect(()=>{
  if(!enabled||q!==search)return;
  void request(true);
  const poll=()=>{if(document.visibilityState==='visible')void request();};
  const timer=setInterval(poll,30000);window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);
  return()=>{++sequence.current;controller.current?.abort();inFlight.current=false;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);};
 },[enabled,q,search,request]);
 const refresh=useCallback(()=>request(true),[request]);
 return {...data,loading,error,refresh};
}
