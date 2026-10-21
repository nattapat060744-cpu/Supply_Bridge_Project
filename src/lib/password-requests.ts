import type { DatabaseRow } from './database';

export const PASSWORD_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'GENERATED',
  'VIEWED',
  'EXPIRED',
  'REJECTED',
] as const;

export type PasswordRequestStatus = (typeof PASSWORD_REQUEST_STATUSES)[number];

export type PasswordRequestRecord = {
  requestId: string;
  username: string;
  requesterName: string;
  department: string;
  status: PasswordRequestStatus;
  requestedAt: string;
  approvedBy: string;
  approvedAt: string;
  generatedAt: string;
  expiresAt: string;
  viewedAt: string;
  rejectedBy: string;
  rejectedAt: string;
  note: string;
  adminNote: string;
};

type SheetRow = DatabaseRow;

const STATUS_SET = new Set<string>(PASSWORD_REQUEST_STATUSES);

export function normalizePasswordRequestStatus(value: unknown): PasswordRequestStatus {
  const status = String(value || '').trim().toUpperCase();
  return STATUS_SET.has(status) ? (status as PasswordRequestStatus) : 'PENDING';
}

export function passwordRequestFromRow(row: SheetRow): PasswordRequestRecord {
  const status = normalizePasswordRequestStatus(row.get('Status'));
  const reviewedBy = row.get('Reviewed_By') || '';
  const reviewedAt = row.get('Reviewed_At') || '';

  return {
    requestId: row.get('Request_ID') || '',
    username: row.get('Username') || '',
    requesterName: row.get('Requester_Name') || row.get('Name') || '',
    department: row.get('Department') || '',
    status,
    requestedAt: row.get('Requested_At') || row.get('Created_At') || '',
    approvedBy: row.get('Approved_By') || (status === 'APPROVED' ? reviewedBy : ''),
    approvedAt: row.get('Approved_At') || (status === 'APPROVED' ? reviewedAt : ''),
    generatedAt: row.get('Generated_At') || (status === 'APPROVED' ? reviewedAt : ''),
    expiresAt: row.get('Expires_At') || '',
    viewedAt: row.get('Viewed_At') || '',
    rejectedBy: row.get('Rejected_By') || (status === 'REJECTED' ? reviewedBy : ''),
    rejectedAt: row.get('Rejected_At') || (status === 'REJECTED' ? reviewedAt : ''),
    note: row.get('Note') || '',
    adminNote: row.get('Admin_Note') || '',
  };
}

export function publicPasswordRequest(record: PasswordRequestRecord) {
  return {
    requestId: record.requestId,
    username: record.username,
    requesterName: record.requesterName,
    department: record.department,
    status: record.status,
    requestedAt: record.requestedAt,
    approvedAt: record.approvedAt,
    generatedAt: record.generatedAt,
    expiresAt: record.expiresAt,
    rejectedAt: record.rejectedAt,
    note: record.note,
    adminNote: record.adminNote,
  };
}

export function thaiTimestamp(date = new Date()) {
  return date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
}

export function expiresInHours(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return thaiTimestamp(date);
}
