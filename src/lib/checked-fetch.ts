/** Mutation callers must never show success for HTTP or application failures. */
export async function checkedFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
  const response=await fetch(input,init);
  const body=await response.clone().json().catch(()=>null);
  if(!response.ok||body?.success===false||body?.partial)throw new Error(body?.message||'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง');
  return response;
}
