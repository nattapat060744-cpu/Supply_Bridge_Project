import { StockDatabase, DatabaseRow, databaseRpc } from './database';


export interface ArchiveCandidate {
  rowNumber: number;
  archiveSheet: string;
  recvDate: string;
  productId: string;
  productName: string;
}

export interface ArchiveResult {
  mode: 'preview' | 'run';
  cutoffDays: number;
  cutoffIso: string;
  totalRows: number;
  eligibleCount: number;
  archivedCount: number;
  skippedCount: number;
  archiveSheets: Record<string, number>;
  candidates: ArchiveCandidate[];
}

type SheetRow = DatabaseRow;

const DEFAULT_ARCHIVE_DAYS = 180;
const MAX_ARCHIVE_ROWS_PER_RUN = 500;
const ORDERS_SHEET_TITLE = 'Orders';



export async function getOrdersDocument() {
  const doc = new StockDatabase();
  await doc.loadInfo();
  return doc;
}

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function parseSheetDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^(2[4-9]\d{2})(?=-)/, y => String(Number(y)-543));
  if (!trimmed || trimmed === '-') return null;

  const datePart = trimmed.split(/[,\s]+/)[0];
  const slashMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, rawYear] = slashMatch;
    const yearNumber = Number(rawYear);
    const year = yearNumber > 2400 ? yearNumber - 543 : yearNumber;
    const parsed = new Date(year, Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function archiveYearFromDate(date: Date) {
  return date.getFullYear();
}

function isClosedIssue(row: SheetRow) {
  return (row.get('Note_Stock') || '').toString().includes('ตัดบิลจบ');
}

function hasUnresolvedMismatch(row: SheetRow) {
  const orderedCarton = toNumber(row.get('Order_Carton'));
  const receivedCarton = toNumber(row.get('Recv_Carton'));
  const expectedInner = toNumber(row.get('Qty_Per_Carton'));
  const receivedInner = toNumber(row.get('Recv_Qty'));

  return (orderedCarton !== receivedCarton || expectedInner !== receivedInner) && !isClosedIssue(row);
}

function getCandidates(rows: SheetRow[], cutoffDate: Date) {
  return rows
    .map((row) => {
      const status = (row.get('Status') || '').toString().trim().toUpperCase();
      const recvDate = (row.get('Recv_Date') || '').toString();
      const parsedRecvDate = parseSheetDate(recvDate);

      if (status !== 'COMPLETED') return null;
      if (!parsedRecvDate) return null;
      if (parsedRecvDate >= cutoffDate) return null;
      if (hasUnresolvedMismatch(row)) return null;

      const archiveYear = archiveYearFromDate(parsedRecvDate);
      return {
        row,
        rowNumber: row.rowNumber,
        archiveSheet: `Orders_Archive_${archiveYear}`,
        recvDate,
        productId: (row.get('Product_ID') || '').toString(),
        productName: (row.get('Product_Name') || '').toString(),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
}

export async function archiveCompletedOrders({
  mode = 'preview',
  cutoffDays = DEFAULT_ARCHIVE_DAYS,
  archivedBy = 'system',
}: {
  mode?: 'preview' | 'run';
  cutoffDays?: number;
  archivedBy?: string;
} = {}): Promise<ArchiveResult> {
  const doc = await getOrdersDocument();
  const ordersSheet = doc.sheetsByTitle[ORDERS_SHEET_TITLE];
  if (!ordersSheet) throw new Error(`Missing sheet: ${ORDERS_SHEET_TITLE}`);

  const rows = await ordersSheet.getRows();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

  const candidates = getCandidates(rows, cutoffDate);
  const archiveSheets = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.archiveSheet] = (acc[candidate.archiveSheet] || 0) + 1;
    return acc;
  }, {});

  const baseResult = {
    cutoffDays,
    cutoffIso: cutoffDate.toISOString(),
    totalRows: rows.length,
    eligibleCount: candidates.length,
    skippedCount: rows.length - candidates.length,
    archiveSheets,
    candidates: candidates.slice(0, 20).map(({ rowNumber, archiveSheet, recvDate, productId, productName }) => ({
      rowNumber,
      archiveSheet,
      recvDate,
      productId,
      productName,
    })),
  };

  if (mode === 'preview' || candidates.length === 0) {
    return {
      mode: 'preview',
      archivedCount: 0,
      ...baseResult,
    };
  }

  const selected = candidates.slice(0, MAX_ARCHIVE_ROWS_PER_RUN);
  await databaseRpc('archive', { archivedBy, items: selected.map(c => ({ id: c.row.id, revision: c.row.revision, archiveSheet: c.archiveSheet })) });

  return {
    mode: 'run',
    archivedCount: selected.length,
    ...baseResult,
    eligibleCount: candidates.length,
  };
}
