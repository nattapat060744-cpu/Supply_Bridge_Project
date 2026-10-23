export type Notice = { id: string; batchId: string; batchName: string; message: string; changedKeys: string[]; updatedAt: number };
type Snapshot = { batchId: string; batchName: string; signature: string; revision: number };
export type NotificationState = { version: 2; initialized: boolean; observedAt: number; baseline: Record<string,Snapshot>; notices: Notice[] };
export type NotificationSummary = { count: number; items: Notice[]; latestBatchId?: string; latestBatchName?: string; latestMessage?: string };
export const NOTIFICATION_EVENT = 'sorting-notifications-changed';
export function emptyNotificationState(): NotificationState { return {version:2,initialized:false,observedAt:0,baseline:{},notices:[]}; }
export function notificationKey(username: string) { return `sorting-notifications:v2:${encodeURIComponent(username)}`; }
export function pendingNotificationKey(username: string) { return `${notificationKey(username)}:open`; }
export function currentNotificationUser(): string {
  try { return String(JSON.parse(localStorage.getItem('user')||'null')?.username||''); } catch { return ''; }
}
export function notificationRowKey(row: object): string {
  const r=row as Record<string,unknown>;
  return `${r.Group_ID??r.batchId??''}-${r.Row_UID??r.rowUid??r.Product_ID??r.id??''}`;
}
function snapshot(row: object): Snapshot {
  const r=row as Record<string,unknown>;
  const fields=[['Status','status'],['Product_ID','id'],['Product_Name','name'],['Supplier','supplier'],['Shop_Qty','storeQty'],['Stock_Qty','warehouseQty'],['Note_Request','note'],['Order_Carton','orderCarton'],['Qty_Per_Carton','qtyPerCarton'],['Carton_Unit','cartonUnit'],['Inner_Unit','innerUnit'],['Note_Purchase','notePurchase'],['Recv_Carton'],['Recv_Qty'],['Recv_Unit'],['Recv_Qty_Unit'],['Note_Stock'],['Recv_Date']];
  return {batchId:String(r.Group_ID??r.batchId??''),batchName:String(r.Group_Name||r.batchName||r.Group_ID||r.batchId||''),revision:Number(r.Revision??0),signature:typeof r.ChangeSignature==='string'?r.ChangeSignature:JSON.stringify(fields.map(keys=>String(keys.map(k=>r[k]).find(v=>v!==undefined&&v!==null)??'')))};
}
export function reconcileNotifications(previous: NotificationState, rows: readonly object[], observedAt: number): NotificationState {
  if(observedAt<previous.observedAt) return previous;
  const baseline: Record<string,Snapshot>={};
  for(const row of rows){
    const key=notificationRowKey(row), next=snapshot(row),old=previous.baseline[key];
    if(next.batchId) baseline[key]=old&&old.revision>next.revision?old:next;
  }
  if(!previous.initialized) return {version:2,initialized:true,observedAt,baseline,notices:[]};
  const changed=new Map<string,Set<string>>();
  const add=(batch:string,key:string)=>{if(!changed.has(batch))changed.set(batch,new Set());changed.get(batch)!.add(key);};
  for(const [key,next] of Object.entries(baseline)){
    const old=previous.baseline[key];
    const migrated=old?.signature.startsWith('[')&&!next.signature.startsWith('[')&&old.revision===next.revision;
    if(old?.signature!==next.signature&&!migrated)add(next.batchId,key);
  }
  for(const [key,old] of Object.entries(previous.baseline)) if(!baseline[key])add(old.batchId,key);
  const batches=new Map(Object.values(baseline).map(r=>[r.batchId,r.batchName]));
  const notices=new Map(previous.notices.filter(n=>batches.has(n.batchId)).map(n=>[n.batchId,n]));
  for(const [batchId,keys] of changed){
    if(!batches.has(batchId)) continue;
    const changedKeys=[...new Set([...(notices.get(batchId)?.changedKeys||[]),...keys])];
    notices.set(batchId,{id:batchId,batchId,batchName:batches.get(batchId)!,message:`พบอัปเดตใหม่ ${changedKeys.length} รายการ`,changedKeys,updatedAt:observedAt});
  }
  return {version:2,initialized:true,observedAt,baseline,notices:[...notices.values()].sort((a,b)=>b.updatedAt-a.updatedAt||a.batchId.localeCompare(b.batchId))};
}
export function acknowledgeNotification(state:NotificationState,batchId:string,visibleRows:readonly object[]):NotificationState{
  const visible=Object.fromEntries(visibleRows.map(r=>[notificationRowKey(r),snapshot(r)]));
  const notice=state.notices.find(n=>n.batchId===batchId);
  // Don't acknowledge an update that arrived after the displayed bill was read.
  if(notice?.changedKeys.some(key=>state.baseline[key]?.signature!==visible[key]?.signature))return state;
  return {...state,notices:state.notices.filter(n=>n.batchId!==batchId)};
}
const memory=new Map<string,NotificationState>();
const storageUnavailable=new Set<string>();
export function readNotificationState(username:string):NotificationState{
  if(!username)return emptyNotificationState();
  if(storageUnavailable.has(username)&&memory.has(username))return memory.get(username)!;
  try{
    const raw=localStorage.getItem(notificationKey(username));
    if(raw){
      const data=JSON.parse(raw) as NotificationState;
      if(data.version===2&&typeof data.initialized==='boolean'&&Number.isFinite(data.observedAt)&&data.baseline&&typeof data.baseline==='object'&&Array.isArray(data.notices)&&Object.values(data.baseline).every(v=>v&&typeof v.signature==='string'&&typeof v.batchId==='string')&&data.notices.every(n=>n&&typeof n.batchId==='string'&&Array.isArray(n.changedKeys)))return data;
    }
  }catch{/* Invalid or unavailable browser storage must not break the page. */}
  return memory.get(username)||emptyNotificationState();
}
export function writeNotificationState(username:string,state:NotificationState){
  if(!username)return;
  memory.set(username,state);
  try{localStorage.setItem(notificationKey(username),JSON.stringify(state));storageUnavailable.delete(username);}catch{storageUnavailable.add(username);}
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT,{detail:{username}}));
}
const pendingReads=new Set<string>();
const readQueues=new Map<string,Promise<void>>();
const requestVersions=new Map<string,number>();
export function notificationReadPending(username:string){return pendingReads.has(username);}
export function notificationRequestVersion(username:string){return requestVersions.get(username)||0;}
export function storeSharedNotificationSummary(username:string,summary:NotificationSummary){
  writeNotificationState(username,{...emptyNotificationState(),initialized:true,observedAt:Date.now(),notices:summary.items});
}
export function acknowledgeAllSortingNotifications(username:string){return acknowledgeSortingBatch(username,'',[],true);}
export async function acknowledgeSortingBatch(username:string,batchId:string,visibleRows:readonly object[],all=false){
  if(!username)return;
  pendingReads.add(username);requestVersions.set(username,notificationRequestVersion(username)+1);
  const job=(readQueues.get(username)||Promise.resolve()).then(async()=>{try{
    const rows=visibleRows.map(row=>{const r=row as Record<string,unknown>;return {Row_UID:r.Row_UID,Revision:r.Revision,Group_ID:r.Group_ID??r.batchId,Group_Name:r.Group_Name??r.batchName,ChangeSignature:r.ChangeSignature};});
    const response=await fetch('/api/order/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(all?{all:true}:{batchId,rows}),signal:AbortSignal.timeout(30000)});
    if(response.ok&&currentNotificationUser()===username)storeSharedNotificationSummary(username,await response.json());
  }catch{/* Keep the notice unread until the server confirms it. */}});
  readQueues.set(username,job);
  await job;
  if(readQueues.get(username)===job){readQueues.delete(username);pendingReads.delete(username);}
  requestVersions.set(username,notificationRequestVersion(username)+1);
}
export function notificationSummary(state:NotificationState):NotificationSummary{
  const latest=state.notices[0];
  return {count:state.notices.length,items:state.notices,latestBatchId:latest?.batchId,latestBatchName:latest?.batchName,latestMessage:latest?.message};
}
export function clearLegacyNotificationStorage(){
  try{
    // These unscoped keys belonged to the old notification implementation.
    for(const key of Object.keys(localStorage))if(key.startsWith('snapshot_')||['dismissed_batches','sampeng_snapshot_live','sorting_nav_notifications','pending_sorting_notification_batch'].includes(key))localStorage.removeItem(key);
  }catch{/* Storage can be disabled. */}
}
