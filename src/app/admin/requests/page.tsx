'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

type Member = { id: string; username: string; name: string; department: string };

const labels: Record<string, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  SORTING: 'ธุรการคลัง',
  PURCHASE: 'จัดซื้อ',
  STOCK: 'สต็อก',
  SORTING_VIEWER: 'ธุรการคลัง (ดูอย่างเดียว)',
  STOCK_SORTING_MANAGER: 'หัวหน้าสต็อกและธุรการคลัง',
};

// สีป้ายแผนก — สอดคล้องกับสีประจำแผนกทั้งระบบ
const badge: Record<string, string> = {
  ADMIN: 'bg-slate-900 text-white border-slate-900',
  SORTING: 'bg-blue-50 text-blue-700 border-blue-100',
  SORTING_VIEWER: 'bg-blue-50 text-blue-700 border-blue-100',
  PURCHASE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  STOCK: 'bg-amber-50 text-amber-700 border-amber-100',
  STOCK_SORTING_MANAGER: 'bg-amber-50 text-amber-700 border-amber-100',
};

const avatar: Record<string, string> = {
  ADMIN: 'bg-slate-900 text-white',
  SORTING: 'bg-blue-100 text-blue-700',
  SORTING_VIEWER: 'bg-blue-100 text-blue-700',
  PURCHASE: 'bg-emerald-100 text-emerald-700',
  STOCK: 'bg-amber-100 text-amber-700',
  STOCK_SORTING_MANAGER: 'bg-amber-100 text-amber-700',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/register?view=members', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(r.status === 403 ? 'หน้านี้สำหรับผู้ดูแลระบบ' : data.message || 'โหลดสมาชิกไม่สำเร็จ');
      }
      setMembers(data.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach((m) => { map[m.department] = (map[m.department] || 0) + 1; });
    return map;
  }, [members]);

  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => {
    if (dept !== 'ALL' && m.department !== dept) return false;
    if (!q) return true;
    return [m.username, m.name, labels[m.department] || m.department].some((v) => v?.toLowerCase().includes(q));
  });
  const filtering = Boolean(q) || dept !== 'ALL';
  const chips = [['ALL', 'ทั้งหมด', members.length] as const, ...Object.keys(counts).map((k) => [k, labels[k] || k, counts[k]] as const)];

  return (
    <div className="app-shell">
      <div className="app-container">
        <section className="app-hero mb-6 flex flex-col gap-5 p-6 pl-8 md:flex-row md:items-end md:justify-between md:p-8 md:pl-10">
          <div>
            <p className="page-kicker mb-3">Members</p>
            <h1 className="page-title font-display">สมาชิกในระบบ</h1>
            <p className="page-subtitle mt-2">สมัครสมาชิกแล้วใช้งานได้ทันที ไม่ต้องรออนุมัติ</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="metric-tile px-5 py-3 text-center">
              <p className="text-2xl font-bold leading-none">{members.length}</p>
              <p className="mt-1 text-xs font-medium">บัญชีทั้งหมด</p>
            </div>
            <button onClick={load} disabled={loading} className="primary-action">
              <svg className={loading ? 'animate-spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" />
              </svg>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </button>
          </div>
        </section>

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex-1">{error}</span>
            <button onClick={load} className="font-semibold underline underline-offset-2">ลองอีกครั้ง</button>
          </p>
        )}

        <section className="app-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="font-semibold text-[var(--ink)]">
                {filtering ? `พบ ${shown.length} จาก ${members.length} บัญชี` : `สมาชิกทั้งหมด ${members.length} บัญชี`}
              </p>
              <div className="relative w-full md:w-72">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาชื่อ, username หรือแผนก"
                  aria-label="ค้นหาสมาชิก"
                  className="control-field w-full py-2.5 pl-10 pr-4 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar-h" role="group" aria-label="กรองตามแผนก">
              {chips.map(([key, label, n]) => {
                const on = dept === key;
                return (
                  <button
                    key={key}
                    onClick={() => setDept(key)}
                    aria-pressed={on}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      on
                        ? 'border-transparent bg-[var(--tone-ink)] text-white shadow-sm'
                        : 'border-[var(--line-strong)] bg-white text-[var(--muted)] hover:border-[var(--tone)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {label} <span className={on ? 'text-white/80' : 'text-slate-400'}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)]">
                <tr>
                  {['ชื่อ', 'ชื่อผู้ใช้', 'แผนก', 'สถานะ'].map((t) => (
                    <th key={t} className="px-5 py-3">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-sm">
                {loading && members.length === 0 &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="skeleton h-9 w-9 !rounded-full" /><div className="skeleton h-4 w-32" /></div></td>
                      <td className="px-5 py-4"><div className="skeleton h-4 w-24" /></td>
                      <td className="px-5 py-4"><div className="skeleton h-6 w-28 !rounded-full" /></td>
                      <td className="px-5 py-4"><div className="skeleton h-4 w-20" /></td>
                    </tr>
                  ))}

                {shown.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatar[m.department] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {(m.name || m.username || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold text-[var(--ink)]">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">{m.username}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${badge[m.department] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {labels[m.department] || m.department}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="badge-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        พร้อมใช้งาน
                      </span>
                    </td>
                  </tr>
                ))}

                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-14 text-center">
                      <p className="font-semibold text-[var(--ink)]">{filtering ? 'ไม่พบสมาชิกที่ตรงกัน' : 'ยังไม่มีสมาชิก'}</p>
                      {filtering && (
                        <button onClick={() => { setQuery(''); setDept('ALL'); }} className="secondary-action mt-3">
                          ล้างตัวกรอง
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}