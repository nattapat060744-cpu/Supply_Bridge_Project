'use client';
import { parseBusinessDate } from '@/lib/dates';
import { acknowledgeSortingBatch,currentNotificationUser,NOTIFICATION_EVENT,notificationRowKey,pendingNotificationKey,readNotificationState } from '@/lib/sorting-notifications';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import IssueTracking from '@/components/IssueTracking';

interface OrderItem {
  Row_UID?: string;
  ChangeSignature?: string;
  Revision?: number;
  tempId?: number;
  id: string;
  Product_ID?: string;
  Product_Name?: string;
  Supplier?: string;
  Shop_Qty?: string | number;
  Stock_Qty?: string | number;
  Note_Request?: string;
  Group_ID?: string;
  Group_Name?: string;
  Created_At?: string;
  Order_Carton?: string | number;
  Carton_Unit?: string;
  Inner_Unit?: string;
  Qty_Per_Carton?: string | number;
  name: string;
  supplier: string;
  Status?: string;
  storeQty: string;
  warehouseQty: string;
  note: string;
  status?: string;
  batchId?: string;
  batchName?: string;
  createdAt?: string;
  Created_At_P?: string;
  orderCarton?: string;
  cartonUnit?: string;
  innerUnit?: string;
  Recv_Carton_Unit?: string;
  qtyPerCarton?: string;
  Note_Purchase?: string;
  notePurchase?: string;
  Recv_Carton?: string | number;
  Recv_Unit?: string;
  Recv_Qty?: string | number;
  Recv_Qty_Unit?: string;
  Note_Stock?: string;
  Recv_Date?: string; 
}

type DateBatchGroup = { batchId: string; items: OrderItem[] };

interface Notification {
  id: string;
  batchId: string;
  message: string;
  productName: string;
  batchName: string;
}

interface DuplicateWarning {
  isOpen: boolean;
  productId: string;
  productName: string;
  existingOrder: string;
  pendingAction?: () => void;
}

const parseThaiDate = parseBusinessDate;

  const exportToExcel = async (batchId: string, activeBatches: Record<string, OrderItem[]>) => {
    const batchItems = activeBatches[batchId];
    if (!batchItems || batchItems.length === 0) return;

    const [{default:ExcelJS},{default:saveAs}]=await Promise.all([import('exceljs'),import('file-saver')]);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ใบขอสั่งซื้อ');

    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `เอกสารขอสั่งซื้อสินค้า - ${batchItems[0].batchName || batchId}`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1B4332' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    const mergedCols = ['A', 'B', 'C', 'D', 'E', 'F', 'K', 'L', 'M'];
    mergedCols.forEach(col => worksheet.mergeCells(`${col}2:${col}3`));
    worksheet.mergeCells('G2:J2');

    const h = {
      A2: 'รหัสสินค้า/บาร์โค้ด', B2: 'ชื่อสินค้า', C2: 'บริษัทซัพพลายเออร์',
      D2: 'สถานะ', E2: 'สินค้าในล็อก', F2: 'สต็อก',
      G2: 'จำนวนที่สั่งซื้อ', G3: 'ว/ด/ป สั่งซื้อ', H3: 'จำนวน', I3: 'ลัง/มัด',
      J3: 'จำนวน', K3: 'ชิ้น/โหล', L2: 'หมายเหตุ จัดซื้อ', M2: 'หมายเหตุ ฝ่ายธุรการคลัง'
    };
    Object.entries(h).forEach(([cell, val]) => worksheet.getCell(cell).value = val);

    [2, 3].forEach(rowNum => {
      const row = worksheet.getRow(rowNum);
      row.height = 25;
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E0' } }; // สีครีมอ่อน
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
      item.Status || 'PENDING',
      item.storeQty || '0',
      item.warehouseQty || '0',
      item.Created_At_P ? parseThaiDate(item.Created_At_P).toLocaleDateString('th-TH') : '-',
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
    { width: 25 }, // บริษัทซัพพลายเออร์
    { width: 15 }, // สถานะ
    { width: 12 }, // ล็อก
    { width: 10 }, // สต็อก
    { width: 15 }, // วันที่
    { width: 10 }, // จำนวน (ลัง)
    { width: 10 }, // หน่วย
    { width: 10 }, // จำนวน (ชิ้น)
    { width: 10 }, // หน่วย
    { width: 20 }, // หมายเหตุจัดซื้อ
    { width: 20 }  // หมายเหตุฝ่ายธุรการคลัง
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
  const [exportingBatch, setExportingBatch] = useState<string | null>(null);
  const exportInProgress = useRef(false);
  const [exportError, setExportError] = useState('');

  const handleExport = async (batchId: string) => {
    if (exportInProgress.current) return;
    exportInProgress.current = true;
    setExportingBatch(batchId);
    setExportError('');
    try {
      await exportToExcel(batchId, activeBatches);
    } catch (error) {
      console.error('Sorting Excel export failed', error);
      setExportError('ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่ได้ให้รีเฟรชหน้าเว็บ');
    } finally {
      exportInProgress.current = false;
      setExportingBatch(null);
    }
  };
  const [currentDepartment, setCurrentDepartment] = useState('');
  const isReadOnlyViewer = currentDepartment === 'SORTING_VIEWER';
  const canManageSorting = currentDepartment === 'SORTING' || currentDepartment === 'ADMIN' || currentDepartment === 'STOCK_SORTING_MANAGER';
  const canExportSorting = canManageSorting || currentDepartment === 'SORTING_VIEWER';

  const [pendingScrollBatch,setPendingScrollBatch] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [paging,setPaging]=useState(false);
  const [totalBatches,setTotalBatches]=useState(0);
  const [totalPages,setTotalPages]=useState(1);
  const [pageBatchIds,setPageBatchIds]=useState<string[]>([]);
  const [locateBatch,setLocateBatch]=useState('');
  const [loadError,setLoadError]=useState('');
  const pageParams=useRef({page:1,q:'',locateBatch:''});
  pageParams.current={page:currentPage,q:searchTerm,locateBatch};
  const pageRequest=useRef<AbortController|null>(null);
  const pageSequence=useRef(0);


  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [originalId, setOriginalId] = useState(''); // ✅ 1. เพิ่มบรรทัดนี้เพื่อล็อก ID เดิม

  const [batchName, setBatchName] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [formData, setFormData] = useState({
    id: '', name: '', supplier: '', Status: 'PENDING', storeQty: '', warehouseQty: '', note: ''
  });

  const [expandedNotes, setExpandedNotes] = useState<{ [key: string]: boolean }>({});

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning>({ 
    isOpen: false, 
    productId: '', 
    productName: '', 
    existingOrder: '',
    pendingAction: undefined
  });
  const [tempFormData, setTempFormData] = useState<OrderItem | null>(null);

const stats={total:totalBatches};
const clearBatchNotifications = (batchId: string) => {
    acknowledgeSortingBatch(currentNotificationUser(),batchId,activeBatches[batchId]||[]);
  };
  const handleAcknowledge=useCallback((batchId:string)=>{
    setSearchTerm('');setLocateBatch(batchId);
    setExpandedBatches(prev=>({...prev,[batchId]:true}));setPendingScrollBatch(batchId);
  },[]);
  useEffect(()=>{
    const sync=()=>{
      const state=readNotificationState(currentNotificationUser());
      setNotifications(state.notices.map(n=>({id:n.id,batchId:n.batchId,batchName:n.batchName,productName:n.message,message:n.message})));
      setUpdatedItems(new Set(state.notices.flatMap(n=>n.changedKeys)));
    };
    sync();
    window.addEventListener(NOTIFICATION_EVENT,sync);
    window.addEventListener('storage',sync);
    return()=>{window.removeEventListener(NOTIFICATION_EVENT,sync);window.removeEventListener('storage',sync);};
  },[]);
  useEffect(()=>{
    const open=(event?:Event)=>{
      const key=pendingNotificationKey(currentNotificationUser());
      let queued='';try{queued=sessionStorage.getItem(key)||'';}catch{/* Storage may be disabled. */}
      const requested=(event as CustomEvent<{batchId?:string}>)?.detail?.batchId||queued;
      // Never open an unrelated bill when a requested notification was already read.
      const target=requested||notifications[0]?.batchId;
      if(target){
        try{sessionStorage.removeItem(key);}catch{/* No persistent queue available. */}
        handleAcknowledge(target);
      }
    };
    window.addEventListener('sorting-notification-open',open);
    let queued=false;try{queued=!!sessionStorage.getItem(pendingNotificationKey(currentNotificationUser()));}catch{/* No queued item. */}
    if(queued)open();
    return()=>window.removeEventListener('sorting-notification-open',open);
  },[notifications,activeBatches,handleAcknowledge]);

const fetchStatus = async () => {
    pageRequest.current?.abort();
    const controller=new AbortController();pageRequest.current=controller;
    const sequence=++pageSequence.current;
    setLoading(true);setLoadError('');
    try {
      const params=pageParams.current;
      const query=new URLSearchParams({page:String(params.page),q:params.q,...(params.locateBatch?{locateBatch:params.locateBatch}:{})});
      const res=await fetch('/api/order/page?'+query,{signal:controller.signal});
      if(!res.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      const result=await res.json();
      if(sequence!==pageSequence.current)return;
      const rawData=result.items;
      setTotalBatches(result.total);setTotalPages(result.totalPages);setPageBatchIds(result.batchIds);
      if(result.page!==params.page)setCurrentPage(result.page);
      if(params.locateBatch)setLocateBatch('');

      const sortedData = Array.isArray(rawData) 
        ? [...rawData].sort((a: OrderItem, b: OrderItem) => {
            const dateA = new Date(a.Created_At || 0).getTime();
            const dateB = new Date(b.Created_At || 0).getTime();
            return dateB - dateA;
          }) 
        : [];

      const normalizedData: OrderItem[] = sortedData.map((item: OrderItem) => ({
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



      const grouped = normalizedData.reduce<Record<string, OrderItem[]>>((acc, item) => {
        const key = item.batchId || 'no-batch';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      setActiveBatches(grouped);
      
    } catch (err) {
      if(sequence===pageSequence.current && !controller.signal.aborted)setLoadError(err instanceof Error?err.message:'โหลดข้อมูลไม่สำเร็จ');
    } finally {if(sequence===pageSequence.current){setLoading(false);setPaging(false);}}
  };

  const currentBatchIds=pageBatchIds;

  const groupedByDate = useMemo(() => {
      const groups: { [key: string]: { batchId: string, items: OrderItem[] }[] } = {};
      
      currentBatchIds.forEach((batchId) => {
        const items = activeBatches[batchId];
        if (!items || items.length === 0) return;

        const dateVal = items[0]?.createdAt || items[0]?.Recv_Date || "";
        const d = parseThaiDate(dateVal);

        if (isNaN(d.getTime())) {const key='ไม่ระบุวันที่';(groups[key]??=[]).push({batchId,items});return;}

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
  useEffect(()=>{
    if(!pendingScrollBatch)return;
    const element=document.getElementById(`batch-${pendingScrollBatch}`);
    if(element){
      element.scrollIntoView({behavior:'smooth',block:'center'});
      acknowledgeSortingBatch(currentNotificationUser(),pendingScrollBatch,activeBatches[pendingScrollBatch]||[]);
      setPendingScrollBatch(null);
    }
  },[pendingScrollBatch,groupedByDate,activeBatches]);


  useEffect(() => {
    const checkAuthAndFetch = async () => {
      if (typeof window === 'undefined') return;

      const savedUserStr = localStorage.getItem('user');
      const lastLoginDate = localStorage.getItem('loginDate'); // 1. ดึงวันที่เข้าเครื่องมา
      const today = new Date().toLocaleDateString('th-TH');    // 2. สร้างวันที่ปัจจุบัน (ไทย)

      if (!savedUserStr || savedUserStr === "undefined" || lastLoginDate !== today) {
        router.push('/');
        return;
      }

      try {
        const savedUser = JSON.parse(savedUserStr);
        const allowedDepartments = ['SORTING', 'ADMIN', 'SORTING_VIEWER', 'STOCK_SORTING_MANAGER'];
        if (!savedUser.name || !allowedDepartments.includes(savedUser.department)) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }
        setCurrentDepartment(savedUser.department);

        // Page data loads after the account is validated. 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);

  useEffect(()=>{
    pageRequest.current?.abort();++pageSequence.current;
    if(!currentDepartment)return;
    const timer=setTimeout(()=>void fetchStatus(),searchTerm?250:0);
    return()=>{clearTimeout(timer);pageRequest.current?.abort();};
  },[currentPage,searchTerm,locateBatch,currentDepartment]);
  useEffect(() => {
      const interval = setInterval(() => {
        // ✅ ไม่ poll ถ้าแท็บนี้ถูกซ่อนอยู่ กัน request ที่ไม่จำเป็น
        if (document.visibilityState === 'visible') {
          fetchStatus();
        }
      }, 30000);
      return () => clearInterval(interval);
    }, []);



  const addItemToTempList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name || formData.storeQty === '' || formData.warehouseQty === '') {
      return alert("กรอกข้อมูลให้ครบก่อนครับ (รหัส, ชื่อ, และจำนวน)");
    }
    
    // ตรวจสอบ Duplicate Order
    checkDuplicateOrder(formData);
  };

  const checkDuplicateOrder = async (product: OrderItem) => {
    try {
      const res = await fetch('/api/order/page?'+new URLSearchParams({productId:product.id}));
      if(!res.ok)throw new Error('ตรวจสอบรายการซ้ำไม่ได้');
      const orders = (await res.json()).items;
      
      // หา order ที่ Product_ID ตรงกัน และยังไม่ได้รับ (Recv_Date ว่าง)
      // และ Status ไม่ใช่ COMPLETED หรือ REJECTED
      const existingOrder = orders.find((order: OrderItem) => 
        order.Product_ID === product.id && 
        (!order.Recv_Date || order.Recv_Date.trim() === '') &&
        order.Status !== 'COMPLETED' &&
        order.Status !== 'REJECTED'
      );
      
      if (existingOrder) {
        // สร้างข้อความแสดงบิลพร้อมวันที่
        let dateStr = '';
        
        // พยายามอ่านวันที่จากหลายรูปแบบ
        if (existingOrder.Created_At && existingOrder.Created_At.trim() !== '') {
          try {
            // ถ้า Created_At เป็น Thai date format เช่น "28/06/2569 10:30:00"
            const date = parseThaiDate(existingOrder.Created_At);
            if (!isNaN(date.getTime())) {
              dateStr = date.toLocaleDateString('th-TH');
            }
          } catch (e) {
            // ถ้า parse ไม่ได้ใช้วันที่เดิม
            dateStr = existingOrder.Created_At;
          }
        }
        
        // ถ้าหาวันที่ไม่ได้ให้แสดงแค่ชื่อบิล
        const billInfo = dateStr 
          ? `${existingOrder.Group_Name || 'การสั่งซื้อ'} (${dateStr})`
          : `${existingOrder.Group_Name || 'การสั่งซื้อ'}`;
        
        // เจอสินค้าที่ยังไม่ได้รับ - แสดง Warning Modal
        setDuplicateWarning({
          isOpen: true,
          productId: product.id,
          productName: product.name,
          existingOrder: billInfo,
          pendingAction: () => proceedAddItem(product)
        });
      } else {
        // ไม่เจอสินค้าที่ค้างอยู่ - เพิ่มเข้าลิสต์เลย
        proceedAddItem(product);
      }
    } catch (err) {
      console.error("Error checking duplicate:", err);
      // ถ้ามี error ให้เพิ่มแบบปกติ
      proceedAddItem(product);
    }
  };

  const proceedAddItem = (product: OrderItem) => {
    const newItem: OrderItem = { ...product, tempId: Date.now() };
    setItems([...items, newItem]);
    setFormData({ id: '', name: '', Status: 'PENDING', supplier: '', storeQty: '', warehouseQty: '', note: '' });
    setDuplicateWarning({ isOpen: false, productId: '', productName: '', existingOrder: '' });
  };

  const submitBatch = async () => {
      if (items.length === 0 || !batchName.trim()) return alert("กรุณาตั้งชื่อรอบและเพิ่มสินค้าก่อนครับ");
      
      setIsSubmitting(true);

      const now = new Date();
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
            items: items.map(it => ({
              productId: it.id,
              productName: it.name,
              supplier: it.supplier,
              shopQty: Number(it.storeQty),
              stockQty: Number(it.warehouseQty),
              note: it.note
            }))
          }),
        });

        if (res.ok) {
          alert('ส่งบิลเรียบร้อยแล้วครับ!');
          setItems([]);
          setBatchName('');
          setIsModalOpen(false);setCurrentPage(1);
          if (typeof fetchStatus === 'function') fetchStatus();
        } else {
          alert('เกิดข้อผิดพลาดในการส่งข้อมูลครับ');
        }
      } catch (error) {
        console.error('Error submitting items:', error);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อครับ');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleDeleteItem = async (item: OrderItem) => {
    if (!confirm(`ยืนยันการลบรายการ "${item.name}" ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/order?${new URLSearchParams({rowUid:item.Row_UID || '',revision:String(item.Revision ?? '')})}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('ลบข้อมูลเรียบร้อยแล้วครับ!');
        fetchStatus(); // อัปเดตหน้าจอใหม่หลังลบข้อมูลเรียบร้อยแล้ว
      } else {
        const failure=await res.json(); alert(failure.message || 'ลบไม่สำเร็จครับ');
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingItem) return;

      try {
        const res = await fetch('/api/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowUid:editingItem.Row_UID, revision:editingItem.Revision, oldId: originalId,           // ✅ ใช้ ID ตั้งเดิมที่เราล็อกไว้
            id: editingItem.id,          // ค่า ID ใหม่จากช่อง Input
            groupId: editingItem.batchId,
            productName: editingItem.name,
            shopQty: Number(editingItem.storeQty),
            stockQty: Number(editingItem.warehouseQty),
            note: editingItem.note,
            supplier: editingItem.supplier
          }),
        });

        if (res.ok) {
          alert('อัปเดตข้อมูลเรียบร้อยแล้วครับ!');
          setIsEditModalOpen(false);
          fetchStatus();
        } else {
          const errorData = await res.json();
          alert(`⚠️ อัปเดตไม่สำเร็จ: ${errorData.message || errorData.error || 'ไม่พบรายการ'}`);
        }
      } catch (err) {
        console.error('Failed to update item:', err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    };

  return (
    <div className="app-shell pb-20">
      {paging && <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[2px] cursor-wait" aria-busy="true">
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-bold text-slate-800 shadow-xl">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--tone)]" />
          กำลังโหลดหน้าที่ {currentPage}…
        </div>
      </div>}

<div className="app-container">
        {exportError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{exportError}</p>}
        
        {/* Header Section */}
          <section className="app-hero mb-6 flex flex-col gap-5 p-6 pl-8 md:flex-row md:items-end md:justify-between md:p-8 md:pl-10">
            <div>
              <p className="page-kicker mb-3">Sorting & Distribution</p>
              <h1 className="page-title font-display">ฝ่ายธุรการคลัง</h1>
              <p className="page-subtitle mt-2">ติดตามสถานะสินค้าที่ขาด ตั้งแต่แจ้งคำขอจนของเข้าคลัง</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="metric-tile px-5 py-3 text-center">
                <p className="text-2xl font-bold leading-none">{stats.total}</p>
                <p className="mt-1 text-xs font-medium">บิลทั้งหมด</p>
              </div>
              {canManageSorting && (
                <button onClick={() => setIsModalOpen(true)} className="primary-action">
                  <span className="text-lg leading-none">+</span> สร้างคำขอใหม่
                </button>
              )}
            </div>
          </section>
        <IssueTracking items={Object.values(activeBatches).flat()} />

        


        {/* Stats & Search */}
        <div className="relative mb-6">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            aria-label="ค้นหาบิลหรือสินค้า"
            placeholder="ค้นหาบิล หรือชื่อสินค้า"
            className="control-field w-full py-3.5 pl-12 pr-4 text-base"
            value={searchTerm || ''}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        

        {/* Batch Monitoring Section */}
        <section className="space-y-6">

          
          {loadError && <p role="alert" className="p-4 text-red-700">{loadError}</p>}
          {loading && Object.keys(activeBatches).length === 0 ? (
            <div className="space-y-4" aria-busy="true">
              {[0, 1, 2].map((n) => (
                <div key={n} className="app-card flex items-center gap-4 p-6">
                  <div className="skeleton h-12 w-12 !rounded-2xl" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-5 w-56" /><div className="skeleton h-3 w-32" /></div>
                </div>
              ))}
            </div>
          ) : currentBatchIds.length === 0 ? (
            <div className="app-card px-6 py-16 text-center">
              <p className="font-semibold text-[var(--ink)]">ไม่พบบิลที่ตรงกับคำค้นหา</p>
              <p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนคำค้น หรือสร้างคำขอใหม่</p>
              {searchTerm && <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="secondary-action mt-4">ล้างคำค้นหา</button>}
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(groupedByDate).map(([dateLabel, batchesInDate]) => (
                <div key={dateLabel} className="space-y-6">
                  
                  {/* --- ส่วนหัวของวันที่ (Date Header) --- */}
                  <div className="sticky top-[67px] z-10 flex items-center gap-3 bg-[var(--bg)]/90 py-2 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-[var(--tone)]" />
                    <h3 className="text-sm font-semibold text-[var(--ink)]">{dateLabel}</h3>
                    <span className="text-xs text-[var(--muted)]">{batchesInDate.length} บิล</span>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                  </div>

                  {/* รายการบิลของวันนั้นๆ */}
                  {/* batchesInDate อาจจะเป็น Array ของ string หรือ object ขึ้นอยู่กับโครงสร้าง groupedByDate ของฝั่งบน */}
                  {/* โค้ดนี้เผื่อไว้ให้รองรับทั้งแบบ string และแบบที่มี .batchId ครับ */}
                  {batchesInDate.map((item: string | DateBatchGroup) => {
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

                    const stageLabel = isStep4Active ? 'เรียบร้อย' : isStep3Active ? 'กำลังส่ง' : isStep2Active ? 'สั่งซื้อแล้ว' : 'รอจัดซื้อ';
                    const stageStyle = isStep4Active ? 'bg-slate-900 text-white' : isStep3Active ? 'bg-amber-100 text-amber-800' : isStep2Active ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';

                    const hasUpdateInBatch = batchItems.some((item: OrderItem) => updatedItems.has(notificationRowKey(item)));
                    return (
                      <div key={batchId} id={`batch-${batchId}`} className={`app-card overflow-hidden transition-all ${isExpanded ? 'bg-white' : 'bg-white/80 hover:bg-white'}`}>
                        <div
                          role="button" tabIndex={0} aria-expanded={Boolean(isExpanded)}
                          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.currentTarget.click(); } }}
                          onClick={() => {
                            const nextExpanded = !isExpanded;
                            setExpandedBatches((prev: Record<string, boolean>) => ({ ...prev, [batchId]: nextExpanded }));
                            if (nextExpanded) clearBatchNotifications(batchId);
                          }}
                          className={`flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors md:p-6 ${isExpanded ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'}`}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--tone-soft)] text-[var(--tone-ink)]">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M8.5 11h7M8.5 14.5h7M8.5 18h4" /></svg>
                              {hasUpdateInBatch && !isExpanded && (
                                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600">
                                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-400" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 text-left">
                              <h2 className="truncate text-lg font-semibold text-[var(--ink)]">{batchItems[0]?.batchName || batchId}</h2>
                              <p className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                                <span className={`rounded-full px-2.5 py-0.5 font-semibold ${stageStyle}`}>{stageLabel}</span>
                                {batchItems.length} รายการ
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {canExportSorting && (
                              <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleExport(batchId);
                              }}
                                type="button"
                                disabled={exportingBatch !== null}
                                aria-label={exportingBatch === batchId ? "กำลังส่งออก Excel" : "ส่งออก Excel"}
                                className="secondary-action !px-3 !py-2 text-xs"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
                                <span className="hidden md:inline">{exportingBatch === batchId ? "กำลังส่งออก…" : "ส่งออก Excel"}</span>
                              </button>
                            )}
                            <svg aria-hidden="true" className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[var(--tone-ink)]' : 'text-slate-300'}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-6 md:p-10 space-y-10 bg-slate-50/30">
                            {(() => {
                              const steps = [
                                { label: 'สร้างคำขอ', done: true },
                                { label: 'สั่งซื้อแล้ว', done: isStep2Active },
                                { label: 'กำลังส่ง', done: isStep3Active },
                                { label: 'เรียบร้อย', done: isStep4Active },
                              ];
                              const reached = steps.filter((s) => s.done).length;
                              return (
                                <ol aria-label="สถานะบิล" className="mx-auto flex max-w-3xl items-start rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                                  {steps.map((st, i) => (
                                    <li key={st.label} className="relative flex-1 text-center">
                                      {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-[18px] h-0.5 w-full transition-colors duration-500 ${st.done ? 'bg-[var(--tone)]' : 'bg-slate-200'}`} />}
                                      <span className={`relative z-10 mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-all duration-500 ${st.done ? 'bg-[var(--tone-ink)] text-white' : 'bg-white text-slate-300 ring-2 ring-slate-200'} ${i === reached - 1 && reached < 4 ? 'ring-4 ring-[var(--tone-soft)]' : ''}`}>
                                        {st.done ? '✓' : i + 1}
                                      </span>
                                      <span className={`mt-2 block text-xs font-semibold ${st.done ? 'text-[var(--ink)]' : 'text-slate-400'}`}>{st.label}</span>
                                    </li>
                                  ))}
                                </ol>
                              );
                            })()}

                            {/* Items Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                              <div className="hidden md:block px-10 py-5 bg-slate-900">
                                <div className="flex items-center gap-6">
                                  <div className="flex-1 text-white text-[11px] font-semibold tracking-wide ">ชื่อสินค้า / รายละเอียด</div>
                                  <div className="flex items-center gap-4 min-w-137.5">
                                    <div className="w-27.5 text-white text-[11px] font-semibold text-center">ข้อมูลจัดซื้อ</div>
                                    <div className="w-27.5 text-white text-[11px] font-semibold text-center">ข้อมูลรับของ</div>
                                    <div className="flex-1 text-white text-[11px] font-semibold pl-4">หมายเหตุ</div>
                                    <div className="w-32 text-white text-[11px] font-semibold text-center">สถานะ</div>
                                  </div>
                                </div>
                              </div>

                              <div className="divide-y divide-slate-50">
                                {batchItems.map((order: OrderItem, idx: number) => {
                                  const itemKey = notificationRowKey(order);
                                  const isItemUpdated = updatedItems.has(itemKey);

                                  return (
                                    <div key={idx} className={`p-6 md:px-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-700 ${isItemUpdated ? 'bg-blue-50 border-l-8 border-blue-500' : 'hover:bg-slate-50/50 border-l-8 border-transparent'}`}>
                                      <div className="flex-1 w-full md:w-auto">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs bg-slate-100 px-3 py-1 rounded-full font-semibold text-slate-500 ">ID: {order.id}</span>
                                          {isItemUpdated && (
                                            <span className="flex h-2 w-2 relative">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="font-semibold text-slate-900 tracking-tight text-lg leading-tight">{order.name}</h4>
                                        {order.note && <p className="text-[11px] text-blue-600 font-semibold mt-2 flex items-center gap-1"><span>📝</span> {order.note}</p>}
                                      </div>

                                      <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto bg-slate-50 md:bg-transparent p-5 md:p-0 rounded-2xl min-w-137.5">
                                        <div className="text-center md:border-r md:border-slate-100 md:pr-4 min-w-27.5">
                                          <span className="block text-[11px] font-semibold text-slate-300 mb-2 md:hidden">ข้อมูลจัดซื้อ</span>
                                          {order.orderCarton || order.qtyPerCarton ? (
                                            <div className="flex flex-col items-center">
                                              <div className="text-base font-semibold text-emerald-700 leading-none">{order.orderCarton || '0'} <span className="text-[11px] text-emerald-400 ">{order.cartonUnit || 'ลัง'}</span></div>
                                              <div className="mt-1.5 pt-1.5 border-t border-emerald-100 w-full text-[11px] font-semibold text-slate-500 leading-none">
                                                {order.qtyPerCarton || '0'} <span className="text-[11px] text-slate-400 ">{order.innerUnit || 'ชิ้น'}</span>
                                              </div>
                                            </div>
                                          ) : <span className="text-[11px] font-semibold text-slate-300 ">รอเข้าคลัง</span>}
                                        </div>

                                        <div className="text-center md:border-r md:border-slate-100 md:pr-4 min-w-27.5">
                                          <span className="block text-[11px] font-semibold text-slate-300 mb-2 md:hidden">ข้อมูลรับของ</span>
                                          {(order.Recv_Carton !== undefined && order.Recv_Carton !== null && order.Recv_Carton !== '') ? (
                                            <div className="flex flex-col items-center">
                                              <div className="text-base font-semibold text-yellow-600 leading-none">{order.Recv_Carton} <span className="text-[11px] text-yellow-400 ">{order.Recv_Unit || 'ลัง'}</span></div>
                                              <div className="mt-1.5 pt-1.5 border-t border-yellow-100 w-full text-[11px] font-semibold text-slate-500 leading-none">
                                                {order.Recv_Qty || '0'} <span className="text-[11px] text-slate-400 ">{order.Recv_Qty_Unit || 'ชิ้น'}</span>
                                              </div>
                                            </div>
                                          ) : <span className="text-[11px] font-semibold text-slate-300 ">รอเข้าคลัง</span>}
                                        </div>

                                        <div className="flex-1 w-full md:w-auto text-center md:text-left px-2">
                                          <span className="block text-[11px] font-semibold text-slate-300 mb-2 md:hidden">หมายเหตุ</span>
                                          <div className="text-[11px] font-bold leading-tight space-y-1.5">
                                            {order.Note_Stock && (
                                              <div onClick={() => toggleNote(`${batchId}-${order.id}-stock`)} className="cursor-pointer hover:bg-slate-50 p-1 rounded transition-all">
                                                <p className={`text-yellow-600 font-semibold ${expandedNotes[`${batchId}-${order.id}-stock`] ? 'whitespace-normal' : 'truncate'}`}>
                                                  🏁 {order.Note_Stock}
                                                </p>
                                              </div>
                                            )}
                                            {order.Note_Purchase && (
                                              <div onClick={() => toggleNote(`${batchId}-${order.id}-pur`)} className="cursor-pointer hover:bg-slate-50 p-1 rounded transition-all">
                                                <p className={`text-emerald-600 font-semibold ${expandedNotes[`${batchId}-${order.id}-pur`] ? 'whitespace-normal' : 'truncate'}`}>
                                                  💬 {order.Note_Purchase}
                                                </p>
                                              </div>
                                            )}
                                            {!order.Note_Stock && !order.Note_Purchase && <span className="text-slate-200">-</span>}
                                          </div>
                                        </div>

                                        {/* แก้ไขส่วน Status และเพิ่มปุ่มจัดการ */}
                                        <div className="flex flex-col gap-2 w-full md:w-32">
                                          <div className={`px-4 py-3 rounded-2xl text-[11px] font-semibold  tracking-tight border text-center transition-all shadow-sm ${
                                              order.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                              order.status === 'COMPLETED' ? 'bg-slate-900 text-white border-slate-900' : 
                                              (order.status === 'ORDERED' || order.status === 'RECEIVED') ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' : 
                                              'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                            {order.status === 'REJECTED' ? '✖ ปฏิเสธ' : 
                                            order.status === 'COMPLETED' ? '🏁 เรียบร้อย' : 
                                            order.status === 'RECEIVED' ? '🚚 ส่งบางส่วน' :
                                            order.status === 'ORDERED' ? '🚚 กำลังส่ง' : '⏳ รอจัดซื้อ'}
                                          </div>
                                          
                                          {/* ปุ่มจัดการรายการ (แสดงเฉพาะเมื่อยังไม่ COMPLETED) */}
                                          {canManageSorting && order.status !== 'COMPLETED' && (
                                            <div className="flex gap-1">
                                              <button 
                                                onClick={() => { setEditingItem(order); setOriginalId(order.id); setIsEditModalOpen(true); }}
                                                className="flex-1 py-1.5 border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl text-[11px] font-semibold transition-all bg-white"
                                              >
                                                แก้ไข
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteItem(order)}
                                                className="flex-1 py-1.5 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl text-[11px] font-semibold transition-all bg-white"
                                              >
                                                ลบ
                                              </button>
                                            </div>
                                          )}
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

 {canManageSorting && isEditModalOpen && editingItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-110 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-t-8 border-blue-600">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <h2 className="text-xl font-semibold ">แก้ไขข้อมูลสินค้า</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-xl hover:rotate-90 transition-transform">x</button>
              </div>

              <form onSubmit={handleUpdateItem} className="p-8 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* เพิ่มช่องแก้ไขรหัสสินค้า */}
                  <div className="col-span-1">
                    <label className="text-[11px] font-semibold text-slate-400 ml-1">รหัสสินค้า (ID)</label>
                    <input 
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editingItem.id} 
                      onChange={(e) => setEditingItem({...editingItem, id: e.target.value})} 
                    />
                  </div>
                  {/* เพิ่มช่องแก้ไขบริษัทซัพพลายเออร์ */}
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold text-slate-400 ml-1">ซัพพลายเออร์ (Supplier)</label>
                    <input 
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none " 
                      value={editingItem.supplier || ''} 
                      onChange={(e) => setEditingItem({...editingItem, supplier: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 ml-1">ชื่อสินค้า</label>
                  <input 
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={editingItem.name} 
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 ml-1">หน้าร้าน</label>
                    <input type="number" 
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editingItem.storeQty} 
                      onChange={(e) => setEditingItem({...editingItem, storeQty: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 ml-1">คลังสินค้า</label>
                    <input type="number" 
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editingItem.warehouseQty} 
                      onChange={(e) => setEditingItem({...editingItem, warehouseQty: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 ml-1">หมายเหตุ</label>
                  <textarea 
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                    rows={2} 
                    value={editingItem.note} 
                    onChange={(e) => setEditingItem({...editingItem, note: e.target.value})} 
                  />
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-5 rounded-2xl text-[11px] hover:bg-slate-900 shadow-lg transition-all active:scale-[0.98]">บันทึกการแก้ไขข้อมูล</button>
              </form>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center gap-2 pb-10">
            <button 
              onClick={() => {setPaging(true);setCurrentPage(prev => Math.max(prev - 1, 1));}}
              disabled={paging || loading || currentPage === 1}
              className={`px-4 py-2 rounded-xl font-semibold text-[11px]  transition-all ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-emerald-600 hover:text-white'}`}
            >← ก่อนหน้า</button>
            <div className="flex gap-1 items-center">
              {(() => {
                const pages = [];
                const range = 1;
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
                    pages.push(
                      <button
                        key={i}
                        disabled={paging || loading || currentPage===i}
                        onClick={() => {setPaging(true);setCurrentPage(i);}}
                        className={`w-10 h-10 rounded-xl font-semibold text-xs transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}
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
              onClick={() => {setPaging(true);setCurrentPage(prev => Math.min(prev + 1, totalPages));}}
              disabled={paging || loading || currentPage === totalPages}
              className={`px-4 py-2 rounded-xl font-semibold text-[11px]  transition-all ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-slate-900 shadow-sm hover:bg-emerald-600 hover:text-white'}`}
            >ถัดไป →</button>
          </div>
        )}

        {/* Modal: New Batch (Style adjusted) */}
        {canManageSorting && isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-100 p-4">
            {/* ล็อกความสูงสูงสุดที่ 90% ของหน้าจอ */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col border-t-8 border-blue-600 animate-in fade-in zoom-in-95 duration-300">
              
              {/* Header: ติดอยู่บนสุด */}
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-semibold ">สร้าง <span className="text-blue-500 ">บิลสั่งซื้อใหม่</span></h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">ระบุรายละเอียดสินค้าที่ต้องการสั่งครับ</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-rose-600 transition-colors text-xl">x</button>
              </div>

              {/* Body: แบ่งซ้าย-ขวา และเลือกเฉพาะฝั่งใน */}
              <div className="flex flex-col md:flex-row overflow-hidden flex-1">
                
                {/* ฝั่งซ้าย: ฟอร์มกรอกข้อมูล (Scrollable) */}
                <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar border-r border-slate-100">
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <label className="text-[11px] font-semibold text-blue-600 tracking-wide block mb-2 ml-1">1. ชื่อรอบการสั่งซื้อ</label>
                    <input 
                      className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 ring-blue-500/5 transition-all" 
                      placeholder="เช่น ของใช้ทั่วไป 14/03/69" 
                      value={batchName} 
                      onChange={(e) => setBatchName(e.target.value)} 
                    />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wide block mb-3 ml-1">2. เพิ่มรายการสินค้า</label>
                    <form onSubmit={addItemToTempList} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none focus:ring-4 ring-blue-500/5 transition-all" placeholder="รหัสสินค้า" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} required />
                        <input className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none focus:ring-4 ring-blue-500/5 transition-all" placeholder="ชื่อสินค้า" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-300">หน้าร้าน:</span>
                          <input type="number" className="w-full p-4 pl-16 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" value={formData.storeQty} onChange={(e) => setFormData({...formData, storeQty: e.target.value})} required />
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-300">คลังสินค้า:</span>
                          <input type="number" className="w-full p-4 pl-16 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" value={formData.warehouseQty} onChange={(e) => setFormData({...formData, warehouseQty: e.target.value})} required />
                        </div>
                      </div>
                      <input className="w-full p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" placeholder="ชื่อซัพพลายเออร์ (ถ้าทราบ)" value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} />
                      <textarea className="w-full p-4 rounded-2xl border border-slate-100 bg-white shadow-sm font-bold text-sm outline-none" placeholder="หมายเหตุถึงจัดซื้อ..." rows={2} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
                      <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-4 rounded-2xl text-[11px] hover:bg-blue-600 transition-all active:scale-95 shadow-lg">+ เพิ่มเข้าบิล</button>
                    </form>
                  </div>
                </div>

                {/* ฝั่งขวา: รายการที่เลือกแล้ว (Fixed Section) */}
                <div className="w-full md:w-95 bg-slate-50 p-8 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-semibold text-slate-400 ">รายการในบิล ({items.length})</p>
                    {items.length > 0 && <button onClick={() => setItems([])} className="text-[11px] font-semibold text-rose-500 hover:underline">ล้างทั้งหมด</button>}
                  </div>
                  
                  {/* รายการสินค้าที่เลือกไว้ ภายในพื้นที่ที่เหลือ */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-6 custom-scrollbar">
                    {items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-300 p-6 text-center">
                        <span className="text-3xl mb-2">+</span>
                        <p className="font-semibold text-[11px] leading-loose">เพิ่มสินค้าจากด้านซ้าย<br/>เพื่อเริ่มสร้างบิลครับ</p>
                      </div>
                    ) : (
                      items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="overflow-hidden">
                            <span className="font-semibold text-xs text-slate-700 block truncate">{item.name}</span>
                            <span className="text-[11px] font-bold text-slate-400 ">สต็อก: {item.storeQty}/{item.warehouseQty}</span>
                          </div>
                          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center justify-center text-[11px]">x</button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* ปุ่มกดยืนยัน (ติดอยู่กับด้านล่างของ Modal) */}
                  <button 
                    onClick={submitBatch} 
                    disabled={items.length === 0 || !batchName || isSubmitting}
                    className={`w-full py-5 rounded-2xl font-semibold  text-[11px] tracking-wide shadow-xl transition-all active:scale-95 ${items.length > 0 && !isSubmitting ? 'bg-blue-600 text-white hover:bg-slate-900 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งบิลเดี๋ยวนี้'}
                  </button>
                </div>
              </div>
            </div>
          </div>
)}

      {/* ⚠️ Duplicate Warning Modal */}
      {canManageSorting && duplicateWarning.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-200 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-10 relative animate-in zoom-in-95 duration-300 border-t-8 border-amber-500">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
                ⚠️
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">ระวัง!</h3>
              <p className="text-amber-600 font-bold text-sm">สินค้านี้มีการสั่งอยู่แล้ว</p>
            </div>

            <div className="bg-amber-50 p-6 rounded-xl border-2 border-amber-200 mb-8 space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-amber-600 ">รหัสสินค้า</p>
                <p className="text-lg font-semibold text-slate-900">{duplicateWarning.productId}</p>
              </div>
              
              <div className="h-px bg-amber-200"></div>
              
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-amber-600 ">ชื่อสินค้า</p>
                <p className="font-bold text-slate-700">{duplicateWarning.productName}</p>
              </div>
              
              <div className="h-px bg-amber-200"></div>
              
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-amber-600 ">บิลที่สั่งค้างอยู่</p>
                <p className="font-bold text-slate-700 text-sm wrap-break-word">{duplicateWarning.existingOrder}</p>
              </div>
            </div>

            <p className="text-center text-slate-600 font-bold text-sm mb-8">สินค้านี้ยังไม่ได้รับจากผู้ขาย<br/>คุณต้องการสั่งเพิ่มอีกหรือไม่?</p>

            <div className="flex gap-4">
              <button onClick={() => setDuplicateWarning({ isOpen: false, productId: '', productName: '', existingOrder: '' })} className="flex-1 py-4 rounded-2xl font-semibold text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all active:scale-95">ยกเลิก</button>
              <button onClick={() => { if (duplicateWarning.pendingAction) { duplicateWarning.pendingAction(); } }} className="flex-1 py-4 rounded-2xl font-semibold text-[11px] bg-amber-600 text-white hover:bg-amber-700 transition-all active:scale-95 shadow-lg">ใช่ สั่งเพิ่ม</button>
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