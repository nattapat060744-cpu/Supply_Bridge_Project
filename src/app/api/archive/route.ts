import { NextResponse } from 'next/server';
import { archiveCompletedOrders } from '@/lib/archive';
import { safeErrorResponse } from '@/lib/api-utils';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { invalidateCache } from '@/lib/sheet-cache';

export const revalidate = 0;

function readCutoffDays(url: string) {
  const { searchParams } = new URL(url);
  const rawDays = Number(searchParams.get('days') || 180);
  if (!Number.isFinite(rawDays)) return 180;
  return Math.min(Math.max(Math.floor(rawDays), 30), 3650);
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
}

async function requireAdmin(req: Request) {
  const token = getCookieValue(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  const session = await verifySessionToken(token);
  return session?.department === 'ADMIN' ? session : null;
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'อนุญาตเฉพาะ admin เท่านั้น' },
        { status: 403 }
      );
    }

    const cutoffDays = readCutoffDays(req.url);
    const result = await archiveCompletedOrders({ mode: 'preview', cutoffDays });
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'archive.GET');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'อนุญาตเฉพาะ admin เท่านั้น' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'run' ? 'run' : 'preview';
    const rawDays = Number(body.days || 180);
    const cutoffDays = Number.isFinite(rawDays) ? Math.min(Math.max(Math.floor(rawDays), 30), 3650) : 180;

    const result = await archiveCompletedOrders({
      mode,
      cutoffDays,
      archivedBy: session.username,
    });

    if (mode === 'run' && result.archivedCount > 0) {
      invalidateCache('purchase:list');
      invalidateCache('stock:list');
      invalidateCache('history:list');
    }

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'archive.POST');
  }
}
