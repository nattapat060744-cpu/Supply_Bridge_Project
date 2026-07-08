import { NextResponse } from 'next/server';
import { getPasswordRequestsSheet } from '@/lib/google-sheet';
import { safeErrorResponse, toSafeString } from '@/lib/api-utils';
import {
  normalizePasswordRequestStatus,
  passwordRequestFromRow,
  thaiTimestamp,
} from '@/lib/password-requests';

type PasswordRequestActionBody = {
  requestId?: unknown;
  action?: unknown;
  adminNote?: unknown;
};

const ADMIN_ACTIONS = new Set(['APPROVE', 'GENERATE', 'REJECT', 'MARK_VIEWED']);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = toSafeString(searchParams.get('status')).toUpperCase();
    const sheet = await getPasswordRequestsSheet();
    const rows = await sheet.getRows();

    const records = rows
      .map(passwordRequestFromRow)
      .filter((record) => !status || record.status === normalizePasswordRequestStatus(status))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

    return NextResponse.json({ success: true, requests: records });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'passwordRequests.GET');
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as PasswordRequestActionBody;
    const requestId = toSafeString(body.requestId);
    const action = toSafeString(body.action).toUpperCase();
    const adminNote = toSafeString(body.adminNote, 500);

    if (!requestId || !ADMIN_ACTIONS.has(action)) {
      return NextResponse.json({ success: false, message: 'Invalid request action' }, { status: 400 });
    }

    const sessionUser = req.headers.get('x-session-user') || 'admin';
    const now = thaiTimestamp();
    const sheet = await getPasswordRequestsSheet();
    const rows = await sheet.getRows();
    const row = rows.find((item) => item.get('Request_ID') === requestId);

    if (!row) {
      return NextResponse.json({ success: false, message: 'ไม่พบคำขอนี้แล้วครับ' }, { status: 404 });
    }

    void adminNote;

    if (action === 'APPROVE') {
      row.set('Status', 'APPROVED');
      row.set('Reviewed_By', sessionUser);
      row.set('Reviewed_At', now);
    }

    if (action === 'GENERATE') {
      row.set('Status', 'APPROVED');
      row.set('Reviewed_By', sessionUser);
      row.set('Reviewed_At', now);
    }

    if (action === 'REJECT') {
      row.set('Status', 'REJECTED');
      row.set('Reviewed_By', sessionUser);
      row.set('Reviewed_At', now);
    }

    if (action === 'MARK_VIEWED') {
      row.set('Status', 'VIEWED');
      row.set('Reviewed_At', row.get('Reviewed_At') || now);
    }

    await row.save();

    return NextResponse.json({
      success: true,
      request: passwordRequestFromRow(row),
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'passwordRequests.PATCH');
  }
}
