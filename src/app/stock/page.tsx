'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

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
  Recv_Date?: string;
  Created_At?: string;
  invoiceNo?: string;
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
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

  const [updatingItem, setUpdatingItem] = useState<StockItem | null>(null);
  const [additionalQty, setAdditionalQty] = useState('');
  const [additionalRecvQty, setAdditionalRecvQty] = useState(''); 
  const [additionalNote, setAdditionalNote] = useState(''); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 
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
    setCurrentPage(1);
  }, [searchTerm, selectedSupplier]);

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

const exportToExcel = () => {
    // 1. ดึงข้อมูลตามที่เรา Filter ไว้บนหน้าจอ (คำค้นหา + บริษัท)
    const s = searchTerm.toLowerCase();
    const filteredForExport = items.filter(item => {
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
      "ID อ้างอิง", "รหัสสินค้า", "รายการสินค้า", "หน่วยหลัก", "ยอดสั่ง (กล่อง)", "บรรจุ/กล่อง", "หน่วยย่อย", "|", 
      "รับจริง (กล่อง)", "รับจริง (ชิ้น)", "เลขที่บิล (Invoice)", "หมายเหตุ"
    ];

    // 4. เตรียมข้อมูล Data Rows
    const rows = filteredForExport.map((item) => [
      item.rowId,
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
      ""  // ช่องว่างให้คีย์
    ]);

    // 5. รวมข้อมูลและสร้าง Sheet
    const worksheetData = [...header, tableHeader, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 6. ตั้งค่าความกว้างคอลัมน์ (Column Widths)
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 50 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 3 },
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
  const [importData, setImportData] = useState<any[]>([]); // เก็บข้อมูลที่อ่านจาก Excel
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
        const parsedData = XLSX.utils.sheet_to_json(sheet, { range: 4 });

        const results = parsedData.filter((row: any) => {
          // เช็คชื่อคอลัมน์ให้ตรงกับไฟล์ Excel ของพี่ชายเป๊ะๆ
          const hasBox = row['รับจริง (กล่อง)'] !== undefined && row['รับจริง (กล่อง)'] !== '';
          const hasPiece = row['รับจริง (ชิ้น)'] !== undefined && row['รับจริง (ชิ้น)'] !== '';
          const hasId = row['ID อ้างอิง'] !== undefined;

          return (hasBox || hasPiece) && hasId;
        });

        if (results.length === 0) {
          alert('ไม่พบข้อมูลการรับของ หรือชื่อคอลัมน์ไม่ตรงกับระบบครับพี่ชาย! ลองเช็คว่าคีย์ยอดในช่อง "รับจริง (กล่อง)" หรือยัง');
          return;
        }
        
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
      const filtered = items.filter(item => {
        const matchStatus = item.status === 'ORDERED';
        const matchSearch = (
          item.productName?.toLowerCase().includes(s) ||
          item.productID?.toString().toLowerCase().includes(s) ||
          item.groupId?.toLowerCase().includes(s) ||
          item.supplier?.toLowerCase().includes(s)
        );
        const matchSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
        
        return matchStatus && matchSearch && matchSupplier;
      });

      // จัดกลุ่มสินค้า (Grouping)
      const groups: { [key: string]: any } = {};
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
    const sortedProducts = Object.values(groups).sort((a: any, b: any) => 
      a.productInfo.productName.localeCompare(b.productInfo.productName)
    );

    // คำนวณจำนวนหน้าจากรายการที่ "กรองเสร็จแล้ว"
    const total = Math.ceil(sortedProducts.length / itemsPerPage);
    
    // ตัดแบ่งหน้า (Pagination)
    const sliced = sortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return { 
      displayProducts: sliced, 
      totalPages: total,
      totalItemsCount: sortedProducts.length
    };
    // เพิ่ม selectedSupplier เข้าไปใน Dependency เพื่อให้ Re-render เมื่อเปลี่ยนบริษัทครับ
  }, [items, searchTerm, selectedSupplier, currentPage]);

  // ดึงรายชื่อ Supplier ทั้งหมดออกมาทำ Dropdown
  const suppliers = useMemo(() => {
    const list = Array.from(new Set(items.map(item => item.supplier).filter(Boolean)));
    return ['all', ...list];
  }, [items]);

  // ปรับ useMemo ของ displayProducts ให้รองรับการกรอง Supplier
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.productID.includes(searchTerm);
      const matchSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
      return matchSearch && matchSupplier;
    });
  }, [items, searchTerm, selectedSupplier]);

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

        await fetch('/api/stock', {
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

  const handleFinalExport = () => {
    // 1. กรองข้อมูลตามรายชื่อบริษัทที่ติ๊กเลือกไว้
    const dataToExport = items.filter(item => {
      const matchStatus = item.status === 'ORDERED';
      const matchSupplier = exportSuppliers.includes(item.supplier);
      return matchStatus && matchSupplier;
    });

    if (dataToExport.length === 0) {
      alert('กรุณาเลือกซัพพลายเออร์อย่างน้อย 1 รายครับพี่ชาย');
      return;
    }

    // 2. จัดเรียงข้อมูลตามชื่อซัพพลายเออร์ (เพื่อให้ใน Excel เรียงเป็นกลุ่มดูง่าย)
    dataToExport.sort((a, b) => a.supplier.localeCompare(b.supplier));

    // 3. ส่วนหัวและโครงสร้าง Excel (เหมือนเดิมแต่ปรับชื่อซัพพลายเออร์)
    const header = [
      ["ศูนย์ค้าส่งสำเพ็งบุรีรัมย์ - ใบแจ้งตรวจรับสินค้า (STOCK INBOUND)"],
      [`ซัพพลายเออร์ที่เลือก: ${exportSuppliers.join(', ')}`],
      [`วันที่ดึงข้อมูล: ${new Date().toLocaleDateString('th-TH')} | รวมทั้งสิ้น: ${dataToExport.length} รายการ`],
      [""],
    ];

    const tableHeader = ["ID อ้างอิง", "รหัสสินค้า", "รายการสินค้า", "ซัพพลายเออร์", "หน่วยหลัก", "ยอดสั่ง (กล่อง)", "บรรจุ/กล่อง", "หน่วยย่อย", "|", "รับจริง (กล่อง)", "รับจริง (ชิ้น)", "เลขที่บิล", "หมายเหตุ"];
    
    const rows = dataToExport.map(item => [
      item.rowId, item.productID, item.productName, item.supplier, item.cartonUnit, 
      Number(item.orderCarton), Number(item.qtyPerCarton || 0), item.innerUnit || '-', "|", "", "", "", ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([...header, tableHeader, ...rows]);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 45 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 3 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 25 }];
    
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
        for (const row of importData) {
          const rowId = row['ID อ้างอิง'];
          if (!rowId) continue;

          const payload = {
            rowId: Number(rowId), // มั่นใจว่าเป็น Number ตามที่หลังบ้านเช็ค rowNumber
            receiver: receiverName,
            recvCarton: String(row['รับจริง (กล่อง)'] || '0'),
            Recv_Qty: String(row['รับจริง (ชิ้น)'] || '0'),
            invoiceNo: String(row['เลขที่บิล'] || ''),
            Note_Stock: String(row['หมายเหตุ'] || ''),
            Recv_Date: new Date().toLocaleDateString('th-TH', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
        }),
          };


          await fetch('/api/stock', { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        alert('นำเข้าข้อมูลสำเร็จแล้วครับพี่ชาย!');
        setShowImportModal(false);
        window.location.reload(); 
      } catch (error) {
        console.error("Error:", error);
        alert('บันทึกไม่สำเร็จครับ');
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
      <div className="max-w-6xl mx-auto p-4 md:p-10">
        {/* ส่วนหัวข้อหลัก */}
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
              className="mt-8 md:mt-0 bg-yellow-600 hover:bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 shadow-lg"
            >
              <span className="text-2xl">🔄</span> รีเฟรชข้อมูล
            </button>
        </div>

{/* Phase 2: Action Bar (Modern & Functional) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 bg-white p-3 rounded-[35px] border-2 border-slate-100 shadow-xl shadow-slate-200/50">
        
        {/* 1. โซนค้นหา (ฝั่งซ้าย - เน้นกว้าง) */}
        <div className="lg:col-span-6 p-4 bg-slate-50/50 rounded-[28px] border border-slate-50">
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Search / ค้นหาข้อมูล</p>
            <span className="text-[10px] font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-md uppercase">Live Filter</span>
          </div>
          
          <div className="relative group">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl group-focus-within:scale-110 transition-transform duration-300">🔍</span>
            <input 
              type="text"
              placeholder="ค้นหารหัสสินค้า, ชื่อสินค้า หรือ เลขบิลกลุ่ม..."
              className="w-full pl-16 pr-6 py-5 rounded-[22px] border-2 border-slate-200 font-black text-xl focus:border-yellow-400 focus:bg-white outline-none transition-all shadow-sm group-hover:border-slate-300 bg-slate-50/50 placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-500 hover:text-white rounded-full transition-all text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2. โซนตัวเลือก Supplier (ตรงกลาง) */}
        <div className="lg:col-span-3 p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 tracking-widest text-center lg:text-left">คัดกรองซัพพลายเออร์</p>
          <div className="relative h-16.5">
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full h-full bg-slate-100 px-6 rounded-[22px] font-black outline-none border-2 border-transparent focus:border-yellow-400 focus:bg-white transition-all text-sm appearance-none cursor-pointer text-slate-700"
            >
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? '🏢 ทุกบริษัทในระบบ' : `🏬 ${s}`}
                </option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>

        {/* 3. โซนปุ่ม Action (ฝั่งขวา) */}
        <div className="lg:col-span-3 flex flex-col justify-end p-4 gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileImport} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {/*ปุ่ม Import */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 bg-white border-2 border-slate-100 text-slate-900 py-3.5 rounded-[20px] font-black text-[11px] hover:bg-slate-50 transition-all shadow-sm uppercase tracking-tighter active:scale-95"
            >
              <span className="text-lg">📥</span>
              <span>Import</span>
            </button>

            {/*ปุ่ม Export */}
            <button 
              onClick={() => setShowExportOptions(true)}
              className="flex items-center justify-center gap-3 bg-emerald-600 text-white py-3.5 rounded-[20px] font-black text-[11px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-tighter active:scale-95"
            >
              <span className="text-lg">📊</span>
              <span>Export</span>
            </button>
          </div>
        </div>

      </div>
            
      {/* ส่วน Discrepancy Items (คงเดิมแต่ปรับ Padding ให้รับกับส่วนอื่น) */}
      {discrepancyItems.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
              <span className="w-2 h-5 bg-red-500 rounded-full"></span>
              แจ้งเตือนรายการที่มีปัญหา ({Array.from(new Set(discrepancyItems.map(item => item.productID))).length})
            </h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar-h snap-x">
            {discrepancyItems
              .filter((item, index, self) => index === self.findIndex((t) => (t.productID === item.productID)))
              .map((item, idx) => {
                // คู่ที่ 1: ลัง เทียบ ลัง
                const diffCarton = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
                
                // คู่ที่ 2: บรรจุ/ลัง เทียบ รับจริง(ชิ้น)
                // (ถ้าคีย์รับจริงมา 10 แต่ในระบบบอกบรรจุ 10 ผลลัพธ์จะเป็น 0 = ไม่โชว์ส่วนต่าง)
                // (ถ้าคีย์รับจริงมา 8 แต่ในระบบบอกบรรจุ 10 ผลลัพธ์จะเป็น -2 = โชว์ว่าขาด 2)
                const diffInner = Number(item.Recv_Qty || 0) - Number(item.qtyPerCarton || 0);

                return (
                  <div key={`issue-${item.productID || idx}`} className="shrink-0 w-80 snap-start bg-white p-6 rounded-[35px] border-2 border-red-50 shadow-md hover:border-red-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-3 py-1 rounded-lg uppercase italic">ID: {item.productID}</span>
                      <div className="flex flex-col items-end gap-1">
                        {item.supplier && (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase truncate">
                            {item.supplier}
                          </span>
                        )}
                        {/* แจ้งเตือนคู่ที่ 1 (ลัง) */}
                        {diffCarton !== 0 && (
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${diffCarton < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-500'}`}>
                            {diffCarton < 0 ? `ลังขาด ${Math.abs(diffCarton)}` : `ลังเกิน ${diffCarton}`} {item.cartonUnit}
                          </span>
                        )}
                        
                        {/* แจ้งเตือนคู่ที่ 2 (ชิ้น) */}
                        {diffInner !== 0 && (
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${diffInner < 0 ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                            {diffInner < 0 ? `เศษขาด ${Math.abs(diffInner)}` : `เศษเกิน ${diffInner}`} {item.innerUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="font-black text-slate-800 text-[14px] uppercase italic truncate mb-4">{item.productName}</h4>
                    
                    <div className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400">ค่าอ้างอิง (สั่ง/บรรจุ):</span>
                        <div className="flex flex-col items-end">
                          <span className="text-slate-900">{item.orderCarton} {item.cartonUnit}</span>
                          <span className="text-slate-900">บรรจุ {item.qtyPerCarton} {item.innerUnit}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold border-t border-slate-200 pt-2">
                        <span className="text-slate-400">ตรวจรับจริง:</span>
                        <div className="flex flex-col items-end">
                           <span className="text-red-600 italic font-black">{item.recvCarton} {item.cartonUnit}</span>
                           <span className="text-red-600 italic font-black">บรรจุ {item.Recv_Qty} {item.innerUnit}</span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => setUpdatingItem(item)} className="w-full bg-slate-950 text-yellow-400 text-[11px] font-black py-4 rounded-2xl hover:bg-yellow-400 hover:text-slate-950 transition-all shadow-lg uppercase">
                      แก้ไข / รับเพิ่ม
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Table: ขยายใหญ่ ใช้งานง่าย สรุปยอดครบถ้วน */}
      <div className="bg-white border-2 border-slate-200 rounded-[40px] shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-white text-[12px] font-black uppercase tracking-[0.2em]">
            <tr>
              <th className="p-6 border-r border-slate-800">รายละเอียดสินค้า</th>
              <th className="p-6 text-center border-r border-slate-800 w-48">ซัพพลายเออร์</th>
              <th className="p-6 text-center border-r border-slate-800 w-64 text-yellow-400">สรุปยอดสั่งทั้งหมด</th>
              <th className="p-6 text-center w-32">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {displayProducts.map(({ productInfo, batches, totalOrder }) => {
              const pId = productInfo.productID;
              const isExpanded = !!expandedBatches[pId];
              const totalInnerQty = totalOrder * Number(productInfo.qtyPerCarton || 0);

              return (
                <React.Fragment key={pId}>
                  <tr 
                    className={`hover:bg-blue-50/50 cursor-pointer transition-all duration-200 ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={() => toggleBatch(pId)}
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl shrink-0 shadow-sm border border-slate-200 overflow-hidden">
                          {productInfo.imageUrl ? <img src={productInfo.imageUrl} className="w-full h-full object-cover" alt="" /> : "📦"}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-400 leading-none mb-2 uppercase tracking-widest">ID: {pId}</p>
                          <p className="text-xl font-black text-slate-800 leading-tight uppercase tracking-tight mb-1">{productInfo.productName}</p>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-black uppercase italic">
                             บรรจุ: {productInfo.qtyPerCarton} {productInfo.innerUnit}/{productInfo.cartonUnit}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <p className="text-sm font-black text-blue-600 uppercase italic">{productInfo.supplier || 'ไม่ระบุ'}</p>
                    </td>
                    <td className="p-6 text-center bg-yellow-50/30">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">
                          {totalOrder} <span className="text-[12px] text-slate-500 uppercase">{productInfo.cartonUnit}</span>
                        </p>
                        <div className="w-20 h-0.75 bg-yellow-400 my-1 rounded-full"></div>
                        <p className="text-sm font-black text-amber-600 italic">
                          รวม {totalInnerQty.toLocaleString()} {productInfo.innerUnit}
                        </p>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className={`text-3xl transition-transform duration-500 ${isExpanded ? 'rotate-180 text-yellow-500' : 'text-slate-300'}`}>
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-100/50">
                      <td colSpan={4} className="p-6 pt-2">
                        <div className="bg-white rounded-4xl border-2 border-slate-200 shadow-inner overflow-hidden">
                          <div className="grid grid-cols-1 divide-y-2 divide-slate-100">
                            {batches.map((batch: StockItem) => {
                              const bInnerQty = Number(batch.orderCarton) * Number(productInfo.qtyPerCarton || 0);
                              return (
                                <div key={batch.rowId} className="p-6 flex flex-col md:flex-row justify-between items-center gap-8 hover:bg-yellow-50/50 transition-colors">
                                  <div className="flex items-center gap-12 flex-1">
                                    <div className="shrink-0">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">กลุ่มบิล / วันที่สั่ง</p>
                                      <p className="text-sm font-black text-slate-800 bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200 inline-block">{batch.groupId}</p>
                                      <p className="text-[11px] font-bold text-slate-500 mt-2">📅 {batch.Created_At || '-'}</p>
                                    </div>
                                    <div className="hidden md:block">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1 font-italic">Invoice No.</p>
                                      <p className="text-sm font-black text-blue-600 border-b-2 border-blue-100 pb-1 italic">{batch.invoiceNo || 'รอระบุเลขที่บิล'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-10">
                                    <div className="text-right px-8 border-r-2 border-slate-100">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1 italic">ยอดบิลนี้</p>
                                      <p className="text-xl font-black text-slate-900">{batch.orderCarton} {batch.cartonUnit}</p>
                                      <p className="text-[11px] font-bold text-amber-600">(= {bInnerQty.toLocaleString()} {productInfo.innerUnit})</p>
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setSelectedBatch([batch]); }}
                                      className="bg-slate-950 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950 px-10 py-5 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-lg border-b-4 border-yellow-700 active:translate-y-1"
                                    >
                                      📝 ตรวจรับสินค้า
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
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
                  const currentVisible = Array.from(new Set(items.map(i => i.supplier)))
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
              {Array.from(new Set(items.map(i => i.supplier)))
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