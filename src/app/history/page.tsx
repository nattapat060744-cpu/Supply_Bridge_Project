'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';

interface HistoryItem {
  rowId: number;
  status: string;
  groupId: string;
  productName: string;
  supplier: string;
  orderCarton: string;
  qtyPerCarton: string;
  cartonUnit: string;
  innerUnit: string;
  recvCarton: string;
  recvUnit: string;
  recvQty: string;
  recvQtyUnit: string;
  invoiceNo: string;
  recvDate?: string;
  receiver: string;
  createdAt: string;
  noteRequest?: string;
  notePurchase?: string;
  noteStock?: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL'); // ✅ เพิ่มตัวกรอง Supplier
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('NEWEST'); // ✅ เพิ่มสถานะการเรียงลำดับ
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // ✅ เปลี่ยนเป็น State ให้เลือกได้

  const fetchHistory = () => {
    setLoading(true);
    setItems([]);
    setCurrentPage(1);
    
    fetch('/api/history', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const rawData = Array.isArray(data) ? data : [];
        const extract = (obj: any, target: string) => {
          const keys = Object.keys(obj);
          const cleanTarget = target.replace(/_/g, '').toLowerCase();
          const foundKey = keys.find(k => k.replace(/_/g, '').toLowerCase() === cleanTarget);
          return foundKey ? String(obj[foundKey]) : '';
        };

        const formatted = rawData.map((item, index) => ({
          rowId: item.rowNumber || item.rowId || index,
          status: extract(item, 'Status').trim().toUpperCase() || 'PENDING',
          productName: extract(item, 'Product_Name') || 'ไม่ระบุชื่อ',
          groupId: extract(item, 'Group_ID') || extract(item, 'Group_ID') || 'ทั่วไป',
          supplier: extract(item, 'Supplier') || 'ไม่ระบุ Supplier',
          qtyPerCarton: extract(item, 'Qty_Per_Carton') || '0',
          innerUnit: extract(item, 'Inner_Unit') || 'ชิ้น',
          orderCarton: extract(item, 'Order_Carton') || '0',
          cartonUnit: extract(item, 'Carton_Unit') || 'กล่อง',
          recvCarton: extract(item, 'Recv_Carton') || '-',
          recvUnit: extract(item, 'Recv_Unit') || 'กล่อง',
          recvQty: extract(item, 'Recv_Qty') || '0',
          recvQtyUnit: extract(item, 'Recv_Qty_Unit') || 'ชิ้น',
          invoiceNo: extract(item, 'Invoice_No') || '-',
          recvDate: extract(item, 'Recv_Date') || '-',
          receiver: extract(item, 'Receiver_Name') || '-',
          createdAt: extract(item, 'Created_At'),
          noteRequest: extract(item, 'Note_Request'),
          notePurchase: extract(item, 'Note_Purchase'),
          noteStock: extract(item, 'Note_Stock'),
        }));

        setItems(formatted);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => { fetchHistory(); }, []);

  // ✅ ดึงรายชื่อ Supplier ทั้งหมดออกมาทำ Dropdown (ไม่ซ้ำกัน)
  const supplierList = useMemo(() => {
    const list = Array.from(new Set(items.map(item => item.supplier))).filter(Boolean);
    return list.sort((a, b) => a.localeCompare(b, 'th'));
  }, [items]);

  // ✅ 1. กรองข้อมูล (Filter) และ เรียงลำดับ (Sort)
  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter(item => {
      const currentStatus = (item.status === 'REJECT' || item.status === 'REJECTED') ? 'REJECTED' : item.status;
      const matchesStatus = filterStatus === 'ALL' || currentStatus === filterStatus;
      const matchesSupplier = filterSupplier === 'ALL' || item.supplier === filterSupplier;
      const search = searchTerm.toLowerCase();
      const matchesSearch = item.productName.toLowerCase().includes(search) || 
                            item.groupId.toLowerCase().includes(search) ||
                            item.supplier.toLowerCase().includes(search);
      
      return matchesStatus && matchesSupplier && matchesSearch;
    });

    // เรียงลำดับข้อมูล
    return result.sort((a, b) => {
      if (sortOrder === 'NEWEST') return b.rowId - a.rowId; // ใหม่ไปเก่า (ใช้ rowId อ้างอิง)
      if (sortOrder === 'OLDEST') return a.rowId - b.rowId; // เก่าไปใหม่
      if (sortOrder === 'NAME_ASC') return a.productName.localeCompare(b.productName, 'th'); // ก-ฮ
      if (sortOrder === 'NAME_DESC') return b.productName.localeCompare(a.productName, 'th'); // ฮ-ก
      return 0;
    });
  }, [items, filterStatus, filterSupplier, searchTerm, sortOrder]);

  // ✅ 2. แบ่งหน้าแสดงผล (Pagination)
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedItems, currentPage, itemsPerPage]);

  // รีเซ็ตหน้าเมื่อมีการเปลี่ยนการกรอง
  useEffect(() => { setCurrentPage(1); }, [filterStatus, filterSupplier, searchTerm, itemsPerPage, sortOrder]);

 return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-412.5 mx-auto">
        
        {/* แผงควบคุม Filter & Sort */}
        <div className="bg-white p-6 rounded-4xl shadow-sm border border-slate-200 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter">📜 History</h1>
              <button onClick={fetchHistory} className="bg-slate-100 p-2 rounded-full hover:rotate-180 transition-all duration-500 shadow-inner">🔄</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:max-w-5xl">
              {/* ค้นหา */}
              <input 
                type="text" placeholder="ค้นหาชื่อสินค้า/กลุ่ม/Supplier..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
              />

              {/* เลือก Supplier */}
              <select 
                value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none cursor-pointer"
              >
                <option value="ALL">ทุก Supplier</option>
                {supplierList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* เรียงลำดับ */}
              <select 
                value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none cursor-pointer"
              >
                <option value="NEWEST">ล่าสุด → เก่าสุด</option>
                <option value="OLDEST">เก่าสุด → ล่าสุด</option>
                <option value="NAME_ASC">ชื่อสินค้า (ก-ฮ)</option>
                <option value="NAME_DESC">ชื่อสินค้า (ฮ-ก)</option>
              </select>

              {/* จำนวนต่อหน้า */}
              <div className="flex items-center bg-slate-50 border-2 border-slate-100 p-3 rounded-xl gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase">Show:</span>
                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-transparent font-black text-sm outline-none w-full">
                  <option value={20}>20 แถว</option>
                  <option value={50}>50 แถว</option>
                  <option value={100}>100 แถว</option>
                  <option value={500}>500 แถว</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        
        {/* แถบ Filter สถานะ */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {['ALL', 'PENDING', 'ORDERED', 'COMPLETED', 'REJECTED'].map(s => (
            <button
              key={s} onClick={() => setFilterStatus(s)}
              className={`px-6 py-2 rounded-full font-black text-[11px] tracking-widest transition-all ${
                filterStatus === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              {s}
            </button>
            
          ))}
        </div>

        {/* ตารางข้อมูล */}
        <div className="bg-white rounded-4xl shadow-xl border border-slate-100 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-20 text-center font-black text-slate-300 animate-pulse uppercase tracking-[0.3em]">กำลังดึงข้อมูลล่าสุด... 🚀</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] border-b">
                  <tr>
                    <th className="p-6 whitespace-nowrap">ข้อมูลบิล</th>
                    <th className="p-6 w-1/3">รายการสินค้า/Supplier</th>
                    <th className="p-6 text-center whitespace-nowrap">หมายเหตุ</th>
                    <th className="p-6 text-center whitespace-nowrap">จำนวนสั่ง</th>
                    <th className="p-6 text-center whitespace-nowrap">จำนวนรับ</th>
                    <th className="p-6 text-center whitespace-nowrap">ข้อมูลการรับ</th>
                    <th className="p-6 text-center">สถานะ</th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedItems.map((item, idx) => (
                      <tr key={`${item.rowId}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        {/* 1. ข้อมูลบิลและวันที่สั่ง */}
                        <td className="p-6 align-top">
                          <div className="font-black text-slate-900 mb-1">{item.createdAt}</div>
                          <div className="text-[10px] text-blue-600 font-black uppercase bg-blue-50 px-2 py-1 rounded-md inline-block">{item.groupId}</div>
                        </td>

                        {/* 2. รายการสินค้า */}
                        <td className="p-6 align-top">
                          <div className="font-bold text-slate-800 text-base mb-1">{item.productName}</div>
                          <div className="text-[11px] text-slate-400 font-bold italic">{item.supplier}</div>
                        </td>

                        {/* 3. หมายเหตุ (แสดงครบทุกแผนก) */}
                        <td className="p-6 align-top">
                          <div className="flex flex-col gap-2">
                            {item.noteRequest && item.noteRequest !== '-' && (
                              <div className="text-[10px] bg-amber-50 text-amber-700 p-2 rounded-lg border-l-2 border-amber-400 font-bold">
                                <span className="text-[9px] opacity-60 block uppercase">Sorting:</span>
                                {item.noteRequest}
                              </div>
                            )}
                            {item.notePurchase && item.notePurchase !== '-' && (
                              <div className="text-[10px] bg-blue-50 text-blue-700 p-2 rounded-lg border-l-2 border-blue-400 font-bold">
                                <span className="text-[9px] opacity-60 block uppercase">Purchasing:</span>
                                {item.notePurchase}
                              </div>
                            )}
                            {item.noteStock && item.noteStock !== '-' && (
                              <div className="text-[10px] bg-emerald-50 text-emerald-700 p-2 rounded-lg border-l-2 border-emerald-400 font-bold">
                                <span className="text-[9px] opacity-60 block uppercase">Stock:</span>
                                {item.noteStock}
                              </div>
                            )}
                            {(!item.noteRequest || item.noteRequest === '-') && 
                            (!item.notePurchase || item.notePurchase === '-') && 
                            (!item.noteStock || item.noteStock === '-') && (
                              <span className="text-slate-300 text-[10px] italic">- ไม่มีหมายเหตุ -</span>
                            )}
                          </div>
                        </td>

                        {/* 4. ช่องสั่งซื้อ (เน้นจำนวนสั่ง) */}
                        <td className="p-6 text-center bg-slate-50/50 align-top">
                          <div className="flex flex-col items-center">
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">
                              {item.orderCarton} <span className="text-[10px] text-slate-400 uppercase">{item.cartonUnit}</span>
                            </p>
                            <div className="w-12 h-0.5 bg-slate-200 my-1"></div>
                            <p className="text-[10px] font-bold text-slate-500">
                              บรรจุ {item.qtyPerCarton} {item.innerUnit}
                            </p>
                          </div>
                        </td>

                        {/* 5. ช่องจำนวนรับ (เน้นยอดรับจริง) */}
                        <td className="p-6 text-center bg-slate-50/50 align-top">
                          <div className="flex flex-col items-center">
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">
                              {item.recvCarton} <span className="text-[10px] text-slate-400 uppercase">{item.recvUnit}</span>
                            </p>
                            <div className="w-12 h-0.5 bg-slate-200 my-1"></div>
                            <p className="text-[10px] font-bold text-slate-500">
                              บรรจุ {item.recvQty} {item.recvQtyUnit}
                            </p>
                          </div>
                        </td>

                        {/* 6. ช่องข้อมูลการรับ (แยกออกมาให้ดูง่ายตามที่พี่ชายบอก) */}
                        <td className="p-6 align-top bg-slate-50/30">
                          <div className="space-y-2">
                            {/* ชื่อคนรับของ */}
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">ผู้รับของ</span>
                              <span className="text-xs font-black text-slate-700">{item.receiver || '-'}</span>
                            </div>
                            {/* วันที่รับของ (ถ้ามีแยกใน DB) หรือ เลขบิล */}
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">เลขที่บิล / INV</span>
                              <span className="text-[11px] font-bold text-blue-600">{item.recvDate !== '-' ? item.invoiceNo : 'ยังไม่ระบุ'}</span>
                            </div>
                          </div>
                        </td>

                        {/* 7. สถานะ */}
                        <td className="p-6 text-center align-top">
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm inline-block ${
                            item.status === 'COMPLETED' ? 'bg-emerald-500 text-white' :
                            item.status === 'ORDERED' ? 'bg-blue-600 text-white' : 
                            item.status === 'REJECTED' || item.status === 'REJECT' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-900'
                          }`}>
                            {item.status}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 pb-10">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              หน้า {currentPage} / {totalPages} (ทั้งหมด {filteredAndSortedItems.length} รายการ)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl font-black transition-all ${
                  currentPage === 1 ? 'bg-slate-100 text-slate-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white'
                }`}
              >←</button>
              
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${
                          currentPage === pageNum ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >{pageNum}</button>
                    );
                  }
                  if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <span key={pageNum} className="text-slate-300">...</span>;
                  return null;
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl font-black transition-all ${
                  currentPage === totalPages ? 'bg-slate-100 text-slate-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white'
                }`}
              >→</button>
            </div>
          </div>
           )}
          </div>
        </div>
  );
}