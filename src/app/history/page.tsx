'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all'); 
  const [expandedNotes, setExpandedNotes] = useState<{ [key: string]: boolean }>({});

  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  useEffect(() => {
    const checkAuthAndFetch = async () => {
    if (typeof window === 'undefined') return;

    const savedUserStr = localStorage.getItem('user');
    const lastLoginDate = localStorage.getItem('loginDate');
    const today = new Date().toLocaleDateString('th-TH');

    if (!savedUserStr || savedUserStr === "undefined" || lastLoginDate !== today) {
      router.push('/');
      return;
    }
    await fetchHistory();
  };

  checkAuthAndFetch();
}, [router]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('ดึงประวัติไม่สำเร็จครับพี่ชาย');
    } finally {
      setLoading(false);
    }
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCleanMonthYear = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('/')) return 'อื่นๆ';
    const cleanStr = dateStr.replace(/,/g, '').trim();
    const parts = cleanStr.split('/');
    if (parts.length >= 3) {
      const monthIndex = parseInt(parts[1]) - 1;
      const year = parts[2].split(' ')[0];
      const monthName = monthNames[monthIndex] || parts[1];
      return `${monthName} ${year}`;
    }
    return 'อื่นๆ';
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    items.forEach(item => {
      const monthYear = getCleanMonthYear(item.date);
      if (monthYear !== 'อื่นๆ') months.add(monthYear);
    });
    return Array.from(months);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.groupId?.toLowerCase().includes(searchTerm.toLowerCase());
      const itemMonth = getCleanMonthYear(item.date);
      const matchesMonth = selectedMonth === 'all' || itemMonth === selectedMonth;
      return matchesSearch && matchesMonth;
    });
  }, [items, searchTerm, selectedMonth]);

  const groupedData = useMemo(() => {
    const groups: { [month: string]: { [groupId: string]: any[] } } = {};
    filteredItems.forEach(item => {
      const monthYear = getCleanMonthYear(item.date);
      const gId = item.groupId || 'ไม่มีชื่อบิล';
      if (!groups[monthYear]) groups[monthYear] = {};
      if (!groups[monthYear][gId]) groups[monthYear][gId] = [];
      groups[monthYear][gId].push(item);
    });
    return groups;
  }, [filteredItems]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black italic text-slate-400 animate-pulse uppercase tracking-[0.3em]">
      Loading History Data...
    </div>
  );

  return (
    <div className="max-w-400 mx-auto p-4 md:p-10 bg-slate-50 min-h-screen">
      <div className="mb-10 bg-white p-8 md:p-12 rounded-[40px] shadow-sm border-b-8 border-emerald-600 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-3 block italic">Internal Purchasing Logs</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none">
            ประวัติ <span className="text-emerald-600 not-italic">การรับของ</span>
          </h1>
        </div>
        <button onClick={fetchHistory} className="bg-emerald-600 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase hover:bg-slate-900 transition-all shadow-lg active:scale-95">
          Refresh Data
        </button>
      </div>

      <div className="mb-10 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-40">🔍</span>
          <input 
            type="text"
            placeholder="ค้นหาบิล, ชื่อสินค้า หรือ รหัส..."
            className="w-full bg-white border-2 border-slate-100 p-6 pl-16 rounded-3xl font-bold outline-none focus:border-emerald-500 shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="md:w-72 relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-40">📅</span>
          <select 
            className="w-full bg-white border-2 border-slate-100 p-6 pl-16 rounded-3xl font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">แสดงทุกเดือน</option>
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {Object.keys(groupedData).length > 0 ? (
        Object.keys(groupedData).map((month) => (
          <div key={month} className="mb-20">
            <h2 className="text-3xl font-black text-slate-800 uppercase italic mb-8 border-l-8 border-slate-800 pl-6">{month}</h2>
            <div className="space-y-10">
              {Object.keys(groupedData[month]).map((batchId) => (
                <div key={batchId} className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic">BILL GROUP</span>
                        <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tighter">{batchId}</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-287.5 table-fixed">
                      <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest italic border-b border-slate-100">
                        <tr>
                          <th className="p-6 w-40">วันที่บันทึก</th>
                          <th className="p-6 w-75">รายการสินค้า</th>
                          <th className="p-6 w-32.5">ยอดสั่งซื้อ</th>
                          <th className="p-6 w-32.5 bg-emerald-50/50">ยอดรับจริง</th>
                          <th className="p-6 w-55">หมายเหตุ</th>
                          <th className="p-6 w-45">วันรับของ / ผู้รับ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {groupedData[month][batchId].map((item, idx) => {
                          const hasMismatch = Number(item.orderCarton) !== Number(item.recvCarton) || Number(item.qtyPerCarton) !== Number(item.recvQty);
                          const rowKey = `${month}-${batchId}-${idx}`;
                          return (
                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${hasMismatch ? 'border-l-8 border-red-500' : 'border-l-8 border-emerald-500'}`}>
                              <td className="p-6 text-[11px] font-bold text-slate-500">{item.date?.replace(/,/g, '') || '-'}</td>
                              <td className="p-6">
                                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{item.productID}</p>
                                <p className="font-black text-slate-800 uppercase text-sm truncate">{item.productName}</p>
                              </td>
                              <td className="p-6">
                                <div className="space-y-1">
                                  <p className="text-xs font-black text-slate-600">{item.orderCarton} {item.cartonUnit}</p>
                                  <p className="text-[10px] font-bold text-slate-400 italic">บ: {item.qtyPerCarton} {item.innerUnit}</p>
                                </div>
                              </td>
                              <td className="p-6 bg-emerald-50/20">
                                <div className="space-y-1">
                                  <p className={`text-xs font-black ${Number(item.orderCarton) !== Number(item.recvCarton) ? "text-red-600" : "text-emerald-600"}`}>
                                    {item.recvCarton || 0} {item.cartonUnit}
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-500 italic">บ: {item.recvQty || 0} {item.innerUnit}</p>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1.5 cursor-pointer" onClick={() => toggleNote(rowKey)}>
                                  {item.note && <p className={`text-[10px] font-bold text-amber-600 italic leading-tight ${expandedNotes[rowKey] ? '' : 'truncate'}`}>🛒 {item.note}</p>}
                                  {item.noteStock && <p className={`text-[10px] font-bold text-blue-600 italic leading-tight ${expandedNotes[rowKey] ? '' : 'truncate'}`}>📦 {item.noteStock}</p>}
                                  {!item.note && !item.noteStock && <span className="text-slate-200">-</span>}
                                </div>
                              </td>
                              <td className="p-6">
                                <p className="font-black text-[13px] text-slate-900 leading-none">{item.recvDate || '-'}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">โดย: {item.receiver || '-'}</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white p-20 rounded-[40px] text-center shadow-sm">
           <p className="text-slate-400 font-black uppercase italic tracking-widest text-xl">ไม่พบข้อมูลครับพี่ชาย ❌</p>
        </div>
      )}
    </div>
  );
}