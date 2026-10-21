import type {DatabaseRow} from './database';
export function prepareReceiptRows(rows:DatabaseRow[],items:Record<string,unknown>[],allowCompleted:boolean){
 if(!items.length || items.length>5000)throw new Error('Receipt batch must contain 1–5000 rows');
 const selected=new Set<string>();
 return items.map(body=>{
  const row=body.rowUid?rows.find(r=>r.id===body.rowUid):rows.find(r=>r.rowNumber===Number(body.rowId));
  if(!row)throw Object.assign(new Error('Receipt row missing'),{code:'P0002'});
  row.expectRevision(body.revision);
  if(selected.has(row.id))throw Object.assign(new Error('Duplicate receipt row'),{code:'22023'});
  selected.add(row.id);
  if(body.productID && row.get('Product_ID')!==body.productID)throw Object.assign(new Error('Product mismatch'),{code:'40001'});
  const status=row.get('Status').toUpperCase();
  if(status!=='ORDERED' && !(allowCompleted && status==='COMPLETED' && body.status==='COMPLETED'))throw Object.assign(new Error('Receipt status changed'),{code:'40001'});
  for(const [key,value] of [['Recv_Carton',body.recvCarton],['Recv_Qty',body.Recv_Qty]] as const){
   if(value!==undefined){const number=Number(value);if(!Number.isFinite(number)||number<0||value===null||typeof value==='boolean')throw Object.assign(new Error('Invalid receipt quantity'),{code:'22023'});row.set(key,number);}
  }
  const text=(value:unknown)=>String(value??'').trim().slice(0,500);
  const receiver=body.receiver??body.receiverName;
  if(receiver!==undefined)row.set('Receiver_Name',text(receiver));
  if(body.Note_Stock!==undefined)row.set('Note_Stock',text(body.Note_Stock));
  if(body.invoiceNo!==undefined)row.set('Invoice_No',text(body.invoiceNo));
  row.set('Status','COMPLETED');row.set('Recv_Unit',row.get('Carton_Unit'));row.set('Recv_Qty_Unit',row.get('Inner_Unit'));
  row.set('Recv_Date',text(body.Recv_Date)||new Date().toISOString());
  return row;
 });
}
