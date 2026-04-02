'use client';

interface StockItem {
  rowId: number;
  productID: string;
  productName: string;
  orderCarton: string;
  cartonUnit: string;
  qtyPerCarton: string;
  innerUnit: string;
  recvCarton?: string;
  Recv_Qty?: string;
  Note_Stock?: string;
  status?: string;
}

interface IssueTrackingProps {
  items: StockItem[];
  onEdit: (item: StockItem) => void;
}

export default function IssueTracking({ items, onEdit }: IssueTrackingProps) {
  // Logic สำหรับกรองเฉพาะรายการที่มีปัญหา (Discrepancy)
  const discrepancyItems = items.filter(i => {
    const ordered = Number(i.orderCarton || 0);
    const received = Number(i.recvCarton || 0);
    const extraQty = Number(i.Recv_Qty || 0);
    const isCompleted = i.status === 'COMPLETED';
    const isMismatch = received !== ordered || extraQty > 0;
    const hasAction = received > 0 || extraQty > 0;

    return isCompleted && isMismatch && hasAction;
  });

  if (discrepancyItems.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
          Issue Tracking ({discrepancyItems.length})
        </h2>
        <span className="text-[9px] font-bold text-slate-400 italic">เลื่อนดูรายการ ↔</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-h snap-x">
        {discrepancyItems.map(item => {
          const diffCarton = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
          const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);
          
          return (
            <div key={`issue-${item.rowId}`} className="shrink-0 w-72 snap-start bg-white p-5 rounded-[28px] border-2 border-red-50 shadow-sm hover:border-red-200 transition-all">
              <div className="flex justify-between items-start mb-3">
                <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                  {item.productID}
                </span>
                <div className="flex flex-col items-end gap-1">
                  {diffCarton !== 0 ? (
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${diffCarton < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-500'}`}>
                      {diffCarton < 0 ? `ลังขาด ${Math.abs(diffCarton)}` : `ลังเกิน ${diffCarton}`} {item.cartonUnit}
                    </span>
                  ) : diffInner !== 0 ? (
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${diffInner < 0 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {diffInner < 0 ? `ขาดในกล่อง ${Math.abs(diffInner)}` : `เกินในกล่อง ${diffInner}`} {item.innerUnit}
                    </span>
                  ) : null}
                </div>
              </div>

              <h4 className="font-black text-slate-800 text-[12px] uppercase italic truncate mb-4">
                {item.productName}
              </h4>

              <div className="bg-slate-50 rounded-2xl p-3 mb-4">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400 uppercase font-black">Ordered</span>
                  <span className="text-slate-900 font-black">{item.orderCarton} {item.cartonUnit}(+ {item.qtyPerCarton || 0} {item.innerUnit})</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 uppercase font-black">Received</span>
                  <span className="text-red-600 font-black">{item.recvCarton} {item.cartonUnit} (+ {item.Recv_Qty || 0} {item.innerUnit})</span>
                </div>
              </div>

              <button 
                onClick={() => onEdit(item)} 
                className="w-full bg-slate-950 text-yellow-400 text-[10px] font-black py-3 rounded-xl hover:bg-yellow-400 hover:text-slate-950 transition-all shadow-lg active:scale-95"
              >
                แก้ไข / รับเพิ่ม
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}