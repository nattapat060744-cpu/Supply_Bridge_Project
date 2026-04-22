'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  tempId?: number;
  storeQty?: string;
  note?: string;
  Recv_Date?: string;
  notePur ?: string;
  Created_At?: string;
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({ id: '', name: '', supplier: '', storeQty: '', warehouseQty: '', note: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());
  const [rawData, setRawData] = useState<OrderItem[]>([]);

  const [isAddingMore, setIsAddingMore] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState('');
  
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

const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

const [existingItems, setExistingItems] = useState<OrderItem[]>([]); // สำหรับโชว์เท่านั้น

const [selectedBatch, setSelectedBatch] = useState<any>(null);

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

      const sortedData = Array.isArray(data) 
        ? [...data].sort((a: any, b: any) => {
            const dateA = new Date(a.Created_At || a.createdAt || 0).getTime();
            const dateB = new Date(b.Created_At || b.createdAt || 0).getTime();
            return dateB - dateA;
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
      
      //setCurrentPage(1); 

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
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

useEffect(() => {
    const checkAuthAndFetch = async () => {
      if (typeof window === 'undefined') return;

      const savedUserStr = localStorage.getItem('user');
      const lastLoginDate = localStorage.getItem('loginDate'); // 1. ดึงวันที่จากเครื่องมา
      const today = new Date().toLocaleDateString('th-TH');    // 2. สร้างวันที่ปัจจุบัน (ไทย)

      if (!savedUserStr || savedUserStr === "undefined" || lastLoginDate !== today) {
        router.push('/');
        return;
      }

      try {
        const savedUser = JSON.parse(savedUserStr);
        if (!savedUser.name || (savedUser.department !== 'PURCHASE' && savedUser.department !== 'ADMIN')) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }

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
      ...item, 
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

  const parseThaiDate = (dateStr: string) => {
    if (!dateStr) return 0;
    
    if (dateStr.includes('T') && dateStr.includes('Z')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    try {
      const [datePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const adjustedYear = year > 2500 ? year - 543 : year;
      const d = new Date(adjustedYear, month - 1, day);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch {
      return 0;
    }
  };

  const addItem = (product: any) => {
  // เช็คว่าไอดีสินค้าตัวนี้ มีอยู่ในรายการ (items) หรือยัง
  const productId = product.Product_ID || product.id;
  const isDuplicate = items.some(item => item.id === productId);

  if (isDuplicate) {
    // ถ้ามีอยู่แล้ว ไม่ต้องทำอะไร หรือจะแจ้งเตือนก็ได้ครับ
    return alert('รายการนี้มีอยู่ในบิลแล้วครับพี่ชาย');
  }

  // ถ้ายังไม่มี ค่อยเพิ่มเข้าไปใหม่
  const newItem: OrderItem = {
    id: productId,
    name: product.Product_Name || product.name,
    supplier: product.Supplier || product.supplier,
    orderCarton: '1',
    qtyPerCarton: product.Qty_Per_Carton || product.qtyPerCarton || '1',
    cartonUnit: product.Carton_Unit || product.cartonUnit || 'ลัง',
    innerUnit: product.Inner_Unit || product.innerUnit || 'ชิ้น',
    notePur: '',
  };
  setItems([...items, newItem]);
};

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
      // 1. สร้างวันที่มาตรฐาน (ISO format) เพื่อใช้เก็บลง DB ให้เรียงลำดับง่าย
      const now = new Date();
      
      // สร้างวันที่แบบไทยสำหรับแสดงผลในชื่อบิล (ว/ด/ป น:น)
      const displayDate = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const displayTime = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // 2. ชื่อบิลที่จะบันทึก (ชื่อที่พี่ชายพิมพ์ + วันที่เวลาปัจจุบัน)
      const finalBatchName = `${batchName} (${displayDate})`;
      
      // 3. วันที่แบบ Full ISO สำหรับฟิลด์ Created_At (เพื่อให้ระบบหลังบ้านเรียงข้อมูลแม่นยำ)
      const isoString = now.toISOString(); 

      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupName: finalBatchName,
          items: items,
          // ใช้ ISO String ไปเลย จะได้ไม่แปลกเวลาดึงข้อมูลไปวิเคราะห์ต่อ
          createdAt: isoString, 
          groupId: finalBatchName.trim() 
        }),
      });

      if (res.ok) {
        alert(`🚀 สร้างบิล "${finalBatchName}" เรียบร้อย!`);
        // ... ล้างค่า State ต่างๆ
      }
    } catch (err) {
      console.error(err);
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
      const keys = Object.keys(batches).filter(batchId => {
        const bItems = batches[batchId];
        return bItems.some(item =>
          item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batchId.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });

      return keys.sort((a, b) => {
        const dateA = parseThaiDate(batches[a][0]?.Created_At || "");
        const dateB = parseThaiDate(batches[b][0]?.Created_At || "");
        
        if (dateB === dateA) {
          return b.localeCompare(a); 
        }
        return dateB - dateA; 
      });
    }, [batches, searchTerm]);

  const groupedByDate = useMemo(() => {
      const groups: { [key: string]: string[] } = {};

      const indexOfLastItem = currentPage * itemsPerPage;
      const indexOfFirstItem = indexOfLastItem - itemsPerPage;
      const currentItemsInPage = filteredBatchKeys.slice(indexOfFirstItem, indexOfLastItem);

      currentItemsInPage.forEach(batchId => {
        const bItems = batches[batchId];
        const rawDate = bItems[0]?.Created_At;

        if (!rawDate) {
          if (!groups['ไม่มีวันที่']) groups['ไม่มีวันที่'] = [];
          groups['ไม่มีวันที่'].push(batchId);
          return;
        }

        try {
          let d: Date;
          if (typeof rawDate === 'string' && rawDate.includes('/')) {
            const parts = rawDate.split(' ');
            const dateParts = parts[0].split('/');
            let year = parseInt(dateParts[2]);
            if (year > 2500) year -= 543;
            d = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
          } else {
            d = new Date(rawDate);
          }

          const datePart = d.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });

          if (!groups[datePart]) groups[datePart] = [];
          groups[datePart].push(batchId);
        } catch (e) {
          if (!groups['รูปแบบวันที่ไม่ถูกต้อง']) groups['รูปแบบวันที่ไม่ถูกต้อง'] = [];
          groups['รูปแบบวันที่ไม่ถูกต้อง'].push(batchId);
        }
      });

      return groups;
    }, [filteredBatchKeys, batches, currentPage, itemsPerPage]);

  const submitAddMore = async () => {
    if (items.length === 0 || !targetGroupId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      
      // เตรียมข้อมูลทั้งหมด (ทั้งเก่าและใหม่) ส่งไปใน groupId เดิม
      const finalItems = items.map(item => ({
        ...item,
        groupId: targetGroupId,
        status: 'ORDERED',
        createdAt: now,
      }));

      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupName: targetGroupId, 
          items: finalItems,
          createdAt: now,
          groupId: targetGroupId,
          isUpdate: true // ส่ง Flag ไปบอก API ว่านี่คือการอัปเดตบิลเดิมนะ
        }),
      });

      if (res.ok) {
        alert(`🚀 อัปเดตบิล "${targetGroupId}" เรียบร้อย! (รวมเป็น ${items.length} รายการ)`);
        setIsAddingMore(false);
        setIsModalOpen(false);
        setItems([]);
        fetchPendingOrders();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              onClick={() => {
                // 🔥 ล้างค่าทุกอย่างเพื่อเริ่มบิลใหม่จริงๆ
                setIsAddingMore(false);
                setTargetGroupId('');
                setBatchName('');
                setItems([]); 
                
                // เพิ่ม 2 บรรทัดนี้ครับพี่ชาย
                setSelectedBatch(null);    // บอกระบบว่าไม่มีบิลเดิมที่เลือกอยู่ (โหมดสร้างใหม่)
                setExistingItems([]);      // ล้างรายการสินค้าเก่าที่เคยดึงมาโชว์
                
                setIsModalOpen(true);
              }}
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
                  index === self.findIndex((t) => (t.id || t.productID) === (item.id || item.productID))
                ).length
              })
            </h2>
            <span className="text-[9px] font-bold text-slate-400 italic">เลื่อนดูรายการ ↔</span>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-h snap-x">
            {discrepancyItems
              .filter((item, index, self) => 
                index === self.findIndex((t) => (t.id || t.productID) === (item.id || item.productID))
              )
              .map((item, idx) => {
                // คู่ที่ 1: ลัง เทียบ ลัง
                const diffCarton = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
                // คู่ที่ 2: บรรจุ/ลัง เทียบ รับจริง(ชิ้น)
                const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);
                
                return (
                  <div key={`issue-${item.id || item.productID || idx}`} className="shrink-0 w-72 snap-start bg-white p-5 rounded-[28px] border-2 border-red-50 shadow-sm hover:border-red-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap items-center gap-1 max-w-[60%]">
                        <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                          {item.productID || item.productId}
                        </span>
                        {item.supplier && (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase truncate">
                            {item.supplier}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {/* 1. เช็คส่วนต่างลัง (แยกอิสระ) */}
                        {diffCarton !== 0 && (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-full ${diffCarton < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-500'}`}>
                            {diffCarton < 0 ? `ลังขาด ${Math.abs(diffCarton)}` : `ลังเกิน ${diffCarton}`} {item.cartonUnit}
                          </span>
                        )}
                        
                        {/* 2. เช็คส่วนต่างเศษ (แยกอิสระ - จะโชว์พร้อมกันหรือโชว์เดี่ยวก็ได้) */}
                        {diffInner !== 0 && (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-full ${diffInner < 0 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {diffInner < 0 ? `เศษขาด ${Math.abs(diffInner)}` : `เศษเกิน ${diffInner}`} {item.innerUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="font-black text-slate-800 text-[12px] uppercase italic truncate mb-4">
                      {item.name || item.Product_Name || item.productName}
                    </h4>

                    <div className="bg-slate-50 rounded-2xl p-4 mb-3 space-y-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400 font-medium">ค่าอ้างอิง:</span>
                        <div className="flex flex-col items-end">
                          <span className="text-slate-900">{item.orderCarton} {item.cartonUnit}</span>
                          <span className="text-slate-500 text-[10px]">บรรจุ {item.qtyPerCarton} {item.innerUnit}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold border-t border-slate-200 pt-2">
                        <span className="text-slate-400 font-medium">ตรวจรับจริง:</span>
                        <div className="flex flex-col items-end text-red-600 italic">
                           <span className="font-black">{item.recvCarton} {item.cartonUnit}</span>
                           <span className="font-black">บรรจุ {item.Recv_Qty} {item.innerUnit}</span>
                        </div>
                      </div>
                    </div>

                    {item.Recv_Date && (
                      <div className="pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-black uppercase italic">
                        อัปเดต: {item.Recv_Date}
                      </div>
                    )}
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
        <div className="space-y-10">
          {Object.entries(groupedByDate).map(([dateLabel, batchIds], groupIdx) => (
            // 🔥 เติม idx เข้าไปใน key ของกลุ่มวันที่
            <div key={`date-group-${dateLabel}-${groupIdx}`} className="space-y-6">
              
              {/* --- ส่วนหัวข้อวันที่ (Date Header) --- */}
              <div className="flex items-center gap-4 py-4">
                <div className="h-px flex-1 bg-slate-200"></div>
                <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
                  <span className="text-lg">📅</span>
                  <span className="text-sm font-black text-slate-600 uppercase tracking-tight">
                    รายการของวันที่: {dateLabel}
                  </span>
                </div>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>

              {/* --- รายการบิลของวันนั้นๆ --- */}
              {batchIds.map((batchId) => {
                const bItems = batches[batchId] || [];
                const isExpanded = expandedBatches.has(batchId);

              return (
                // 🔥 1. แก้ไข className ที่นี่ เพื่อให้การ์ดมีมุมมนและเงา (Shadow) ดูนุ่มนวลขึ้น
                <div 
                  key={`batch-card-${batchId}`}
                  className="bg-white border border-slate-100 rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mb-6 transition-all duration-300 hover:border-emerald-100 hover:shadow-[0_20px_40px_rgba(16,185,129,0.08)]"
                >
                  {/* ส่วนหัวของบิล (Header) */}
                  <div 
                    className={`p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                    onClick={() => toggleBatch(batchId)}
                  >
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      {/* 🔥 2. ตัวเลข SKU ปรับเป็น Rounded 2xl */}
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
                        {/* 🔥 3. ป้ายกลุ่ม ปรับเป็น Rounded-full (ทรงแคปซูล) */}
                        <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-1 inline-block uppercase italic border border-emerald-100/50">
                          กลุ่ม: {bItems[0]?.Group_ID || 'ทั่วไป'}
                        </p>
                      </div>
                    </div>
                      
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        {/* 🔥 เพิ่มเฉพาะปุ่มนี้เข้ามาครับ */}
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setTargetGroupId(batchId);
                              setIsAddingMore(true);
                              setBatchName(batchId);
                              
                              // 🔥 1. เอาของเก่าไปเก็บไว้ใน State Preview (existingItems)
                              setExistingItems(bItems); 

                              // 🔥 2. เคลียร์ตะกร้าของใหม่ (items) ให้ว่าง เพื่อเริ่มเลือกใหม่
                              setItems([]); 
                              
                              setIsModalOpen(true);
                            }}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-6 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border border-blue-100 shadow-sm active:scale-95"
                          >
                            ➕ เพิ่มรายการสินค้า
                          </button>

                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleOpenReview(batchId); 
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
                    

                    {/* ส่วนแสดงรายการสินค้าด้านใน (Expansion) - โค้ดเดิมทั้งหมด */}
                    {isExpanded && (
                      <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="h-px bg-slate-100 mb-6"></div>
                        
                        <div className="hidden lg:grid grid-cols-12 gap-5 px-8 py-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                          <div className="col-span-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">รหัสสินค้า (SKU)</div>
                          <div className="col-span-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">รายการสินค้า / SUP</div>
                          <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">สถานะสต็อก</div>
                          <div className="col-span-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">หมายเหตุจัดซื้อ</div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {bItems.map((item: OrderItem, idx: number) => {
                            const isLowStock = Number(item.warehouseQty || item.Stock_Qty) <= 5;
                            const note = item.notePurchase || item.noteReq || item.Note_Request || item.note;

                            return (
                              <div 
                                // 🔥 แก้ไขตรงนี้ครับ: ใช้คำนำหน้า + ชื่อบิล + รหัสสินค้า + ลำดับ (idx) 
                                // เพื่อให้มั่นใจ 100% ว่าต่อให้สินค้าซ้ำกันในบิลเดียว key ก็จะไม่ชนกัน
                                key={`order-item-${batchId}-${item.productId || item.Product_ID || 'no-id'}-${idx}`} 
                                className="group/item grid grid-cols-1 lg:grid-cols-12 items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 transition-all shadow-sm hover:shadow-md"
                              >
                                <div className="lg:col-span-2">
                                  <span className="inline-block bg-slate-950 text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm border-b-2 border-emerald-600">
                                    {item.productId || item.Product_ID || item.productID}
                                  </span>
                                </div>

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
                                
                                <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">หน้าร้าน</p>
                                    <p className="text-sm font-black text-slate-700">
                                      {item.orderQty || item.Shop_Qty || '0'}
                                    </p>
                                  </div>
                                  <div className={`px-3 py-2 rounded-xl border text-center transition-all ${
                                    isLowStock ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                                  }`}>
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">คลัง</p>
                                    <p className="text-sm font-black leading-none">
                                      {item.warehouseQty || item.Stock_Qty || '0'}
                                    </p>
                                  </div>
                                </div>

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
          ))}
        </div>

        {/* Pagination */}
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

      {/* --- New Batch Modal (Single Screen & Fixed Layout) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-110 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] w-full max-w-7xl h-[85vh] flex flex-col border border-white/50 animate-in zoom-in-95 duration-500 overflow-hidden">
            
            {/* --- Header: ลด Padding ลงเพื่อเพิ่มพื้นที่ทำงาน --- */}
            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                  <span className="text-xl">📦</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    New Purchase <span className="text-emerald-500 italic">Order</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">สร้างรายการจัดซื้อใหม่</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                ✕
              </button>
            </div>

            {/* --- Main Content Area: ล็อคความสูงไม่ให้เลื่อนทั้งหน้า --- */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* --- Left Side: Input Form (Fixed Area) --- */}
              <div className="w-[42%] p-10 bg-slate-50/50 border-r border-slate-100 flex flex-col">
                <div className="space-y-8">
                  
                  {/* Step 1: Batch Name - แถวยาวเต็มพื้นที่ด้านบน */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[9px]">01</span>
                      ชื่อรอบการสั่งซื้อ (Batch Name)
                    </label>
                    <input 
                      type="text" 
                      placeholder="ระบุชื่อรอบ เช่น: เครื่องเขียน ล็อตด่วน..." 
                      className={`w-full border p-5 rounded-3xl font-bold outline-none transition-all text-lg shadow-sm ${
                        isAddingMore ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-4 ring-blue-500/5'
                      }`}
                      value={batchName}
                      onChange={(e) => !isAddingMore && setBatchName(e.target.value)} // ถ้าไม่ใช่การเพิ่มของเดิม ให้พิมพ์ได้ปกติ
                      readOnly={isAddingMore} // ถ้าจะเพิ่มของเข้าบิลเดิม ห้ามแก้ชื่อ
                    />
                  </div>

                  {/* Step 2: Product Input Grid */}
                  <div className="space-y-3 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1 mb-2">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[9px]">02</span>
                      รายละเอียดสินค้า
                    </label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="text" placeholder="รหัสสินค้า" 
                        className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                        value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})}
                      />
                      <input 
                        type="text" placeholder="ชื่อสินค้า" 
                        className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                      <input 
                        type="number" placeholder="สต็อกหน้าร้าน" 
                        className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                        value={formData.storeQty} onChange={e => setFormData({...formData, storeQty: e.target.value})}
                      />
                      <input 
                        type="number" placeholder="สต็อกคลัง" 
                        className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                        value={formData.warehouseQty} onChange={e => setFormData({...formData, warehouseQty: e.target.value})}
                      />
                    </div>
                    <input 
                      type="text" placeholder="ชื่อซัพพลายเออร์" 
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400 transition-all"
                      value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})}
                    />
                    <textarea 
                      placeholder="หมายเหตุเพิ่มเติม..." 
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-400 transition-all h-20 resize-none"
                      value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}
                    />
                    <button 
                      onClick={addItemToTempList}
                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all active:scale-95"
                    >
                      + เพิ่มลงรายการ
                    </button>
                  </div>
                </div>
              </div>

              {/* --- Right Side: Preview List (Only this part scrolls if many items) --- */}
              <div className="flex-1 flex flex-col p-10 bg-white overflow-hidden">
                <div className="flex justify-between items-end mb-6 shrink-0">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Basket Items</h3>
                    <p className="text-2xl font-black text-slate-900">รายการสั่งซื้อในบิล <span className="text-blue-600">({(existingItems?.length || 0) + items.length})</span></p>
                  </div>
                  {items.length > 0 && (
                    <button onClick={() => setItems([])} className="text-[10px] font-black text-red-400 uppercase tracking-tighter hover:underline">Clear New Items</button>
                  )}
                </div>

                {/* ส่วนแสดงรายการสินค้า - ให้เลื่อนเฉพาะตรงนี้ถ้าของเยอะ */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {(existingItems?.length === 0 && items.length === 0) ? (
                    <div className="h-full border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center p-10 opacity-60">
                      <span className="text-4xl mb-3">🛍️</span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ยังไม่มีสินค้าในบิลนี้</p>
                    </div>
                  ) : (
                    <>
                      {/* 1. รายการเดิมที่มีอยู่ (แก้ไขไม่ได้ - แสดงเป็นสีจาง) */}
                      {existingItems?.map((item, i) => (
                        <div key={`existing-${item.id || i}`} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between opacity-60 grayscale-[0.5]">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 border border-slate-200 flex items-center justify-center font-black text-xs shrink-0">
                              {i + 1}
                            </div>
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-600 text-sm truncate uppercase tracking-tight">{item.name || item.Product_Name}</h4>
                                <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">On Bill</span>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">ID: {item.id || item.Product_ID} | รายการเดิมในระบบ</p>
                            </div>
                          </div>
                          <div className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400 italic">LOCKED</div>
                        </div>
                      ))}

                      {/* 2. รายการใหม่ที่กำลังเพิ่ม (แสดงสีปกติ - สามารถลบได้) */}
                      {items.map((item, i) => (
                        <div key={item.tempId || `new-${i}`} className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 flex items-center justify-between group animate-in slide-in-from-right-4 duration-300">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-lg shadow-blue-100">
                              {(existingItems?.length || 0) + i + 1}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{item.name}</h4>
                              <p className="text-[9px] font-bold text-blue-500 uppercase">ID: {item.id} | Stock: {item.storeQty}/{item.warehouseQty}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setItems(items.filter((_, idx) => idx !== i))} 
                            className="w-8 h-8 rounded-lg bg-white text-slate-300 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100 shadow-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Submit Section: ล็อคไว้ด้านล่างเสมอ */}
                <div className="pt-8 shrink-0">
                  <button 
                    onClick={submitBatch} 
                    disabled={items.length === 0 || !batchName || isSubmitting}
                    className={`w-full py-7 rounded-4xl font-black uppercase text-xs tracking-[0.4em] shadow-xl transition-all active:scale-[0.98] ${
                      items.length > 0 && !isSubmitting 
                        ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'Processing...' : '🚀 ยืนยันเพิ่มสินค้าลงบิล'}
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