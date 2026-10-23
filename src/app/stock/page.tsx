'use client';
import {checkedFetch} from '@/lib/checked-fetch';
import {saveReceiptBatch} from '@/lib/save-receipts';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {parseStockImport} from '@/lib/stock-import';
import IssueTracking from '@/components/IssueTracking';
import {useWorkPage} from '@/lib/use-work-page';

interface StockItem {
  rowId: number;
  rowUid?: string;
  revision: number;
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
  Recv_Date?: string;
  Created_At?: string;
  Created_At_P?: string;
  invoiceNo?: string;
}

type StockApiItem = StockItem & {
  id?: string | number;
  ID?: string | number;
  rowNumber?: string | number;
};

type ImportRow = Record<string, string | number | boolean | null | undefined>;

interface ProductGroup {
  productInfo: StockItem;
  batches: StockItem[];
  totalOrder: number;
  totalRecv: number;
}

interface StockUpdateData {
  rowId: number;
  rowUid?: string;
  revision: number;
  productID: string;
  invoiceNo: string;
  recvCarton?: number;
  Recv_Qty?: number;
  Note_Stock?: string;
  Recv_Date?: string;
  status?: string;
}

export default function StockPage() {

  const router = useRouter();

  const [selectedBatch, setSelectedBatch] = useState<StockItem[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [singleRecvCarton, setSingleRecvCarton] = useState('');
  const [singleRecvQty, setSingleRecvQty] = useState('');
  
  const [updatingItem, setUpdatingItem] = useState<StockItem | null>(null);
  const [additionalQty, setAdditionalQty] = useState('');
  const [additionalRecvQty, setAdditionalRecvQty] = useState(''); 
  const [additionalNote, setAdditionalNote] = useState(''); 

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkRecvList, setBulkRecvList] = useState<(StockItem & { 
    custom_carton?: string; 
    custom_qty?: string; 
    custom_invoice?: string;
    custom_note?: string; 
  })[]>([]);
  const [innerSearch, setInnerSearch] = useState('');

  const [recvList, setRecvList] = useState<StockItem[]>([]); // รายการที่เลือกมาเตรียมรับของ
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 
  const [authorized,setAuthorized]=useState(false);
  const workPage=useWorkPage<StockItem>({kind:'stock',page:currentPage,q:searchTerm,supplier:selectedSupplier,enabled:authorized,onPage:setCurrentPage});
  const items=workPage.items;
  const loading=workPage.loading&&!items.length;
  const fetchOrderedItems=workPage.refresh;
  const [auxItems,setAuxItems]=useState<StockItem[]>([]);
  const [auxLoading,setAuxLoading]=useState(false);
  const auxRequest=useRef<Promise<StockItem[]>|null>(null);
  const loadAllStock=async()=>{
    if(auxRequest.current)return auxRequest.current;
    setAuxLoading(true);
    const request=(async()=>{const response=await checkedFetch('/api/stock');const data=await response.json();if(!Array.isArray(data))throw new Error('ข้อมูลไม่ถูกต้อง');setAuxItems(data);return data as StockItem[];})();
    auxRequest.current=request;
    try{return await request;}finally{if(auxRequest.current===request){auxRequest.current=null;setAuxLoading(false);}}
  };
  const openBulk=async()=>{try{await loadAllStock();setIsBulkModalOpen(true);}catch{alert('โหลดรายการรับสินค้าไม่สำเร็จ กรุณาลองใหม่');}};

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
        if (!savedUser.name || (savedUser.department !== 'STOCK' && savedUser.department !== 'ADMIN' && savedUser.department !== 'STOCK_SORTING_MANAGER')) {
          alert(`ไม่มีสิทธิ์เข้าหน้านี้ (แผนกของพี่คือ: ${savedUser.department})`);
          router.push('/');
          return;
        }

        // 3. ถ้าผ่านเงื่อนไข ค่อยโหลดข้อมูล
        setAuthorized(true); 
      } catch (e) {
        console.error("Auth Error:", e);
        router.push('/');
      }
    };

    checkAuthAndFetch();
  }, [router]);
  const fetchPendingOrders=fetchOrderedItems;

  const addToRecvList = (item: StockItem) => {
    const isExist = recvList.find(i => i.rowId === item.rowId);
    if (!isExist) {
      setRecvList([...recvList, { ...item, recvCarton: '', Recv_Qty: '' }]);
    }
    setSearchQuery(''); // ล้างช่องค้นหาหลังเลือก
  };

const handlePrint = (groupId: string, items: StockItem[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const displayDate = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const content = `
      <html>
        <head>
          <title>ใบตรวจรับสินค้า - ${groupId}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #000; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title-section h1 { margin: 0; font-size: 22px; font-weight: 700; }
            .title-section p { margin: 2px 0 0 0; font-size: 13px; font-weight: bold; }
            .batch-info { text-align: right; font-weight: bold; font-size: 14px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { border: 1px solid #000; padding: 10px 5px; font-size: 12px; background-color: #f2f2f2; }
            td { border: 1px solid #000; padding: 10px 8px; vertical-align: middle; }
            
            .product-name { font-weight: 700; font-size: 13px; margin: 0; }
            .product-id { font-size: 10px; color: #444; margin-bottom: 2px; }
            .supplier { font-size: 10px; color: #444; }
            
            .qty-cell { text-align: center; width: 70px; }
            .qty-val { font-size: 15px; font-weight: 700; }
            .qty-unit { font-size: 10px; display: block; margin-top: 2px; }
            
            /* เปลี่ยนจากกล่องมนเป็นเส้นขีดล่างสำหรับเขียน */
            .line-input { 
              border-bottom: 1px solid #000; 
              height: 25px; 
              width: 50px; 
              margin: 0 auto; 
            }
            .line-note { 
              border-bottom: 1px solid #000; 
              height: 25px; 
              width: 90%; 
              margin: 0 auto; 
            }
            
            .footer { margin-top: 40px; display: flex; justify-content: space-around; }
            .sig-area { text-align: center; width: 220px; }
            .sig-line { border-bottom: 1px dotted #000; height: 30px; margin-bottom: 8px; }
            .sig-text { font-size: 12px; }

            @media print {
              @page { size: A4; margin: 1cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="title-section">
              <h1>ใบตรวจรับสินค้า (Incoming Checklist)</h1>
              <p>ประจำวันที่: ${displayDate}</p>
            </div>
            <div class="batch-info">
              ID บิลกลุ่ม: ${groupId}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35%; text-align: left;">รายการสินค้า</th>
                <th style="width: 10%;">ยอดสั่ง</th>
                <th style="width: 12%;">จำนวน(ชิ้น)</th>
                <th style="width: 12%;">จำนวนลัง (รับ)</th>
                <th style="width: 12%;">จำนวน(ชิ้น) (รับ)</th>
                <th>หมายเหตุการรับ</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>
                    <div class="product-id">ID: ${item.productID}</div>
                    <div class="product-name">${item.productName}</div>
                    <div class="supplier">ผู้ผลิต: ${item.supplier || '-'}</div>
                  </td>
                  <td class="qty-cell">
                    <span class="qty-val">${item.orderCarton}</span>
                    <span class="qty-unit">${item.cartonUnit}</span>
                  </td>
                  <td class="qty-cell">
                    <span class="qty-val">${item.qtyPerCarton || 0}</span>
                    <span class="qty-unit">${item.innerUnit}</span>
                  </td>
                  <td class="qty-cell">
                    <div class="line-input"></div>
                    <span class="qty-unit">${item.cartonUnit}</span>
                  </td>
                  <td class="qty-cell">
                    <div class="line-input"></div>
                    <span class="qty-unit">${item.innerUnit}</span>
                  </td>
                  <td>
                    <div class="line-note"></div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div class="sig-area">
              <div class="sig-line"></div>
              <div class="sig-text">ลงชื่อ: ............................................<br/>ผู้ตรวจรับสินค้า (คลัง)</div>
            </div>
            <div class="sig-area">
              <div class="sig-line"></div>
              <div class="sig-text">ลงชื่อ: ............................................<br/>ผู้นำส่งสินค้า / พนักงานขับรถ</div>
            </div>
          </div>

          <script>
            window.onload = function() { 
              window.print(); 
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

const exportToExcel = async () => {
    let exportItems:StockItem[];try{exportItems=await loadAllStock();}catch{alert('โหลดข้อมูล Export ไม่สำเร็จ');return;}
    // 1. ดึงข้อมูลตามที่เรา Filter ไว้บนหน้าจอ (คำค้นหา + บริษัท)
    const s = searchTerm.toLowerCase();
    const filteredForExport = exportItems.filter(item => {
      const matchStatus = item.status === 'ORDERED'; // เอาเฉพาะที่ยังไม่ได้รับ
      const matchSearch = (
        item.productName?.toLowerCase().includes(s) || 
        item.productID?.toString().toLowerCase().includes(s) ||
        item.groupId?.toLowerCase().includes(s)
      );
      const matchSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
      
      return matchStatus && matchSearch && matchSupplier;
    });

    if (filteredForExport.length === 0) {
      alert('ไม่พบรายการตามที่คุณพี่ชายเลือกไว้ ลองปรับการ Filter ใหม่นะครับ');
      return;
    }

    // 2. จัดโครงสร้างส่วนหัวเอกสาร (Header) ให้สวยงาม
    const header = [
      ["ศูนย์ค้าส่งสำเพ็งบุรีรัมย์ - ใบแจ้งตรวจรับสินค้า (STOCK INBOUND)"],
      [`ซัพพลายเออร์: ${selectedSupplier === 'all' ? 'รวมทุกบริษัท' : selectedSupplier}`],
      [`สถานะการดึงข้อมูล: ตามเงื่อนไขการกรอง (Filter Applied)`],
      [`วันที่ดึงข้อมูล: ${new Date().toLocaleDateString('th-TH')} | จำนวนรวม: ${filteredForExport.length} รายการ`],
      [""], // แถวว่าง
      ["[ ข้อมูลสินค้าจากระบบ ]", "", "", "", "", "", "", "|", "[ ส่วนงานคลังสินค้า - กรอกข้อมูลด้านล่างนี้ ]"],
    ];

    // 3. หัวตาราง (แบ่งกลุ่มชัดเจน)
    const tableHeader = [
      "ID อ้างอิง", "วันที่สั่งซื้อ", "รหัสสินค้า", "รายการสินค้า", "หน่วยหลัก", "ยอดสั่ง (กล่อง)", "บรรจุ/กล่อง", "หน่วยย่อย", "|", 
      "รับจริง (กล่อง)", "รับจริง (ชิ้น)", "เลขที่บิล (Invoice)", "หมายเหตุ", "เวอร์ชันข้อมูล", "UUID อ้างอิง"
    ];

    // 4. เตรียมข้อมูล Data Rows
    const rows = filteredForExport.map((item) => [
      item.rowId,
      item.Created_At_P || '-', // <--- ดึงวันที่สั่งซื้อมาใส่
      item.productID,
      item.productName,
      item.cartonUnit,
      Number(item.orderCarton),
      Number(item.qtyPerCarton || 0),
      item.innerUnit || '-',
      "|",
      "", // ช่องว่างให้คีย์
      "", // ช่องว่างให้คีย์
      "", // ช่องว่างให้คีย์
      "", item.revision, item.rowUid || "" // ข้อมูลอ้างอิง
    ]);

    // 5. รวมข้อมูลและสร้าง Sheet
    const worksheetData = [...header, tableHeader, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 6. ตั้งค่าความกว้างคอลัมน์ (Column Widths)
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 50 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 3 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
    ];

    // 7. รวมเซลล์ส่วนหัว (Merging)
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // หัวใหญ่
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // ซัพพลายเออร์
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // เงื่อนไข
      { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } }, // หัวส่วนระบบ
      { s: { r: 5, c: 8 }, e: { r: 5, c: 11 } } // หัวส่วนคลัง
    ];

    // 8. บันทึกไฟล์
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "StockInbound");
    
    const fileName = `ใบตรวจรับ_${selectedSupplier}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // State สำหรับจัดการ Modal Export
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportSupplier, setExportSupplier] = useState('all');
  const [exportSuppliers, setExportSuppliers] = useState<string[]>([]); // เก็บเป็น Array แทน
  const [supplierSearch, setSupplierSearch] = useState('');

  // State สำหรับจัดการ Import
  const [importData, setImportData] = useState<ImportRow[]>([]); // เก็บข้อมูลที่อ่านจาก Excel
  const [showImportModal, setShowImportModal] = useState(false); // เปิดหน้าต่างเช็คข้อมูลก่อนเซฟ

  // Ref สำหรับ Input ไฟล์
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // หัวตารางอยู่ที่แถวที่ 5 ใน Excel (index คือ 4) 
        // หรือถ้าพี่นับจากไฟล์ CSV ที่ส่งมา แถวว่างมันมี 4 แถว แถวที่ 5 คือหัวตาราง
        const results = parseStockImport(sheet);

        if (results.length === 0) {
          alert('ไม่พบข้อมูลการรับของ หรือชื่อคอลัมน์ไม่ตรงกับระบบครับพี่ชาย! ลองเช็คว่าคีย์ยอดในช่อง "รับจริง (กล่อง)" หรือยัง');
          return;
        }
        
        if(results.some(row=>row['เวอร์ชันข้อมูล']===undefined || !row['UUID อ้างอิง'])) {alert('กรุณาดาวน์โหลดใบตรวจรับใหม่ ไฟล์นี้ไม่มีเวอร์ชันสำหรับป้องกันข้อมูลทับกัน');return;}
        setImportData(results);
        setShowImportModal(true);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      } catch (err) {
        console.error("Import Error: ", err);
        alert("อ่านไฟล์ไม่ได้ครับพี่ชาย");
      }
    };
    reader.readAsBinaryString(file);
  };

  const { displayProducts, totalPages, totalItemsCount } = useMemo(() => {
      const s = searchTerm.toLowerCase();

      // กรองข้อมูลทั้งหมดก่อน โดยรวมเงื่อนไข Supplier เข้าไปด้วย
      const filtered = items;

      // จัดกลุ่มสินค้า (Grouping)
      const groups: { [key: string]: ProductGroup } = {};
      filtered.forEach(item => {
        const id = item.productID;
        if (!groups[id]) {
          groups[id] = {
            productInfo: item,
            batches: [],
            totalOrder: 0,
            totalRecv: 0
          };
        }
        groups[id].batches.push(item);
        groups[id].totalOrder += Number(item.orderCarton || 0);
        groups[id].totalRecv += Number(item.recvCarton || 0);
      });

    // เรียงลำดับชื่อสินค้า
    const sortedProducts = Object.values(groups).sort((a: ProductGroup, b: ProductGroup) => 
      a.productInfo.productName.localeCompare(b.productInfo.productName)
    );

    // คำนวณจำนวนหน้าจากรายการที่ "กรองเสร็จแล้ว"
    const total = Math.ceil(sortedProducts.length / itemsPerPage);
    
    // ตัดแบ่งหน้า (Pagination)
    const sliced = sortedProducts;

    return { 
      displayProducts: sliced, 
      totalPages: workPage.totalPages,
      totalItemsCount: workPage.total
    };
    // เพิ่ม selectedSupplier เข้าไปใน Dependency เพื่อให้ Re-render เมื่อเปลี่ยนบริษัทครับ
  }, [items, searchTerm, selectedSupplier, currentPage, workPage.totalPages, workPage.total]);

  // ดึงรายชื่อ Supplier ทั้งหมดออกมาทำ Dropdown
  const suppliers=['all',...workPage.suppliers];

  // ปรับ useMemo ของ displayProducts ให้รองรับการกรอง Supplier
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.productID.includes(searchTerm);
      const matchSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
      return matchSearch && matchSupplier;
    });
  }, [items, searchTerm, selectedSupplier]);

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
      await saveReceiptBatch(selectedBatch.map(item=>({
            rowId: item.rowId, rowUid:item.rowUid, revision:item.revision,
            productID: item.productID,
            receiver: receiverName,
            // ✅ ส่งค่าดิบที่กรอกจากอินพุตตรง ๆ ไม่ผ่านการคำนวณหรือคูณเลขซ้อนแล้วครับพี่ชาย
            recvCarton: item.recvCarton || 0,
            recvUnit: item.cartonUnit,
            recvQtyUnit: item.innerUnit,
            Recv_Qty: item.Recv_Qty || 0,
            Note_Stock: item.Note_Stock || '',
            Recv_Date: thaiDate
          })));
      alert('ตรวจรับเข้าสต็อกเรียบร้อยทุกรายการ!');
      setSelectedBatch(null);
      setReceiverName('');
      
      // ✅ เรียกฟังก์ชันตัวเดิมของพี่ชายเพื่อรีเฟรชข้อมูลให้หน้าจออัปเดตอย่างถูกต้อง
      fetchOrderedItems();
      
    } catch (err) {
      alert(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAdditional = async () => {
      if (!updatingItem) return;
      setIsSubmitting(true);
      try {
        const updateData: StockUpdateData = {
          status:updatingItem.status==='COMPLETED'?'COMPLETED':undefined,
          rowId: updatingItem.rowId, rowUid:updatingItem.rowUid, revision:updatingItem.revision,
          productID: updatingItem.productID,
          // *** เพิ่มบรรทัดนี้: เพื่อส่งเลขที่บิลที่มีอยู่กลับไปด้วย ***
          invoiceNo: updatingItem.invoiceNo || '', 
        };

        let hasChange = false;

        // Logic คำนวณ: ขาดกดบวกเพิ่ม เกินกดลบออก
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

        // ถ้าไม่มีการเปลี่ยนตัวเลข แต่มีการพิมพ์ Note หรือมีเลขบิลอยู่ ก็ให้ทำงานต่อได้
        if (!hasChange && additionalNote === '') {
          setUpdatingItem(null);
          setIsSubmitting(false);
          return;
        }

        // ปรับแต่งข้อความ Log
        const qtyLabel = Number(additionalQty) >= 0 ? `+${additionalQty}` : `${additionalQty}`;
        const innerLabel = Number(additionalRecvQty) >= 0 ? `+${additionalRecvQty}` : `${additionalRecvQty}`;
        
        const logEntry = `[แก้ไข: ${additionalQty !== '' ? 'ลัง ' + qtyLabel : ''} ${additionalRecvQty !== '' ? 'เศษ ' + innerLabel : ''} สาเหตุ: ${additionalNote}]`.trim();
        updateData.Note_Stock = `${updatingItem.Note_Stock || ''} ${logEntry}`.trim();
        
        const now = new Date();
        updateData.Recv_Date = now.toLocaleDateString('th-TH', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        await checkedFetch('/api/stock', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        alert('บันทึกการปรับปรุงยอดและรักษาเลขที่บิลเรียบร้อยครับพี่ชาย!');
        
        setUpdatingItem(null);
        setAdditionalQty('');
        setAdditionalRecvQty('');
        setAdditionalNote('');
        fetchOrderedItems(); // รีโหลดข้อมูลเพื่อให้เห็นค่าล่าสุดจาก Sheet
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

 const handleFinalExport = async () => {
    let exportItems:StockItem[];try{exportItems=await loadAllStock();}catch{alert('โหลดข้อมูล Export ไม่สำเร็จ');return;}
    // 1. กรองข้อมูลตามรายชื่อบริษัทที่ติ๊กเลือกไว้
    const dataToExport = exportItems.filter(item => {
      const matchStatus = item.status === 'ORDERED';
      const matchSupplier = exportSuppliers.includes(item.supplier);
      return matchStatus && matchSupplier;
    });

    if (dataToExport.length === 0) {
      alert('กรุณาเลือกซัพพลายเออร์อย่างน้อย 1 รายครับพี่ชาย');
      return;
    }

    // 2. จัดเรียงข้อมูลตามชื่อซัพพลายเออร์
    dataToExport.sort((a, b) => a.supplier.localeCompare(b.supplier));

    // 3. ส่วนหัวและโครงสร้าง Excel
    const header = [
      ["ศูนย์ค้าส่งสำเพ็งบุรีรัมย์ - ใบแจ้งตรวจรับสินค้า (STOCK INBOUND)"],
      [`ซัพพลายเออร์ที่เลือก: ${exportSuppliers.join(', ')}`],
      [`วันที่ดึงข้อมูล: ${new Date().toLocaleDateString('th-TH')} | รวมทั้งสิ้น: ${dataToExport.length} รายการ`],
      [""],
    ];

    // ✅ เพิ่ม "วันที่สั่งซื้อ" ในหัวตาราง
    const tableHeader = [
      "ID อ้างอิง", 
      "วันที่สั่งซื้อ", // <--- เพิ่มตรงนี้
      "รหัสสินค้า", 
      "รายการสินค้า", 
      "ซัพพลายเออร์", 
      "หน่วยหลัก", 
      "ยอดสั่ง (กล่อง)", 
      "บรรจุ/กล่อง", 
      "หน่วยย่อย", 
      "|", 
      "รับจริง (กล่อง)", 
      "รับจริง (ชิ้น)", 
      "เลขที่บิล", 
      "หมายเหตุ", "เวอร์ชันข้อมูล", "UUID อ้างอิง"
    ];
    
    // ✅ เพิ่ม item.Created_At เข้าไปใน Rows
    const rows = dataToExport.map(item => [
      item.rowId, 
      item.Created_At_P || '-', // <--- ดึงวันที่สั่งซื้อมาใส่
      item.productID, 
      item.productName, 
      item.supplier, 
      item.cartonUnit, 
      Number(item.orderCarton), 
      Number(item.qtyPerCarton || 0), 
      item.innerUnit || '-', 
      "|", 
      "", "", "", "", item.revision, item.rowUid || ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([...header, tableHeader, ...rows]);
    
    // ✅ ปรับความกว้างคอลัมน์ (เพิ่มช่องวันที่เข้ามา 1 ช่อง)
    worksheet['!cols'] = [
      { wch: 12 }, // ID
      { wch: 15 }, // วันที่สั่งซื้อ (ใหม่)
      { wch: 15 }, // รหัสสินค้า
      { wch: 45 }, // รายการ
      { wch: 20 }, // ซัพพลายเออร์
      { wch: 10 }, // หน่วยหลัก
      { wch: 12 }, // ยอดสั่ง
      { wch: 12 }, // บรรจุ
      { wch: 10 }, // หน่วยย่อย
      { wch: 3 },  // |
      { wch: 18 }, // รับกล่อง
      { wch: 18 }, // รับชิ้น
      { wch: 20 }, // เลขบิล
      { wch: 25 }  // หมายเหตุ
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `ใบตรวจรับ_รวมหลายบริษัท_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    setShowExportOptions(false);
  };

const handleConfirmImport = async () => {
    if (!receiverName) {
      alert('พี่ชายใส่ชื่อผู้ตรวจรับก่อนครับ');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads=importData.map(row=>({
        rowId:Number(row['ID อ้างอิง']),rowUid:String(row['UUID อ้างอิง']||''),revision:Number(row['เวอร์ชันข้อมูล']),
        receiver:receiverName,recvCarton:row['รับจริง (กล่อง)']??0,Recv_Qty:row['รับจริง (ชิ้น)']??0,
        invoiceNo:String(row['เลขที่บิล']||row['เลขที่บิล (Invoice)']||''),Note_Stock:String(row['หมายเหตุ']||''),Recv_Date:new Date().toISOString()
      }));
      await saveReceiptBatch(payloads);
      alert(`บันทึกสำเร็จทั้งชุด ${payloads.length} รายการ`);
      setShowImportModal(false);setImportData([]);await fetchOrderedItems();
    } catch(error) {
      alert(error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
    } finally {setIsSubmitting(false);}
  };

  const handleForceComplete = async (item: StockItem) => {
    const confirmClose = window.confirm(`ยืนยันจะ "ตัดบิล" รายการนี้เลยใช่ไหมครับ? \nระบบจะถือว่ายอดที่รับไปแล้วคือยอดที่ถูกต้อง และปิดรายการนี้ทันที`);
    
    if (!confirmClose) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      // ใช้ Format วันที่และเวลาที่อ่านง่ายสำหรับลง Sheets
      const thaiDate = now.toLocaleString('th-TH', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // 🔥 ส่งข้อมูลไปที่ API PATCH
      await checkedFetch('/api/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId: item.rowId, rowUid:item.rowUid, revision:item.revision,
          productID: item.productID,
          receiver: receiverName || 'คลังสินค้า (ตัดบิลจบ)', 
          recvCarton: item.recvCarton || 0,
          Recv_Qty: item.Recv_Qty || 0,
          invoiceNo: item.invoiceNo || '', 
          status: 'COMPLETED', 
          // ปรับ Note ให้ชัดเจน
          Note_Stock: `${item.Note_Stock || ''} [ตัดบิลจบรายการโดยคลังสินค้า]`.trim(),
          Recv_Date: thaiDate
        }),
      });

      alert('ตัดบิลเรียบร้อย! รายการนี้จะหายไปจากหน้าจอครับ');
      
      // รีโหลดข้อมูลใหม่ทันทีเพื่อให้รายการที่ COMPLETED แล้วหายไปจากหน้าจอ (เพราะ GET กรองออกแล้ว)
      await fetchOrderedItems(); 
    } catch (err) {
      console.error("Force Complete Error:", err);
      alert('ตัดบิลไม่สำเร็จครับพี่ชาย');
    } finally {
      setIsSubmitting(false);
    }
  };

 const handleBulkSave = async () => {
    if (!receiverName.trim()) return alert("กรุณาระบุชื่อผู้รับของก่อนครับ");
    setIsSubmitting(true);
    try {
      await saveReceiptBatch(bulkRecvList.map(item=>({
            rowId: item.rowId, rowUid:item.rowUid, revision:item.revision,
            productID: item.productID,
            receiver: receiverName,
            recvCarton: item.custom_carton || 0,
            Recv_Qty: item.custom_qty || 0,
            invoiceNo: item.custom_invoice || '',
            Note_Stock: item.Note_Stock || '',
            status: 'COMPLETED' // หรือสถานะตามที่ API หลังบ้านของพี่ชายกำหนดไว้
          })));
      alert('บันทึกทุกรายการเรียบร้อยแล้วครับพี่ชาย!');
      setBulkRecvList([]);
      setIsBulkModalOpen(false);
      
      // ✅ เปลี่ยนเป็นฟังก์ชันดึงข้อมูลหลักของหน้าหน้าจอตามที่ระบบต้องการแล้วครับ
      await fetchOrderedItems(); 
      
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiverNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiverName(e.target.value);
  };

  const handleSaveSingle = async () => {
    if (!updatingItem || !receiverName.trim()) {
      alert('กรุณากรอกชื่อผู้รับสินค้าให้เรียบร้อยครับพี่ชาย');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await checkedFetch('/api/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowId: updatingItem.rowId, rowUid:updatingItem.rowUid, revision:updatingItem.revision,
          receiverName: receiverName,
          recvCarton: singleRecvCarton, // ส่งค่าดิบจากช่อง ยอดรับจริง (ลัง)
          Recv_Qty: singleRecvQty,     // ส่งค่าดิบจากช่อง บรรจุ/ลัง โดยตรง ไม่คูณเลข
          invoiceNo: updatingItem.invoiceNo || '',
          Note_Stock: updatingItem.Note_Stock || '',
          Recv_Date: new Date().toLocaleString('th-TH'),
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('บันทึกข้อมูลเรียบร้อยแล้วครับพี่ชาย!');
        setUpdatingItem(null);
        
        // ✅ แก้ไขเซฟตี้ตรงจุดนี้: สั่งให้โหลดและรีเฟรชข้อมูลหน้าจอด้วย router.refresh() 
        // เพื่อให้หน้าจออัปเดตสถานะล่าสุดทันทีโดยไม่ติดเออร์เรอร์ TypeScript
        await fetchOrderedItems();
        router.refresh();
        
      } else {
        alert(data.message || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (error) {
      console.error('Save Single Error:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="app-container">
        {workPage.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{workPage.error}</p>}
        {/* ส่วนหัวข้อหลัก */}
        <div className="app-hero mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 p-6 md:p-8 text-slate-900 border-b-4 border-yellow-600">
            <div className="relative z-10">
              <span className="page-kicker text-yellow-700 mb-3 block">
                Inventory Control System
              </span>
              <h1 className="page-title font-display">
                รายการ <span className="text-yellow-600 not-italic">สต็อกสินค้า</span>
              </h1>
              <p className="page-subtitle mt-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                จัดการรายการสั่งซื้อและตรวจสอบสินค้าในระบบ
              </p>
            </div>
            <button 
              onClick={fetchPendingOrders}
              className="primary-action bg-yellow-600 text-white shadow-lg shadow-yellow-600/15 hover:bg-slate-900 md:self-end"
            >
              <span className="text-2xl">🔄</span> รีเฟรชข้อมูล
            </button>
        </div>

{/* Phase 2: Action Bar (Modern & Functional) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8 app-card p-4 md:p-5 transition-all">
        
        {/* 1. โซนค้นหา (ฝั่งซ้าย) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 ml-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ค้นหาข้อมูลสินค้าหรือเลขบิล</p>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <span className="text-xl text-slate-400">🔍</span>
            </div>
            <input 
              type="text"
              placeholder="รหัสสินค้า, ชื่อสินค้า หรือ เลขบิล..."
              className="control-field w-full pl-14 pr-12 py-4 rounded-xl font-bold text-base placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => {setSearchTerm(e.target.value);setCurrentPage(1);}}
            />
            {searchTerm && (
              <button 
                onClick={() => {setSearchTerm('');setCurrentPage(1);}}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-red-500 rounded-lg transition-all border border-slate-100"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2. โซนตัวเลือก Supplier (ตรงกลาง) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">คัดกรองซัพพลายเออร์</p>
          <div className="relative group h-full">
            <select
              value={selectedSupplier}
              onChange={(e) => {setSelectedSupplier(e.target.value);setCurrentPage(1);}}
              className="control-field w-full h-14 px-5 rounded-xl font-black text-slate-600 appearance-none cursor-pointer"
            >
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? '🏢 ทุกบริษัทในระบบ' : `🏬 ${s}`}
                </option>
              ))}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-focus-within:text-yellow-500 transition-colors">
              ▼
            </div>
          </div>
        </div>

        {/* 3. โซนปุ่ม Action (ฝั่งขวา) */}
        <div className="lg:col-span-4 flex flex-col justify-end gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileImport} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          
          <div className="flex flex-col gap-2">
            {/* ปุ่มหลัก: ลงทะเบียนรับของ */}
            <button 
              onClick={() => void openBulk()}
              disabled={auxLoading}
              className="primary-action w-full bg-slate-900 text-yellow-300 hover:bg-yellow-500 hover:text-slate-950"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">📦</span>
              <span>ลงทะเบียนรับของหลายรายการ</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>

            {/* กลุ่มปุ่มรอง: Import/Export */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-200 bg-white py-3 text-[11px] font-bold uppercase text-slate-600 transition-all hover:border-blue-400 hover:text-blue-600 active:scale-95"
              >
                <span>📥</span>
                <span>Import</span>
              </button>

              <button 
                onClick={() => setShowExportOptions(true)}
                className="rounded-lg border border-slate-200 bg-white py-3 text-[11px] font-bold uppercase text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-600 active:scale-95"
              >
                <span>📊</span>
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

      </div>
            
      <IssueTracking
        items={workPage.issues}
        canEdit
        onEdit={setUpdatingItem}
        onForceComplete={handleForceComplete}
      />


{/* Table Section: ปรับโฉมใหม่เป็น Modern Floating Card Style */}
      <div className="w-full overflow-x-auto pb-10">
        <table className="w-full border-separate border-spacing-y-4 px-2">
          <thead className="bg-transparent text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
            <tr>
              <th className="px-8 py-4 text-left">ข้อมูลสินค้า</th>
              <th className="px-4 py-4 text-center">ซัพพลายเออร์</th>
              <th className="px-4 py-4 text-center">ยอดรวมที่ต้องรับ</th>
              <th className="px-4 py-4 text-center w-24"></th>
            </tr>
          </thead>
          <tbody>
            {displayProducts.map(({ productInfo, batches, totalOrder }) => {
              const pId = productInfo.productID;
              const isExpanded = !!expandedBatches[pId];

              return (
                <React.Fragment key={pId}>
                  {/* Main Product Row */}
                  <tr 
                    className={`group cursor-pointer transition-all duration-300 ${isExpanded ? 'scale-[1.01]' : 'hover:scale-[1.005]'}`}
                    onClick={() => toggleBatch(pId)}
                  >
                    {/* รายละเอียดสินค้า */}
                    <td className={`bg-white p-6 rounded-l-[35px] border-y-2 border-l-2 transition-colors ${isExpanded ? 'border-yellow-400 bg-slate-50' : 'border-slate-100 group-hover:border-slate-200'}`}>
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-3xl shrink-0 shadow-inner border border-slate-100 overflow-hidden group-hover:rotate-3 transition-transform">
                          {productInfo.imageUrl ? <img src={productInfo.imageUrl} className="w-full h-full object-cover" alt="" /> : "📦"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-tighter uppercase">ID: {pId}</span>
                          </div>
                          <h3 className="text-lg font-black text-slate-800 leading-tight uppercase tracking-tight group-hover:text-yellow-600 transition-colors">
                            {productInfo.productName}
                          </h3>
                        </div>
                      </div>
                    </td>

                    {/* ซัพพลายเออร์ */}
                    <td className={`bg-white px-4 py-6 border-y-2 text-center transition-colors ${isExpanded ? 'border-yellow-400 bg-slate-50' : 'border-slate-100 group-hover:border-slate-200'}`}>
                      <span className="px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-[11px] font-black uppercase border border-blue-100 italic">
                        {productInfo.supplier || 'N/A'}
                      </span>
                    </td>

                    {/* สรุปยอดสั่ง */}
                    <td className={`bg-white px-4 py-6 border-y-2 text-center transition-colors ${isExpanded ? 'border-yellow-400 bg-slate-50' : 'border-slate-100 group-hover:border-slate-200'}`}>
                      <div className="inline-flex flex-col items-center bg-slate-50 px-6 py-2 rounded-2xl border border-slate-100 shadow-inner">
                        <p className="text-2xl font-black text-slate-900 leading-none">
                          {totalOrder} <span className="text-[11px] text-slate-400 font-bold uppercase">{productInfo.cartonUnit}</span>
                        </p>
                        <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-tighter">
                           {productInfo.qtyPerCarton} {productInfo.innerUnit}
                        </p>
                      </div>
                    </td>

                    {/* ปุ่มลูกศร */}
                    <td className={`bg-white p-6 rounded-r-[35px] border-y-2 border-r-2 text-center transition-colors ${isExpanded ? 'border-yellow-400 bg-slate-50' : 'border-slate-100 group-hover:border-slate-200'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-yellow-400 text-slate-900 rotate-180 shadow-lg shadow-yellow-200' : 'bg-slate-50 text-slate-300'}`}>
                        <span className="text-xl">▼</span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Batch Detail */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="px-4 pb-4 -mt-2">
                        <div className="bg-slate-900 rounded-[35px] p-2 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                          <div className="bg-white/5 rounded-[28px] overflow-hidden">
                            <div className="grid grid-cols-1">
                              {batches.map((batch: StockItem) => (
                                <div key={batch.rowId} className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 last:border-0 hover:bg-white/5 transition-all">
                                  <div className="flex items-center gap-8 flex-1">
                                    <div className="shrink-0">
                                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">BATCH GROUP</p>
                                      <p className="text-sm font-black text-yellow-400">{batch.groupId}</p>
                                      <p className="text-[10px] font-bold text-slate-400 mt-1">📅 วันที่สั่ง {batch.Created_At_P || '-'}</p>
                                    </div>
                                    <div className="h-10 w-px bg-white/10 hidden md:block"></div>
                                    <div>
                                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1 italic">Invoice No.</p>
                                      <p className="text-sm font-black text-white italic tracking-tight">{batch.invoiceNo || 'PENDING'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-8">
                                    <div className="text-right">
                                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">ยอดบิลนี้</p>
                                      <p className="text-2xl font-black text-amber-600 leading-none">
                                        {totalOrder} <span className="text-[11px] text-slate-400 font-bold uppercase">{productInfo.cartonUnit}</span>
                                      </p>
                                      <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-tighter">
                                        {productInfo.qtyPerCarton} {productInfo.innerUnit}
                                      </p>
                                    </div>
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        
                                        // 1. สั่งปิดหน้าต่างรับของหลายรายการ (Bulk) เพื่อไม่ให้หน้าจอทับซ้อนกัน
                                        setIsBulkModalOpen(false); 
                                        
                                        // 2. ดีดหน้าต่างใบตรวจรับสินค้าขาเข้าอันเดิมขึ้นมาทำงานทันทีครับพี่ชาย!
                                        setSelectedBatch([batch]); 
                                      }} 
                                      className="group/btn relative bg-yellow-400 text-slate-950 px-8 py-4 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all hover:bg-white active:scale-95 flex items-center gap-2" 
                                    >
                                      <span>📝 ตรวจรับสินค้า</span>
                                      <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity">→</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
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

{isBulkModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-70 flex items-start justify-center p-2 sm:p-6 pt-10 sm:pt-20 overflow-y-auto">
            <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20 my-auto">
              
              {/* Header */}
              <div className="px-10 py-8 flex justify-between items-center bg-yellow-400 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="bg-slate-900 text-yellow-400 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl">
                    📦
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-none">ลงทะเบียนรับของหลายรายการ</h2>
                    <p className="text-slate-900/60 text-xs font-bold mt-2 uppercase tracking-[0.2em]">Bulk Stock-In Registration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBulkModalOpen(false)} 
                  className="w-12 h-12 flex items-center justify-center bg-slate-900/10 hover:bg-slate-900 text-slate-900 hover:text-white rounded-full transition-all active:scale-90"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                {/* Search & Filter Section */}
                <div className="p-8 bg-white border-b border-slate-100 shrink-0">
                  <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto">

                    {/* Search Bar */}
                    <div className="flex flex-col gap-2 flex-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">ค้นหาสินค้าเพื่อเพิ่มเข้าลิสต์</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                          <span className="text-slate-400 group-focus-within:text-yellow-500 transition-colors">🔍</span>
                        </div>
                        <input 
                          type="text"
                          placeholder="พิมพ์ชื่อสินค้า, ID หรือ เลขบิล..."
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[22px] outline-none focus:border-yellow-400 focus:bg-white font-bold text-base transition-all shadow-sm"
                          value={innerSearch}
                          onChange={(e) => setInnerSearch(e.target.value)}
                        />
                        
                        {/* Search Results Dropdown */}
                        {innerSearch && (
                          <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[28px] shadow-2xl z-80 max-h-60 overflow-y-auto p-2">
                            {auxItems
                              .filter(i => {
                                const matchSearch = i.productName.toLowerCase().includes(innerSearch.toLowerCase()) || i.productID.includes(innerSearch);
                                const matchSupplier = selectedSupplier === 'all' || i.supplier === selectedSupplier;
                                const isAlreadyAdded = bulkRecvList.some(x => x.rowId === i.rowId);
                                
                                // ✅ ปรับแก้จุดนี้: เช็คไม่ให้เจอรายการที่มีสถานะ COMPLETED (หรือเผื่อ 'รับแล้ว' ของเดิมไว้ให้ครับ)
                                const isNotCompleted = i.status !== 'COMPLETED' && i.status !== 'รับแล้ว';
                                
                                return matchSearch && matchSupplier && isNotCompleted && !isAlreadyAdded;
                              })
                              .map(item => (
                                <div 
                                  key={item.rowId}
                                  onClick={() => {
                                    if(!bulkRecvList.find(x => x.rowId === item.rowId)) {
                                      setBulkRecvList([...bulkRecvList, { ...item, custom_carton: '', custom_qty: '', custom_invoice: item.invoiceNo || '', custom_note: item.Note_Stock || '' }]);
                                    }
                                    setInnerSearch('');
                                  }}
                                  className="p-4 hover:bg-yellow-50 rounded-[20px] cursor-pointer flex justify-between items-center transition-all group/item mb-1"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-black text-slate-700 text-sm">{item.productName}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">ซัพ: {item.supplier} | บิล: {item.invoiceNo}</span>
                                  </div>
                                  <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black opacity-0 group-hover/item:opacity-100 transition-all">+ เพิ่มรายการ</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supplier Filter Dropdown */}
                    <div className="flex flex-col gap-2 min-w-60">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">คัดกรองซัพพลายเออร์</label>
                      <div className="relative">
                        <select 
                          value={selectedSupplier}
                          onChange={(e) => {setSelectedSupplier(e.target.value);setCurrentPage(1);}}
                          className="w-full appearance-none pl-12 pr-10 py-4 bg-slate-50 border-2 border-slate-100 rounded-[22px] outline-none focus:border-yellow-400 focus:bg-white font-bold text-slate-700 transition-all shadow-sm cursor-pointer"
                        >
                          <option value="all">ทุกบริษัทในระบบ</option>
                          {[...new Set(auxItems.map(i => i.supplier))].filter(Boolean).map(sup => (
                            <option key={sup} value={sup}>{sup}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-xl">
                          🏢
                        </div>
                        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                          ▼
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table Section */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                  <table className="w-full border-separate border-spacing-y-4">
                    <thead>
                      <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <th className="text-left px-6 py-2">รายละเอียดสินค้า</th>
                        <th className="text-center px-4 py-2">ข้อมูลสั่งซื้อ</th>
                        <th className="text-center px-4 py-2">ยอดรับจริง (ลัง)</th>
                        <th className="text-center px-4 py-2">บรรจุ/ลัง</th>
                        <th className="text-center px-4 py-2">เลขที่บิล</th>
                        <th className="text-center px-4 py-2">หมายเหตุสต็อก</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRecvList
                        .filter(item => selectedSupplier === 'all' || item.supplier === selectedSupplier)
                        .map((item, idx) => (
                        <tr key={item.rowId} className="bg-white hover:shadow-xl transition-all group animate-in fade-in slide-in-from-bottom-2">
                          <td className="px-6 py-5 rounded-l-[28px] border-y border-l border-slate-100">
                            <div className="flex flex-col gap-2">
                              <span className="font-black text-slate-900 text-[13px] line-clamp-1">{item.productName}</span>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase border border-slate-200">
                                  SUP: {item.supplier}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 border-y border-slate-100 text-center">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-700">{item.orderCarton} {item.cartonUnit}</span>
                              <span className="text-[10px] font-bold text-slate-400">({item.qtyPerCarton} {item.innerUnit}/ลัง)</span>
                            </div>
                          </td>

                          {/* ช่องที่ 1: ยอดรับจริง (ลัง) */}
                          <td className="px-4 py-5 border-y border-slate-100">
                            <input 
                              type="number"
                              className="w-24 mx-auto block text-center bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-black text-sm focus:border-yellow-400 focus:bg-white outline-none transition-all shadow-inner"
                              placeholder="ใส่จำนวน"
                              value={item.custom_carton ?? ''}
                              onChange={(e) => {
                                const updated = [...bulkRecvList];
                                const realIdx = bulkRecvList.findIndex(x => x.rowId === item.rowId);
                                updated[realIdx].custom_carton = e.target.value; 
                                setBulkRecvList(updated);
                              }}
                            />
                          </td>

                          {/* ช่องที่ 2: บรรจุ/ลัง */}
                          <td className="px-4 py-5 border-y border-slate-100">
                            <input 
                              type="number"
                              className="w-24 mx-auto block text-center bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-black text-sm focus:border-yellow-400 focus:bg-white outline-none transition-all shadow-inner"
                              placeholder="ใส่จำนวน"
                              value={item.custom_qty ?? ''}
                              onChange={(e) => {
                                const updated = [...bulkRecvList];
                                const realIdx = bulkRecvList.findIndex(x => x.rowId === item.rowId);
                                updated[realIdx].custom_qty = e.target.value; 
                                setBulkRecvList(updated);
                              }}
                            />
                          </td>

                          {/* ช่องที่ 3: เลขที่บิลรายรายการ */}
                          <td className="px-4 py-5 border-y border-slate-100">
                            <input 
                              type="text"
                              className="w-32 mx-auto block text-center bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-xs focus:border-yellow-400 focus:bg-white outline-none transition-all shadow-inner"
                              placeholder="เลขที่บิล"
                              value={item.custom_invoice ?? ''}
                              onChange={(e) => {
                                const updated = [...bulkRecvList];
                                const realIdx = bulkRecvList.findIndex(x => x.rowId === item.rowId);
                                updated[realIdx].custom_invoice = e.target.value; 
                                setBulkRecvList(updated);
                              }}
                            />
                          </td>

                          {/* ช่องที่ 4: หมายเหตุสต็อก */}
                          <td className="px-4 py-5 border-y border-slate-100">
                            <input 
                              type="text"
                              className="w-44 mx-auto block bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-medium text-xs focus:border-yellow-400 focus:bg-white outline-none transition-all shadow-inner"
                              placeholder="เช่น ของแถม, ขาดส่ง..."
                              value={item.custom_note ?? ''}
                              onChange={(e) => {
                                const updated = [...bulkRecvList];
                                const realIdx = bulkRecvList.findIndex(x => x.rowId === item.rowId);
                                updated[realIdx].custom_note = e.target.value; 
                                setBulkRecvList(updated);
                              }}
                            />
                          </td>

                          <td className="px-4 py-5 rounded-r-[28px] border-y border-r border-slate-100 text-center">
                            <button 
                              onClick={() => setBulkRecvList(bulkRecvList.filter(x => x.rowId !== item.rowId))}
                              className="w-10 h-10 flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {bulkRecvList.length === 0 && (
                    <div className="py-32 text-center text-slate-300">
                      <div className="text-6xl mb-4 opacity-10">📥</div>
                      <p className="font-black text-[10px] uppercase tracking-[0.4em]">ยังไม่ได้เลือกรายการ</p>
                    </div>
                  )}
                </div>

                {/* Footer: บันทึกข้อมูล */}
                <div className="p-8 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                  <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                    <input 
                      type="text" 
                      placeholder="ระบุชื่อผู้รับสินค้า..."
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-yellow-400 transition-all"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if(!receiverName.trim())return alert('กรุณาระบุชื่อผู้รับของ');
                      try {
                        setIsSubmitting(true);
                        await saveReceiptBatch(bulkRecvList.filter(item=>selectedSupplier==='all'||item.supplier===selectedSupplier).map(item=>({
                              rowId: item.rowId, rowUid:item.rowUid, revision:item.revision,
                              receiver: receiverName,
                              recvCarton: item.custom_carton || '',
                              Recv_Qty: item.custom_qty || '',
                              invoiceNo: item.custom_invoice || '',
                              Note_Stock: item.custom_note || '',
                              Recv_Date: new Date().toLocaleString('th-TH')
                            })));
                        setBulkRecvList(previous=>previous.filter(item=>selectedSupplier!=='all'&&item.supplier!==selectedSupplier));
                        setIsBulkModalOpen(false);
                        alert('บันทึกข้อมูลแบบ Bulk เรียบร้อยครับพี่ชาย!');
                        
                        await fetchOrderedItems();
                      } catch (err) {
                        console.error(err);
                        alert(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="px-10 py-4 bg-slate-900 text-white rounded-[22px] font-black text-sm hover:bg-slate-800 transition-all flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-30" 
                    disabled={!bulkRecvList.some(item=>selectedSupplier==='all'||item.supplier===selectedSupplier) || isSubmitting || !receiverName.trim()}
                  >
                    {isSubmitting ? 'กำลังบันทึกทั้งชุด...' : 'บันทึกชุดที่แสดง'}
                    <span className="bg-yellow-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-[10px]">{bulkRecvList.filter(item=>selectedSupplier==='all'||item.supplier===selectedSupplier).length}</span>
                  </button>
                </div>
              </div>
            </div>
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
                      <th className="p-5 text-center border-l border-slate-700">จำนวนลัง</th>
                      <th className="p-5 text-center">จำนวนในกล่อง</th>
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

      {showExportOptions && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-110 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-4xl p-8 shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2">
              <span>📊</span> เลือกซัพพลายเออร์
            </h3>
            
            {/* 1. ส่วนแสดงรายการที่เลือกแล้ว (จะแสดงเมื่อมีการเลือกอย่างน้อย 1 รายการ) */}
            {exportSuppliers.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">เลือกแล้ว {exportSuppliers.length} รายการ:</div>
                <div className="flex flex-wrap gap-2 max-h-25 overflow-y-auto p-2 bg-emerald-50 rounded-2xl custom-scrollbar">
                  {exportSuppliers.map(s => (
                    <div key={s} className="flex items-center gap-1 bg-white border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span className="text-[11px] font-black text-slate-700">{s}</span>
                      <button 
                        onClick={() => setExportSuppliers(exportSuppliers.filter(item => item !== s))}
                        className="text-emerald-500 hover:text-red-500 font-bold ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. ช่องค้นหา */}
            <div className="relative mb-4 mt-2">
              <input 
                type="text"
                placeholder="ค้นหาชื่อบริษัท..."
                className="w-full bg-slate-100 p-4 pl-12 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:border-emerald-500 transition-all"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>

            {/* 3. ปุ่มทางลัด */}
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => {
                  const currentVisible = suppliers.filter(s=>s!=='all')
                    .filter(s => s && s.toLowerCase().includes(supplierSearch.toLowerCase())) as string[];
                  setExportSuppliers(Array.from(new Set([...exportSuppliers, ...currentVisible])));
                }}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"
              >
                เลือกทั้งหมดที่เห็น
              </button>
              <button 
                onClick={() => setExportSuppliers([])}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"
              >
                ล้างค่าทั้งหมด
              </button>
            </div>
            
            {/* 4. รายการบริษัท (Checkbox) */}
            <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-2 custom-scrollbar">
              {suppliers.filter(s=>s!=='all')
                .filter(s => s && s.toLowerCase().includes(supplierSearch.toLowerCase()))
                .sort()
                .map(s => (
                  <label key={s} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors border-2 border-transparent has-checked:border-emerald-500 has-checked:bg-emerald-50/50">
                    <input 
                      type="checkbox"
                      className="w-5 h-5 accent-emerald-600 cursor-pointer"
                      checked={exportSuppliers.includes(s as string)}
                      onChange={(e) => {
                        if (e.target.checked) setExportSuppliers([...exportSuppliers, s as string]);
                        else setExportSuppliers(exportSuppliers.filter(item => item !== s));
                      }}
                    />
                    <span className="font-black text-slate-700 text-sm">{s}</span>
                  </label>
                ))}
            </div>

            <div className="flex gap-3 pt-4 border-t-2 border-slate-50">
              <button onClick={() => setShowExportOptions(false)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400">ยกเลิก</button>
              <button 
                onClick={handleFinalExport}
                className="flex-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                ดาวน์โหลด {exportSuppliers.length} บริษัท
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-150 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-7xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] scale-in-center">
            
            {/* Header */}
            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter">ตรวจสอบการรับสินค้า (Stock Inbound)</h3>
                <p className="text-slate-400 font-bold text-sm">ตรวจพบข้อมูลในไฟล์ทั้งหมด {importData.length} รายการ</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="bg-white w-12 h-12 rounded-full shadow-sm flex items-center justify-center text-slate-300 hover:text-red-500 transition-all border border-slate-100">✕</button>
            </div>

            {/* Table Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="pb-4 pl-6">ID / รายการสินค้า</th>
                    <th className="pb-4 text-center">ยอดสั่งซื้อ (กล่อง)</th>
                    <th className="pb-4 text-center">บรรจุ/กล่อง</th>
                    <th className="pb-4 text-center bg-blue-50 text-blue-600 rounded-t-2xl border-x border-t border-blue-100 uppercase">รับจริง (กล่อง)</th>
                    <th className="pb-4 text-center bg-blue-50 text-blue-600 rounded-t-2xl border-r border-t border-blue-100 uppercase">รับจริง (ชิ้น)</th>
                    <th className="pb-4 text-center">เลขที่บิล</th>
                    <th className="pb-4 text-right pr-6">สถานะการตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                {importData.map((row, idx) => {
                    // 1. ดึงค่าตัวเลขดิบจากแต่ละช่อง
                    const orderBox = Number(row['ยอดสั่ง (กล่อง)'] || 0);
                    const packSize = Number(row['บรรจุ/กล่อง'] || 0);
                    const recvBox = Number(row['รับจริง (กล่อง)'] || 0);
                    const recvPiece = Number(row['รับจริง (ชิ้น)'] || 0);

                    // 2. Logic การเปรียบเทียบตามคู่ที่พี่ชายสั่ง
                    // คู่ที่ 1: ยอดสั่ง (กล่อง) เทียบกับ รับจริง (กล่อง)
                    const isBoxMatch = recvBox === orderBox;
                    
                    // คู่ที่ 2: บรรจุ/กล่อง เทียบกับ รับจริง (ชิ้น)
                    // (เศษชิ้นที่รับมา ต้องเท่ากับจำนวนบรรจุต่อกล่องถึงจะถือว่าตรงตามคู่ของมัน)
                    const isPieceMatch = recvPiece === packSize;

                    // เงื่อนไข OK: ต้องตรงกันทั้ง 2 คู่
                    const isComplete = isBoxMatch && isPieceMatch;

                    return (
                      <tr key={idx} className="text-sm font-bold text-slate-700 bg-white group hover:bg-slate-50 transition-all shadow-sm">
                        <td className="py-4 pl-6 rounded-l-3xl border-y-2 border-l-2 border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-black"># {row['ID อ้างอิง']}</span>
                            <span className="max-w-70 truncate text-slate-900">{row['รายการสินค้า']}</span>
                          </div>
                        </td>
                        
                        {/* คู่ที่ 1: ยอดสั่ง (กล่อง) */}
                        <td className="py-4 text-center border-y-2 border-slate-50 text-slate-950 text-lg">
                          {orderBox} <span className="text-[10px] text-slate-400 font-normal">{row['หน่วยหลัก']}</span>
                        </td>

                        {/* คู่ที่ 2: บรรจุ/กล่อง */}
                        <td className="py-4 text-center border-y-2 border-slate-50 text-slate-400 font-normal">
                          {packSize} {row['หน่วยย่อย']}
                        </td>

                        {/* ผลรับจริง (กล่อง) - เทียบกับยอดสั่ง */}
                        <td className={`py-4 text-center border-y-2 border-slate-50 border-x font-black text-xl ${!isBoxMatch ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/30'}`}>
                          {recvBox}
                        </td>
                        
                        {/* ผลรับจริง (ชิ้น) - เทียบกับบรรจุ/กล่อง */}
                        <td className={`py-4 text-center border-y-2 border-slate-50 border-r font-black text-xl ${!isPieceMatch ? 'text-orange-600 bg-orange-50' : 'text-blue-700 bg-blue-50/30'}`}>
                          {recvPiece}
                        </td>

                        <td className="py-4 text-center border-y-2 border-slate-50">
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black">{row['เลขที่บิล'] || '-'}</span>
                        </td>

                        {/* ตรวจสอบสถานะ */}
                      <td className="py-4 pr-6 text-right rounded-r-3xl border-y-2 border-r-2 border-slate-50">
                        {isComplete ? (
                          <span className="text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full text-[10px] border border-emerald-100 font-black uppercase">
                            ✓ OK ครบ
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {/* 1. เช็คส่วนต่างกล่อง: รับจริง - ยอดสั่ง */}
                            {recvBox !== orderBox && (
                              <span className={`text-[9px] px-2 py-0.5 rounded border font-black ${recvBox > orderBox ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                กล่อง {recvBox > orderBox ? 'เกิน' : 'ขาด'} ({recvBox - orderBox})
                              </span>
                            )}

                            {/* 2. เช็คส่วนต่างเศษชิ้น: รับจริง(ชิ้น) - บรรจุ/กล่อง */}
                            {/* ตรงนี้แหละครับที่จะทำให้รายการ Test โชว์ส่วนต่างออกมา */}
                            {recvPiece !== packSize && (
                              <span className={`text-[9px] px-2 py-0.5 rounded border font-black ${recvPiece > packSize ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                เศษ {recvPiece > packSize ? 'เกิน' : 'ขาด'} ({recvPiece - packSize})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-8 bg-slate-950 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 text-white">
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Confirmation Required</p>
                <p className="text-sm font-bold">ตรวจสอบยอดรับจริง (กล่อง/ชิ้น) ให้ตรงกับหน้างานสำเพ็งบุรีรัมย์</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="พิมพ์ชื่อพี่ชาย หรือผู้ตรวจรับ..."
                  className="bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl font-black text-white outline-none focus:border-yellow-400 transition-all text-sm w-full md:w-64"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                />
                <button 
                  onClick={handleConfirmImport}
                  disabled={isSubmitting}
                  className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-yellow-400/5 ${isSubmitting ? 'bg-slate-800 text-slate-500' : 'bg-yellow-400 text-slate-950 hover:bg-yellow-300'}`}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกเข้าสต็อกจริง'}
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

function fetchData() {
  throw new Error('Function not implemented.');
}
