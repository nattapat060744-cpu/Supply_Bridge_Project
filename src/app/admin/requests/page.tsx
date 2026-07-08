'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type RegisterRequest = {
  id: string;
  username: string;
  name: string;
  department: string;
  status: string;
  createdAt: string;
  reviewedAt: string;
  reviewedBy: string;
  rowNumber: number;
};

const departments = [
  { value: 'SORTING', label: 'ธุรการคลัง' },
  { value: 'PURCHASE', label: 'จัดซื้อ' },
  { value: 'STOCK', label: 'สต็อก' },
  { value: 'SORTING_VIEWER', label: 'ธุรการคลัง(ดูอย่างเดียว)' },
  { value: 'STOCK_SORTING_MANAGER', label: 'หัวหน้าสต็อก+ธุรการคลัง' },
];

function statusStyle(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-rose-100';
  return 'bg-amber-50 text-amber-700 ring-amber-100';
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RegisterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [departmentOverrides, setDepartmentOverrides] = useState<Record<string, string>>({});

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === 'PENDING').length,
    [requests]
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/register', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage(data.message || 'โหลดคำขอสมัครไม่สำเร็จ');
        setRequests([]);
        return;
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      console.error(err);
      setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) {
        router.push('/');
        return;
      }

      const user = JSON.parse(savedUser);
      if (user?.department !== 'ADMIN') {
        router.push('/');
        return;
      }

      fetchRequests();
    } catch {
      router.push('/');
    }
  }, [fetchRequests, router]);

  const updateRequest = async (id: string, action: 'approve' | 'reject') => {
    const actionText = action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!confirm(`ยืนยัน${actionText}คำขอนี้ใช่ไหม?`)) return;

    setActionLoading(`${action}:${id}`);
    setMessage('');

    try {
      const res = await fetch('/api/register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          department: departmentOverrides[id],
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage(data.message || `${actionText}ไม่สำเร็จ`);
        return;
      }

      setMessage(data.message || `${actionText}เรียบร้อย`);
      await fetchRequests();
    } catch (err) {
      console.error(err);
      setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="app-shell pb-16">
      <div className="app-container py-8">
        <section className="app-hero mb-6 flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="page-kicker text-slate-500">Access Control</span>
            <h1 className="page-title font-display text-slate-950">อนุมัติสมาชิก</h1>
            <p className="page-subtitle mt-3">
              ตรวจสอบคำขอสมัครเข้าใช้งาน ก่อนเพิ่มผู้ใช้ลงใน Google Sheet Users
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="primary-action bg-slate-950 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            รีเฟรช
          </button>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="metric-tile p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">รออนุมัติ</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{pendingCount}</p>
          </div>
          <div className="metric-tile p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">คำขอทั้งหมด</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{requests.length}</p>
          </div>
          <div className="metric-tile p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ปลายทาง</p>
            <p className="mt-3 text-sm font-black text-slate-700">Users Sheet</p>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="app-card overflow-hidden bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">รายการคำขอสมัคร</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm font-bold text-slate-400">ยังไม่มีคำขอสมัคร</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((item) => {
                const isPending = item.status === 'PENDING';
                const approveLoading = actionLoading === `approve:${item.id}`;
                const rejectLoading = actionLoading === `reject:${item.id}`;

                return (
                  <article key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-slate-950">{item.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${statusStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">username: {item.username}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">ส่งคำขอ: {item.createdAt || '-'}</p>
                      {item.reviewedAt && (
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          จัดการแล้ว: {item.reviewedAt} โดย {item.reviewedBy || '-'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        แผนกที่จะอนุมัติ
                      </label>
                      <select
                        value={departmentOverrides[item.id] || item.department}
                        disabled={!isPending}
                        onChange={(e) =>
                          setDepartmentOverrides((current) => ({ ...current, [item.id]: e.target.value }))
                        }
                        className="control-field w-full rounded-xl p-3 text-sm font-bold disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {departments.map((dept) => (
                          <option key={dept.value} value={dept.value}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                      <button
                        onClick={() => updateRequest(item.id, 'approve')}
                        disabled={!isPending || !!actionLoading}
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200"
                      >
                        {approveLoading ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                      </button>
                      <button
                        onClick={() => updateRequest(item.id, 'reject')}
                        disabled={!isPending || !!actionLoading}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-black text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                      >
                        {rejectLoading ? 'กำลังปฏิเสธ...' : 'ปฏิเสธ'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
