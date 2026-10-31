'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface MenuItem {
  title: string;
  desc: string;
  href: string;
  icon: 'sorting' | 'purchase' | 'stock';
  deptKey: string;
  soft: string;
  ink: string;
}

function DeptIcon({ kind, color }: { kind: MenuItem['icon']; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (kind === 'sorting') {
    return (
      <svg width="30" height="30" viewBox="0 0 24 24" {...common}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
        <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
      </svg>
    );
  }

  if (kind === 'purchase') {
    return (
      <svg width="30" height="30" viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M9.3 9.7c0-1.1 1.2-2 2.7-2s2.7.7 2.7 1.8-1 1.6-2.7 1.9c-1.7.3-2.7.9-2.7 2s1.2 1.8 2.7 1.8 2.7-.7 2.7-1.7" />
      </svg>
    );
  }

  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...common}>
      <path d="M3.5 7.5L12 3l8.5 4.5L12 12 3.5 7.5z" />
      <path d="M3.5 7.5V16L12 20.5 20.5 16V7.5" />
      <path d="M12 12v8.5" />
    </svg>
  );
}

function canOpenMenu(department: string, menu: MenuItem) {
  if (department === 'ADMIN') return true;
  if (department === menu.deptKey) return true;
  if (department === 'SORTING_VIEWER' && menu.deptKey === 'SORTING') return true;
  if (department === 'STOCK_SORTING_MANAGER' && (menu.deptKey === 'SORTING' || menu.deptKey === 'STOCK')) return true;
  return false;
}

export default function HomeImproved() {
  const router = useRouter();

  const [showLogin, setShowLogin] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMessage, setRegisterMessage] = useState('');
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    password: '',
    department: 'SORTING',
  });

  const menus: MenuItem[] = [
    {
      title: 'ฝ่ายธุรการคลัง',
      desc: 'คีย์รายการของขาด และเช็คสต็อกประจำวัน',
      href: '/sorting',
      icon: 'sorting',
      deptKey: 'SORTING',
      soft: 'var(--sorting-soft)',
      ink: 'var(--sorting-ink)',
    },
    {
      title: 'ฝ่ายจัดซื้อ',
      desc: 'อนุมัติคำสั่งซื้อ และระบุหน่วยสินค้า',
      href: '/purchase',
      icon: 'purchase',
      deptKey: 'PURCHASE',
      soft: 'var(--purchase-soft)',
      ink: 'var(--purchase-ink)',
    },
    {
      title: 'ฝ่ายสต็อก',
      desc: 'ตรวจรับสินค้าเข้าคลังจริง',
      href: '/stock',
      icon: 'stock',
      deptKey: 'STOCK',
      soft: 'var(--stock-soft)',
      ink: 'var(--stock-ink)',
    },
  ];

  const departmentOptions = [
    { value: 'SORTING', label: 'ฝ่ายธุรการคลัง' },
    { value: 'PURCHASE', label: 'ฝ่ายจัดซื้อ' },
    { value: 'STOCK', label: 'ฝ่ายสต็อก' },
    { value: 'SORTING_VIEWER', label: 'ธุรการคลัง (ดูอย่างเดียว)' },
    { value: 'STOCK_SORTING_MANAGER', label: 'หัวหน้าสต็อก + ธุรการคลัง' },
  ];

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedMenu(menu);
    setShowLogin(true);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        if (canOpenMenu(data.user.department, selectedMenu)) {
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('loginDate', data.user.loginDate || new Date().toLocaleDateString());
          router.push(selectedMenu.href);
        } else {
          setError(`ยังไม่มีสิทธิ์เข้าใช้งานส่วนของ ${selectedMenu.title} ครับ`);
        }
      } else {
        setError(data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้งครับ');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterMessage('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRegisterMessage(data.message || 'สมัครสมาชิกไม่สำเร็จ');
        return;
      }

      localStorage.setItem('user',JSON.stringify(data.user));
      localStorage.setItem('loginDate',data.user.loginDate);
      const target=data.user.department==='PURCHASE'?'/purchase':data.user.department==='STOCK'?'/stock':'/sorting';
      router.push(target);
      setRegisterForm({ name: '', username: '', password: '', department: 'SORTING' });
    } catch {
      setRegisterMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้งครับ');
    } finally {
      setRegisterLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!showLogin && !showRegister) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowLogin(false); setShowRegister(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLogin, showRegister]);

  const closeButton = (onClose: () => void) => (
    <button
      onClick={onClose}
      aria-label="ปิด"
      className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--ink)] active:scale-90"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
    </button>
  );

  const submitClass = (busy: boolean) =>
    `w-full rounded-xl py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] ${busy ? 'cursor-not-allowed opacity-60' : 'hover:brightness-110'}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)]">
      {/* เส้นทางส่งของ 3 สี ลากผ่านหลังหน้า */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex h-1.5">
        <span className="flex-1" style={{ background: 'var(--sorting-ink)' }} />
        <span className="flex-1" style={{ background: 'var(--purchase-ink)' }} />
        <span className="flex-1" style={{ background: 'var(--stock-ink)' }} />
      </div>

      <main className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        {/* ฝั่งซ้าย: ชื่อระบบ + เส้นทางงาน */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-base font-black text-white shadow-sm">SP</div>
            <div>
              <p className="font-display text-base font-bold leading-none text-[var(--ink)]">Supply Bridge</p>
              <p className="mt-1 text-xs text-[var(--muted)]">ระบบจัดซื้อและตรวจรับสินค้า</p>
            </div>
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.25] text-[var(--ink)] sm:text-5xl">
            ระบบ Supply Bridge
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
            ของที่ขาดไปถึงมือจัดซื้อ แล้วถึงคลังอย่างครบถ้วน เลือกแผนกของคุณเพื่อเริ่มงาน
          </p>

          <ol className="mt-8 hidden max-w-md gap-0 sm:grid" aria-label="ขั้นตอนการทำงาน">
            {menus.map((menu, i) => (
              <li key={menu.href} className="relative flex gap-4 pb-6 last:pb-0">
                {i < menus.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] border-l-2 border-dashed border-[var(--line-strong)]" />
                )}
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: menu.soft, color: menu.ink }}>
                  {i + 1}
                </span>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold text-[var(--ink)]">{menu.title}</p>
                  <p className="text-sm text-[var(--muted)]">{menu.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ฝั่งขวา: เลือกแผนก */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-[var(--muted)]">เข้าสู่ระบบในฐานะ</h2>
          <div className="grid gap-4">
            {menus.map((menu) => (
              <button
                key={menu.href}
                onClick={() => handleMenuClick(menu)}
                className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-xl active:scale-[0.99] sm:p-6"
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 transition-all duration-300 group-hover:w-2.5" style={{ background: menu.ink }} />
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105" style={{ background: menu.soft }}>
                  <DeptIcon kind={menu.icon} color={menu.ink} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold text-[var(--ink)]">{menu.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">{menu.desc}</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-300 group-hover:translate-x-1" style={{ background: menu.soft, color: menu.ink }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[var(--line-strong)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">ยังไม่มีบัญชี?</p>
              <p className="text-sm text-[var(--muted)]">สมัครแล้วใช้งานได้ทันที ไม่ต้องรออนุมัติ</p>
            </div>
            <button onClick={() => { setShowRegister(true); setRegisterMessage(''); }} className="secondary-action shrink-0">
              สมัครเข้าใช้งาน
            </button>
          </div>
        </section>
      </main>

      {/* หน้าต่างเข้าสู่ระบบ */}
      {showLogin && selectedMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowLogin(false)}>
          <div
            role="dialog" aria-modal="true" aria-label={`เข้าสู่ระบบ ${selectedMenu.title}`}
            className="pop-in relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full" style={{ background: selectedMenu.ink }} />
            {closeButton(() => setShowLogin(false))}
            <div className="p-7 sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl" style={{ background: selectedMenu.soft }}>
                  <DeptIcon kind={selectedMenu.icon} color={selectedMenu.ink} />
                </div>
                <p className="mb-1 text-xs font-semibold" style={{ color: selectedMenu.ink }}>เข้าสู่ระบบ</p>
                <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{selectedMenu.title}</h3>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-semibold text-[var(--muted)]">ชื่อผู้ใช้</label>
                  <input
                    id="username" type="text" autoFocus autoComplete="username" required
                    className="control-field w-full p-3.5 text-sm"
                    value={username} onChange={(e) => setUsername(e.target.value)} placeholder="กรอกชื่อผู้ใช้"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-[var(--muted)]">รหัสผ่าน</label>
                  <div className="relative">
                    <input
                      id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                      className="control-field w-full p-3.5 pr-16 text-sm"
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--bg)]">
                      {showPassword ? 'ซ่อน' : 'แสดง'}
                    </button>
                  </div>
                </div>

                {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-center text-sm font-medium text-rose-700">{error}</div>}

                <button type="submit" disabled={loading} className={submitClass(loading)} style={{ background: selectedMenu.ink }}>
                  {loading ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
                </button>

                <p className="pt-1 text-center text-xs text-[var(--muted)]">หากเข้าสู่ระบบไม่ได้ โปรดติดต่อ IT Support</p>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* หน้าต่างสมัครสมาชิก */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowRegister(false)}>
          <div
            role="dialog" aria-modal="true" aria-label="สมัครเข้าใช้งาน"
            className="pop-in relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[var(--sorting-ink)] via-[var(--purchase-ink)] to-[var(--stock-ink)]" />
            {closeButton(() => setShowRegister(false))}
            <div className="p-7 sm:p-8">
              <div className="mb-6 text-center">
                <h3 className="font-display text-2xl font-semibold text-[var(--ink)]">สมัครเข้าใช้งาน</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">สมัครแล้วเข้าสู่ระบบใช้งานได้ทันที</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-[var(--muted)]">ชื่อที่แสดงในระบบ</label>
                  <input id="reg-name" autoFocus className="control-field w-full p-3.5 text-sm" value={registerForm.name}
                    onChange={(e) => setRegisterForm((c) => ({ ...c, name: e.target.value }))} placeholder="เช่น admin stock" required />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-user" className="block text-xs font-semibold text-[var(--muted)]">Username</label>
                    <input id="reg-user" autoComplete="username" className="control-field w-full p-3.5 text-sm" value={registerForm.username}
                      onChange={(e) => setRegisterForm((c) => ({ ...c, username: e.target.value }))} placeholder="อย่างน้อย 3 ตัว" required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-pass" className="block text-xs font-semibold text-[var(--muted)]">Password</label>
                    <input id="reg-pass" type="password" autoComplete="new-password" className="control-field w-full p-3.5 text-sm" value={registerForm.password}
                      onChange={(e) => setRegisterForm((c) => ({ ...c, password: e.target.value }))} placeholder="อย่างน้อย 8 ตัวอักษร" minLength={8} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-dept" className="block text-xs font-semibold text-[var(--muted)]">แผนกที่ใช้งาน</label>
                  <select id="reg-dept" className="control-field w-full p-3.5 text-sm" value={registerForm.department}
                    onChange={(e) => setRegisterForm((c) => ({ ...c, department: e.target.value }))}>
                    {departmentOptions.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}
                  </select>
                </div>

                {registerMessage && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-center text-sm font-medium text-rose-700">{registerMessage}</div>}

                <button type="submit" disabled={registerLoading} className={submitClass(registerLoading)} style={{ background: 'var(--brand)' }}>
                  {registerLoading ? 'กำลังสมัคร…' : 'สมัครและเริ่มใช้งาน'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}