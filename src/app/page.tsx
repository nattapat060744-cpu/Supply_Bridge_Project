'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MenuItem {
  title: string;
  desc: string;
  href: string;
  color: string;
  icon: string;
  deptKey: string;
}

export default function Home() {
  const router = useRouter();
  
  const [showLogin, setShowLogin] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const menus: MenuItem[] = [
    { title: 'ฝ่ายธุรการคลัง', desc: 'คีย์รายการของขาด / เช็คสต็อก', href: '/sorting', color: 'bg-blue-600', icon: '📋', deptKey: 'SORTING' },
    { title: 'ฝ่ายจัดซื้อ', desc: 'อนุมัติสั่งซื้อ / ระบุหน่วยสินค้า', href: '/purchase', color: 'bg-green-600', icon: '💰', deptKey: 'PURCHASE' },
    { title: 'ฝ่ายสต็อก', desc: 'ตรวจรับสินค้าเข้าคลังจริง', href: '/stock', color: 'bg-amber-500', icon: '📦', deptKey: 'STOCK' },
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
        // ตรวจสอบสิทธิ์: แผนกต้องตรงกับปุ่มที่กด หรือ เป็น ADMIN ถึงจะเข้าได้
        const isAuthorized = data.user.department === selectedMenu.deptKey || data.user.department === 'ADMIN';

        if (isAuthorized) {
          // --- จุดที่แก้ไข: เก็บข้อมูล User และวันที่ Login เพื่อใช้เช็คตอนเที่ยงคืน ---
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('loginDate', data.user.loginDate || new Date().toLocaleDateString());
          
          router.push(selectedMenu.href);
        } else {
          setError(`❌ คุณไม่มีสิทธิ์เข้าใช้งานในส่วนของ ${selectedMenu.title} ครับ`);
        }
      } else {
        setError(data.message || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center justify-center relative">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 italic">สำเพ็ง บุรีรัมย์</h1>
        <p className="text-gray-600 text-lg font-bold">ระบบจัดการสต็อกและสั่งซื้อสินค้าภายใน</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {menus.map((menu) => (
          <div 
            key={menu.href} 
            onClick={() => handleMenuClick(menu)}
            className={`${menu.color} text-white p-8 rounded-4xl shadow-xl hover:scale-105 transition-all cursor-pointer h-full flex flex-col justify-between active:scale-95`}
          >
            <div>
              <span className="text-4xl mb-4 block">{menu.icon}</span>
              <h2 className="text-2xl font-black mb-2 uppercase italic leading-none">{menu.title}</h2>
              <p className="text-white/80 font-bold text-sm">{menu.desc}</p>
            </div>
            <div className="mt-6 flex items-center font-black text-[10px] uppercase tracking-widest bg-black/20 w-fit px-4 py-2 rounded-full">
              เข้าใช้งานระบบ →
            </div>
          </div>
        ))}
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-100 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10 relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowLogin(false)}
              className="absolute right-8 top-8 text-slate-300 hover:text-slate-600 transition-colors text-2xl"
            >✕</button>

            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl">
                {selectedMenu?.icon}
              </div>
              <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Authorization Required</p>
              <h3 className="text-2xl font-black text-slate-900 italic uppercase">เข้าใช้งาน: {selectedMenu?.title}</h3>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
               <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Username</p>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold outline-none focus:ring-4 ring-slate-500/10 focus:border-slate-400 transition-all text-slate-900"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  required
                />
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Password</p>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold outline-none focus:ring-4 ring-slate-500/10 focus:border-slate-400 transition-all text-slate-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-500 text-[11px] font-bold p-4 rounded-2xl text-center border border-red-100">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-6 rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                  loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-emerald-100'
                }`}
              >
                {loading ? 'Checking... ⏳' : 'ยืนยันตัวตน เข้าสู่ระบบ 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-16 text-gray-400 text-xs italic font-bold uppercase tracking-widest">
      </footer>
    </div>
  );
}