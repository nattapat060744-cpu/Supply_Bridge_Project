import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

// API access rules by department. ADMIN is allowed everywhere.
// SORTING_VIEWER can read sorting/order data for export, but cannot write.
const ROUTE_DEPARTMENTS: { prefix: string; allow: string[] }[] = [
  { prefix: '/api/order', allow: ['SORTING', 'STOCK_SORTING_MANAGER'] },
  { prefix: '/api/purchase', allow: ['PURCHASE', 'SORTING', 'STOCK', 'STOCK_SORTING_MANAGER'] },
  { prefix: '/api/stock', allow: ['STOCK', 'STOCK_SORTING_MANAGER'] },
  { prefix: '/api/history', allow: ['*'] },
  { prefix: '/api/archive', allow: ['ADMIN'] },
  { prefix: '/api/password-requests', allow: ['ADMIN'] },
];

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/demo',
  '/api/register',
  '/api/password-requests/public',
];

function withSessionHeaders(req: NextRequest, username: string, department: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-session-user', username);
  requestHeaders.set('x-session-department', department);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const requestOrigin = `${req.nextUrl.protocol}//${req.headers.get('host') || req.nextUrl.host}`;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.get('origin')&&req.headers.get('origin')!==requestOrigin){
    return NextResponse.json({success:false,message:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'},{status:403});
  }
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งานครับ' },
      { status: 401 }
    );
  }

  const rule = ROUTE_DEPARTMENTS.find((r) => pathname.startsWith(r.prefix));

  if (pathname.startsWith('/api/order') && (req.method === 'GET' || (pathname === '/api/order/notifications' && req.method === 'POST')) && session.department === 'SORTING_VIEWER') {
    return withSessionHeaders(req, session.username, session.department);
  }

  if (rule && session.department !== 'ADMIN' && !rule.allow.includes('*') && !rule.allow.includes(session.department)) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้ครับ' },
      { status: 403 }
    );
  }

  return withSessionHeaders(req, session.username, session.department);
}

export const config = {
  matcher: '/api/:path*',
};
