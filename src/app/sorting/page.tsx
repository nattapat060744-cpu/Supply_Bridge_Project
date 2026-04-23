'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface OrderItem {
  tempId?: number;
  id: string;
  name: string;
  supplier: string;
  storeQty: string;
  warehouseQty: string;
  note: string;
  status?: string;
  batchId?: string;
  batchName?: string;
  createdAt?: string;
  orderCarton?: string;
  cartonUnit?: string;
  innerUnit?: string;
  qtyPerCarton?: string;
  Note_Purchase?: string;
  Recv_Carton?: string | number;
  Recv_Unit?: string;
  Recv_Qty?: string | number;
  Recv_Qty_Unit?: string;
  Note_Stock?: string;
  Recv_Date?: string; 
}

interface Notification {
  id: string;
  batchId: string;
  message: string;
  productName: string;
  batchName: string;
}

const parseThaiDate = (rawDate: string | number | Date) => {
  if (!rawDate) return new Date(0);
  
  let date: Date;

  if (rawDate instanceof Date) {
    date = rawDate;
  } else if (typeof rawDate === 'string') {
    const [datePart, timePart] = rawDate.split(' ');
    const [d, m, y] = datePart.split('/').map(Number);
    
    const yearAD = y > 2500 ? y - 543 : y;
    
    if (timePart) {
      const [hh, mm, ss] = timePart.split(':').map(Number);
      date = new Date(yearAD, m - 1, d, hh, mm, ss);
    } else {
      date = new Date(yearAD, m - 1, d);
    }
  } else {
    date = new Date(rawDate);
  }

  if (!isNaN(date.getTime())) {
    date.setHours(date.getHours() + 7);
  }

  return date;
};

const exportToExcel = async (batchId: string, activeBatches: Record<string, OrderItem[]>) => {
  const batchItems = activeBatches[batchId];
  if (!batchItems || batchItems.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('ใบขอสั่งซื้อ');

  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `📦 เอกสารขอสั่งซื้อสินค้า - ${batchItems[0].batchName || batchId}`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1B4332' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  const mergedCols = ['A', 'B', 'C', 'D', 'E', 'F', 'K', 'L'];
  mergedCols.forEach(col => worksheet.mergeCells(`${col}2:${col}3`));
  worksheet.mergeCells('G2:J2');

  const h = {
    A2: 'รหัสสินค้า/บาร์โค้ด', B2: 'ชื่อสินค้า', C2: 'บริษัทซัพพลายเออร์',
    D2: 'สินค้าในล็อก', E2: 'สต็อก', F2: 'ว/ดป สั่งซื้อ',
    G2: 'จำนวนที่สั่งซื้อ', G3: 'จำนวน', H3: 'ลัง/มัด',
    I3: 'จำนวน', J3: 'ชิ้น/โหล', K2: 'หมายเหตุ จัดซื้อ', L2: 'หมายเหตุ จัดเรียง'
  };
  Object.entries(h).forEach(([cell, val]) => worksheet.getCell(cell).value = val);

  [2, 3].forEach(rowNum => {
    const row = worksheet.getRow(rowNum);
    row.height = 25;
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E0' } }; // เหลืองครีมอ่อน
      cell.font = { bold: true, size: 10, color: { argb: 'FF444444' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  batchItems.forEach((item, index) => {
    const row = worksheet.addRow([
      item.id,
      item.name,
      item.supplier,
      item.storeQty || '0',
      item.warehouseQty || '0',
      item.createdAt ? parseThaiDate(item.createdAt).toLocaleDateString('th-TH') : '-',
      item.orderCarton || '0',
      item.cartonUnit || 'ลัง',
      item.qtyPerCarton || '0',
      item.innerUnit || 'ชิ้น',
      item.Note_Purchase || '-',
      item.note || '-'
    ]);

    row.height = 22;
    const isEven = index % 2 === 0;

    row.eachCell((cell, colNumber) => {
      if (!isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
      }
      
      cell.font = { size: 10, color: { argb: 'FF333333' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        right: { style: 'thin', color: { argb: 'FFEEEEEE' } }
      };

      if (colNumber === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      }
    });
  });

  worksheet.columns = [
    { width: 18 }, // รหัส
    { width: 45 }, // ชื่อสินค้า (กว้างพิเศษ)
    { width: 25 }, // ซัพพลายเออร์
    { width: 12 }, // ล็อก
    { width: 10 }, // สต็อก
    { width: 15 }, // วันที่
    { width: 10 }, // จำนวน (ลัง)
    { width: 10 }, // หน่วย
    { width: 10 }, // จำนวน (ชิ้น)
    { width: 10 }, // หน่วย
    { width: 20 }, // หมายเหตุซื้อ
    { width: 20 }  // หมายเหตุเรียง
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ใบขอสั่งซื้อ_${batchItems[0].batchName || 'ไม่มีชื่อบิล'}.xlsx`);
};

export default function SortingPage() {
  const router = useRouter();

  const [activeBatches, setActiveBatches] = useState<{ [key: string]: OrderItem[] }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());
  const previousDataRef = useRef<{ [key: string]: string }>({});
  const isInitialLoadRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissedBatchesRef = useRef<Set<string>>(new Set()); 
  const lastAlertedSnapshotRef = useRef<{ [key: string]: string }>({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const hasAutoScrolled = useRef<string | null>(null);

  const [batchName, setBatchName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({
    id: '', name: '', supplier: '', storeQty: '', warehouseQty: '', note: ''
  });

  const [expandedNotes, setExpandedNotes] = useState<{ [key: string]: boolean }>({});

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

const allFilteredBatchIds = useMemo(() => {
  const now = new Date().getTime();
  const oneDayInMs = 24 * 60 * 60 * 1000;

  const filtered = Object.keys(activeBatches).filter(batchId => {
    const batchItems = activeBatches[batchId];
    if (!batchItems || batchItems.length === 0) return false;

    /*const allDone = batchItems.every(i => i.status === 'COMPLETED');
    if (allDone) {
      const itemDate = batchItems[0]?.createdAt;
      const lastUpdate = parseThaiDate(itemDate || "").getTime();
      if (now - lastUpdate > oneDayInMs) return false;
    }*/

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    const matchBatchName = batchItems[0]?.batchName?.toLowerCase().includes(s);
    const matchItems = batchItems.some(item => 
      item.id?.toLowerCase().includes(s) || 
      item.name?.toLowerCase().includes(s) || 
      item.supplier?.toLowerCase().includes(s)
    );
    return matchBatchName || matchItems;
  });

  return filtered.sort((a, b) => {
    const timeA = parseThaiDate(activeBatches[a][0]?.createdAt || "").getTime();
    const timeB = parseThaiDate(activeBatches[b][0]?.createdAt || "").getTime();
    return timeB - timeA; 
  });

}, [activeBatches, searchTerm]);

 useEffect(() => {
  const latestBatchId = notifications.length > 0 ? notifications[notifications.length - 1].batchId : null;

  if (latestBatchId && hasAutoScrolled.current !== latestBatchId) {
    

    const element = document.getElementById(`batch-${latestBatchId}`);
    
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      hasAutoScrolled.current = latestBatchId;
      
      console.log("Auto scrolled to:", latestBatchId);
    }
  }

  if (notifications.length === 0) {
    hasAutoScrolled.current = null;
  }

}, [notifications, currentPage]); 

  const discrepancyItems = useMemo(() => {
    const allItems: OrderItem[] = Object.values(activeBatches).flat();
    return allItems.filter((item) => {
      const status = (item.status || '').toUpperCase();
      const isOrdered = status === 'ORDERED' || status === 'COMPLETED' || status === 'RECEIVED';
      if (!isOrdered) return false;

      const hasStartedRecv = (item.Recv_Carton !== null && item.Recv_Carton !== undefined && item.Recv_Carton !== "");
      if (!hasStartedRecv) return false;

      const orderedCTN = Number(item.orderCarton || 0);
      const receivedCTN = Number(item.Recv_Carton || 0);
      const expectedQtyInside = Number(item.qtyPerCarton || 0);
      const receivedQtyInside = Number(item.Recv_Qty || 0);

      return (receivedCTN !== orderedCTN) || (receivedQtyInside !== expectedQtyInside);
    });
  }, [activeBatches]);

  const stats = useMemo(() => {
      const total = allFilteredBatchIds.length; 
      const ordered = allFilteredBatchIds.filter(bid => {
        const batchItems = activeBatches[bid];
        const hasOrdered = batchItems.some(i => i.status === 'ORDERED' || i.orderCarton);
        const isAllDone = batchItems.every(i => i.status === 'COMPLETED');
        return hasOrdered && !isAllDone;
      }).length;
      const completed = allFilteredBatchIds.filter(bid => 
        activeBatches[bid].every(i => i.status === 'COMPLETED')
      ).length;

      return { total, ordered, completed };
    }, [allFilteredBatchIds, activeBatches]);

  const clearBatchNotifications = (batchId: string) => {
  setNotifications(prev => prev.filter(n => n.batchId !== batchId));
      
      const dismissed = JSON.parse(localStorage.getItem('dismissed_batches') || '{}');
      dismissed[batchId] = true; 
      localStorage.setItem('dismissed_batches', JSON.stringify(dismissed));

      const currentSnapshot = JSON.stringify(activeBatches[batchId] || []);
      localStorage.setItem(`snapshot_${batchId}`, currentSnapshot);

      setUpdatedItems(prev => {
        const next = new Set(prev);
        Array.from(next).forEach(key => {
          if (key.startsWith(`${batchId}-`)) next.delete(key);
        });
        return next;
      });
    };

  const handleAcknowledge = (batchId: string) => {
    const batchIndex = allFilteredBatchIds.indexOf(batchId);
    if (batchIndex !== -1) {
      const targetPage = Math.floor(batchIndex / itemsPerPage) + 1;
      setCurrentPage(targetPage);
    }
    setExpandedBatches(prev => ({ ...prev, [batchId]: true }));
    clearBatchNotifications(batchId);
    setTimeout(() => {
      const element = document.getElementById(`batch-${batchId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const trackChanges = (newData: OrderItem[]) => {
      const batchUpdates: { [key: string]: { count: number; batchName: string, items: any[] } } = {};
      let hasSnapshotChange = false;


      newData.forEach(item => {
        if (!item.batchId) return;
        if (!batchUpdates[item.batchId]) {
          batchUpdates[item.batchId] = { count: 0, batchName: item.batchName || item.batchId, items: [] };
        }
        batchUpdates[item.batchId].items.push(item);
      });

      const dismissed = JSON.parse(localStorage.getItem('dismissed_batches') || '{}');

      Object.entries(batchUpdates).forEach(([bid, info]) => {
        const currentBatchString = JSON.stringify(info.items);
        const lastSnapshot = localStorage.getItem(`snapshot_${bid}`);

        if (lastSnapshot === currentBatchString && dismissed[bid]) {
          return; 
        }

        let changeCount = 0;
        info.items.forEach(item => {
          const itemKey = `${item.batchId}-${item.id}`;
          const currentItemSnap = `${item.status}|${item.orderCarton}|${item.Note_Purchase}|${item.Recv_Carton}|${item.Note_Stock}`;
          const prevItemSnap = previousDataRef.current[itemKey];

          if (!isInitialLoadRef.current && prevItemSnap && prevItemSnap !== currentItemSnap) {
            changeCount++;
            setUpdatedItems(prev => new Set(prev).add(itemKey));
          }
          
          if (prevItemSnap !== currentItemSnap) {
            previousDataRef.current[itemKey] = currentItemSnap;
            hasSnapshotChange = true;
          }
        });

        if (changeCount > 0 && !dismissed[bid]) {
          const isAlreadyShowing = notifications.some(n => n.batchId === bid);
          if (!isAlreadyShowing) {
            setNotifications(prev => [{
              id: `${Date.now()}-${bid}`,
              batchId: bid,
              batchName: info.batchName,
              productName: `พบอัปเดตใหม่ ${changeCount} รายการ`,
              message: `มีการแก้ไขข้อมูลในบิลนี้`
            }, ...prev].slice(0, 5));

            if (audioRef.current) audioRef.current.play().catch(() => {});
            
            localStorage.setItem(`snapshot_${bid}`, currentBatchString);
          }
        } else if (changeCount > 0 && dismissed[bid]) {
          delete dismissed[bid];
          localStorage.setItem('dismissed_batches', JSON.stringify(dismissed));
        }
      });

      if (hasSnapshotChange) {
        localStorage.setItem('sampeng_snapshot_live', JSON.stringify(previousDataRef.current));
      }
      if (isInitialLoadRef.current) isInitialLoadRef.current = false;
    };

const fetchStatus = async () => {
    try {
      const res = await fetch('/api/order'); 
      if (!res.ok) return;
      
      const rawData = await res.json();

      const sortedData = Array.isArray(rawData) 
        ? [...rawData].sort((a: any, b: any) => {
            const dateA = new Date(a.Created_At || 0).getTime();
            const dateB = new Date(b.Created_At || 0).getTime();
            return dateB - dateA;
          }) 
        : [];

      const normalizedData: OrderItem[] = sortedData.map((item: any) => ({
        ...item,
        id: (item.id || item.Product_ID || '').toString(),
        name: item.Product_Name || item.name || 'ไม่มีชื่อสินค้า',
        supplier: item.Supplier || item.supplier || 'ไม่ระบุ',
        storeQty: (item.Shop_Qty || item.storeQty || '0').toString(),
        warehouseQty: (item.Stock_Qty || item.warehouseQty || '0').toString(),
        note: item.Note_Request || item.note || '',
        status: item.Status || item.status,
        batchId: item.Group_ID || item.batchId || 'no-batch',
        batchName: item.Group_Name || item.batchName || item.Group_ID || 'ไม่มีชื่อกลุ่ม',
        createdAt: item.Created_At || item.createdAt || new Date().toISOString(),
        orderCarton: (item.Order_Carton || item.orderCarton || '0').toString(),
        cartonUnit: item.Carton_Unit || item.cartonUnit || 'ลัง',
        innerUnit: item.Inner_Unit || item.innerUnit || 'ชิ้น',
        qtyPerCarton: (item.Qty_Per_Carton || item.qtyPerCarton || '0').toString(),
        Note_Purchase: item.Note_Purchase || item.notePurchase || '',
        Recv_Carton: item.Recv_Carton || '',
        Recv_Unit: item.Recv_Unit || item.Carton_Unit || 'ลัง',
        Recv_Qty: item.Recv_Qty || '',
        Recv_Qty_Unit: item.Recv_Qty_Unit || item.Inner_Unit || 'ชิ้น',
        Recv_Date: item.Recv_Date || '',
        Note_Stock: item.Note_Stock || ''
      }));

      trackChanges(normalizedData);

      const grouped = normalizedData.reduce((acc: any, item: OrderItem) => {
        const key = item.batchId || 'no-batch';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      setActiveBatches(grouped);
      
    } catch (err) {
      console.error("❌ Fetch status error:", err);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBatchIds = allFilteredBatchIds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allFilteredBatchIds.length / itemsPerPage);

  const groupedByDate = useMemo(() => {
      const groups: { [key: string]: { batchId: string, items: OrderItem[] }[] } = {};
      
      currentBatchIds.forEach((batchId) => {
        const items = activeBatches[batchId];
        if (!items || items.length === 0) return;

        const dateVal = items[0]?.createdAt || items[0]?.Recv_Date || "";
        const d = parseThaiDate(dateVal);

        if (isNaN(d.getTime())) return;

        const dateKey = d.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push({ batchId, items });
      });

      return groups;
    }, [currentBatchIds, activeBatches]);

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
        if (!savedUser.name || (savedUser.department !== 'SORTING' && savedUser.department !== 'ADMIN')) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }

        await fetchStatus(); 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);

  useEffect(() => {
      const savedSnapshot = localStorage.getItem('sampeng_snapshot_live');
      if (savedSnapshot) {
        previousDataRef.current = JSON.parse(savedSnapshot);
      }
      
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const addItemToTempList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name || formData.storeQty === '' || formData.warehouseQty === '') {
      return alert("กรอกข้อมูลให้ครบก่อนครับ (รหัส, ชื่อ, และจำนวน)");
    }
    const newItem: OrderItem = { ...formData, tempId: Date.now() };
    setItems([...items, newItem]);
    setFormData({ id: '', name: '', supplier: formData.supplier, storeQty: '', warehouseQty: '', note: '' });
  };

const submitBatch = async () => {
    // 1. ดักข้อมูลเบื้องต้น: ชื่อรอบต้องมี และต้องมีสินค้าในลิสต์
    if (items.length === 0 || !batchName.trim()) {
      return alert("พี่ชายช่วยตั้งชื่อรอบและเพิ่มสินค้าก่อนส่งนะครับ");
    }

    // 2. 🔥 ดักรายการที่ข้อมูลไม่สมบูรณ์ (ชื่อสินค้าว่าง หรือ จำนวนที่กรอกเป็น 0 หรือค่าว่าง)
    const invalidItems = items.filter(
      (it) => !it.name.trim() || !it.storeQty || Number(it.storeQty) <= 0
    );

    if (invalidItems.length > 0) {
      return alert(
        `มีรายการสินค้า ${invalidItems.length} รายการที่ยังไม่ได้ใส่ชื่อหรือจำนวน พี่ชายช่วยเช็คหน่อยครับ`
      );
    }

    setIsSubmitting(true);

    const now = new Date();
    // ใช้รูปแบบวันที่มาตรฐาน YYYY-MM-DD เพื่อให้หลังบ้านนำไปใช้งานหรือจัดเรียงได้ง่ายขึ้น
    // แต่ส่วนชื่อบิลยังคงใช้แบบไทยตามที่พี่ชายต้องการครับ
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear() + 543}`;
    
    const finalBatchName = `${batchName.trim()} (${dateStr})`;
    const customGroupId = finalBatchName; 

    try {
      const res = await fetch('/api/order', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupId: customGroupId,
          groupName: finalBatchName,
          // 🔥 ปรับ Mapping ชื่อ Field ให้เป็นมาตรฐาน (ใช้ camelCase ที่เข้าใจง่าย)
          items: items.map(it => ({
            productID: it.id,      // ใช้ ID ตัวใหญ่ตามหน้าสต็อก
            productName: it.name,
            supplier: it.supplier,
            shopQty: Number(it.storeQty),
            stockQty: Number(it.warehouseQty),
            note: it.note,
            createdAt: now.toISOString() // ส่งเวลาสร้างแบบสากลไปด้วย
          }))
        }),
      });

      if (res.ok) {
        alert('🚀 ส่งบิลเรียบร้อยแล้วครับ!');
        setItems([]);
        setBatchName('');
        setIsModalOpen(false);
        if (typeof fetchStatus === 'function') fetchStatus();
      } else {
        const errorData = await res.json();
        alert(`เกิดข้อผิดพลาด: ${errorData.message || 'ส่งข้อมูลไม่สำเร็จ'}`);
      }
    } catch (error) {
      console.error("Submit Error:", error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อครับพี่ชาย');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
      
      {/* Notification Toast */}
      <div className="fixed bottom-6 right-6 z-100 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {notifications.map((note) => (
          <div key={note.id} className="pointer-events-auto bg-white border-l-4 border-blue-500 shadow-2xl p-4 rounded-2xl animate-in slide-in-from-right-full duration-500">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">อัปเดต</span>
              <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== note.id))} className="text-slate-300 hover:text-slate-500">✕</button>
            </div>
            <h5 className="text-xs font-black text-slate-900 uppercase italic truncate">{note.batchName}</h5>
            <p className="text-[10px] text-slate-500 font-bold mb-3">{note.productName}</p>
            <button 
              onClick={() => handleAcknowledge(note.batchId)}
              className="w-full bg-slate-900 text-white text-[9px] font-black uppercase py-2 rounded-xl hover:bg-blue-600 transition-colors"
            >
              รับทราบ & ขยายดู
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-10">
        
        {/* Header Section */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between bg-white p-8 md:p-12 rounded-[40px] shadow-sm relative overflow-hidden text-slate-900 border-b-8 border-blue-600">
            <div className="relative z-10">
              <span className="text-[12px] font-black text-blue-600 uppercase tracking-[0.4em] mb-3 block">
                Sorting & Distribution Control
              </span>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none">
                จัดการ <span className="text-blue-600 not-italic">จัดเรียงสินค้า</span>
              </h1>
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                ระบบติดตามสถานะสินค้า - สำเพ็ง บุรีรัมย์
              </p>
            </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-8 md:mt-0 bg-blue-600 hover:bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3"
          >
            <span className="text-xl">+</span> สร้างคำขอใหม่
          </button>
        </div>

        {/* Issue Tracking Section (Design like requested) */}
        <section className="mb-12">
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
                  const diffCarton = Number(item.Recv_Carton || 0) - Number(item.orderCarton || 0);
                  const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);
                  
                  return (
                    <div key={`issue-${item.id || idx}`} className="shrink-0 w-72 snap-start bg-white p-5 rounded-[28px] border-2 border-red-50 shadow-sm hover:border-red-200 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                            {item.id}
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
                        {item.name || item.name}
                      </h4>

                  <div className="bg-slate-50 rounded-2xl p-3 mb-4">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400 uppercase font-black">สั่งซื้อ</span>
                      <span className="text-slate-900 font-black">{item.orderCarton} {item.cartonUnit}(+ {item.qtyPerCarton || 0} {item.innerUnit})</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 uppercase font-black">รับจริง</span>
                      <span className="text-red-600 font-black">{item.Recv_Carton} {item.cartonUnit} (+ {item.Recv_Qty || 0} {item.innerUnit})</span>
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
        </section>

        {/* Stats & Search */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
            <input 
              type="text" 
              placeholder="ค้นหาบิล หรือชื่อสินค้า..." 
              className="w-full bg-white border border-slate-100 p-6 pl-16 rounded-3xl font-bold outline-none focus:ring-4 ring-blue-500/10 shadow-sm transition-all text-lg placeholder:text-slate-300"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex items-center justify-center gap-4 min-w-55">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">📦</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">บิลทั้งหมด</p>
              <p className="text-2xl font-black text-blue-600 leading-none">{stats.total}</p>
            </div>
          </div>
        </div>
        

        {/* Batch Monitoring Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 mb-6 px-2">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">รายการบิลที่กำลังดำเนินการ</h2>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          
          {loading && Object.keys(activeBatches).length === 0 ? (
            <div className="text-center py-20 font-black text-slate-300 uppercase tracking-widest text-xs">กำลังโหลดข้อมูลสถานะสด...</div>
          ) : currentBatchIds.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs">
              ไม่พบข้อมูลที่ตรงกับการค้นหาครับ
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(groupedByDate).map(([dateLabel, batchesInDate]) => (
                <div key={dateLabel} className="space-y-6">
                  
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

                  {/* รายการบิลของวันนั้นๆ */}
                  {/* batchesInDate อาจจะเป็น Array ของ string หรือ object ขึ้นอยู่กับโครงสร้าง groupedByDate ของพี่ชาย */}
                  {/* ในที่นี้ผมแก้ให้รองรับทั้งแบบ string และแบบที่มี .batchId ครับ */}
                  {batchesInDate.map((item: any) => {
                    const batchId = typeof item === 'string' ? item : item.batchId;
                    const batchItems = activeBatches[batchId];
                    if (!batchItems) return null;

                    const isExpanded = expandedBatches[batchId];

                    const isStep2Active = batchItems.some((i: OrderItem) => 
                      i.status !== 'PENDING' && (Number(i.orderCarton) > 0 || Number(i.qtyPerCarton) > 0)
                    );
                    const isStep3Active = batchItems.some((i: OrderItem) => 
                      i.status === 'ORDERED' || 
                      i.status === 'RECEIVED' || 
                      (i.Recv_Carton !== '' && i.Recv_Carton !== null && Number(i.Recv_Carton) > 0)
                    );
                    const isStep4Active = batchItems.length > 0 && batchItems.every((i: OrderItem) => i.status === 'COMPLETED');

                    let currentIcon = '🛒';
                    let statusBgColor = 'bg-blue-500';

                    if (isStep4Active) {
                      currentIcon = '🏁';
                    } else if (isStep3Active) {
                      currentIcon = '🚚';
                    } else if (isStep2Active) {
                      currentIcon = '🛒';
                    }

                    const hasUpdateInBatch = batchItems.some((item: OrderItem) => updatedItems.has(`${batchId}-${item.id}`));
                    return (
                      <div key={batchId} id={`batch-${batchId}`} className={`rounded-[40px] overflow-hidden transition-all border border-slate-100 ${isExpanded ? 'bg-white shadow-xl scale-[1.01]' : 'bg-white/60 hover:bg-white'}`}>
                        <div 
                          onClick={() => {
                            const nextExpanded = !isExpanded;
                            setExpandedBatches((prev: Record<string, boolean>) => ({ ...prev, [batchId]: nextExpanded }));
                            if (nextExpanded) clearBatchNotifications(batchId);
                          }}
                          className={`w-full p-6 md:p-10 flex justify-between items-center transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900 text-white' : 'text-slate-900'}`}
                        >
                          {/* ฝั่งซ้าย: ไอคอนและชื่อบิล */}
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm relative transition-all duration-300 ${
                              isExpanded ? 'bg-blue-600' : statusBgColor
                            }`}>
                              <span className={`leading-none ${currentIcon === '🚚' ? 'animate-pulse' : ''}`}>
                                {currentIcon}
                              </span>
                              {hasUpdateInBatch && !isExpanded && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 border-4 border-white rounded-full animate-ping"></span>
                              )}
                            </div>

                            <div className="text-left">
                              <span className={`text-[10px] font-black uppercase block tracking-[0.2em] mb-1 ${isExpanded ? 'opacity-40' : 'text-slate-400'}`}>
                                ชื่อรอบการสั่งซื้อ
                              </span>
                              <h2 className="text-xl font-black uppercase italic leading-none tracking-tight">
                                {batchItems[0]?.batchName || batchId}
                              </h2>
                            </div>
                          </div>

                          {/* ฝั่งขวา: ปุ่ม Export และ ลูกศร (รวมกลุ่มกัน) */}
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                exportToExcel(batchId, activeBatches);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-900/20 whitespace-nowrap"
                            >
                              <span>📊</span>
                              <span className="hidden md:inline">EXPORT EXCEL</span>
                            </button>

                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 border-white/20 text-white' : 'border-slate-200 text-slate-400'}`}>
                              ↓
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-6 md:p-10 space-y-10 bg-slate-50/30">
                            <div className="max-w-3xl mx-auto bg-white p-8 rounded-[35px] shadow-sm border border-slate-100">
                              <div className="relative flex justify-between items-center px-6">
                                <div className="absolute top-5 left-16 right-16 h-0.5 bg-slate-100 z-0"></div>
                                
                                {/* จุดที่ 1: สร้างคำขอ */}
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                  <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg text-sm">✓</div>
                                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-tighter">สร้างคำขอ</span>
                                </div>

                                {/* จุดที่ 2: สั่งซื้อแล้ว */}
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                                    isStep2Active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-200'
                                  }`}>🛒</div>
                                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isStep2Active ? 'text-emerald-600' : 'text-slate-300'}`}>สั่งซื้อแล้ว</span>
                                </div>

                                {/* จุดที่ 3: กำลังส่ง */}
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                                    isStep3Active ? 'bg-amber-500 text-white animate-pulse shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-200'
                                  }`}>🚚</div>
                                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isStep3Active ? 'text-amber-600' : 'text-slate-300'}`}>กำลังส่ง</span>
                                </div>

                                {/* จุดที่ 4: เรียบร้อย */}
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                                    isStep4Active ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-200'
                                  }`}>🏁</div>
                                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isStep4Active ? 'text-slate-900' : 'text-slate-300'}`}>เรียบร้อย</span>
                                </div>
                              </div>
                            </div>

                            {/* Items Table */}
                            <div className="bg-white rounded-[35px] border border-slate-100 overflow-hidden shadow-sm">
                              <div className="hidden md:block px-10 py-5 bg-slate-900">
                                <div className="flex items-center gap-6">
                                  <div className="flex-1 text-white text-[10px] font-black uppercase tracking-[0.2em] italic">ชื่อสินค้า / รายละเอียด</div>
                                  <div className="flex items-center gap-4 min-w-137.5">
                                    <div className="w-27.5 text-white text-[10px] font-black uppercase tracking-widest text-center">ข้อมูลจัดซื้อ</div>
                                    <div className="w-27.5 text-white text-[10px] font-black uppercase tracking-widest text-center">ข้อมูลรับของ</div>
                                    <div className="flex-1 text-white text-[10px] font-black uppercase tracking-widest pl-4">หมายเหตุ</div>
                                    <div className="w-32 text-white text-[10px] font-black uppercase tracking-widest text-center">สถานะ</div>
                                  </div>
                                </div>
                              </div>

                              <div className="divide-y divide-slate-50">
                                {batchItems.map((order: OrderItem, idx: number) => {
                                  const itemKey = `${batchId}-${order.id}`;
                                  const isItemUpdated = updatedItems.has(itemKey);

                                  return (
                                    <div key={idx} className={`p-6 md:px-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-700 ${isItemUpdated ? 'bg-blue-50 border-l-8 border-blue-500' : 'hover:bg-slate-50/50 border-l-8 border-transparent'}`}>
                                      <div className="flex-1 w-full md:w-auto">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[9px] bg-slate-100 px-3 py-1 rounded-full font-black text-slate-500 uppercase tracking-tighter">ID: {order.id}</span>
                                          {isItemUpdated && (
                                            <span className="flex h-2 w-2 relative">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="font-black text-slate-900 uppercase italic tracking-tight text-lg leading-tight">{order.name}</h4>
                                        {order.note && <p className="text-[10px] text-blue-600 font-black mt-2 italic flex items-center gap-1"><span>📝</span> {order.note}</p>}
                                      </div>

                                      <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto bg-slate-50 md:bg-transparent p-5 md:p-0 rounded-3xl min-w-137.5">
                                        <div className="text-center md:border-r md:border-slate-100 md:pr-4 min-w-27.5">
                                          <span className="block text-[9px] font-black text-slate-300 uppercase mb-2 md:hidden">ข้อมูลจัดซื้อ</span>
                                          {order.orderCarton || order.qtyPerCarton ? (
                                            <div className="flex flex-col items-center">
                                              <div className="text-base font-black text-emerald-700 leading-none">{order.orderCarton || '0'} <span className="text-[9px] text-emerald-400 uppercase">{order.cartonUnit || 'ลัง'}</span></div>
                                              <div className="mt-1.5 pt-1.5 border-t border-emerald-100 w-full text-[11px] font-black text-slate-500 leading-none">
                                                {order.qtyPerCarton || '0'} <span className="text-[9px] text-slate-400 uppercase">{order.innerUnit || 'ชิ้น'}</span>
                                              </div>
                                            </div>
                                          ) : <span className="text-[10px] font-black text-slate-300 italic uppercase">รอจัดซื้อ</span>}
                                        </div>

                                        <div className="text-center md:border-r md:border-slate-100 md:pr-4 min-w-27.5">
                                          <span className="block text-[9px] font-black text-slate-300 uppercase mb-2 md:hidden">ข้อมูลรับของ</span>
                                          {(order.Recv_Carton !== undefined && order.Recv_Carton !== null && order.Recv_Carton !== '') ? (
                                            <div className="flex flex-col items-center">
                                              <div className="text-base font-black text-yellow-600 leading-none">{order.Recv_Carton} <span className="text-[9px] text-yellow-400 uppercase">{order.Recv_Unit || 'ลัง'}</span></div>
                                              <div className="mt-1.5 pt-1.5 border-t border-yellow-100 w-full text-[11px] font-black text-slate-500 leading-none">
                                                {order.Recv_Qty || '0'} <span className="text-[9px] text-slate-400 uppercase">{order.Recv_Qty_Unit || 'ชิ้น'}</span>
                                              </div>
                                            </div>
                                          ) : <span className="text-[10px] font-black text-slate-300 italic uppercase">รอเข้าคลัง</span>}
                                        </div>

                                        <div className="flex-1 w-full md:w-auto text-center md:text-left px-2">
                                          <span className="block text-[9px] font-black text-slate-300 uppercase mb-2 md:hidden">หมายเหตุ</span>
                                          <div className="text-[10px] font-bold italic leading-tight space-y-1.5">
                                            {order.Note_Stock && (
                                              <div onClick={() => toggleNote(`${batchId}-${order.id}-stock`)} className="cursor-pointer hover:bg-slate-50 p-1 rounded transition-all">
                                                <p className={`text-yellow-600 font-black ${expandedNotes[`${batchId}-${order.id}-stock`] ? 'whitespace-normal' : 'truncate'}`}>
                                                  🏁 {order.Note_Stock}
                                                </p>
                                              </div>
                                            )}
                                            {order.Note_Purchase && (
                                              <div onClick={() => toggleNote(`${batchId}-${order.id}-pur`)} className="cursor-pointer hover:bg-slate-50 p-1 rounded transition-all">
                                                <p className={`text-emerald-600 font-black ${expandedNotes[`${batchId}-${order.id}-pur`] ? 'whitespace-normal' : 'truncate'}`}>
                                                  💬 {order.Note_Purchase}
                                                </p>
                                              </div>
                                            )}
                                            {!order.Note_Stock && !order.Note_Purchase && <span className="text-slate-200">-</span>}
                                          </div>
                                        </div>

                                        <div className={`w-full md:w-32 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight border text-center transition-all shadow-sm ${
                                            order.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                            order.status === 'COMPLETED' ? 'bg-slate-900 text-white border-slate-900' : 
                                            (order.status === 'ORDERED' || order.status === 'RECEIVED') ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' : 
                                            'bg-blue-50 text-blue-600 border-blue-100'
                                          }`}>
                                          {order.status === 'REJECTED' ? '✖ ปฏิเสธ' : 
                                          order.status === 'COMPLETED' ? '🏁 เรียบร้อย' : 
                                          order.status === 'RECEIVED' ? '🚚 กำลังนำส่ง (บางส่วน)' :
                                          order.status === 'ORDERED' ? '🚚 กำลังนำส่ง' : '⏳ รอจัดซื้อ'}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>  
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

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

        {/* Modal: New Batch (Style adjusted) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-100 p-4">
            {/* ล็อกความสูงสูงสุดที่ 90% ของหน้าจอ */}
            <div className="bg-white rounded-[45px] shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col border-t-8 border-blue-600 animate-in fade-in zoom-in-95 duration-300">
              
              {/* Header: ติดอยู่กับที่ */}
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">สร้าง <span className="text-blue-500 not-italic">บิลสั่งซื้อใหม่</span></h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ระบุรายละเอียดสินค้าที่ต้องการสั่งครับ</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-rose-600 transition-colors text-xl">✕</button>
              </div>

              {/* Body: แบ่งซ้าย-ขวา และเลื่อนเฉพาะข้างใน */}
              <div className="flex flex-col md:flex-row overflow-hidden flex-1">
                
                {/* ฝั่งซ้าย: ฟอร์มกรอกข้อมูล (Scrollable) */}
                <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar border-r border-slate-100">
                  <div className="bg-blue-50/50 p-6 rounded-[30px] border border-blue-100">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] block mb-2 ml-1">1. ชื่อรอบการสั่งซื้อ</label>
                    <input 
                      className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 ring-blue-500/5 transition-all" 
                      placeholder="เช่น ของใช้ทั่วไป 14/03/69" 
                      value={batchName} 
                      onChange={(e) => setBatchName(e.target.value)} 
                    />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[30px] border border-slate-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">2. เพิ่มรายการสินค้า</label>
                    <form onSubmit={addItemToTempList} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none focus:ring-4 ring-blue-500/5 transition-all" placeholder="รหัสสินค้า" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} required />
                        <input className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none focus:ring-4 ring-blue-500/5 transition-all" placeholder="ชื่อสินค้า" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">หน้าร้าน:</span>
                          <input type="number" className="w-full p-4 pl-16 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" value={formData.storeQty} onChange={(e) => setFormData({...formData, storeQty: e.target.value})} required />
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">ในคลัง:</span>
                          <input type="number" className="w-full p-4 pl-16 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" value={formData.warehouseQty} onChange={(e) => setFormData({...formData, warehouseQty: e.target.value})} required />
                        </div>
                      </div>
                      <input className="w-full p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" placeholder="ชื่อซัพพลายเออร์ (ถ้าทราบ)" value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} />
                      <textarea className="w-full p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" placeholder="หมายเหตุถึงจัดซื้อ..." rows={2} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
                      <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg">
                        + เพิ่มเข้าบิล
                      </button>
                    </form>
                  </div>
                </div>

                {/* ฝั่งขวา: รายการที่เลือกแล้ว (Fixed Section) */}
                <div className="w-full md:w-95 bg-slate-50 p-8 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายการในบิล ({items.length})</p>
                    {items.length > 0 && <button onClick={() => setItems([])} className="text-[9px] font-black text-rose-500 uppercase hover:underline">ล้างทั้งหมด</button>}
                  </div>
                  
                  {/* รายการสินค้าที่เลื่อนได้ภายในพื้นที่ที่เหลือ */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-6 custom-scrollbar">
                    {items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[30px] text-slate-300 p-6 text-center">
                        <span className="text-3xl mb-2">📥</span>
                        <p className="font-black text-[9px] uppercase tracking-widest leading-loose">เพิ่มสินค้าจากด้านซ้าย<br/>เพื่อเริ่มสร้างบิลครับ</p>
                      </div>
                    ) : (
                      items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="overflow-hidden">
                            <span className="font-black text-xs uppercase italic text-slate-700 block truncate">{item.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">สต็อก: {item.storeQty}/{item.warehouseQty}</span>
                          </div>
                          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center justify-center text-[10px]">✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* ปุ่มกดยืนยัน (ติดอยู่กับขอบล่างของ Modal) */}
                  <button 
                    onClick={submitBatch} 
                    disabled={items.length === 0 || !batchName || isSubmitting}
                    className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 ${items.length > 0 && !isSubmitting ? 'bg-blue-600 text-white hover:bg-slate-900 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {isSubmitting ? 'กำลังส่งข้อมูล... ⏳' : '🚀 ส่งบิลเดี๋ยวนี้'}
                  </button>
                </div>
              </div>
            </div>
          </div>
)}
      </div>

    <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .custom-scrollbar-h::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar-h::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-h::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}