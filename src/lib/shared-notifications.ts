import 'server-only';
import {supabaseFunction} from './database';
import {getOrFetch,invalidateCache} from './sheet-cache';
import {reconcileNotifications,acknowledgeNotification,type NotificationState} from './sorting-notifications';
type Acknowledgement={batchId:string;rows:object[]}|{all:true};
type ReadState={state:NotificationState;revision:number;observedAt:number;changes:{version:string;items:object[]|null}};
async function synchronize(username:string,ack?:Acknowledgement){
 for(let attempt=0;attempt<3;attempt++){
  const current=await supabaseFunction<ReadState>('stock_notifications',{payload:{op:'read',username,includeBaseline:!!ack}});
  if(!ack&&current.changes.items===null)return current.state;
  let state=current.changes.items===null?current.state:reconcileNotifications(current.state,current.changes.items,current.observedAt);
  if(ack)state='all' in ack?{...state,notices:[]}:acknowledgeNotification(state,ack.batchId,ack.rows);
  if(JSON.stringify(state)===JSON.stringify(current.state))return state;
  try{
   await supabaseFunction('stock_notifications',{payload:{op:'save',username,revision:current.revision,orderVersion:current.changes.version,state}});
   return state;
  }catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='40001'||attempt===2)throw error;
   await new Promise(resolve=>setTimeout(resolve,80*2**attempt+Math.floor(Math.random()*40)));}
 }
 throw new Error('Notification synchronization failed');
}

export async function syncNotifications(username:string,ack?:Acknowledgement){
 const key='notifications:summary:'+username;
 if(!ack)return getOrFetch(key,()=>synchronize(username),3000);
 invalidateCache(key);
 try{return await synchronize(username,ack);}finally{invalidateCache(key);}
}
