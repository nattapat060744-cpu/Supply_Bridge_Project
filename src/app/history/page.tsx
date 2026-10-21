'use client';
import {formatBusinessDate} from '@/lib/dates';
import { useState, useEffect, useRef, useCallback } from 'react';

interface HistoryItem {
  rowId: number;
  rowUid: string;
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

interface ArchiveSummary {
  eligibleCount: number;
  archivedCount: number;
  totalRows: number;
  cutoffDays: number;
  archiveSheets: Record<string, number>;
  candidates: Array<{
    rowNumber: number;
    archiveSheet: string;
    recvDate: string;
    productId: string;
    productName: string;
  }>;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [archiveDays, setArchiveDays] = useState(180);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSummary, setArchiveSummary] = useState<ArchiveSummary | null>(null);
  const [archiveMessage, setArchiveMessage] = useState('');

  const [total,setTotal]=useState(0);
  const [supplierList,setSupplierList]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [refreshVersion,setRefreshVersion]=useState(0);
  const suppliersLoaded=useRef(false);
  const fetchHistory=useCallback(()=>{suppliersLoaded.current=false;setRefreshVersion(n=>n+1);},[]);
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedSearch(searchTerm),250);return()=>clearTimeout(timer);},[searchTerm]);
  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      setLoading(true);setError('');
      const includeSuppliers=!suppliersLoaded.current;
      const params=new URLSearchParams({page:String(currentPage),pageSize:String(itemsPerPage),q:debouncedSearch,status:filterStatus,supplier:filterSupplier,sort:sortOrder,includeSuppliers:includeSuppliers?'1':'0'});
      try{
        const res=await fetch('/api/history?'+params,{cache:'no-store',signal:controller.signal});
        const data=await res.json();
        if(!res.ok||!Array.isArray(data.items))throw new Error(data.message||'โหลดประวัติไม่สำเร็จ');
        if(controller.signal.aborted)return;
        setItems(data.items);setTotal(data.total);
        if(includeSuppliers){setSupplierList(data.suppliers||[]);suppliersLoaded.current=true;}
        if(data.page!==currentPage)setCurrentPage(data.page);
      }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'โหลดประวัติไม่สำเร็จ');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    };
    void load();return()=>controller.abort();
  },[currentPage,itemsPerPage,debouncedSearch,filterStatus,filterSupplier,sortOrder,refreshVersion]);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      setIsAdmin(user?.department === 'ADMIN');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const previewArchive = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveMessage('');
    try {
      const res = await fetch(`/api/archive?days=${archiveDays}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setArchiveMessage(data.message || 'ตรวจสอบรายการสำหรับเก็บเข้าคลังไม่สำเร็จ');
        return;
      }
      setArchiveSummary(data);
      setArchiveMessage(`ตรวจพบ ${data.eligibleCount || 0} รายการที่พร้อมย้ายเข้าคลัง`);
    } catch (err) {
      console.error(err);
      setArchiveMessage('ตรวจสอบรายการสำหรับเก็บเข้าคลังไม่สำเร็จ');
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveDays]);

  const runArchive = useCallback(async () => {
    if (!archiveSummary || archiveSummary.eligibleCount === 0) return;
    const ok = confirm(`ยืนยันย้าย ${archiveSummary.eligibleCount} รายการที่จบแล้วและเก่ากว่า ${archiveDays} วันเข้าคลังใช่ไหม?\nระบบจะเก็บรายการไว้ในหมวดคลังรายปี และยังค้นหาได้จากหน้าประวัติ`);
    if (!ok) return;

    setArchiveLoading(true);
    setArchiveMessage('');
    try {
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'run', days: archiveDays }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setArchiveMessage(data.message || 'ย้ายรายการเข้าคลังไม่สำเร็จ');
        return;
      }
      setArchiveSummary(data);
      setArchiveMessage(`ย้ายเข้าคลังสำเร็จ ${data.archivedCount || 0} รายการ`);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setArchiveMessage('ย้ายรายการเข้าคลังไม่สำเร็จ');
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveDays, archiveSummary, fetchHistory]);

  const totalPages=Math.max(1,Math.ceil(total/itemsPerPage));
  const paginatedItems=items;
  const statusLabels:Record<string,string>={ALL:'ทั้งหมด',PENDING:'รอจัดซื้อ',ORDERED:'สั่งซื้อแล้ว',COMPLETED:'รับสินค้าแล้ว',REJECTED:'ยกเลิก'};

 return (
    <div className="app-shell font-sans text-slate-900">
      <div className="app-container">
        
        {/* แผงควบคุม Filter & Sort */}
        <div className="app-hero p-6 md:p-8 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="page-kicker">Audit Trail</p>
                <h1 className="page-title font-display">ประวัติรายการ</h1>
              </div>
              <button onClick={fetchHistory} className="primary-action bg-slate-950 text-white hover:bg-blue-700 shadow-lg shadow-slate-900/10">รีเฟรช</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:max-w-5xl">
              {/* ค้นหา */}
              <input 
                type="text" placeholder="ค้นหาชื่อสินค้า/กลุ่ม/Supplier..." value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="control-field p-3 rounded-xl font-bold text-sm"
              />

              {/* เลือก Supplier */}
              <select 
                aria-label="ผู้ขาย" value={filterSupplier} onChange={(e) => {
                  setFilterSupplier(e.target.value);
                  setCurrentPage(1);
                }}
                className="control-field p-3 rounded-xl font-bold text-sm cursor-pointer"
              >
                <option value="ALL">ทุก Supplier</option>
                {supplierList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* เรียงลำดับ */}
              <select 
                aria-label="เรียงลำดับ" value={sortOrder} onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                className="control-field p-3 rounded-xl font-bold text-sm cursor-pointer"
              >
                <option value="NEWEST">ล่าสุด → เก่าสุด</option>
                <option value="OLDEST">เก่าสุด → ล่าสุด</option>
                <option value="NAME_ASC">ชื่อสินค้า (ก-ฮ)</option>
                <option value="NAME_DESC">ชื่อสินค้า (ฮ-ก)</option>
              </select>

              {/* จำนวนต่อหน้า */}
              <div className="flex items-center control-field p-3 rounded-xl gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase">Show:</span>
                <select aria-label="จำนวนต่อหน้า" value={itemsPerPage} onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }} className="bg-transparent font-black text-sm outline-none w-full">
                  <option value={20}>20 แถว</option>
                  <option value={50}>50 แถว</option>
                  <option value={100}>100 แถว</option>
                  <option value={500}>500 แถว</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="app-card mb-8 p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="page-kicker text-slate-500">จัดการพื้นที่ข้อมูล</p>
                <h2 className="text-lg font-black text-slate-950">เก็บรายการที่จบแล้วเข้าคลัง</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  ตรวจสอบจำนวนก่อนย้าย รายการที่เก็บเข้าคลังแล้วยังค้นหาได้ในหน้าประวัติ
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="อายุรายการเก็บเข้าคลัง" value={archiveDays}
                  onChange={(e) => {setArchiveDays(Number(e.target.value));setArchiveSummary(null);setArchiveMessage('');}}
                  className="control-field rounded-xl p-3 text-sm font-bold"
                  disabled={archiveLoading}
                >
                  <option value={90}>เก่ากว่า 90 วัน</option>
                  <option value={180}>เก่ากว่า 180 วัน</option>
                  <option value={365}>เก่ากว่า 365 วัน</option>
                </select>
                <button
                  type="button"
                  onClick={previewArchive}
                  disabled={archiveLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  ตรวจสอบ
                </button>
                <button
                  type="button"
                  onClick={runArchive}
                  disabled={archiveLoading || !archiveSummary || archiveSummary.eligibleCount === 0}
                  className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  ย้ายเข้าคลัง
                </button>
              </div>
            </div>

            {(archiveMessage || archiveSummary) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                {archiveMessage && <p>{archiveMessage}</p>}
                {archiveSummary && (
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div>แถวทั้งหมด: {archiveSummary.totalRows}</div>
                    <div>พร้อมย้าย: {archiveSummary.eligibleCount}</div>
                    <div>ย้ายแล้ว: {archiveSummary.archivedCount || 0}</div>
                    {Object.entries(archiveSummary.archiveSheets || {}).map(([sheet, count]) => (
                      <div key={sheet} className="md:col-span-3 text-slate-500">
                        {sheet}: {count} รายการ
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        
        {/* แถบ Filter สถานะ */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {['ALL', 'PENDING', 'ORDERED', 'COMPLETED', 'REJECTED'].map(s => (
            <button
              key={s} onClick={() => {
                setFilterStatus(s);
                setCurrentPage(1);
              }}
              className={`px-6 py-2 rounded-full font-black text-[11px] tracking-widest transition-all ${
                filterStatus === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              {statusLabels[s]}
            </button>
            
          ))}
        </div>

        {error&&<div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button onClick={fetchHistory} className="underline">ลองอีกครั้ง</button></div>}
        {loading&&items.length>0&&<p role="status" className="mb-3 text-sm text-slate-500">กำลังโหลดรายการ...</p>}
        {/* ตารางข้อมูล */}
        <div className="app-card overflow-hidden mb-6">
          <div className="overflow-x-auto">
            {loading && items.length===0 ? (
              <div className="p-20 text-center font-black text-slate-300 animate-pulse uppercase tracking-[0.18em]">กำลังดึงข้อมูลล่าสุด...</div>
            ) : (
              <table aria-busy={loading} className="w-full min-w-[1100px] text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-[0.12em] border-b">
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
                    {paginatedItems.map((item) => (
                      <tr key={item.rowUid} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. ข้อมูลบิลและวันที่สั่ง */}
                        <td className="p-6 align-top">
                          <time dateTime={item.createdAt} className="block min-w-40 whitespace-nowrap font-bold text-slate-900 mb-2">{formatBusinessDate(item.createdAt)}</time>
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
                            <div><span className="block text-[9px] font-bold text-slate-400">วันที่รับสินค้า</span><time className="whitespace-nowrap text-xs">{formatBusinessDate(item.recvDate)}</time></div>
                            {/* ชื่อคนรับของ */}
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">ผู้รับของ</span>
                              <span className="text-xs font-black text-slate-700">{item.receiver || '-'}</span>
                            </div>
                            {/* วันที่รับของ (ถ้ามีแยกใน DB) หรือ เลขบิล */}
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">เลขที่บิล / INV</span>
                              <span className="text-[11px] font-bold text-blue-600">{item.invoiceNo && item.invoiceNo !== '-' ? item.invoiceNo : 'ยังไม่ระบุ'}</span>
                            </div>
                          </div>
                        </td>

                        {/* 7. สถานะ */}
                        <td className="p-6 text-center align-top">
                          <div className={`whitespace-nowrap px-3 py-1 rounded-md text-[10px] font-black shadow-sm inline-block ${
                            item.status === 'COMPLETED' ? 'bg-emerald-500 text-white' :
                            item.status === 'ORDERED' ? 'bg-blue-600 text-white' : 
                            item.status === 'REJECTED' || item.status === 'REJECT' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-900'
                          }`}>
                            {statusLabels[item.status]||item.status}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading&&items.length===0&&<tr><td colSpan={7} className="p-12 text-center text-slate-500">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>}
                  </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 pb-10">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              หน้า {currentPage} / {totalPages} (ทั้งหมด {total} รายการ)
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="หน้าก่อนหน้า" disabled={loading || currentPage === 1}
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
                aria-label="หน้าถัดไป" disabled={loading || currentPage === totalPages}
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
