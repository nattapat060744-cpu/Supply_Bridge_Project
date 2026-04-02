'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; department: string } | null>(null);

  // ใช้ useCallback เพื่อให้ฟังก์ชันไม่ถูกสร้างใหม่บ่อยๆ กัน Loop
  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('loginDate');
    setUser(null);
    
    // ใช้ window.location.href แทน router.push ในกรณีนี้ 
    // เพื่อบังคับล้าง State ทุกอย่างของ Browser ให้สะอาดกริ๊บ
    window.location.href = '/';
  }, []);

  useEffect(() => {
    // 1. ดึงข้อมูลผู้ใช้มาแสดงที่ Navbar
    const savedUserStr = localStorage.getItem('user');
    if (savedUserStr && savedUserStr !== "undefined") {
      setUser(JSON.parse(savedUserStr));
    }

    // 2. ฟังก์ชันตรวจสอบการข้ามวัน
    const checkMidnightLogout = () => {
  const today = new Date().toLocaleDateString('th-TH'); // เพิ่ม 'th-TH'
  const lastLoginDate = localStorage.getItem('loginDate');
  const currentUser = localStorage.getItem('user');

  if (currentUser && lastLoginDate && lastLoginDate !== today) {
    alert('เซสชันหมดอายุแล้วครับ'); // Alert ก่อน
    handleLogout(); // แล้วค่อยเตะออก
  }
};

    // เช็คทันทีที่เข้าหน้าเว็บ
    checkMidnightLogout();

    // ตั้งเวลาเช็คทุก 1 นาที
    const interval = setInterval(checkMidnightLogout, 60000);

    return () => clearInterval(interval);
  }, [pathname, handleLogout]);

  // ถ้าอยู่หน้า Login ไม่ต้องแสดง Navbar
  if (pathname === '/') return null;

  const menus = [
    { name: 'ประวัติการทำรายการ', path: '/history', icon: '📜' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-100 px-6 py-4 shadow-sm">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h1 
            className="font-black text-xl italic tracking-tighter text-slate-900 cursor-pointer" 
            onClick={() => router.push('/history')}
          >
            SAMPENG <span className="text-blue-600 not-italic">SYSTEM</span>
          </h1>
          
          <div className="flex gap-2">
            {menus.map((menu) => (
              <button
                key={menu.path}
                onClick={() => router.push(menu.path)}
                className={`px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  pathname === menu.path 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                {menu.icon} {menu.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-900 leading-none">{user?.name || ''}</p>
            <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">
               {user?.department === 'ADMIN' ? '⭐ ADMIN' : user?.department}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
          >
            🚪
          </button>
        </div>
      </div>
    </nav>
  );
}