import {checkedFetch} from './checked-fetch';
export async function saveReceiptBatch(items:Record<string,unknown>[]){
 if(!items.length)throw new Error('กรุณาเลือกรายการรับสินค้า');
 return checkedFetch('/api/stock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
}
