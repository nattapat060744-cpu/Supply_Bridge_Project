import 'server-only';
import {getOrFetch,invalidateCachePrefix} from './sheet-cache';

type Cell = string | number | null;
export type RowData = Record<string, Cell>;
type StoredRow = { id: string; rowNumber: number; revision: number; signature?:string; data: RowData };
class DatabaseRequestError extends Error { constructor(message:string,public code:string){super(message);} }

export async function supabaseFunction<T>(name: 'stock_bridge'|'stock_history'|'stock_orders'|'stock_order_changes'|'stock_register'|'stock_save_orders'|'stock_notifications'|'stock_sorting_page', args: unknown): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase server configuration');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Never log credentials, request payloads, or password hashes.
    throw new DatabaseRequestError(`Supabase ${name} failed (${response.status}, ${body.code || 'unknown'})`,body.code==='PT409'?'40001':body.code||'unknown');
  }
  return response.json() as Promise<T>;
}
export async function databaseRpc<T>(op:string,payload:unknown={}):Promise<T>{
  const result=await supabaseFunction<T>('stock_bridge',{op,payload});
  if(['save','insert','delete','archive'].includes(op))invalidateCachePrefix('database:orders:');
  return result;
}

export class DatabaseRow {
  private changes: RowData = {};
  constructor(private table: string, private record: StoredRow) {}
  get rowNumber() { return this.record.rowNumber; }
  get id() { return this.record.id; }
  get revision() { return this.record.revision; }
  get signature() { return this.record.signature; }
  expectRevision(value:unknown){
    if(typeof value!=='number'||!Number.isInteger(value)||value!==this.revision)throw new DatabaseRequestError('Stale or missing client revision','40001');
  }
  pendingPatch(){return {id:this.id,revision:this.revision,data:this.changes};}
  get(key: string): string {
    const value = String((key in this.changes ? this.changes[key] : this.record.data[key]) ?? '');
    // The old export has Buddhist years in ISO-shaped strings. Standardize API
    // dates for the existing UI; *_raw values in Postgres stay untouched.
    if (['Created_At','Created_At_P','Recv_Date'].includes(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const year = Number(value.slice(0,4));
      const normalized = `${year >= 2400 ? year-543 : year}${value.slice(4)}`.replace(' ','T');
      const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized.length === 10 ? normalized+'T00:00:00' : normalized}+07:00`;
      const date = new Date(zoned);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
    return value;
  }
  set(key: string, value: Cell) { this.changes[key] = value; }
  async save() {
    this.record = await databaseRpc<StoredRow>('save', { table: this.table, id: this.id, revision: this.revision, data: this.changes });
    this.changes = {};
  }
  async delete() { await databaseRpc('delete', { table: this.table, id: this.id, revision: this.revision }); }
}
export async function saveDatabaseRows(rows:DatabaseRow[]){
  await supabaseFunction('stock_save_orders',{payload:{items:rows.map(row=>row.pendingPatch())}});
  invalidateCachePrefix('database:orders:');
}

export class DatabaseTable {
  headerValues: string[] = [];
  constructor(public title: string) {}
  async getRows(): Promise<DatabaseRow[]> {
    if(this.title==='Orders'||this.title.startsWith('Orders_Archive_')){
      const rows=await getOrFetch(`database:orders:${this.title}`,()=>supabaseFunction<StoredRow[]>('stock_orders',{payload:{table:this.title}}));
      return rows.map(record=>new DatabaseRow(this.title,record));
    }
    const all: DatabaseRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await databaseRpc<StoredRow[]>('list', { table: this.title, offset, limit: 500 });
      all.push(...page.map(record => new DatabaseRow(this.title, record)));
      if (page.length < 500) return all;
    }
  }
  async addRows(rows: RowData[]) { return databaseRpc('insert', { table: this.title, rows }); }
  async addRow(row: RowData) { return this.addRows([row]); }
}

export class StockDatabase {
  sheetsByTitle: Record<string, DatabaseTable> = {};
  sheetsByIndex: DatabaseTable[] = [];
  async loadInfo() {
    const names = await getOrFetch('database:orders:tables',()=>databaseRpc<string[]>('tables'));
    this.sheetsByIndex = names.map(name => new DatabaseTable(name));
    this.sheetsByTitle = Object.fromEntries(this.sheetsByIndex.map(t => [t.title, t]));
  }
}

export async function getSpreadsheet() { const doc = new StockDatabase(); await doc.loadInfo(); return doc; }
export async function getOrdersSheet() { return new DatabaseTable('Orders'); }
export async function getPasswordRequestsSheet() { return new DatabaseTable('Password_Requests'); }
export async function getFirstSheet() { return getOrdersSheet(); }
