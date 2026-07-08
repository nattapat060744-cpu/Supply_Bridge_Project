'use client';

import { useState } from 'react';
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
        setRegisterMessage(data.message || 'ส่งคำขอสมัครไม่สำเร็จ');
        return;
      }

      setRegisterMessage(data.message || 'ส่งคำขอสมัครเรียบร้อย รอ admin อนุมัติ');
      setRegisterForm({ name: '', username: '', password: '', department: 'SORTING' });
    } catch {
      setRegisterMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้งครับ');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-16">
        <div className="text-center mb-10 max-w-xl">
          <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-lg bg-[var(--brand-soft)] border border-[var(--line)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--stock-ink)]" />
            <span className="text-[11px] font-semibold text-[var(--muted)] tracking-[0.18em] uppercase">
              Supply Bridge System
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--ink)] mb-4 leading-[1.1] tracking-tight">
            สำเพ็ง บุรีรัมย์
          </h1>
          <p className="text-[var(--muted)] text-base leading-relaxed">
            เลือกแผนกของคุณเพื่อเข้าสู่ระบบจัดการสต็อกและสั่งซื้อสินค้า
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full mb-8">
          {menus.map((menu) => (
            <button
              key={menu.href}
              onClick={() => handleMenuClick(menu)}
              className="group text-left bg-[var(--surface)] rounded-2xl border border-[var(--line)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-panel)] active:scale-[0.98] focus-visible:outline-offset-4"
            >
              <div className="h-24 flex items-center justify-center relative" style={{ background: menu.soft }}>
                <div className="w-14 h-14 rounded-xl bg-white/70 flex items-center justify-center">
                  <DeptIcon kind={menu.icon} color={menu.ink} />
                </div>
              </div>

              <div className="relative h-0 border-t border-dashed border-[var(--line)]">
                <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-[var(--bg)]" />
                <span className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-[var(--bg)]" />
              </div>

              <div className="p-6">
                <h2 className="font-display text-lg font-semibold text-[var(--ink)] mb-1.5">{menu.title}</h2>
                <p className="text-sm text-[var(--muted)] leading-relaxed mb-5 min-h-10">{menu.desc}</p>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: menu.ink }}>
                  เข้าสู่ระบบ
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-[var(--muted)] tracking-wide">ระบบจัดการสต็อก เวอร์ชัน 2.0</p>
        <button
          onClick={() => {
            setShowRegister(true);
            setRegisterMessage('');
          }}
          className="mt-5 rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors hover:bg-[var(--brand-soft)]"
        >
          สมัครเข้าใช้งาน
        </button>
      </div>

      {showLogin && selectedMenu && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-sm p-8 relative border border-[var(--line)]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLogin(false)}
              aria-label="ปิด"
              className="absolute right-5 top-5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--bg)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: selectedMenu.soft }}>
                <DeptIcon kind={selectedMenu.icon} color={selectedMenu.ink} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1.5" style={{ color: selectedMenu.ink }}>
                การยืนยันตัวตน
              </p>
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{selectedMenu.title}</h3>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">ชื่อผู้ใช้</label>
                <input
                  id="username"
                  type="text"
                  className="control-field w-full p-3.5 rounded-xl text-sm font-medium placeholder:text-[var(--muted)]/60"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">รหัสผ่าน</label>
                <input
                  id="password"
                  type="password"
                  className="control-field w-full p-3.5 rounded-xl text-sm font-medium placeholder:text-[var(--muted)]/60"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <div className="bg-[#FBEAE8] border border-[#F0C9C4] text-[#A4453B] text-sm font-medium p-3.5 rounded-xl text-center">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all active:scale-[0.98] ${loading ? 'bg-[var(--line)] text-[var(--muted)] cursor-not-allowed' : 'bg-[var(--brand)] text-white hover:opacity-90 shadow-lg shadow-[var(--brand)]/15'}`}
              >
                {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </button>

              <p className="text-xs text-[var(--muted)] text-center pt-1">หากเข้าสู่ระบบไม่ได้ โปรดติดต่อ IT Support</p>
            </form>
          </div>
        </div>
      )}

      {showRegister && (
        <div className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md p-8 relative border border-[var(--line)]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowRegister(false)}
              aria-label="ปิด"
              className="absolute right-5 top-5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--bg)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>

            <div className="mb-7 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Access Request</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--ink)]">สมัครเข้าใช้งาน</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">ส่งคำขอให้ admin ตรวจสอบและอนุมัติก่อนเข้าใช้งาน</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">ชื่อที่แสดงในระบบ</label>
                <input
                  className="control-field w-full p-3.5 rounded-xl text-sm font-medium"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="เช่น admin stock"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Username</label>
                  <input
                    className="control-field w-full p-3.5 rounded-xl text-sm font-medium"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm((current) => ({ ...current, username: e.target.value }))}
                    placeholder="อย่างน้อย 3 ตัว"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Password</label>
                  <input
                    type="password"
                    className="control-field w-full p-3.5 rounded-xl text-sm font-medium"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((current) => ({ ...current, password: e.target.value }))}
                    placeholder="อย่างน้อย 4 ตัว"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">ขอสิทธิ์แผนก</label>
                <select
                  className="control-field w-full p-3.5 rounded-xl text-sm font-medium"
                  value={registerForm.department}
                  onChange={(e) => setRegisterForm((current) => ({ ...current, department: e.target.value }))}
                >
                  {departmentOptions.map((dept) => (
                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                  ))}
                </select>
              </div>

              {registerMessage && <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-center text-sm font-bold text-[var(--muted)]">{registerMessage}</div>}

              <button
                type="submit"
                disabled={registerLoading}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all active:scale-[0.98] ${registerLoading ? 'bg-[var(--line)] text-[var(--muted)] cursor-not-allowed' : 'bg-[var(--brand)] text-white hover:opacity-90 shadow-lg shadow-[var(--brand)]/15'}`}
              >
                {registerLoading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสมัคร'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}