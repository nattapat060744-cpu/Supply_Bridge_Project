'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface StockItem {
  rowId: number;
  groupId: string;
  productID: string;
  productName: string;
  orderCarton: string;
  cartonUnit: string;
  qtyPerCarton: string;
  innerUnit: string;
  notePur: string;
  imageUrl: string; 
  supplier: string;
  recvCarton?: string;
  Recv_Qty?: string;
  Note_Stock?: string;
  status?: string; 
  Recv_Date?: string; // เพิ่มฟิลด์วันที่รับของ
}

export default function StockPage() {

  const router = useRouter();

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<StockItem[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [updatingItem, setUpdatingItem] = useState<StockItem | null>(null);
  const [additionalQty, setAdditionalQty] = useState('');
  const [additionalRecvQty, setAdditionalRecvQty] = useState(''); 
  const [additionalNote, setAdditionalNote] = useState(''); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; 
  const previousDataRef = useRef<{ [key: string]: string }>({});

  const fetchOrderedItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      alert('ดึงข้อมูลไม่ได้ครับ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderedItems();
  }, []);

 useEffect(() => {
    const checkAuthAndFetch = async () => {
      if (typeof window === 'undefined') return;

      const savedUserStr = localStorage.getItem('user');
      const lastLoginDate = localStorage.getItem('loginDate'); // 1. ดึงวันที่จากเครื่องมา
      const today = new Date().toLocaleDateString('th-TH');    // 2. สร้างวันที่ปัจจุบัน (ไทย)

      // 1. ดักจับถ้าไม่ได้ Login หรือ "วันที่ไม่ตรงกับวันนี้" (ข้ามวัน)
      if (!savedUserStr || savedUserStr === "undefined" || lastLoginDate !== today) {
        // ถ้าข้ามวัน ไม่ต้อง Alert ซ้ำก็ได้ครับ ให้ดีดกลับหน้า Login เงียบๆ 
        // เพราะ Navbar จะเป็นคน Alert บอกเองอยู่แล้ว
        router.push('/');
        return;
      }

      try {
        const savedUser = JSON.parse(savedUserStr);
        // 2. เช็คสิทธิ์แผนก (คงเดิม)
        if (!savedUser.name || (savedUser.department !== 'STOCK' && savedUser.department !== 'ADMIN')) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }

        // 3. ถ้าผ่านเงื่อนไข ค่อยโหลดข้อมูล
        await fetchOrderedItems(); 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);
  const fetchPendingOrders = async () => {
    try {
      const res = await fetch(`/api/purchase?t=${Date.now()}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      data.forEach((item: any) => {
        const itemId = item.id || item.ID || item.rowNumber;
        const currentItemStr = JSON.stringify(item);
        if (previousDataRef.current[itemId] && previousDataRef.current[itemId] !== currentItemStr) {
          console.log(`รายการ ${itemId} อัปเดตข้อมูล`);
        }
        previousDataRef.current[itemId] = currentItemStr;
      });
      fetchOrderedItems(); 
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูลอัปเดต:', err);
    }
  };

const { currentBatches, totalPages, allGroupKeys } = useMemo(() => {
    // 1. หา GroupID ทั้งหมดที่มีสินค้าตรงกับคำค้นหา
    const matchingGroupIds = new Set(
      items
        .filter(i => {
          const s = searchTerm.toLowerCase();
          return (
            i.productName?.toLowerCase().includes(s) ||
            i.productID?.toString().toLowerCase().includes(s) ||
            i.groupId?.toLowerCase().includes(s) ||
            i.supplier?.toLowerCase().includes(s)
          );
        })
        .map(i => i.groupId)
    );

    // 2. กรองสินค้า และจัดกลุ่ม
    const groups: { [key: string]: StockItem[] } = {};
    const groupOrder: string[] = []; // เก็บชื่อกลุ่มตามลำดับที่เจอในข้อมูล (ซึ่งมักจะเรียงมาแล้ว)

    items.forEach(item => {
      if (matchingGroupIds.has(item.groupId) && item.status === 'ORDERED') {
        if (!groups[item.groupId]) {
          groups[item.groupId] = [];
          groupOrder.push(item.groupId); // เก็บกลุ่มใหม่ตามลำดับข้อมูลดิบ
        }
        groups[item.groupId].push(item);
      }
    });

    // 3. เรียงลำดับ: กลับด้านลำดับกลุ่มเพื่อให้ "กลุ่มล่าสุด" (ที่มักอยู่ท้ายตาราง) ขึ้นมาอยู่หน้าแรก
    const groupKeys = groupOrder.reverse(); 

    const total = Math.ceil(groupKeys.length / itemsPerPage);
    const slicedKeys = groupKeys.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    const pagedBatches = slicedKeys.map(key => ({
      id: key,
      items: groups[key]
    }));

    return { 
      currentBatches: pagedBatches,
      totalPages: total,
      allGroupKeys: groupKeys 
    };
  }, [items, searchTerm, currentPage]);

  const discrepancyItems = useMemo(() => {
    return items.filter(i => {
      const ordered = Number(i.orderCarton || 0);
      const received = Number(i.recvCarton || 0);
      const expectedExtra = Number(i.qtyPerCarton || 0); 
      const actualExtra = Number(i.Recv_Qty || 0);
      const isCompleted = i.status === 'COMPLETED';
      const isMismatch = (received !== ordered) || (actualExtra !== expectedExtra);
      const hasAction = received > 0 || actualExtra > 0;
      return isCompleted && isMismatch && hasAction;
    });
  }, [items]);

  const toggleBatch = (id: string) => {
    setExpandedBatches(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBatchSubmit = async () => {
    if (!receiverName) return alert('กรุณาใส่ชื่อผู้ตรวจรับด้วยครับ');
    if (!selectedBatch) return;

    setIsSubmitting(true);
    
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      for (const item of selectedBatch) {
        await fetch('/api/stock', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId: item.rowId,
            productID: item.productID,
            receiver: receiverName,
            recvCarton: item.recvCarton || 0,
            recvUnit: item.cartonUnit,
            recvQtyUnit: item.innerUnit,
            Recv_Qty: item.Recv_Qty || 0,
            Note_Stock: item.Note_Stock || '',
            Recv_Date: thaiDate
          }),
        });
      }
      alert('ตรวจรับเข้าสต็อกเรียบร้อยทุกรายการ!');
      setSelectedBatch(null);
      setReceiverName('');
      fetchOrderedItems();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAdditional = async () => {
    if (!updatingItem) return;
    setIsSubmitting(true);
    try {
      const updateData: any = {
        rowId: updatingItem.rowId,
        productID: updatingItem.productID,
      };

      let hasChange = false;

      // Logic คำนวณ: ขาดกดบวกเพิ่ม เกินกดลบออก (รับค่าตามที่กรอกมาบวกเข้าไปในยอดเดิม)
      if (additionalQty !== '') {
        const adjustVal = Number(additionalQty);
        updateData.recvCarton = Number(updatingItem.recvCarton || 0) + adjustVal;
        hasChange = true;
      }

      if (additionalRecvQty !== '') {
        const adjustInnerVal = Number(additionalRecvQty);
        updateData.Recv_Qty = Number(updatingItem.Recv_Qty || 0) + adjustInnerVal;
        hasChange = true;
      }

      if (!hasChange) {
        setUpdatingItem(null);
        setIsSubmitting(false);
        return;
      }

      // ปรับแต่งข้อความ Log ให้ชัดเจนว่าเป็นการ บวก หรือ ลบ
      const qtyLabel = Number(additionalQty) >= 0 ? `+${additionalQty}` : `${additionalQty}`;
      const innerLabel = Number(additionalRecvQty) >= 0 ? `+${additionalRecvQty}` : `${additionalRecvQty}`;
      
      const logEntry = `[แก้ไข: ${additionalQty !== '' ? 'ลัง ' + qtyLabel : ''} ${additionalRecvQty !== '' ? 'เศษ ' + innerLabel : ''} สาเหตุ: ${additionalNote}]`.trim();
      updateData.Note_Stock = `${updatingItem.Note_Stock || ''} ${logEntry}`.trim();
      
      const now = new Date();
      updateData.Recv_Date = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      await fetch('/api/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      alert('บันทึกการปรับปรุงยอดเรียบร้อยครับ!');
      
      setUpdatingItem(null);
      setAdditionalQty('');
      setAdditionalRecvQty('');
      setAdditionalNote('');
      fetchOrderedItems();
    } catch (err) {
      alert('อัปเดตพลาดครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin mb-4"></div>
      <span className="font-black text-slate-400 uppercase tracking-[0.3em] text-[10px]">
        กำลังตรวจสอบสิทธิ์และซิงค์ข้อมูลสต็อก...
      </span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between bg-white p-8 md:p-12 rounded-[40px] shadow-sm relative overflow-hidden text-slate-900 border-b-8 border-yellow-600">
          <div className="relative z-10">
            <span className="text-[12px] font-black text-yellow-600 uppercase tracking-[0.4em] mb-3 block">
              Inventory Control System
            </span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none">
              รายการ <span className="text-yellow-600 not-italic">สต็อกสินค้า</span>
            </h1>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              จัดการรายการสั่งซื้อและตรวจสอบสินค้าในระบบ
            </p>
          </div>
          <button 
            onClick={fetchPendingOrders}
             className="mt-8 md:mt-0 bg-yellow-600 hover:bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3"
          >
            <span className="text-2xl">🔄</span> รีเฟรชข้อมูล
          </button>
      </div>
      
      {discrepancyItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
              ติดตามรายการที่มีปัญหา ({
                Array.from(new Set(discrepancyItems.map( item => item.productID))).length
              })
            </h2>
            <span className="text-[9px] font-bold text-slate-400 italic">เลื่อนดูรายการ ↔</span>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-h snap-x">
            {discrepancyItems
              .filter((item, index, self) => 
                index === self.findIndex((t) => (t.productID === item.productID))
              )
              .map((item, idx) => {
                const diffCarton = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
                const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);
                
                return (
                  <div key={`issue-${item.productID || idx}`} className="shrink-0 w-72 snap-start bg-white p-5 rounded-[28px] border-2 border-red-50 shadow-sm hover:border-red-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-1">
                        <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                          {item.productID}
                        </span>
                        {item.supplier && (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                            - {item.supplier}
                          </span>
                        )}
                      </div>

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
                      {item.productName }
                    </h4>

                  <div className="bg-slate-50 rounded-2xl p-3 mb-4">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400 uppercase font-black">สั่งซื้อ</span>
                      <span className="text-slate-900 font-black">{item.orderCarton} {item.cartonUnit}(+ {item.qtyPerCarton || 0} {item.innerUnit})</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 uppercase font-black">รับจริง</span>
                      <span className="text-red-600 font-black">{item.recvCarton} {item.cartonUnit} (+ {item.Recv_Qty || 0} {item.innerUnit})</span>
                    </div>
                    {item.Recv_Date && (
                      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                        รับเมื่อ: {item.Recv_Date}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setUpdatingItem(item)} 
                    className="w-full bg-slate-950 text-yellow-400 text-[10px] font-black py-3 rounded-xl hover:bg-yellow-400 hover:text-slate-950 transition-all shadow-lg active:scale-95"
                  >
                    แก้ไข / รับเพิ่ม
                  </button>
                </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
          <input 
            type="text" 
            placeholder="ค้นหากลุ่มบิล หรือชื่อสินค้า..." 
            className="w-full bg-white border border-slate-200 p-6 pl-16 rounded-3xl font-bold outline-none focus:ring-4 ring-yellow-500/10 shadow-sm transition-all text-lg placeholder:text-slate-300"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center justify-center gap-4 min-w-50">
          <div className="text-3xl">📦</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">กลุ่มบิลที่รอรับ</p>
            <p className="text-2xl font-black text-yellow-600 leading-none">{allGroupKeys.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {currentBatches.map((batch) => {
          const groupId = batch.id;
          const bItems = batch.items;
          const isExpanded = !!expandedBatches[groupId];

          return (
            <div 
              key={groupId} 
              className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              <div 
                className={`p-6 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                onClick={() => toggleBatch(groupId)}
              >
                <div className="flex items-center gap-6 w-full md:w-auto">
                  {/* วงกลมจำนวน SKU */}
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black transition-all ${isExpanded ? 'bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100' : 'bg-slate-100 text-slate-400'}`}>
                    <span className="text-lg leading-none">{bItems.length}</span>
                    <span className="text-[7px] uppercase tracking-tighter">SKU</span>
                  </div>
                  
                  <div className="flex flex-col">
                    {/* ชื่อรอบการสั่งซื้อ (หัวข้อเล็ก) */}
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                      ชื่อรอบการสั่งซื้อ
                    </span>
                    {/* ชื่อรายการ (ตัวหนา) */}
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter leading-tight">
                      {groupId}
                    </h2>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      setSelectedBatch(bItems);
                    }}
                    className="flex-1 md:flex-none bg-slate-950 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950 px-6 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-md active:scale-95 border-b-4 border-yellow-600 flex items-center gap-2"
                  >
                    📝 ตรวจรับเดี๋ยวนี้
                  </button>
                  
                  <div className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180 text-yellow-500' : 'text-slate-200'}`}>
                    ▼
                  </div>
                </div>
              </div>
                    {isExpanded && (
                      <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                        <hr className="mb-6 border-slate-100" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {bItems.map((item: StockItem) => ( // ใส่ : StockItem เพื่อแก้ Error type any
                            <div key={item.rowId} className="group/item p-4 rounded-2xl bg-slate-50/50 hover:bg-white border border-transparent hover:border-yellow-200 transition-all shadow-sm hover:shadow-md">
                              
                              <div className="flex justify-between items-start mb-2 gap-2">
                                <span className="bg-slate-900 text-yellow-400 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider shrink-0">
                                  SKU: {item.productID}
                                </span>
                                <span className="text-[9px] font-black text-slate-400 uppercase truncate">
                                  SUP: {item.supplier || 'ไม่ระบุ'}
                                </span>
                              </div>

                              <p className="font-black text-[13px] uppercase italic text-slate-800 truncate group-hover/item:text-yellow-600 transition-colors mb-2">
                                {item.productName}
                              </p>
                              
                              <div className="flex gap-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight bg-white px-2 py-1 rounded-lg border border-slate-100">
                                  📦 {item.orderCarton} {item.cartonUnit}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight bg-white px-2 py-1 rounded-lg border border-slate-100">
                                  🔢 {item.qtyPerCarton} {item.innerUnit}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

      {totalPages > 1 && (
        <div className="mt-12 flex justify-center items-center gap-2 pb-10">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-blue-600 hover:text-white'}`}
          >
            ← ก่อนหน้า
          </button>
          <div className="flex gap-1 items-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(i => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}
              >
                {i}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-blue-600 hover:text-white'}`}
          >
            ถัดไป →
          </button>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedBatch(null)}></div>
          
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[40px] shadow-2xl flex flex-col border border-slate-200">
            
            <div className="p-8 border-b border-slate-100 bg-linear-to-r from-white to-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                  <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest italic shadow-lg">
                    บิลกลุ่ม: {selectedBatch[0].groupId}
                  </span>
                  <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-yellow-200">
                    สินค้านำเข้า
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
                  ใบตรวจรับ <span className="text-yellow-500">สินค้าขาเข้า</span>
                </h2>
              </div>

              <div className="w-full md:w-80">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">
                  ชื่อผู้ตรวจรับสินค้า ()
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl font-black outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 transition-all text-sm pl-12"
                    placeholder="ระบุชื่อผู้รับผิดชอบ..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">👤</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30 custom-scrollbar">
              <div className="bg-white rounded-4xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                    <tr>
                      <th className="p-5 italic w-1/3">รายการสินค้า</th>
                      <th className="p-5 text-center bg-slate-800">ยอดสั่ง</th>
                      <th className="p-5 text-center bg-slate-800">ยอดเศษเดิม</th>
                      <th className="p-5 text-center border-l border-slate-700">ยอดรับจริง</th>
                      <th className="p-5 text-center">เศษที่รับจริง</th>
                      <th className="p-5">หมายเหตุการรับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-bold">
                    {selectedBatch.map((item, idx) => (
                      <tr key={item.rowId || idx} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">รหัสสินค้า: {item.productID}</p>
                          <p className="font-black text-slate-800 uppercase italic leading-tight">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">{item.supplier}</p>
                        </td>

                        <td className="p-5 text-center bg-slate-50/50">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-slate-700">{item.orderCarton}</span>
                            <span className="text-[9px] text-slate-400 uppercase">{item.cartonUnit}</span>
                          </div>
                        </td>

                        <td className="p-5 text-center bg-slate-50/50">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-black text-slate-700">{item.qtyPerCarton}</span>
                            <span className="text-[9px] text-slate-400 uppercase">{item.innerUnit}</span>
                          </div>
                        </td>

                        <td className="p-5 text-center border-l border-slate-100">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              className="w-24 bg-white border-2 border-slate-200 p-3 rounded-2xl font-black text-center text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all shadow-sm group-hover:border-slate-300"
                              placeholder="0"
                              value={item.recvCarton || ''}
                              onChange={(e) => {
                                const newBatch = [...selectedBatch];
                                newBatch[idx].recvCarton = e.target.value;
                                setSelectedBatch(newBatch);
                              }}
                            />
                            <span className="text-[9px] text-slate-400 uppercase font-black">{item.cartonUnit}</span>
                          </div>
                        </td>

                        <td className="p-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              className="w-20 bg-white border-2 border-slate-200 p-3 rounded-2xl font-black text-center text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                              placeholder="0"
                              value={item.Recv_Qty || ''}
                              onChange={(e) => {
                                const newBatch = [...selectedBatch];
                                newBatch[idx].Recv_Qty = e.target.value;
                                setSelectedBatch(newBatch);
                              }}
                            />
                            <span className="text-[9px] text-slate-400 uppercase font-black">{item.innerUnit}</span>
                          </div>
                        </td>

                        <td className="p-5">
                          <textarea
                            rows={1}
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs text-slate-600 outline-none focus:border-yellow-400 focus:bg-white transition-all resize-none"
                            placeholder="ระบุปัญหาหรือข้อความ..."
                            value={item.Note_Stock || ''}
                            onChange={(e) => {
                              const newBatch = [...selectedBatch];
                              newBatch[idx].Note_Stock = e.target.value;
                              setSelectedBatch(newBatch);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${selectedBatch.every(i => Number(i.recvCarton) === Number(i.orderCarton)) ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></div>
                <span className="font-black text-[11px] uppercase italic text-slate-900 tracking-wider">
                  รายการที่ไม่ตรง: <span className="text-orange-500 text-lg">{selectedBatch.filter(i => Number(i.recvCarton) !== Number(i.orderCarton)).length}</span> รายการ
                </span>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <button
                  onClick={handleBatchSubmit}
                  disabled={isSubmitting}
                  className={`w-full md:px-16 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                    isSubmitting ? 'bg-slate-200 text-slate-400' : 'bg-slate-950 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950 shadow-yellow-400/20'
                  }`}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการรับสินค้า 🚀'}
                </button>
                <button
                  onClick={() => setSelectedBatch(null)}
                  disabled={isSubmitting}
                  className="px-8 py-3 font-black text-[10px] uppercase text-slate-400 hover:text-red-500 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {updatingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setUpdatingItem(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 text-center animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black uppercase italic text-slate-900 mb-2">แก้ไข / ปรับยอดรับ</h3>
            <p className="text-xs font-bold text-slate-400 mb-6 uppercase">{updatingItem.productName}</p>
            
            <div className="space-y-4 mb-8 text-left">
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 mb-4">
                <p className="text-[10px] font-black text-yellow-700 uppercase mb-1">คำแนะนำสำหรับ:</p>
                <p className="text-[11px] font-bold text-yellow-600 leading-tight">
                  กรอกเลขบวก (เช่น 1) เพื่อ <span className="underline">รับเพิ่ม</span><br/>
                  กรอกเลขติดลบ (เช่น -1) เพื่อ <span className="underline">ลดจำนวน</span>
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">ปรับยอดลัง ({updatingItem.cartonUnit})</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black outline-none focus:border-yellow-400 transition-all"
                  placeholder="เช่น 1 หรือ -1"
                  value={additionalQty || ''}
                  onChange={(e) => setAdditionalQty(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">ปรับยอดเศษ ({updatingItem.innerUnit})</label>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black outline-none focus:border-yellow-400 transition-all"
                  placeholder="เช่น 5 หรือ -5"
                  value={additionalRecvQty || ''}
                  onChange={(e) => setAdditionalRecvQty(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">หมายเหตุการแก้ไข</label>
                <input 
                  type="text"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black outline-none focus:border-yellow-400 transition-all text-sm"
                  placeholder="ระบุสาเหตุ (เช่น ของขาดส่งมาเพิ่ม)..."
                  value={additionalNote || ''}
                  onChange={(e) => setAdditionalNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setUpdatingItem(null)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400">ยกเลิก</button>
              <button 
                onClick={handleUpdateAdditional} 
                disabled={isSubmitting}
                className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isSubmitting ? 'bg-slate-200 text-slate-400' : 'bg-slate-950 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950'}`}
              >
                {isSubmitting ? 'Updating...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}