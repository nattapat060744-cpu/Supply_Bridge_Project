'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import IssueTracking from '@/components/IssueTracking';
import {useWorkPage} from '@/lib/use-work-page';

interface OrderItem {
  ID?: string;
  rowNumber?: string | number;
  id: string;
  rowUid?: string;
  revision?: number;
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
  Qty_Per_Carton?: string;
  cartonUnit?: string;
  Carton_Unit?: string;
  innerUnit?: string;
  Inner_Unit?: string;
  notePurchase?: string;
  isRejected?: boolean;
  status?: string;
  Note_Stock?: string;
  recvCarton?: string;
  Recv_Qty?: string;
  rowId?: string;
  tempId?: number;
  storeQty?: string;
  note?: string;
  Recv_Date?: string;
  notePur?: string;
  Created_At?: string;
  createdAt?: string;
  Created_At_P?: string;
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
  const [paging,setPaging]=useState(false);
  const itemsPerPage = 6;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());

  const [isAddingMore, setIsAddingMore] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState('');

const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

const [existingItems, setExistingItems] = useState<OrderItem[]>([]); // สำหรับโชว์เท่านั้น

const [selectedBatch, setSelectedBatch] = useState<OrderItem[] | null>(null);

const [authorized,setAuthorized]=useState(false);
const workPage=useWorkPage<OrderItem>({kind:'purchase',page:currentPage,q:searchTerm,enabled:authorized,onPage:setCurrentPage});
const loading=workPage.loading;
  useEffect(()=>{if(!workPage.loading)setPaging(false);},[workPage.loading]);
const rawData=workPage.issues;
const batches=useMemo(()=>workPage.items.reduce<Record<string,OrderItem[]>>((groups,item)=>{
 const key=item.batchId||item.Group_ID||'ทั่วไป';(groups[key]??=[]).push(item);return groups;
},{}),[workPage.items]);
const fetchPendingOrders=workPage.refresh;

  const groupedItems = useMemo(() => {
    const groups: { [key: string]: OrderItem[] } = {};
    const currentTime = new Date().getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    items.forEach((item) => {
      // ตรวจสอบเงื่อนไขการพิมพ์ค้นหา
      const matchesSearch =
        !searchTerm ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Product_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Group_ID?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return;

      const status = item.status?.toString().trim().toUpperCase();

      // ถ้าเป็น PENDING ให้โชว์ปกติ
      if (status === 'PENDING') {
        const key = item.batchId || item.Group_ID || 'unbatched';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
      // ถ้าเป็น ORDERED ให้เช็คเวลา 1 วันเพื่อให้โชว์ค้างบนหน้าหลักได้เลย
      else if (status === 'ORDERED') {
        const dateStr = item.Created_At_P || item.Created_At;
        if (dateStr) {
          const orderTime = parseThaiDate(dateStr);
          if (orderTime > 0 && currentTime - orderTime <= oneDayInMs) {
            const key = item.batchId || item.Group_ID || 'unbatched';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
          }
        }
      }
    });

    return groups;
  }, [items, searchTerm]);
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

        setAuthorized(true); 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);

  const handleOpenReview = (batchId: string) => {
    const itemsForReview = batches[batchId].map((item: OrderItem) => ({
      ...item, 
      id: (item.id || item.Product_ID || item.rowId || '').toString(),
      name: item.name || item.Product_Name || 'ไม่มีชื่อสินค้า',
      supplier: item.supplier || item.Supplier || '-',
      orderCarton: item.orderCarton || '', 
      qtyPerCarton: item.qtyPerCarton || '', 
      cartonUnit: item.cartonUnit || 'ลัง',
      innerUnit: item.innerUnit || 'ชิ้น',
      notePurchase: item.notePurchase ?? item.notePur ?? '',
      isRejected: false 
    }));
    setReviewItems(itemsForReview);
    setReviewBatch(batchId);
  };

    const getThaiTimestamp = () => {
    const now = new Date();
    return now.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  };

const handleFinalConfirm = async () => {
    if (isSubmitting) return;
    if (!confirm(`ยืนยันการบันทึกรายการชุดนี้ใช่ไหมครับ?`)) return;

    setIsSubmitting(true);
    try {
      const confirmedAt = new Date().toLocaleString('th-TH', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
      });

      const itemsToSubmit = reviewItems.map(item => {
        // 🔍 1. เช็คสถานะให้ชัวร์: 
        // ถ้าพี่กดปุ่ม "ไม่สั่ง" (isRejected === true) ให้เป็น REJECTED
        // ถ้าสถานะเดิมใน DB เป็น REJECTED อยู่แล้ว และพี่ไม่ได้กดแก้ ก็ให้คงไว้
        let finalStatus = item.isRejected ? 'REJECTED' : 'ORDERED';
        
        // กรณีพิเศษ: ถ้าเป็นรายการที่เคย Reject ไปแล้ว (ป้องกันสถานะเด้งกลับ)
        if (item.status === 'REJECTED' && !item.isRejected) {
           // ถ้าของเดิมคือ Rejected แต่พี่ไม่ได้กด Toggle กลับมา ระบบจะกันเหนียวให้เป็น Rejected เหมือนเดิม
           finalStatus = 'REJECTED';
        }

        return {
          id: item.id || item.ID || item.rowNumber, 
          rowUid: item.rowUid || '', revision: item.revision,
          productId: item.productId || item.Product_ID || '',
          status: finalStatus, 
          orderCarton: item.orderCarton,
          cartonUnit: item.cartonUnit,
          qtyPerCarton: item.qtyPerCarton,
          innerUnit: item.innerUnit,
          purchaseNote: item.notePurchase,
          purchaseQty: Number(item.orderCarton || 0) * Number(item.qtyPerCarton || 0),
          Created_At_P: confirmedAt 
        };
      });

      const res = await fetch('/api/purchase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsToSubmit,
          updatedAt: confirmedAt 
        }),
      });

      if (res.ok) {
        alert('🚀 บันทึกเรียบร้อย! แยกสถานะ ORDERED และ REJECTED ชัดเจนครับ');
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

  const addItem = (product: OrderItem) => {
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
        if (items.length === 0) return alert('ไม่มีรายการสินค้าในบิลครับ');

        setIsSubmitting(true);
        try {
          const now = new Date();
          
          // ✅ 1. วันที่สำหรับใส่ในชื่อบิล (เช่น 02/05/2569)
          const displayDate = now.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });

          // ✅ 2. เวลาสำหรับลงช่อง Created_At
          const thaiTimestamp = now.toLocaleString('th-TH', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
          });

          // ✅ 3. ชื่อบิล: เอาแค่ชื่อ + วันที่พอ (ไม่มีเลขแปลกๆ ต่อท้ายแล้ว)
          const finalBatchName = `${batchName.trim()} (${displayDate})`;

          const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              groupName: finalBatchName, // 👈 ส่งชื่อสะอาดๆ ไปโชว์ (ไม่มีตัวเลขยาวๆ)
              items: items,
              Created_At: thaiTimestamp, 
              // 💡 ตรงนี้ยังต้องมี Date.now() ไว้เพื่อให้ระบบหลังบ้านไม่สับสนถ้าพี่ตั้งชื่อซ้ำกันเป๊ะๆ
              groupId: `${batchName.trim().replace(/\s+/g, '_')}_${Date.now()}` 
            }),
          });

          if (res.ok) {
            alert(`🚀 สร้างบิล "${finalBatchName}" เรียบร้อย!`);
            setBatchName(''); 
            setItems([]); 
            setIsModalOpen(false); 
            fetchPendingOrders();
          } else {
            const errorData = await res.json();
            alert(`❌ เกิดข้อผิดพลาด: ${errorData.message || 'บันทึกไม่สำเร็จ'}`);
          }
        } catch (err) {
          console.error(err);
          alert('⚠️ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
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
  
  const filteredBatchKeys=Object.keys(batches);

  const groupedByDate = useMemo(() => {
      const groups: { [key: string]: string[] } = {};

      const indexOfLastItem = currentPage * itemsPerPage;
      const indexOfFirstItem = indexOfLastItem - itemsPerPage;
      const currentItemsInPage = filteredBatchKeys;

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
      // ✅ กลับไปใช้รูปแบบเวลาเดิม (ISO) เพื่อไม่ให้กระทบความเป็นจริงของข้อมูลตามที่พี่สั่ง
      const now = new Date().toISOString();
      
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
          isUpdate: true 
        }),
      });

      if (res.ok) {
        alert(`🚀 อัปเดตบิล "${targetGroupId}" เรียบร้อย!`);
        
        // ✅ ปิดหน้าจอและล้างค่า State ทั้งหมดให้ทันที
        setIsModalOpen(false);      
        setIsAddingMore(false);    
        setItems([]);              
        setExistingItems([]);      
        setTargetGroupId('');      
        setBatchName('');          

        fetchPendingOrders();
      } else {
        const errorData = await res.json();
        alert(`❌ เกิดข้อผิดพลาด: ${errorData.message || 'บันทึกไม่สำเร็จ'}`);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = workPage.totalPages;
  const currentBatches = filteredBatchKeys;

  if (loading && Object.keys(batches).length === 0) return (
    <div className="app-shell flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold animate-pulse">กำลังโหลดข้อมูล...</p>
    </div>
  );

  return (
    <div className="app-shell">
      {paging && <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[2px] cursor-wait" aria-busy="true">
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-bold text-slate-800 shadow-xl">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--tone)]" />
          กำลังโหลดหน้าที่ {currentPage}…
        </div>
      </div>}

      {workPage.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{workPage.error}</p>}
      {/* --- การแจ้งเตือน --- */}
      <div className="fixed top-6 right-6 z-100 flex flex-col gap-3">
        {notifications.map(noti => (
          <div key={noti.id} className="bg-white border-l-4 border-emerald-500 p-5 rounded-2xl shadow-xl flex items-center gap-4 pop-in min-w-[320px] max-w-100">
            <div className="text-2xl">📦</div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-semibold text-emerald-600 truncate">อัปเดต: {noti.batchName}</p>
              <p className="text-slate-900 font-bold text-xs truncate">{noti.productName}</p>
            </div>
            <button onClick={() => setNotifications(n => n.filter(x => x.id !== noti.id))} className="ml-auto text-slate-300 hover:text-slate-600">✕</button>
          </div>
        ))}
      </div>

      <div className="app-container">
        {workPage.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{workPage.error}</p>}
        {/* --- ส่วนหัวข้อ --- */}
        <section className="app-hero mb-6 flex flex-col gap-5 p-6 pl-8 md:flex-row md:items-end md:justify-between md:p-8 md:pl-10">
          <div>
            <p className="page-kicker mb-3">Purchase Order</p>
            <h1 className="page-title font-display">สั่งซื้อสินค้า</h1>
            <p className="page-subtitle mt-2">จัดการรายการขอซื้อจากธุรการคลัง และบันทึกประวัติการสั่งซื้อ</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="metric-tile px-5 py-3 text-center">
              <p className="text-2xl font-bold leading-none">{workPage.total}</p>
              <p className="mt-1 text-xs font-medium">บิลที่กำลังดำเนินการ</p>
            </div>
            <button onClick={() => fetchPendingOrders()} className="secondary-action">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" /></svg>
              รีเฟรช
            </button>
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
              className="primary-action"
            >
              <span className="text-lg leading-none">+</span> สร้างบิลใหม่
            </button>
          </div>
        </section>

        <IssueTracking items={rawData} />


        <div className="relative mb-6">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            aria-label="ค้นหารอบสั่งซื้อหรือสินค้า"
            placeholder="ค้นหารอบสั่งซื้อ หรือชื่อสินค้า"
            className="control-field w-full py-3.5 pl-12 pr-4 text-base"
            value={searchTerm || ''}
            onChange={(e) => {setSearchTerm(e.target.value);setCurrentPage(1);}}
          />
        </div>

        {/* --- รายการบิลสินค้า --- */}
        <div className="space-y-10">
          {Object.entries(groupedByDate).map(([dateLabel, batchIds], groupIdx) => (
            // 🔥 เติม idx เข้าไปใน key ของกลุ่มวันที่
            <div key={`date-group-${dateLabel}-${groupIdx}`} className="space-y-6">
              
              {/* --- ส่วนหัวข้อวันที่ (Date Header) --- */}
              <div className="sticky top-[67px] z-10 flex items-center gap-3 bg-[var(--bg)]/90 py-2 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[var(--tone)]" />
                <h3 className="text-sm font-semibold text-[var(--ink)]">{dateLabel}</h3>
                <span className="text-xs text-[var(--muted)]">{batchIds.length} บิล</span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>

              {/* --- รายการบิลของวันนั้นๆ --- */}
              {batchIds.map((batchId) => {
                const bItems = batches[batchId] || [];
                const isExpanded = expandedBatches.has(batchId);

              return (
                // 🔥 1. แก้ไข className ที่นี่ เพื่อให้การ์ดมีมุมมนและเงา (Shadow) ดูนุ่มนวลขึ้น
                <div 
                  key={`batch-card-${batchId}`}
                  className="app-card overflow-hidden mb-5 transition-all duration-300 hover:border-emerald-200"
                >
                  {/* ส่วนหัวของบิล (Header) */}
                  <div
                    role="button" tabIndex={0} aria-expanded={isExpanded}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleBatch(batchId); } }}
                    className={`flex cursor-pointer flex-col gap-4 p-5 transition-colors md:flex-row md:items-center md:justify-between md:p-6 ${isExpanded ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'}`}
                    onClick={() => toggleBatch(batchId)}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-center transition-all ${isExpanded ? 'bg-[var(--tone-ink)] text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                        <div>
                          <p className="text-lg font-bold leading-none">{bItems.length}</p>
                          <p className="text-[10px]">รายการ</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-[var(--ink)]">{batchId}</h2>
                        <p className="mt-1 text-xs text-[var(--muted)]">กลุ่ม: {bItems[0]?.Group_ID || 'ทั่วไป'}</p>
                      </div>
                    </div>

                    <div className="flex w-full items-center gap-2 md:w-auto">
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
                        className="secondary-action"
                      >
                        + เพิ่มสินค้า
                      </button>
                      <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleOpenReview(batchId); 
                          }}
                        className="primary-action flex-1 md:flex-none"
                      >
                        จัดการใบสั่งซื้อ
                      </button>
                      <svg aria-hidden="true" className={`shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[var(--tone-ink)]' : 'text-slate-300'}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  </div>
                    

                    {/* ส่วนแสดงรายการสินค้าด้านใน (Expansion) - โค้ดเดิมทั้งหมด */}
                    {isExpanded && (
                      <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="h-px bg-slate-100 mb-6"></div>
                        
                        <div className="hidden lg:grid grid-cols-12 gap-5 px-8 py-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                          <div className="col-span-2 text-[11px] font-semibold text-slate-400 tracking-wider">รหัสสินค้า (SKU)</div>
                          <div className="col-span-4 text-[11px] font-semibold text-slate-400 tracking-wider">รายการสินค้า / SUP</div>
                          <div className="col-span-3 text-[11px] font-semibold text-slate-400 tracking-wider text-center">สถานะสต็อก</div>
                          <div className="col-span-3 text-[11px] font-semibold text-slate-400 tracking-wider">หมายเหตุจัดซื้อ</div>
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
                                  <span className="inline-block bg-emerald-50 !text-emerald-800 ring-1 ring-emerald-200 text-[11px] font-semibold px-3 py-1.5 rounded-lg">
                                    {item.productId || item.Product_ID || item.productID}
                                  </span>
                                </div>

                                <div className="lg:col-span-4">
                                  <div className="flex flex-col">
                                    <p className="font-semibold text-[15px] text-slate-800 group-hover/item:text-emerald-600 transition-colors">
                                      {item.name || item.Product_Name || item.productName}
                                    </p>
                                    <span className="text-[11px] font-bold text-slate-400 mt-1">
                                      SUP: {item.supplier || item.Supplier || '-'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[11px] font-semibold text-slate-400 mb-1">หน้าร้าน</p>
                                    <p className="text-sm font-semibold text-slate-700">
                                      {item.orderQty || item.Shop_Qty || '0'}
                                    </p>
                                  </div>
                                  <div className={`px-3 py-2 rounded-xl border text-center transition-all ${
                                    isLowStock ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                                  }`}>
                                    <p className="text-[11px] font-semibold text-slate-400 mb-1">คลัง</p>
                                    <p className="text-sm font-semibold leading-none">
                                      {item.warehouseQty || item.Stock_Qty || '0'}
                                    </p>
                                  </div>
                                </div>

                                <div className="lg:col-span-3">
                                  {note ? (
                                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                      <p className="text-[11px] font-bold text-amber-600 leading-relaxed">
                                        📌 {note}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-300 ">ไม่มีหมายเหตุ</span>
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
          <div className="mt-10 flex flex-col items-center justify-between gap-4 pb-6 md:flex-row">
            <p className="text-sm text-[var(--muted)]">หน้า {currentPage} จาก {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                aria-label="หน้าก่อนหน้า"
                onClick={() => {setPaging(true);setCurrentPage(prev => Math.max(prev - 1, 1));}}
                disabled={paging || workPage.loading || currentPage === 1}
                className="secondary-action h-10 w-10 !p-0"
              >←</button>
              <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm">
                {(() => {
                  const pages = [];
                  const range = 1;
                  for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
                      const on = currentPage === i;
                      pages.push(
                        <button
                          key={i} aria-current={on ? 'page' : undefined}
                          disabled={paging || workPage.loading || on}
                          onClick={() => {setPaging(true);setCurrentPage(i);}}
                          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${on ? 'bg-[var(--tone-ink)] text-white' : 'text-[var(--muted)] hover:bg-slate-100'}`}
                        >{i}</button>
                      );
                    } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
                      pages.push(<span key={i} className="px-1 text-slate-300">…</span>);
                    }
                  }
                  return pages;
                })()}
              </div>
              <button
                aria-label="หน้าถัดไป"
                onClick={() => {setPaging(true);setCurrentPage(prev => Math.min(prev + 1, totalPages));}}
                disabled={paging || workPage.loading || currentPage === totalPages}
                className="secondary-action h-10 w-10 !p-0"
              >→</button>
            </div>
          </div>
        )}
      </div>

      {/* --- Review Modal (Reviewing existing batch) --- */}
      {reviewBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-110 p-2 md:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] overflow-hidden flex flex-col border border-white animate-in fade-in zoom-in-95 duration-300">
            
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div>
                  <p className="text-emerald-600 text-[11px] font-semibold mb-1">ยืนยันรายการสั่งซื้อ</p>
                  <h2 className="text-2xl md:text-3xl font-semibold text-slate-900">ตรวจสอบ: {reviewBatch}</h2>
                </div>
                <button 
                  onClick={autoFillOrderQty}
                  className="bg-slate-100 hover:bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-semibold text-[11px] transition-all flex items-center gap-2 border border-emerald-100"
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
                  <div className="flex-1 min-w-50 text-white text-[11px] font-semibold tracking-wide ">ชื่อสินค้า / รายละเอียด</div>
                  <div className="grid grid-cols-2 gap-3 min-w-50 text-white text-[11px] font-semibold text-center">
                    <span>ยอดจากร้าน</span>
                    <span>คลังเหลือ</span>
                  </div>
                  <div className="w-50 text-white text-[11px] font-semibold text-center">จำนวนสั่ง (ลัง × ชิ้น)</div>
                  <div className="w-11"></div>
                  <div className="flex-[1.5] md:max-w-75 text-white text-[11px] font-semibold md:pl-6">หมายเหตุการสั่งซื้อ</div>
                  <div className="w-24"></div>
                </div>
              </div>

              <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                {reviewItems.map((item, idx) => (
                  <div key={`review-item-${item.id || idx}`} className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row items-center gap-6 ${item.isRejected ? 'bg-red-50/50 border-red-100 opacity-60' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'}`}>
                    <div className="flex-1 min-w-50 w-full">
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded mb-1 inline-block">ID: {item.productId || item.Product_ID}</span>
                      <div className="font-semibold text-base text-slate-800 truncate">{item.name || item.Product_Name}</div>
                      <span className="text-[11px] font-bold text-emerald-600 ">ซัพ: {item.supplier || item.Supplier}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 min-w-50">
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center justify-center">
                        <span className="text-[11px] font-semibold text-slate-400 mb-1 md:hidden">ยอดจากร้าน</span>
                        <span className="text-xl font-semibold text-slate-900">{item.orderQty || item.Shop_Qty}</span>
                      </div>
                      <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center ${Number(item.warehouseQty || item.Stock_Qty) <= 5 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                        <span className="text-[11px] font-semibold text-slate-400 mb-1 md:hidden">คลังเหลือ</span>
                        <span className={`text-xl font-semibold ${Number(item.warehouseQty || item.Stock_Qty) <= 5 ? 'text-red-500' : 'text-slate-900'}`}>{item.warehouseQty || item.Stock_Qty}</span>
                      </div>
                    </div>

                    {!item.isRejected ? (
                      <div className="flex items-center bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-sm gap-1">
                        <div className="flex flex-col items-center min-w-22.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-emerald-100 group transition-all hover:border-emerald-400">
                          <span className="text-[11px] font-semibold text-emerald-600 mb-1 opacity-70">สั่ง (ลัง)</span>
                          <div className="flex items-baseline gap-1">
                            <input 
                              type="number" 
                              className="w-12 bg-transparent text-slate-900 text-center font-semibold text-2xl outline-none" 
                              value={item.orderCarton || ''} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].orderCarton = e.target.value;
                                setReviewItems(newItems);
                              }} 
                            />
                            <input 
                              type="text"
                              className="w-8 bg-transparent text-[11px] text-slate-400 font-bold outline-none focus:text-emerald-600"
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

                        <div className="flex flex-col items-center min-w-22.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-blue-100 group transition-all hover:border-blue-400">
                          <span className="text-[11px] font-semibold text-blue-600 mb-1 opacity-70">แพ็ค (ชิ้น)</span>
                          <div className="flex items-baseline gap-1">
                            <input 
                              type="number" 
                              className="w-12 bg-transparent text-slate-900 text-center font-semibold text-2xl outline-none" 
                              value={item.qtyPerCarton} 
                              onChange={e => {
                                const newItems = [...reviewItems];
                                newItems[idx].qtyPerCarton = e.target.value;
                                setReviewItems(newItems);
                              }} 
                            />
                            <input 
                              type="text"
                              className="w-8 bg-transparent text-[11px] text-slate-400 font-bold outline-none focus:text-blue-600"
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
                      <div className="w-60 text-center text-red-400 font-semibold text-[11px] tracking-wide border-2 border-dashed border-red-100 py-5 rounded-2xl bg-red-50/30 ">
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
                      className={`h-14 w-24 rounded-2xl font-semibold text-[11px]   transition-all ${item.isRejected ? 'bg-emerald-600 text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}
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
                   <p className="text-[11px] font-semibold text-slate-400 mb-1">สถานะคิวงาน</p>
                   <p className="text-2xl font-semibold text-slate-900 leading-none">
                     {reviewItems.filter(i => !i.isRejected).length} <span className="text-emerald-600">รายการพร้อมสั่ง</span>
                   </p>
                 </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={() => setReviewBatch(null)} className="px-8 py-5 font-semibold text-xs text-slate-400 hover:text-slate-900 transition-all">ยกเลิก</button>
                <button 
                  onClick={handleFinalConfirm} 
                  disabled={isSubmitting || reviewItems.every(i => !i.orderCarton && !i.isRejected)} 
                  className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-emerald-600 px-12 py-5 rounded-2xl font-semibold text-sm shadow-xl transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-300"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-7xl h-[85vh] flex flex-col border border-white/50 animate-in zoom-in-95 duration-500 overflow-hidden">
            
            {/* --- Header: ลด Padding ลงเพื่อเพิ่มพื้นที่ทำงาน --- */}
            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="text-xl">📦</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight ">
                    New Purchase <span className="text-emerald-500 ">Order</span>
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 tracking-wide">สร้างรายการจัดซื้อใหม่</p>
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
                    <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-2 ml-1">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[11px]">01</span>
                      ชื่อรอบการสั่งซื้อ (Batch Name)
                    </label>
                    <input 
                      type="text" 
                      placeholder="ระบุชื่อรอบ เช่น: เครื่องเขียน ล็อตด่วน..." 
                      className={`w-full border p-5 rounded-2xl font-bold outline-none transition-all text-lg shadow-sm ${
                        isAddingMore ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-4 ring-blue-500/5'
                      }`}
                      value={batchName}
                      onChange={(e) => !isAddingMore && setBatchName(e.target.value)} // ถ้าไม่ใช่การเพิ่มของเดิม ให้พิมพ์ได้ปกติ
                      readOnly={isAddingMore} // ถ้าจะเพิ่มของเข้าบิลเดิม ห้ามแก้ชื่อ
                    />
                  </div>

                  {/* Step 2: Product Input Grid */}
                  <div className="space-y-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-2 ml-1 mb-2">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[11px]">02</span>
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
                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-[11px] shadow-lg hover:bg-blue-600 transition-all active:scale-95"
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
                    <h3 className="text-[11px] font-semibold tracking-wide text-slate-400 mb-1">Basket Items</h3>
                    <p className="text-2xl font-semibold text-slate-900">รายการสั่งซื้อในบิล <span className="text-blue-600">({(existingItems?.length || 0) + items.length})</span></p>
                  </div>
                  {items.length > 0 && (
                    <button onClick={() => setItems([])} className="text-[11px] font-semibold text-red-400 hover:underline">Clear New Items</button>
                  )}
                </div>

                {/* ส่วนแสดงรายการสินค้า - ให้เลื่อนเฉพาะตรงนี้ถ้าของเยอะ */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {(existingItems?.length === 0 && items.length === 0) ? (
                    <div className="h-full border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center p-10 opacity-60">
                      <span className="text-4xl mb-3">🛍️</span>
                      <p className="text-[11px] font-semibold text-slate-400 ">ยังไม่มีสินค้าในบิลนี้</p>
                    </div>
                  ) : (
                    <>
                      {/* 1. รายการเดิมที่มีอยู่ (แก้ไขไม่ได้ - แสดงเป็นสีจาง) */}
                      {existingItems?.map((item, i) => (
                        <div key={`existing-${item.id || i}`} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between opacity-60 grayscale-[0.5]">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 border border-slate-200 flex items-center justify-center font-semibold text-xs shrink-0">
                              {i + 1}
                            </div>
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-600 text-sm truncate tracking-tight">{item.name || item.Product_Name}</h4>
                                <span className="text-[11px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-semibold ">On Bill</span>
                              </div>
                              <p className="text-[11px] font-bold text-slate-400 ">ID: {item.id || item.Product_ID} | รายการเดิมในระบบ</p>
                            </div>
                          </div>
                          <div className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-400 ">LOCKED</div>
                        </div>
                      ))}

                      {/* 2. รายการใหม่ที่กำลังเพิ่ม (แสดงสีปกติ - สามารถลบได้) */}
                      {items.map((item, i) => (
                        <div key={item.tempId || `new-${i}`} className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 flex items-center justify-between group animate-in slide-in-from-right-4 duration-300">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm">
                              {(existingItems?.length || 0) + i + 1}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-semibold text-slate-800 text-sm truncate tracking-tight">{item.name}</h4>
                              <p className="text-[11px] font-bold text-blue-500 ">ID: {item.id} | Stock: {item.storeQty}/{item.warehouseQty}</p>
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
                    className={`w-full py-7 rounded-2xl font-semibold  text-xs tracking-wide shadow-xl transition-all active:scale-[0.98] ${
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

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';