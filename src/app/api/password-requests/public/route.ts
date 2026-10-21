import { NextResponse } from 'next/server';
import { getPasswordRequestsSheet } from '@/lib/database';
import { safeErrorResponse, toSafeString } from '@/lib/api-utils';
import {
  passwordRequestFromRow,
  publicPasswordRequest,
  thaiTimestamp,
} from '@/lib/password-requests';

type CreatePasswordRequestBody = {
  username?: unknown;
  requesterName?: unknown;
  department?: unknown;
  note?: unknown;
};

const ACTIVE_STATUSES = new Set(['PENDING']);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = toSafeString(searchParams.get('requestId'));
    const username = toSafeString(searchParams.get('username')).toLowerCase();

    if (!requestId && !username) {
      return NextResponse.json({ success: false, message: 'Missing requestId or username' }, { status: 400 });
    }

    const sheet = await getPasswordRequestsSheet();
    const rows = await sheet.getRows();

    const records = rows
      .map(passwordRequestFromRow)
      .filter((record) => {
        if (requestId) return record.requestId === requestId;
        return record.username.toLowerCase() === username;
      })
      .reverse();

    return NextResponse.json({
      success: true,
      requests: records.map(publicPasswordRequest),
      latest: records[0] ? publicPasswordRequest(records[0]) : null,
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'passwordRequests.public.GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePasswordRequestBody;
    const username = toSafeString(body.username, 120);
    const requesterName = toSafeString(body.requesterName, 120);
    const department = toSafeString(body.department, 80).toUpperCase();
    const note = toSafeString(body.note, 500);

    if (!username) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุชื่อผู้ใช้งานครับ' }, { status: 400 });
    }

    const sheet = await getPasswordRequestsSheet();
    const rows = await sheet.getRows();
    const existing = rows
      .map(passwordRequestFromRow)
      .find((record) => record.username.toLowerCase() === username.toLowerCase() && ACTIVE_STATUSES.has(record.status));

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        request: publicPasswordRequest(existing),
        message: 'มีคำขอที่ยังรอดำเนินการอยู่แล้วครับ',
      }, { status: 200 });
    }

    const requestId = crypto.randomUUID();
    const requestedAt = thaiTimestamp();

    await sheet.addRow({
      Request_ID: requestId,
      Username: username,
      Password: '',
      Name: requesterName || username,
      Department: department,
      Status: 'PENDING',
      Created_At: requestedAt,
      Reviewed_At: '',
      Reviewed_By: '',
    });

    return NextResponse.json({
      success: true,
      request: {
        requestId,
        username,
        requesterName,
        department,
        status: 'PENDING',
        requestedAt,
        approvedAt: '',
        generatedAt: '',
        expiresAt: '',
        rejectedAt: '',
        note,
        adminNote: '',
      },
    }, { status: 201 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'passwordRequests.public.POST');
  }
}
