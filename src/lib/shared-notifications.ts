import 'server-only';
import {supabaseFunction} from './database';
import {reconcileNotifications,acknowledgeNotification,type NotificationState} from './sorting-notifications';
type ReadState={state:NotificationState;revision:number;observedAt:number;changes:{version:string;items:object[]|null}};
export async function syncNotifications(username:string,ack?:{batchId:string;rows:object[]}){
 for(let attempt=0;attempt<5;attempt++){
  const current=await supabaseFunction<ReadState>('stock_notifications',{payload:{op:'read',username,includeBaseline:!!ack}});
  if(!ack&&current.changes.items===null)return current.state;
  let state=current.changes.items===null?current.state:reconcileNotifications(current.state,current.changes.items,current.observedAt);
  if(ack)state=acknowledgeNotification(state,ack.batchId,ack.rows);
  if(JSON.stringify(state)===JSON.stringify(current.state))return state;
  try{
   await supabaseFunction('stock_notifications',{payload:{op:'save',username,revision:current.revision,orderVersion:current.changes.version,state}});
   return state;
  }catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='40001'||attempt===4)throw error;}
 }
 throw new Error('Notification synchronization failed');
}
