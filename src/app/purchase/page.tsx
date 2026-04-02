'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

// อินเตอร์เฟซสำหรับรายการสินค้า
interface OrderItem {
  id: string;
  productId?: string;
  Product_ID?: string;
  productID?: string;
  name: string;
  Product_Name?: string;
  productName?: string;
  supplier: string;
  Supplier?: string;
  orderQty?: string;
  Shop_Qty?: string;
  warehouseQty?: string;
  Stock_Qty?: string;
  noteReq?: string;
  Note_Request?: string;
  batchId?: string;
  Group_ID?: string;
  orderCarton?: string;
  qtyPerCarton?: string;
  cartonUnit?: string;
  innerUnit?: string;
  notePurchase?: string;
  isRejected?: boolean;
  status?: string;
  recvCarton?: string;
  Recv_Qty?: string;
  rowId?: string;
  // ฟิลด์เพิ่มเติมสำหรับระบบสร้างบิลใหม่
  tempId?: number;
  storeQty?: string;
  note?: string;
  Recv_Date?: string; // เพิ่มฟิลด์วันที่รับของ
   notePur ?: string; // หมายเหตุจากจัดซื้อ
}

interface Notification {
  id: string;
  batchId: string;
  message: string;
  productName: string;
  batchName: string;
}

export default function PurchasePage() {
  const router = useRouter();

  const [batches, setBatches] = useState<{ [key: string]: OrderItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openBatches, setOpenBatches] = useState<{ [key: string]: boolean }>({});
  const [reviewBatch, setReviewBatch] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<OrderItem[]>([]);

  // ระบบสร้างบิลใหม่ (New Batch)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({ id: '', name: '', supplier: '', storeQty: '', warehouseQty: '', note: '' });

  // ระบบ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // ระบบ Notification
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());
  const [rawData, setRawData] = useState<OrderItem[]>([]);
  
  const discrepancyItems = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter((item: OrderItem) => {
      const status = (item.status || '').toUpperCase();
      const isProcessed = status === 'ORDERED' || status === 'COMPLETED' || status === 'RECEIVED';
      if (!isProcessed) return false;

      const hasStartedRecv = (item.recvCarton !== null && item.recvCarton !== undefined && item.recvCarton !== "") ||
                             (item.Recv_Qty !== null && item.Recv_Qty !== undefined && item.Recv_Qty !== "");
      
      if (!hasStartedRecv) return false;

      const orderedCTN = Number(item.orderCarton || 0);
      const receivedCTN = Number(item.recvCarton || 0);
      const expectedQtyInside = Number(item.qtyPerCarton || 0);
      const receivedQtyInside = Number(item.Recv_Qty || 0);

      const isCartonMismatch = (receivedCTN !== orderedCTN);
      const isQtyInsideMismatch = (receivedQtyInside !== expectedQtyInside);

      return isCartonMismatch || isQtyInsideMismatch;
    });
  }, [rawData]);

const fetchPendingOrders = async (retries = 2) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/purchase?t=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!res.ok) throw new Error('การเชื่อมต่อเครือข่ายมีปัญหา');
      
      const data = await res.json();
      setRawData(data);

      // ✅ แก้จุดนี้: เรียงข้อมูลจากใหม่ไปเก่า (Created_At)
      const sortedData = Array.isArray(data) 
        ? [...data].sort((a: any, b: any) => {
            const dateA = new Date(a.Created_At || a.createdAt || 0).getTime();
            const dateB = new Date(b.Created_At || b.createdAt || 0).getTime();
            return dateB - dateA; // ใหม่ล่าสุดอยู่บนสุด
          }) 
        : [];

      const pendingItems = sortedData.filter((item: any) => item.status === 'PENDING');
      
      const grouped = pendingItems.reduce((acc: any, item: any) => {
        const key = item.batchId || item.Group_ID || 'ทั่วไป';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      setBatches(grouped);
      
      // ✅ เพิ่มบรรทัดนี้: ให้กลับไปหน้า 1 เสมอเมื่อโหลดข้อมูลใหม่
      setCurrentPage(1); 

    } catch (err: any) {
      if (retries > 0 && err.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchPendingOrders(retries - 1);
      }
      console.error(err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleBatch = (batchId: string) => {
    setOpenBatches((prev: any) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

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
        if (!savedUser.name || (savedUser.department !== 'PURCHASE' && savedUser.department !== 'ADMIN')) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }

        // 3. ถ้าผ่านเงื่อนไข ค่อยโหลดข้อมูล
        await fetchPendingOrders(); 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);

  const handleOpenReview = (batchId: string) => {
    const itemsForReview = batches[batchId].map((item: any) => ({
      ...item, // ✅ กระจายข้อมูลเดิมทั้งหมดออกมาก่อน
      id: (item.id || item.Product_ID || item.rowId || '').toString(),
      name: item.name || item.Product_Name || 'ไม่มีชื่อสินค้า',
      supplier: item.supplier || item.Supplier || '-',
      orderCarton: item.orderCarton || '', 
      qtyPerCarton: item.qtyPerCarton || '', 
      cartonUnit: item.cartonUnit || 'ลัง',
      innerUnit: item.innerUnit || 'ชิ้น',
      notePurchase: item.notePurchase || '',
      isRejected: false 
    }));
    setReviewItems(itemsForReview);
    setReviewBatch(batchId);
  };

  const handleFinalConfirm = async () => {
    if (isSubmitting) return;
    if (!confirm(`ยืนยันการบันทึกรายการชุดนี้ใช่ไหมครับ?`)) return;

    setIsSubmitting(true);
    try {
      const itemsToSubmit = reviewItems.map(item => ({
        id: item.id || (item as any).ID || (item as any).rowNumber, 
        status: item.isRejected ? 'REJECTED' : 'ORDERED',
        orderCarton: item.orderCarton,
        cartonUnit: item.cartonUnit,
        qtyPerCarton: item.qtyPerCarton,
        innerUnit: item.innerUnit,
        purchaseNote: item.notePurchase,
        purchaseQty: Number(item.orderCarton || 0) * Number(item.qtyPerCarton || 0)
      }));

      const res = await fetch('/api/purchase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSubmit }),
      });

      if (res.ok) {
        alert('🚀 บันทึกเรียบร้อย!');
        setReviewBatch(null);
        fetchPendingOrders();
      } else {
        const errorData = await res.json();
        alert(`❌ บันทึกไม่สำเร็จ: ${errorData.message || 'ตรวจเช็ค API อีกทีครับ'}`);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันสำหรับระบบสร้างบิลใหม่
  const addItemToTempList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name) return alert('กรุณาระบุรหัสและชื่อสินค้าครับ');
    
    const newItem: OrderItem = {
      id: formData.id,
      name: formData.name,
      supplier: formData.supplier,
      storeQty: formData.storeQty,
      warehouseQty: formData.warehouseQty,
      note: formData.note,
      tempId: Date.now()
    };

    setItems([...items, newItem]);
    setFormData({ id: '', name: '', supplier: '', storeQty: '', warehouseQty: '', note: '' });
  };

  const submitBatch = async () => {
    if (isSubmitting) return;
    if (!batchName) return alert('กรุณาระบุชื่อรอบการสั่งซื้อด้วยครับ');
    
  setIsSubmitting(true);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupName: batchName, // เปลี่ยนจาก batchName เป็น groupName ให้ตรงกับ API
          items: items,
          groupId: `PUR-${Date.now()}` // ส่ง ID กลุ่มไปให้ API ด้วย
        }),
      });
      if (res.ok) {
        alert('🚀 ส่งบิลสั่งซื้อใหม่สำเร็จแล้วครับ!');
        setIsModalOpen(false);
        setItems([]);
        setBatchName('');
        fetchPendingOrders();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูลครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoFillOrderQty = () => {
    const newItems = reviewItems.map(item => ({
      ...item,
      orderCarton: item.orderCarton || item.orderQty || item.Shop_Qty || '1',
      qtyPerCarton: item.qtyPerCarton || '1'
    }));
    setReviewItems(newItems);
  };
  
  const filteredBatchKeys = useMemo(() => {
      const s = searchTerm.toLowerCase();
      
      return Object.keys(batches).filter(key => {
        const matchBatchName = key.toLowerCase().includes(s);
        const matchItems = batches[key].some((i: OrderItem) => {
          const pId = (i.productId || i.Product_ID || i.productID || '').toString().toLowerCase();
          const pName = (i.name || i.Product_Name || i.productName || '').toLowerCase();
          const pSup = (i.supplier || i.Supplier || '').toLowerCase();
          return pId.includes(s) || pName.includes(s) || pSup.includes(s);
        });
        return matchBatchName || matchItems;
      }); // ✅ ลบ .reverse() ตรงนี้ออกครับพี่ชาย
    }, [batches, searchTerm]);

  const totalPages = Math.ceil(filteredBatchKeys.length / itemsPerPage);
  const currentBatches = filteredBatchKeys.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading && Object.keys(batches).length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold tracking-widest animate-pulse">กำลังโหลดข้อมูล...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 selection:bg-emerald-100 selection:text-emerald-900">
      {/* --- การแจ้งเตือน --- */}
      <div className="fixed top-6 right-6 z-100 flex flex-col gap-3">
        {notifications.map(noti => (
          <div key={noti.id} className="bg-white border-l-4 border-emerald-500 p-5 rounded-2xl shadow-xl flex items-center gap-4 animate-in slide-in-from-right duration-500 min-w-[320px] max-w-100">
            <div className="text-2xl">📦</div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest truncate">อัปเดต: {noti.batchName}</p>
              <p className="text-slate-900 font-bold text-xs truncate">{noti.productName}</p>
            </div>
            <button onClick={() => setNotifications(n => n.filter(x => x.id !== noti.id))} className="ml-auto text-slate-300 hover:text-slate-600">✕</button>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-10">
        {/* --- ส่วนหัวข้อ --- */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between bg-white p-8 md:p-12 rounded-[40px] shadow-sm relative overflow-hidden text-slate-900 border-b-8 border-emerald-600">
          <div className="relative z-10">
            <span className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-3 block">
              Purchase Order System
            </span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none">
              ระบบ <span className="text-emerald-600 not-italic">สั่งซื้อสินค้า</span>
            </h1>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              จัดการรายการขอซื้อและบันทึกประวัติการสั่งซื้อ
            </p>
          </div>
          <div className="flex gap-3 mt-8 md:mt-0">
             <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-slate-900 text-white hover:bg-emerald-600 px-8 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3"
              >
                <span className="text-xl">+</span> สร้างบิลใหม่
              </button>
            <button 
              onClick={() => fetchPendingOrders()} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3"
            >
              <span className="text-xl">🔄</span> รีเฟรช
            </button>
          </div>
        </div>

        {/* --- รายการตรวจสอบสินค้าที่ไม่ครบ --- */}
        {discrepancyItems.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
                ติดตามรายการที่มีปัญหา ({
                  discrepancyItems.filter((item, index, self) => 
                    index === self.findIndex((t) => t.id === item.id)
                  ).length
                })
              </h2>
              <span className="text-[9px] font-bold text-slate-400 italic">เลื่อนดูรายการ ↔</span>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-h snap-x">
              {discrepancyItems
                .filter((item, index, self) => 
                  index === self.findIndex((t) => t.id === item.id)
                )
                .map((item, idx) => {
                  const diffCarton = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
                  const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);
                  
                  return (
                    <div key={`issue-${item.id || item.productID || idx}`} className="shrink-0 w-72 snap-start bg-white p-5 rounded-[28px] border-2 border-red-50 shadow-sm hover:border-red-200 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                            {item.productID || item.productId}
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
                        {item.name || item.Product_Name}
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
                    </div>
                  );
              })}
            </div>
          </div>
        )}

        {/* --- แถบค้นหา --- */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
            <input 
              type="text" 
              placeholder="ค้นหารรอบสั่งซื้อ หรือชื่อสินค้า..." 
              className="w-full bg-white border border-slate-200 p-6 pl-16 rounded-3xl font-bold outline-none focus:ring-4 ring-yellow-500/10 shadow-sm transition-all text-lg placeholder:text-slate-300"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center justify-center gap-4 min-w-50">
            <div className="text-3xl">📦</div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">บิลที่กำลังดำเนินการ</p>
              <p className="text-2xl font-black text-emerald-600 leading-none">{filteredBatchKeys.length}</p>
            </div>
          </div>
        </div>

        {/* --- รายการบิลสินค้า --- */}
<div className="space-y-4">
          {currentBatches.map(batchId => {
            // ใช้ตัวแปรให้ตรงกับ State ที่พี่ชายมีในหน้า Purchase
            const bItems = batches[batchId];
            const isExpanded = !!openBatches[batchId];

            return (
              <div 
                key={batchId} 
                className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                {/* ส่วนหัวของบิล (Header) */}
                <div 
                  className={`p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                  onClick={() => toggleBatch(batchId)}
                >
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    {/* วงกลมจำนวน SKU */}
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black transition-all ${isExpanded ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                      <span className="text-xl leading-none">{bItems.length}</span>
                      <span className="text-[8px] uppercase">SKU</span>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">
                        ชื่อรอบการสั่งซื้อ
                      </span>
                      <h2 className="text-xl font-black text-slate-800 tracking-tight">
                        {batchId}
                      </h2>
                      {/* ชื่อกลุ่ม */}
                      <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block uppercase italic">
                        กลุ่ม: {bItems[0]?.Group_ID || 'ทั่วไป'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleOpenReview(batchId); // ใช้ฟังก์ชันเดิมของพี่ชาย
                      }}
                      className="flex-1 md:flex-none bg-emerald-600 text-white hover:bg-slate-900 px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-md active:scale-95 border-b-4 border-emerald-800"
                    >
                      📝 จัดการใบสั่งซื้อ
                    </button>
                    
                    <div className={`text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180 text-emerald-600' : 'text-slate-300'}`}>
                      ▼
                    </div>
                  </div>
                </div>

                {/* ส่วนแสดงรายการสินค้าด้านใน (Expansion) */}
                {isExpanded && (
                  <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="h-px bg-slate-100 mb-6"></div>
                    
                    {/* หัวตาราง (Desktop) - เพิ่มหัวข้อหมายเหตุแยกออกมา */}
                    <div className="hidden lg:grid grid-cols-12 gap-5 px-8 py-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                      <div className="col-span-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">รหัสสินค้า (SKU)</div>
                      <div className="col-span-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">รายการสินค้า / SUP</div>
                      <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">สถานะสต็อก</div>
                      <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">หมายเหตุจัดซื้อ</div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {bItems.map((item: OrderItem, idx: number) => {
                        const isLowStock = Number(item.warehouseQty || item.Stock_Qty) <= 5;
                        
                        // ดึงค่าหมายเหตุจากตัวแปรที่มีโอกาสเป็นไปได้
                        const note = item.notePurchase || item.noteReq || item.Note_Request || item.note;

                        return (
                          <div 
                            key={`${batchId}-${item.id || idx}`} 
                            className="group/item grid grid-cols-1 lg:grid-cols-12 items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 transition-all shadow-sm hover:shadow-md"
                          >
                            {/* 1. SKU (2 cols) */}
                            <div className="lg:col-span-2">
                              <span className="inline-block bg-slate-950 text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm border-b-2 border-emerald-600">
                                {item.productId || item.Product_ID || item.productID}
                              </span>
                            </div>

                            {/* 2. รายการสินค้า & Supplier (4 cols) */}
                            <div className="lg:col-span-4">
                              <div className="flex flex-col">
                                <p className="font-black text-[15px] uppercase italic text-slate-800 group-hover/item:text-emerald-600 transition-colors">
                                  {item.name || item.Product_Name || item.productName}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                  SUP: {item.supplier || item.Supplier || '-'}
                                </span>
                              </div>
                            </div>
                            
                            {/* 3. ตัวเลขสต็อก (3 cols) */}
                            <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">หน้าร้าน</p>
                                <p className="text-sm font-black text-slate-700">
                                  {item.orderQty || item.Shop_Qty || '0'}
                                </p>
                              </div>
                              <div className={`px-3 py-2 rounded-xl border text-center transition-all ${
                                isLowStock 
                                ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' 
                                : 'bg-blue-50 border-blue-100 text-blue-600'
                              }`}>
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">คลัง</p>
                                <p className="text-sm font-black leading-none">
                                  {item.warehouseQty || item.Stock_Qty || '0'}
                                </p>
                              </div>
                            </div>

                            {/* 4. ช่องหมายเหตุแยกออกมาโดยเฉพาะ (3 cols) */}
                            <div className="lg:col-span-3">
                              {note ? (
                                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                  <p className="text-[10px] font-bold text-amber-600 italic leading-relaxed">
                                    📌 {note}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300 italic">ไม่มีหมายเหตุ</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* --- การแบ่งหน้า --- */}
        {totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center gap-2 pb-10">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-emerald-600 hover:text-white'}`}
            >
              ← ก่อนหน้า
            </button>
            <div className="flex gap-1 items-center">
              {(() => {
                const pages = [];
                const range = 1;
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}
                      >
                        {i}
                      </button>
                    );
                  } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
                    pages.push(<span key={i} className="px-2 text-slate-400">...</span>);
                  }
                }
                return pages;
              })()}
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-emerald-600 hover:text-white'}`}
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>

      {/* --- Review Modal (Reviewing existing batch) --- */}
      {reviewBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-110 p-2 md:p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-7xl h-[95vh] overflow-hidden flex flex-col border border-white animate-in fade-in zoom-in-95 duration-300">
            
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div>
                  <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">ยืนยันรายการสั่งซื้อ</p>
                  <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-900">ตรวจสอบ: {reviewBatch}</h2>
                </div>
                <button 
                  onClick={autoFillOrderQty}
                  className="bg-slate-100 hover:bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border border-emerald-100"
                >
                  ⚡ สั่งตามยอดหน้าร้าน
                </button>
              </div>
              <button onClick={() => setReviewBatch(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                <span className="text-2xl">✕</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
              <div className="px-6 md:px-10 py-4 bg-slate-900 shadow-lg z-10 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="flex-1 min-w-50 text-white text-[10px] font-black uppercase tracking-[0.2em] italic">ชื่อสินค้า / รายละเอียด</div>
                  <div className="grid grid-cols-2 gap-3 min-w-50 text-white text-[10px] font-black uppercase tracking-widest text-center">
                    <span>ยอดจากร้าน</span>
                    <span>คลังเหลือ</span>
                  </div>
                  <div className="w-50 text-white text-[10px] font-black uppercase tracking-widest text-center">จำนวนสั่ง (ลัง × ชิ้น)</div>
                  <div className="w-11"></div>
                  <div className="flex-[1.5] md:max-w-75 text-white text-[10px] font-black uppercase tracking-widest md:pl-6">หมายเหตุการสั่งซื้อ</div>
                  <div className="w-24"></div>
                </div>
              </div>

              <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                {reviewItems.map((item, idx) => (
                  <div key={`review-item-${item.id || idx}`} className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row items-center gap-6 ${item.isRejected ? 'bg-red-50/50 border-red-100 opacity-60' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'}`}>
                    <div className="flex-1 min-w-50 w-full">
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest mb-1 inline-block">ID: {item.productId || item.Product_ID}</span>
                      <div className="font-black text-base text-slate-800 uppercase italic truncate">{item.name || item.Product_Name}</div>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">ซัพ: {item.supplier || item.Supplier}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 min-w-50">
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1 md:hidden">ยอดจากร้าน</span>
                        <span className="text-xl font-black text-slate-900">{item.orderQty || item.Shop_Qty}</span>
                      </div>
                      <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center ${Number(item.warehouseQty || item.Stock_Qty) <= 5 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1 md:hidden">คลังเหลือ</span>
                        <span className={`text-xl font-black ${Number(item.warehouseQty || item.Stock_Qty) <= 5 ? 'text-red-500' : 'text-slate-900'}`}>{item.warehouseQty || item.Stock_Qty}</span>
                      </div>
                    </div>

                    {!item.isRejected ? (
                      <div className="flex items-center bg-slate-100/50 p-1.5 rounded-3xl border border-slate-200 shadow-sm gap-1">
                        <div className="flex flex-col items-center min-w-22.5 px-3 py-2 bg-white rounded-[18px] shadow-sm border border-emerald-100 group transition-all hover:border-emerald-400">
                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter mb-1 opacity-70">สั่ง (ลัง)</span>
                          <div className="flex items-baseline gap-1">
                            <input 
                              type="number" 
                              className="w-12 bg-transparent text-slate-900 text-center font-black text-2xl outline-none" 
                              value={item.orderCarton} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].orderCarton = e.target.value;
                                setReviewItems(newItems);
                              }} 
                            />
                            <input 
                              type="text"
                              className="w-8 bg-transparent text-[10px] text-slate-400 font-bold uppercase outline-none focus:text-emerald-600"
                              placeholder="ลัง"
                              value={item.cartonUnit || ''} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].cartonUnit = e.target.value;
                                setReviewItems(newItems);
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-center w-6 text-slate-300 font-light text-2xl">×</div>

                        <div className="flex flex-col items-center min-w-22.5 px-3 py-2 bg-white rounded-[18px] shadow-sm border border-blue-100 group transition-all hover:border-blue-400">
                          <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter mb-1 opacity-70">แพ็ค (ชิ้น)</span>
                          <div className="flex items-baseline gap-1">
                            <input 
                              type="number" 
                              className="w-12 bg-transparent text-slate-900 text-center font-black text-2xl outline-none" 
                              value={item.qtyPerCarton} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].qtyPerCarton = e.target.value;
                                setReviewItems(newItems);
                              }} 
                            />
                            <input 
                              type="text"
                              className="w-8 bg-transparent text-[10px] text-slate-400 font-bold uppercase outline-none focus:text-blue-600"
                              placeholder="ชิ้น"
                              value={item.innerUnit || ''} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].innerUnit = e.target.value;
                                setReviewItems(newItems);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-60 text-center text-red-400 font-black text-[10px] tracking-[0.2em] border-2 border-dashed border-red-100 py-5 rounded-3xl bg-red-50/30 uppercase italic">
                        🚫 รายการนี้ถูกยกเลิก
                      </div>
                    )}

                    <div className="flex-[1.5] md:ml-auto border-l border-slate-100 md:pl-6 w-full md:max-w-75">
                      <input 
                        type="text" 
                        placeholder="ระบุหมายเหตุถึงจัดซื้อ..." 
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all shadow-sm" 
                        value={item.notePurchase} 
                        onChange={(e) => {
                          const newItems = [...reviewItems];
                          newItems[idx].notePurchase = e.target.value;
                          setReviewItems(newItems);
                        }} 
                      />
                    </div>

                    <button 
                      onClick={() => {
                        const newItems = [...reviewItems];
                        newItems[idx].isRejected = !newItems[idx].isRejected;
                        setReviewItems(newItems);
                      }}
                      className={`h-14 w-24 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${item.isRejected ? 'bg-emerald-600 text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}
                    >
                      {item.isRejected ? 'ย้อนกลับ' : 'ไม่สั่ง'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-white shrink-0">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                    <span className="text-2xl">📦</span>
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สถานะคิวงาน</p>
                   <p className="text-2xl font-black text-slate-900 leading-none">
                     {reviewItems.filter(i => !i.isRejected).length} <span className="text-emerald-600">รายการพร้อมสั่ง</span>
                   </p>
                 </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={() => setReviewBatch(null)} className="px-8 py-5 font-black text-[12px] uppercase text-slate-400 hover:text-slate-900 transition-all">ยกเลิก</button>
                <button 
                  onClick={handleFinalConfirm} 
                  disabled={isSubmitting || reviewItems.every(i => !i.orderCarton && !i.isRejected)} 
                  className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-emerald-600 px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-300"
                >
                  {isSubmitting ? 'กำลังส่งข้อมูล...' : '🚀 ยืนยันสั่งซื้อสินค้า'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- New Batch Modal (Creating new batch) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-110 p-2 md:p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-7xl h-[95vh] overflow-hidden flex flex-col border border-white animate-in fade-in zoom-in-95 duration-300">
             
             {/* Header */}
             <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div>
                  <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">สร้างคำขอสั่งซื้อใหม่</p>
                  <h2 className="text-2xl md:text-3xl font-black uppercase text-slate-900 italic">NEW PURCHASE <span className="text-emerald-600 not-italic">BATCH</span></h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                  <span className="text-2xl">✕</span>
                </button>
             </div>

             {/* Content Area */}
             <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/30">
                
                {/* Left Side: Form */}
                <div className="w-full md:w-[45%] p-6 md:p-10 overflow-y-auto custom-scrollbar border-r border-slate-100">
                  <div className="space-y-8">
                    {/* Step 1 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black italic">01</span>
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">ชื่อรอบการสั่งซื้อ</h3>
                      </div>
                      <input 
                        type="text" 
                        placeholder="เช่น เครื่องมือช่าง 06/03/2568" 
                        className="w-full bg-white border border-slate-200 p-6 rounded-3xl font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all text-lg shadow-sm placeholder:text-slate-300"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                      />
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black italic">02</span>
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">เพิ่มรายการสินค้า</h3>
                      </div>
                      
                      <form onSubmit={addItemToTempList} className="space-y-3 bg-white p-6 rounded-4xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="text" placeholder="รหัสสินค้า" 
                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})}
                          />
                          <input 
                            type="text" placeholder="ชื่อสินค้า" 
                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                          />
                          <input 
                            type="number" placeholder="หน้าร้านมี..." 
                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={formData.storeQty} onChange={e => setFormData({...formData, storeQty: e.target.value})}
                          />
                          <input 
                            type="number" placeholder="ในคลังมี..." 
                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={formData.warehouseQty} onChange={e => setFormData({...formData, warehouseQty: e.target.value})}
                          />
                        </div>
                        <input 
                          type="text" placeholder="ชื่อซัพพลายเออร์ (ถ้าทราบ)" 
                          className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                          value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})}
                        />
                        <textarea 
                          placeholder="หมายเหตุถึงฝ่ายจัดซื้อ..." 
                          className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all h-24 resize-none"
                          value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}
                        />
                        <button 
                          type="submit"
                          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:bg-blue-600 transition-all active:scale-95"
                        >
                          + เพิ่มรายการนี้
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Right Side: List Preview */}
                <div className="flex-1 p-6 md:p-10 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">รายการที่จะส่ง ({items.length})</h3>
                    {items.length > 0 && (
                      <button onClick={() => setItems([])} className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">ล้างทั้งหมด</button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {items.length === 0 ? (
                      <div className="h-full border-4 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center p-10 opacity-30">
                        <div className="text-6xl mb-4">📥</div>
                        <p className="text-center font-black text-sm uppercase leading-relaxed">ยังไม่มีรายการสินค้า<br/>กรุณาเพิ่มข้อมูลด้านซ้ายครับ</p>
                      </div>
                    ) : (
                      items.map((item, i) => (
                        <div key={item.tempId} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between animate-in slide-in-from-right duration-300">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-xs text-slate-400 shrink-0">
                              {i + 1}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-black text-slate-800 text-sm truncate uppercase">{item.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase truncate">ID: {item.id} | ยอด: {item.storeQty}/{item.warehouseQty}</p>
                            </div>
                          </div>
                          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shrink-0">✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-8">
                    <button 
                      onClick={submitBatch} 
                      disabled={items.length === 0 || !batchName || isSubmitting}
                      className={`w-full py-7 rounded-[30px] font-black uppercase text-[13px] tracking-[0.3em] shadow-2xl transition-all active:scale-95 ${items.length > 0 && !isSubmitting ? 'bg-blue-600 text-white hover:bg-slate-900 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      {isSubmitting ? 'กำลังส่งข้อมูล... ⏳' : '🚀 ส่งบิลตอนนี้'}
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}