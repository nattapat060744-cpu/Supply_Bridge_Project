import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const revalidate = 0;

const REQUEST_SHEET = 'User_Requests';
const USERS_SHEET = 'Users';
const REQUEST_HEADERS = [
  'Request_ID',
  'Username',
  'Password',
  'Name',
  'Department',
  'Status',
  'Created_At',
  'Reviewed_At',
  'Reviewed_By',
];
const USER_HEADERS = ['Username', 'Password', 'Name', 'Department'];
const ALLOWED_DEPARTMENTS = ['SORTING', 'PURCHASE', 'STOCK', 'SORTING_VIEWER', 'STOCK_SORTING_MANAGER'];

type RequestRow = {
  id: string;
  username: string;
  password: string;
  name: string;
  department: string;
  status: string;
  createdAt: string;
  reviewedAt: string;
  reviewedBy: string;
  rowNumber: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getSpreadsheetId() {
  return process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
}

function getCredentials() {
  const credentialsRaw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (credentialsRaw && credentialsRaw !== 'undefined') {
    return JSON.parse(credentialsRaw);
  }

  if (privateKey && clientEmail) {
    return {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    };
  }

  throw new Error('Missing Google Credentials');
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
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

async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
  headers: string[]
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
}

async function readRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  range: string
) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

function normalizeDepartment(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function mapRequestRows(rows: unknown[][]): RequestRow[] {
  return rows.map((row, index) => ({
    id: String(row[0] || ''),
    username: String(row[1] || ''),
    password: String(row[2] || ''),
    name: String(row[3] || ''),
    department: String(row[4] || ''),
    status: String(row[5] || 'PENDING').toUpperCase(),
    createdAt: String(row[6] || ''),
    reviewedAt: String(row[7] || ''),
    reviewedBy: String(row[8] || ''),
    rowNumber: index + 2,
  }));
}

export async function POST(req: Request) {
  try {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json({ success: false, message: 'Missing Spreadsheet ID' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim();
    const department = normalizeDepartment(body.department);

    if (!username || !password || !name || !department) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    if (!ALLOWED_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ success: false, message: 'แผนกที่เลือกไม่ถูกต้อง' }, { status: 400 });
    }

    if (username.length < 3 || password.length < 4) {
      return NextResponse.json({ success: false, message: 'username หรือ password สั้นเกินไป' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await ensureSheet(sheets, spreadsheetId, REQUEST_SHEET, REQUEST_HEADERS);
    await ensureSheet(sheets, spreadsheetId, USERS_SHEET, USER_HEADERS);

    const [users, requestRows] = await Promise.all([
      readRows(sheets, spreadsheetId, `${USERS_SHEET}!A2:D`),
      readRows(sheets, spreadsheetId, `${REQUEST_SHEET}!A2:I`),
    ]);

    const lowerUsername = username.toLowerCase();
    const userExists = users.some((row) => String(row[0] || '').trim().toLowerCase() === lowerUsername);
    const pendingExists = mapRequestRows(requestRows).some(
      (row) => row.username.trim().toLowerCase() === lowerUsername && row.status === 'PENDING'
    );

    if (userExists) {
      return NextResponse.json({ success: false, message: 'username นี้มีในระบบแล้ว' }, { status: 409 });
    }

    if (pendingExists) {
      return NextResponse.json({ success: false, message: 'username นี้ส่งคำขอไว้แล้ว รอ admin อนุมัติ' }, { status: 409 });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${REQUEST_SHEET}!A:I`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[crypto.randomUUID(), username, password, name, department, 'PENDING', new Date().toLocaleString('th-TH'), '', '']],
      },
    });

    return NextResponse.json({ success: true, message: 'ส่งคำขอสมัครเรียบร้อย รอ admin อนุมัติ' }, { status: 201 });
  } catch (error: unknown) {
    console.error('register.POST', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAdmin(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'อนุญาตเฉพาะ admin เท่านั้น' }, { status: 403 });
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json({ success: false, message: 'Missing Spreadsheet ID' }, { status: 500 });
    }

    const sheets = getSheetsClient();
    await ensureSheet(sheets, spreadsheetId, REQUEST_SHEET, REQUEST_HEADERS);
    const rows = await readRows(sheets, spreadsheetId, `${REQUEST_SHEET}!A2:I`);
    const requests = mapRequestRows(rows)
      .filter((row) => row.id)
      .sort((a, b) => (a.status === 'PENDING' ? -1 : 1) - (b.status === 'PENDING' ? -1 : 1));

    return NextResponse.json({ success: true, requests }, { status: 200 });
  } catch (error: unknown) {
    console.error('register.GET', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'อนุญาตเฉพาะ admin เท่านั้น' }, { status: 403 });
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json({ success: false, message: 'Missing Spreadsheet ID' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body.id || '').trim();
    const action = String(body.action || '').trim().toLowerCase();
    const overrideDepartment = normalizeDepartment(body.department);

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await ensureSheet(sheets, spreadsheetId, REQUEST_SHEET, REQUEST_HEADERS);
    await ensureSheet(sheets, spreadsheetId, USERS_SHEET, USER_HEADERS);

    const requestRows = await readRows(sheets, spreadsheetId, `${REQUEST_SHEET}!A2:I`);
    const requests = mapRequestRows(requestRows);
    const target = requests.find((row) => row.id === requestId);

    if (!target) {
      return NextResponse.json({ success: false, message: 'ไม่พบคำขอนี้' }, { status: 404 });
    }

    if (target.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: 'คำขอนี้ถูกจัดการไปแล้ว' }, { status: 409 });
    }

    const reviewedAt = new Date().toLocaleString('th-TH');

    if (action === 'reject') {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${REQUEST_SHEET}!F${target.rowNumber}:I${target.rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['REJECTED', target.createdAt, reviewedAt, session.username]] },
      });

      return NextResponse.json({ success: true, message: 'ปฏิเสธคำขอแล้ว' }, { status: 200 });
    }

    const department = overrideDepartment || target.department;
    if (!ALLOWED_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ success: false, message: 'แผนกที่เลือกไม่ถูกต้อง' }, { status: 400 });
    }

    const users = await readRows(sheets, spreadsheetId, `${USERS_SHEET}!A2:D`);
    const userExists = users.some((row) => String(row[0] || '').trim().toLowerCase() === target.username.toLowerCase());
    if (userExists) {
      return NextResponse.json({ success: false, message: 'username นี้มีใน Users แล้ว' }, { status: 409 });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${USERS_SHEET}!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[target.username, target.password, target.name, department]] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REQUEST_SHEET}!F${target.rowNumber}:I${target.rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['APPROVED', target.createdAt, reviewedAt, session.username]] },
    });

    return NextResponse.json({ success: true, message: 'อนุมัติและเพิ่มผู้ใช้แล้ว' }, { status: 200 });
  } catch (error: unknown) {
    console.error('register.PATCH', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 });
  }
}
