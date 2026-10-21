import { SESSION_COOKIE_NAME, verifySessionToken } from './auth';
export async function sessionFor(req: Request) {
  const cookie = req.headers.get('cookie')?.split(';').map(p => p.trim()).find(p => p.startsWith(SESSION_COOKIE_NAME+'='));
  return verifySessionToken(cookie?.slice(SESSION_COOKIE_NAME.length+1));
}
