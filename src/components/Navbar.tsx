'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface User {
  name: string;
  department: string;
  email?: string;
}

interface SortingNotificationItem {
  id: string;
  batchId: string;
  batchName: string;
  message?: string;
}

interface SortingNotificationState {
  count: number;
  latestBatchId?: string;
  latestBatchName?: string;
  latestMessage?: string;
  updatedAt?: number;
  items?: SortingNotificationItem[];
}

const navItems = [
  { href: '/sorting', label: 'ธุรการคลัง', dept: 'SORTING' },
  { href: '/purchase', label: 'จัดซื้อ', dept: 'PURCHASE' },
  { href: '/stock', label: 'สต็อก', dept: 'STOCK' },
  { href: '/history', label: 'ประวัติ', dept: 'ALL' },
  { href: '/admin/requests', label: 'สมัครสมาชิก', dept: 'ADMIN' },
];

const pageMeta: Record<string, { eyebrow: string; title: string; tone: string }> = {
  '/sorting': { eyebrow: 'Operations', title: 'ฝ่ายธุรการคลัง', tone: 'blue' },
  '/purchase': { eyebrow: 'Procurement', title: 'ฝ่ายจัดซื้อ', tone: 'emerald' },
  '/stock': { eyebrow: 'Inventory', title: 'ฝ่ายสต็อก', tone: 'amber' },
  '/history': { eyebrow: 'Audit Trail', title: 'ประวัติรายการ', tone: 'slate' },
  '/admin/requests': { eyebrow: 'Admin', title: 'อนุมัติสมาชิก', tone: 'slate' },
};

const departmentStyles: Record<string, string> = {
  SORTING: 'bg-blue-50 text-blue-700 ring-blue-100',
  SORTING_VIEWER: 'bg-sky-50 text-sky-700 ring-sky-100',
  STOCK_SORTING_MANAGER: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  PURCHASE: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  STOCK: 'bg-amber-50 text-amber-700 ring-amber-100',
  ADMIN: 'bg-slate-900 text-white ring-slate-200',
};

const toneTextStyles: Record<string, string> = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  slate: 'text-slate-500',
};

function canAccess(user: User | null, dept: string) {
  if (!user) return true;
  if (user.department === 'SORTING_VIEWER') return dept === 'SORTING';
  if (user.department === 'STOCK_SORTING_MANAGER') return dept === 'SORTING' || dept === 'STOCK' || dept === 'ALL';
  if (dept === 'ALL') return true;
  return user.department === 'ADMIN' || user.department === dept;
}

function readSortingNotification(): SortingNotificationState {
  try {
    const raw = localStorage.getItem('sorting_nav_notifications');
    if (!raw) return { count: 0 };

    const parsed = JSON.parse(raw) as SortingNotificationState;
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > oneDayMs) {
      localStorage.removeItem('sorting_nav_notifications');
      return { count: 0 };
    }

    return parsed;
  } catch {
    return { count: 0 };
  }
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSortingNotiMenu, setShowSortingNotiMenu] = useState(false);
  const [sortingNoti, setSortingNoti] = useState<SortingNotificationState>({ count: 0 });

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('user');
    localStorage.removeItem('loginDate');
    setUser(null);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    const savedUserStr = localStorage.getItem('user');
    if (savedUserStr && savedUserStr !== 'undefined') {
      setUser(JSON.parse(savedUserStr));
    }

    const checkMidnightLogout = () => {
      const today = new Date().toLocaleDateString('th-TH');
      const lastLoginDate = localStorage.getItem('loginDate');
      const currentUser = localStorage.getItem('user');

      if (currentUser && lastLoginDate && lastLoginDate !== today) {
        alert('เซสชันหมดอายุแล้วครับ');
        handleLogout();
      }
    };

    checkMidnightLogout();
    const interval = setInterval(checkMidnightLogout, 60000);
    return () => clearInterval(interval);
  }, [pathname, handleLogout]);

  useEffect(() => {
    setSortingNoti(readSortingNotification());

    const handleSortingNotification = (event: Event) => {
      const customEvent = event as CustomEvent<SortingNotificationState>;
      setSortingNoti(customEvent.detail || readSortingNotification());
    };
    const handleStorage = () => setSortingNoti(readSortingNotification());

    window.addEventListener('sorting-notifications-changed', handleSortingNotification);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sorting-notifications-changed', handleSortingNotification);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (pathname === '/') return null;

  const meta = pageMeta[pathname] || { eyebrow: 'Supply Bridge', title: 'Dashboard', tone: 'slate' };
  const userInitial = user?.name?.trim()?.[0]?.toUpperCase() || 'U';
  const deptStyle = departmentStyles[user?.department || ''] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const homeHref =
    user?.department === 'SORTING_VIEWER' || user?.department === 'STOCK_SORTING_MANAGER'
      ? '/sorting'
      : '/history';
  const canSeeSortingNoti =
    user?.department === 'ADMIN' ||
    user?.department === 'SORTING' ||
    user?.department === 'SORTING_VIEWER' ||
    user?.department === 'STOCK_SORTING_MANAGER';
  const hasSortingNoti = canSeeSortingNoti && sortingNoti.count > 0;

  const openSortingNoti = (batchId?: string) => {
    setShowSortingNotiMenu(false);

    if (pathname !== '/sorting') {
      if (batchId) localStorage.setItem('pending_sorting_notification_batch', batchId);
      router.push('/sorting');
      return;
    }

    window.dispatchEvent(new CustomEvent('sorting-notification-open', { detail: { batchId } }));
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push(homeHref)}
          className="group flex shrink-0 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
          aria-label="กลับไปหน้าหลัก"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">
            SP
          </div>
          <div className="hidden text-left sm:block">
            <p className="font-display text-sm font-bold leading-none text-slate-950">Supply Bridge</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Sampeng System</p>
          </div>
        </button>

        <div className="hidden h-8 w-px bg-slate-200 md:block" />

        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-black uppercase tracking-[0.24em] ${toneTextStyles[meta.tone] || toneTextStyles.slate}`}>
            {meta.eyebrow}
          </p>
          <p className="truncate font-display text-base font-bold text-slate-950">{meta.title}</p>
        </div>

        <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 lg:flex">
          {navItems.filter((item) => canAccess(user, item.dept)).map((item) => {
            const active = pathname === item.href;
            const showBadge = item.href === '/sorting' && hasSortingNoti;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`relative rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                {item.label}
                {showBadge && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                    {sortingNoti.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {hasSortingNoti && (
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setShowSortingNotiMenu((current) => !current)}
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-base shadow-sm transition-colors hover:bg-blue-100"
              title="Noti ธุรการคลัง"
              aria-label="เปิดรายการแจ้งเตือนธุรการคลัง"
            >
              🔔
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                {sortingNoti.count}
              </span>
            </button>

            {showSortingNotiMenu && (
              <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Noti ธุรการคลัง</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{sortingNoti.count} อัปเดตใหม่</p>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {(sortingNoti.items?.length ? sortingNoti.items : [{
                    id: sortingNoti.latestBatchId || 'latest',
                    batchId: sortingNoti.latestBatchId || '',
                    batchName: sortingNoti.latestBatchName || 'มีอัปเดตใหม่',
                    message: sortingNoti.latestMessage,
                  }]).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openSortingNoti(item.batchId)}
                      className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-blue-50"
                    >
                      <p className="truncate text-sm font-black text-slate-900">{item.batchName}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.message || 'มีการแก้ไขข้อมูลในบิลนี้'}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowUserMenu((current) => !current)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors hover:bg-slate-50"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
              {userInitial}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-32 truncate text-sm font-bold leading-none text-slate-950">{user?.name || 'User'}</p>
              <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ring-1 ${deptStyle}`}>
                {user?.department || 'USER'}
              </p>
            </div>
            <span className={`text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}>⌄</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <div className="border-b border-slate-100 bg-slate-50 p-5">
                <p className="font-display text-base font-bold text-slate-950">{user?.name || 'User'}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{user?.email || 'ภายในระบบสำเพ็ง'}</p>
                <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ring-1 ${deptStyle}`}>
                  {user?.department || 'USER'}
                </p>
              </div>

              <div className="grid gap-1 p-2 lg:hidden">
                {navItems.filter((item) => canAccess(user, item.dept)).map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push(item.href);
                    }}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <span>{item.label}</span>
                    {item.href === '/sorting' && hasSortingNoti && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">
                        {sortingNoti.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {hasSortingNoti && (
                <div className="border-t border-slate-100 p-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      openSortingNoti(sortingNoti.items?.[0]?.batchId || sortingNoti.latestBatchId);
                    }}
                    className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-black text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Noti ธุรการคลัง: {sortingNoti.count} อัปเดต
                  </button>
                </div>
              )}

              <div className="border-t border-slate-100 p-2">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-black text-rose-600 transition-colors hover:bg-rose-50"
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
