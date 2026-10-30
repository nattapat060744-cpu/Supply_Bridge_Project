'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSortingNotifications } from '@/lib/use-sorting-notifications';
import { acknowledgeAllSortingNotifications, pendingNotificationKey } from '@/lib/sorting-notifications';

interface User {
  username?: string;
  name: string;
  department: string;
  email?: string;
}

const navItems = [
  { href: '/sorting', label: 'ธุรการคลัง', dept: 'SORTING' },
  { href: '/purchase', label: 'จัดซื้อ', dept: 'PURCHASE' },
  { href: '/stock', label: 'สต็อก', dept: 'STOCK' },
  { href: '/history', label: 'ประวัติ', dept: 'ALL' },
  { href: '/admin/requests', label: 'สมาชิก', dept: 'ADMIN' },
];

// tone ใช้เป็น data-tone บน <html> เพื่อให้ทั้งหน้าเปลี่ยนสีตามแผนก (ดู globals.css)
const pageMeta: Record<string, { eyebrow: string; title: string; tone: string }> = {
  '/sorting': { eyebrow: 'Operations', title: 'ฝ่ายธุรการคลัง', tone: 'blue' },
  '/purchase': { eyebrow: 'Procurement', title: 'ฝ่ายจัดซื้อ', tone: 'emerald' },
  '/stock': { eyebrow: 'Inventory', title: 'ฝ่ายสต็อก', tone: 'amber' },
  '/history': { eyebrow: 'Audit Trail', title: 'ประวัติรายการ', tone: 'slate' },
  '/admin/requests': { eyebrow: 'Admin', title: 'สมาชิกในระบบ', tone: 'slate' },
};

const deptLabel: Record<string, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  SORTING: 'ธุรการคลัง',
  PURCHASE: 'จัดซื้อ',
  STOCK: 'สต็อก',
  SORTING_VIEWER: 'ธุรการคลัง (ดูอย่างเดียว)',
  STOCK_SORTING_MANAGER: 'หัวหน้าสต็อกและธุรการคลัง',
};

const departmentStyles: Record<string, string> = {
  SORTING: 'bg-blue-50 text-blue-700 ring-blue-100',
  SORTING_VIEWER: 'bg-sky-50 text-sky-700 ring-sky-100',
  STOCK_SORTING_MANAGER: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  PURCHASE: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  STOCK: 'bg-amber-50 text-amber-700 ring-amber-100',
  ADMIN: 'bg-slate-900 text-white ring-slate-200',
};

const SORTING_DEPTS = ['ADMIN', 'SORTING', 'SORTING_VIEWER', 'STOCK_SORTING_MANAGER'];

function canAccess(user: User | null, dept: string) {
  if (!user) return true;
  if (user.department === 'SORTING_VIEWER') return dept === 'SORTING';
  if (user.department === 'STOCK_SORTING_MANAGER') return dept === 'SORTING' || dept === 'STOCK' || dept === 'ALL';
  if (dept === 'ALL') return true;
  return user.department === 'ADMIN' || user.department === dept;
}

function NavIcon({ href }: { href: string }) {
  const p = {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (href === '/sorting')
    return (
      <svg {...p}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M8.5 11h7M8.5 14.5h7M8.5 18h4" />
      </svg>
    );
  if (href === '/purchase')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M9.3 9.7c0-1.1 1.2-2 2.7-2s2.7.7 2.7 1.8-1 1.6-2.7 1.9c-1.7.3-2.7.9-2.7 2s1.2 1.8 2.7 1.8 2.7-.7 2.7-1.7" />
      </svg>
    );
  if (href === '/stock')
    return (
      <svg {...p}>
        <path d="M3.5 7.5L12 3l8.5 4.5L12 12 3.5 7.5zM3.5 7.5V16L12 20.5 20.5 16V7.5M12 12v8.5" />
      </svg>
    );
  if (href === '/history')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5M16 5.8a3 3 0 010 5.4M18.5 19c0-2.2-.9-3.8-2.4-4.5" />
    </svg>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSortingNotiMenu, setShowSortingNotiMenu] = useState(false);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notiMenuRef = useRef<HTMLDivElement>(null);
  const sortingNoti = useSortingNotifications(user?.username || '', SORTING_DEPTS.includes(user?.department || ''));

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
      try { setUser(JSON.parse(savedUserStr)); } catch { setUser(null); }
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
    if (pathname === '/sorting' && user?.username && SORTING_DEPTS.includes(user.department)) {
      void acknowledgeAllSortingNotifications(user.username);
    }
  }, [pathname, user?.username, user?.department]);

  // ตั้งสีประจำแผนกให้ทั้งหน้า
  useEffect(() => {
    const tone = pageMeta[pathname]?.tone;
    if (tone && pathname !== '/') document.documentElement.dataset.tone = tone;
    else delete document.documentElement.dataset.tone;
  }, [pathname]);

  // แถบสีที่เลื่อนไปหาเมนูที่เปิดอยู่
  useEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname, user]);

  // คลิกนอกเมนู / กด Esc เพื่อปิด
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!userMenuRef.current?.contains(target)) setShowUserMenu(false);
      if (!notiMenuRef.current?.contains(target)) setShowSortingNotiMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowSortingNotiMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (pathname === '/') return null;

  const meta = pageMeta[pathname] || { eyebrow: 'Supply Bridge', title: 'Dashboard', tone: 'slate' };
  const userInitial = user?.name?.trim()?.[0]?.toUpperCase() || 'U';
  const deptStyle = departmentStyles[user?.department || ''] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const homeHref =
    user?.department === 'SORTING_VIEWER' || user?.department === 'STOCK_SORTING_MANAGER' ? '/sorting' : '/history';
  const canSeeSortingNoti = SORTING_DEPTS.includes(user?.department || '');
  const hasSortingNoti = canSeeSortingNoti && sortingNoti.count > 0;
  const visibleItems = navItems.filter((item) => canAccess(user, item.dept));

  const go = (href: string) => {
    if (href === '/sorting' && pathname === '/sorting' && user?.username) {
      void acknowledgeAllSortingNotifications(user.username);
    }
    router.push(href);
  };

  const openSortingNoti = (batchId?: string) => {
    setShowSortingNotiMenu(false);
    if (pathname === '/sorting' && user?.username) void acknowledgeAllSortingNotifications(user.username);

    if (pathname !== '/sorting') {
      if (batchId && user?.username) {
        try { sessionStorage.setItem(pendingNotificationKey(user.username), batchId); } catch { /* Navigation still works without storage. */ }
      }
      router.push('/sorting');
      return;
    }

    window.dispatchEvent(new CustomEvent('sorting-notification-open', { detail: { batchId } }));
  };

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        {/* เส้นสีแผนก เปลี่ยนสีนุ่มๆ เมื่อสลับหน้า */}
        <div className="h-[3px] w-full transition-colors duration-500" style={{ background: 'var(--tone)' }} />
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push(homeHref)}
            className="group flex shrink-0 items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50"
            aria-label="กลับไปหน้าหลัก"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm transition-transform group-active:scale-95">
              SP
            </div>
            <div className="hidden text-left md:block">
              <p className="font-display text-sm font-bold leading-none text-slate-950">Supply Bridge</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">ระบบสำเพ็ง</p>
            </div>
          </button>

          <div className="hidden h-8 w-px bg-slate-200 md:block" />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--tone-ink)' }}>{meta.eyebrow}</p>
            <p className="truncate font-display text-base font-bold text-slate-950">{meta.title}</p>
          </div>

          {/* เมนูหลัก (จอใหญ่) */}
          <div ref={navRef} className="relative hidden items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 lg:flex">
            {indicator && (
              <span
                aria-hidden="true"
                className="absolute bottom-1 top-1 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-[left,width] duration-300"
                style={{ left: indicator.left, width: indicator.width, transitionTimingFunction: 'var(--ease-out)' }}
              />
            )}
            {visibleItems.map((item) => {
              const active = pathname === item.href;
              const showBadge = item.href === '/sorting' && hasSortingNoti;
              return (
                <button
                  key={item.href}
                  data-active={active}
                  onClick={() => go(item.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative z-10 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                    active ? 'text-slate-950' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span className={active ? '' : 'opacity-70'} style={active ? { color: 'var(--tone-ink)' } : undefined}>
                    <NavIcon href={item.href} />
                  </span>
                  {item.label}
                  {showBadge && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {sortingNoti.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* แจ้งเตือนธุรการคลัง */}
          {hasSortingNoti && (
            <div ref={notiMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSortingNotiMenu((current) => !current)}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-95"
                title="แจ้งเตือนธุรการคลัง"
                aria-label="เปิดรายการแจ้งเตือนธุรการคลัง"
                aria-expanded={showSortingNotiMenu}
              >
                <svg key={sortingNoti.count} className="bell-ring" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9zM10 19a2 2 0 004 0" />
                </svg>
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {sortingNoti.count}
                </span>
              </button>

              {showSortingNotiMenu && (
                <div className="pop-in absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: 'var(--shadow-pop)' }}>
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-blue-700">แจ้งเตือนธุรการคลัง</p>
                    <p className="mt-0.5 text-xs text-slate-500">{sortingNoti.count} อัปเดตใหม่ · กดเพื่อเปิดบิลนั้น</p>
                  </div>
                  <div className="custom-scrollbar max-h-80 overflow-y-auto p-2">
                    {sortingNoti.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openSortingNoti(item.batchId)}
                        className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-blue-50"
                      >
                        <p className="truncate text-sm font-bold text-slate-900">{item.batchName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{item.message || 'มีการแก้ไขข้อมูลในบิลนี้'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ผู้ใช้ */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu((current) => !current)}
              aria-expanded={showUserMenu}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-slate-50 sm:py-1.5 sm:pl-1.5 sm:pr-3"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold" style={{ background: 'var(--tone-soft)', color: 'var(--tone-ink)' }}>
                {userInitial}
              </div>
              <div className="hidden text-left sm:block">
                <p className="max-w-32 truncate text-sm font-bold leading-none text-slate-950">{user?.name || 'User'}</p>
                <p className="mt-1 max-w-32 truncate text-[11px] font-medium text-slate-500">
                  {deptLabel[user?.department || ''] || user?.department || 'ผู้ใช้'}
                </p>
              </div>
              <span className={`hidden text-slate-400 transition-transform sm:inline ${showUserMenu ? 'rotate-180' : ''}`}>⌄</span>
            </button>

            {showUserMenu && (
              <div className="pop-in absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: 'var(--shadow-pop)' }}>
                <div className="border-b border-slate-100 bg-slate-50 p-5">
                  <p className="font-display text-base font-bold text-slate-950">{user?.name || 'User'}</p>
                  <p className="mt-1 text-xs text-slate-500">{user?.email || 'ภายในระบบสำเพ็ง'}</p>
                  <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${deptStyle}`}>
                    {deptLabel[user?.department || ''] || user?.department || 'ผู้ใช้'}
                  </p>
                </div>

                {hasSortingNoti && (
                  <div className="border-b border-slate-100 p-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        openSortingNoti(sortingNoti.items?.[0]?.batchId || sortingNoti.latestBatchId);
                      }}
                      className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      แจ้งเตือนธุรการคลัง: {sortingNoti.count} อัปเดต
                    </button>
                  </div>
                )}

                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* แถบเมนูด้านล่าง (มือถือ/แท็บเล็ต) — เอื้อมนิ้วโป้งถึง */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const showBadge = item.href === '/sorting' && hasSortingNoti;
            return (
              <button
                key={item.href}
                onClick={() => go(item.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold transition-colors active:scale-95 ${
                  active ? '' : 'text-slate-500'
                }`}
                style={active ? { color: 'var(--tone-ink)' } : undefined}
              >
                <span
                  className="absolute inset-x-5 top-0 h-[3px] rounded-b-full transition-opacity"
                  style={{ background: 'var(--tone)', opacity: active ? 1 : 0 }}
                />
                <span className="relative">
                  <NavIcon href={item.href} />
                  {showBadge && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                      {sortingNoti.count}
                    </span>
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}