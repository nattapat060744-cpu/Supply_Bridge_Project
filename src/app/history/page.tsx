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
  const [paging,setPaging]=useState(false);
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
      finally{if(!controller.signal.aborted){setLoading(false);setPaging(false);}}
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
  const statusStyle:Record<string,{pill:string;dot:string}>={
    COMPLETED:{pill:'bg-emerald-50 text-emerald-700 ring-emerald-200',dot:'bg-emerald-500'},
    ORDERED:{pill:'bg-blue-50 text-blue-700 ring-blue-200',dot:'bg-blue-500'},
    REJECTED:{pill:'bg-rose-50 text-rose-700 ring-rose-200',dot:'bg-rose-500'},
    REJECT:{pill:'bg-rose-50 text-rose-700 ring-rose-200',dot:'bg-rose-500'},
    PENDING:{pill:'bg-amber-50 text-amber-700 ring-amber-200',dot:'bg-amber-500'},
  };
  const hasNote=(v?:string|null)=>Boolean(v)&&v!=='-';
  const filtersActive=filterStatus!=='ALL'||filterSupplier!=='ALL'||searchTerm.trim()!=='';
  const clearFilters=()=>{setFilterStatus('ALL');setFilterSupplier('ALL');setSearchTerm('');setCurrentPage(1);};

  return (
    <div className="app-shell">
      {paging && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex cursor-wait items-center justify-center bg-white/70 backdrop-blur-[2px]" aria-busy="true">
          <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-800 shadow-xl">
            <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--tone)]" />
            กำลังโหลดหน้าที่ {currentPage}…
          </div>
        </div>
      )}

      <div className="app-container">
        {/* หัวหน้า */}
        <section className="app-hero mb-5 flex flex-col gap-5 p-6 pl-8 md:flex-row md:items-end md:justify-between md:p-8 md:pl-10">
          <div>
            <p className="page-kicker mb-3">Audit Trail</p>
            <h1 className="page-title font-display">ประวัติรายการ</h1>
            <p className="page-subtitle mt-2">ติดตามทุกรายการตั้งแต่สั่งซื้อจนรับสินค้า พร้อมหมายเหตุจากแต่ละแผนก</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="metric-tile px-5 py-3 text-center">
              <p className="text-2xl font-bold leading-none">{total.toLocaleString('th-TH')}</p>
              <p className="mt-1 text-xs font-medium">{filtersActive ? 'รายการที่ตรงกัน' : 'รายการทั้งหมด'}</p>
            </div>
            <button onClick={fetchHistory} disabled={loading} className="primary-action">
              <svg className={loading ? 'animate-spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" /></svg>
              รีเฟรช
            </button>
          </div>
        </section>

        {/* แถบค้นหาและตัวกรอง */}
        <section className="app-card mb-5 p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                type="search" aria-label="ค้นหา" placeholder="ค้นหาชื่อสินค้า, กลุ่ม หรือ Supplier" value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="control-field w-full py-3 pl-10 pr-4 text-sm"
              />
            </div>
            <select aria-label="ผู้ขาย" value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); setCurrentPage(1); }} className="control-field cursor-pointer px-3 py-3 text-sm">
              <option value="ALL">ทุก Supplier</option>
              {supplierList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="เรียงลำดับ" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }} className="control-field cursor-pointer px-3 py-3 text-sm">
              <option value="NEWEST">ใหม่สุดก่อน</option>
              <option value="OLDEST">เก่าสุดก่อน</option>
              <option value="NAME_ASC">ชื่อสินค้า ก-ฮ</option>
              <option value="NAME_DESC">ชื่อสินค้า ฮ-ก</option>
            </select>
            <select aria-label="จำนวนต่อหน้า" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="control-field cursor-pointer px-3 py-3 text-sm">
              <option value={20}>20 แถว</option>
              <option value={50}>50 แถว</option>
              <option value={100}>100 แถว</option>
              <option value={500}>500 แถว</option>
            </select>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 custom-scrollbar-h" role="group" aria-label="กรองตามสถานะ">
              {['ALL', 'PENDING', 'ORDERED', 'COMPLETED', 'REJECTED'].map((s) => {
                const on = filterStatus === s;
                return (
                  <button
                    key={s} aria-pressed={on}
                    onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      on ? 'border-transparent bg-[var(--tone-ink)] text-white shadow-sm' : 'border-[var(--line-strong)] bg-white text-[var(--muted)] hover:border-[var(--tone)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {s !== 'ALL' && <span className={`h-2 w-2 rounded-full ${statusStyle[s].dot}`} />}
                    {statusLabels[s]}
                  </button>
                );
              })}
            </div>
            {filtersActive && <button onClick={clearFilters} className="shrink-0 text-xs font-semibold text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]">ล้างตัวกรอง</button>}
          </div>
        </section>

        {/* จัดการพื้นที่ข้อมูล (ผู้ดูแลระบบ) */}
        {isAdmin && (
          <details className="app-card group mb-5 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:px-5">
              <div>
                <p className="font-semibold text-[var(--ink)]">เก็บรายการที่จบแล้วเข้าคลัง</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">ตรวจสอบจำนวนก่อนย้าย รายการที่เก็บแล้วยังค้นหาได้ในหน้านี้</p>
              </div>
              <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="border-t border-[var(--line)] p-4 md:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="อายุรายการเก็บเข้าคลัง" value={archiveDays} disabled={archiveLoading}
                  onChange={(e) => { setArchiveDays(Number(e.target.value)); setArchiveSummary(null); setArchiveMessage(''); }}
                  className="control-field px-3 py-2.5 text-sm"
                >
                  <option value={90}>เก่ากว่า 90 วัน</option>
                  <option value={180}>เก่ากว่า 180 วัน</option>
                  <option value={365}>เก่ากว่า 365 วัน</option>
                </select>
                <button type="button" onClick={previewArchive} disabled={archiveLoading} className="secondary-action">ตรวจสอบก่อน</button>
                <button type="button" onClick={runArchive} disabled={archiveLoading || !archiveSummary || archiveSummary.eligibleCount === 0} className="primary-action">ย้ายเข้าคลัง</button>
              </div>
              {(archiveMessage || archiveSummary) && (
                <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
                  {archiveMessage && <p className="font-semibold text-[var(--ink)]">{archiveMessage}</p>}
                  {archiveSummary && (
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <div><p className="text-xs">แถวทั้งหมด</p><p className="text-lg font-bold tabular-nums text-[var(--ink)]">{archiveSummary.totalRows}</p></div>
                      <div><p className="text-xs">พร้อมย้าย</p><p className="text-lg font-bold tabular-nums text-[var(--tone-ink)]">{archiveSummary.eligibleCount}</p></div>
                      <div><p className="text-xs">ย้ายแล้ว</p><p className="text-lg font-bold tabular-nums text-[var(--ink)]">{archiveSummary.archivedCount || 0}</p></div>
                      {Object.entries(archiveSummary.archiveSheets || {}).map(([sheet, count]) => (
                        <p key={sheet} className="text-xs sm:col-span-3">{sheet}: {count} รายการ</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        )}

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex-1">{error}</span>
            <button onClick={fetchHistory} className="font-semibold underline underline-offset-2">ลองอีกครั้ง</button>
          </div>
        )}

        {/* ตาราง */}
        <section className="app-card mb-6 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar-h">
            <table aria-busy={loading} className="w-full min-w-[1040px] border-collapse text-left">
              <thead className="bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="px-5 py-3.5">บิล / วันที่สั่ง</th>
                  <th className="w-[28%] px-5 py-3.5">สินค้า</th>
                  <th className="px-5 py-3.5 text-center">สั่ง</th>
                  <th className="px-5 py-3.5 text-center">รับจริง</th>
                  <th className="px-5 py-3.5">การรับสินค้า</th>
                  <th className="px-5 py-3.5">หมายเหตุ</th>
                  <th className="px-5 py-3.5 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {loading && items.length === 0 &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td className="px-5 py-5"><div className="skeleton mb-2 h-4 w-28" /><div className="skeleton h-5 w-20" /></td>
                      <td className="px-5 py-5"><div className="skeleton mb-2 h-4 w-48" /><div className="skeleton h-3 w-24" /></td>
                      <td className="px-5 py-5"><div className="skeleton mx-auto h-8 w-14" /></td>
                      <td className="px-5 py-5"><div className="skeleton mx-auto h-8 w-14" /></td>
                      <td className="px-5 py-5"><div className="skeleton h-4 w-28" /></td>
                      <td className="px-5 py-5"><div className="skeleton h-4 w-32" /></td>
                      <td className="px-5 py-5"><div className="skeleton mx-auto h-6 w-20 !rounded-full" /></td>
                    </tr>
                  ))}

                {paginatedItems.map((item) => {
                  const st = statusStyle[item.status] || statusStyle.PENDING;
                  const diff = Number(item.recvCarton || 0) - Number(item.orderCarton || 0);
                  const received = Number(item.recvCarton || 0) > 0;
                  const noteList = [
                    { k: 'ธุรการ', v: item.noteRequest, c: 'border-blue-400 bg-blue-50 text-blue-800' },
                    { k: 'จัดซื้อ', v: item.notePurchase, c: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
                    { k: 'สต็อก', v: item.noteStock, c: 'border-amber-400 bg-amber-50 text-amber-800' },
                  ].filter((n) => hasNote(n.v));
                  return (
                    <tr key={item.rowUid} className="transition-colors hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-4 align-top">
                        <time dateTime={item.createdAt} className="block whitespace-nowrap text-sm font-semibold text-[var(--ink)]">{formatBusinessDate(item.createdAt)}</time>
                        <span className="mt-1.5 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{item.groupId}</span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold leading-snug text-[var(--ink)]">{item.productName}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{item.supplier}</p>
                      </td>
                      <td className="px-5 py-4 text-center align-top">
                        <p className="text-xl font-bold tabular-nums text-[var(--ink)]">{item.orderCarton} <span className="text-xs font-medium text-slate-400">{item.cartonUnit}</span></p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">บรรจุ {item.qtyPerCarton} {item.innerUnit}</p>
                      </td>
                      <td className="px-5 py-4 text-center align-top">
                        {received ? (
                          <>
                            <p className="text-xl font-bold tabular-nums text-[var(--ink)]">{item.recvCarton} <span className="text-xs font-medium text-slate-400">{item.recvUnit}</span></p>
                            <p className="mt-0.5 text-[11px] text-[var(--muted)]">บรรจุ {item.recvQty} {item.recvQtyUnit}</p>
                            {diff !== 0 && (
                              <span className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${diff < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {diff < 0 ? 'ขาด' : 'เกิน'} {Math.abs(diff)}
                              </span>
                            )}
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 align-top text-xs">
                        <dl className="space-y-1.5">
                          <div><dt className="text-[11px] text-slate-400">วันที่รับ</dt><dd className="whitespace-nowrap text-[var(--ink)]">{item.recvDate ? formatBusinessDate(item.recvDate) : '-'}</dd></div>
                          <div><dt className="text-[11px] text-slate-400">ผู้รับ</dt><dd className="font-medium text-[var(--ink)]">{item.receiver || '-'}</dd></div>
                          <div><dt className="text-[11px] text-slate-400">เลขบิล / INV</dt><dd className={hasNote(item.invoiceNo) ? 'font-semibold text-[var(--tone-ink)]' : 'text-slate-400'}>{hasNote(item.invoiceNo) ? item.invoiceNo : 'ยังไม่ระบุ'}</dd></div>
                        </dl>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {noteList.length === 0 ? (
                          <span className="text-xs text-slate-300">ไม่มีหมายเหตุ</span>
                        ) : (
                          <div className="flex max-w-[220px] flex-col gap-1.5">
                            {noteList.map((n) => (
                              <p key={n.k} className={`rounded-md border-l-[3px] px-2.5 py-1.5 text-xs leading-5 ${n.c}`}>
                                <span className="mr-1 font-semibold">{n.k}:</span>{n.v}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center align-top">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${st.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="font-semibold text-[var(--ink)]">ไม่พบรายการที่ตรงกับตัวกรอง</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนคำค้นหาหรือสถานะ</p>
                      {filtersActive && <button onClick={clearFilters} className="secondary-action mt-4">ล้างตัวกรองทั้งหมด</button>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* เปลี่ยนหน้า */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 pb-6 md:flex-row">
            <p className="text-sm text-[var(--muted)]">หน้า {currentPage} จาก {totalPages} · ทั้งหมด {total.toLocaleString('th-TH')} รายการ</p>
            <div className="flex items-center gap-2">
              <button
                aria-label="หน้าก่อนหน้า" disabled={paging || loading || currentPage === 1}
                onClick={() => { setPaging(true); setCurrentPage((prev) => prev - 1); }}
                className="secondary-action h-10 w-10 !p-0"
              >←</button>
              <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    const on = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum} disabled={paging || loading || on} aria-current={on ? 'page' : undefined}
                        onClick={() => { setPaging(true); setCurrentPage(pageNum); }}
                        className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${on ? 'bg-[var(--tone-ink)] text-white' : 'text-[var(--muted)] hover:bg-slate-100'}`}
                      >{pageNum}</button>
                    );
                  }
                  if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <span key={pageNum} className="px-1 text-slate-300">…</span>;
                  return null;
                })}
              </div>
              <button
                aria-label="หน้าถัดไป" disabled={paging || loading || currentPage === totalPages}
                onClick={() => { setPaging(true); setCurrentPage((prev) => prev + 1); }}
                className="secondary-action h-10 w-10 !p-0"
              >→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}