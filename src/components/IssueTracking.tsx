'use client';

export interface IssueTrackingItem {
  rowId?: number | string;
  id?: string | number;
  productId?: string;
  Product_ID?: string;
  productID?: string;
  name?: string;
  Product_Name?: string;
  productName?: string;
  supplier?: string;
  Supplier?: string;
  orderCarton?: string | number;
  cartonUnit?: string;
  qtyPerCarton?: string | number;
  innerUnit?: string;
  recvCarton?: string | number;
  Recv_Carton?: string | number;
  Recv_Qty?: string | number;
  Recv_Qty_Unit?: string;
  Note_Stock?: string;
  status?: string;
  Status?: string;
  Order_Carton?: string | number;
  Qty_Per_Carton?: string | number;
}

interface IssueTrackingProps<T extends IssueTrackingItem> {
  items: T[];
  canEdit?: boolean;
  onEdit?: (item: T) => void;
  onForceComplete?: (item: T) => void;
}

const toNumber = (value: string | number | undefined) => Number(value || 0);
const text = (...values: Array<string | number | undefined>) =>
  values.find((value) => value !== undefined && value !== '')?.toString() || '-';

const getProductId = (item: IssueTrackingItem) =>
  text(item.productID, item.productId, item.Product_ID, item.id);

const getProductName = (item: IssueTrackingItem) =>
  text(item.productName, item.Product_Name, item.name);

const getSupplier = (item: IssueTrackingItem) =>
  text(item.supplier, item.Supplier);

const getReceivedCarton = (item: IssueTrackingItem) =>
  toNumber(item.recvCarton ?? item.Recv_Carton);

const getOrderedCarton = (item: IssueTrackingItem) =>
  toNumber(item.orderCarton ?? item.Order_Carton);

const getExpectedInner = (item: IssueTrackingItem) =>
  toNumber(item.qtyPerCarton ?? item.Qty_Per_Carton);

const getStatus = (item: IssueTrackingItem) =>
  (item.status || item.Status || '').toUpperCase();

const isClosedIssue = (item: IssueTrackingItem) =>
  item.Note_Stock?.includes('ตัดบิลจบ');

const hasReceivedAmount = (item: IssueTrackingItem) =>
  getReceivedCarton(item) > 0 || toNumber(item.Recv_Qty) > 0;

const isIssueItem = (item: IssueTrackingItem) => {
  if (isClosedIssue(item)) return false;

  const status = getStatus(item);
  const isProcessed = ['ORDERED', 'COMPLETED', 'RECEIVED'].includes(status);
  if (!isProcessed) return false;

  if (status === 'ORDERED' && !hasReceivedAmount(item)) return false;

  const receivedCarton = getReceivedCarton(item);
  const orderedCarton = getOrderedCarton(item);
  const receivedInner = toNumber(item.Recv_Qty);
  const expectedInner = getExpectedInner(item);

  return receivedCarton !== orderedCarton || receivedInner !== expectedInner;
};

function getUniqueActiveIssues<T extends IssueTrackingItem>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (!isIssueItem(item)) return false;

    const productId = getProductId(item);
    if (seen.has(productId)) return false;
    seen.add(productId);

    return true;
  });
}

function DiffBadge({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: 'danger' | 'success' | 'warning' | 'info';
}) {
  if (value === 0) return null;

  const toneClass = {
    danger: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
      <span>{label}</span>
      <span className="tabular-nums">{Math.abs(value)}</span>
      <span>{unit}</span>
    </span>
  );
}

export default function IssueTracking<T extends IssueTrackingItem>({
  items,
  canEdit = false,
  onEdit,
  onForceComplete,
}: IssueTrackingProps<T>) {
  const activeIssues = getUniqueActiveIssues(items);

  if (activeIssues.length === 0) return null;

  const cartonShortage = activeIssues.filter((item) => getReceivedCarton(item) < getOrderedCarton(item)).length;
  const cartonOverage = activeIssues.filter((item) => getReceivedCarton(item) > getOrderedCarton(item)).length;

  return (
    <section className="mb-6 rounded-lg border border-red-100 bg-white shadow-sm" aria-label="ติดตามรายการที่มีปัญหา">
      <div className="grid gap-3 border-b border-slate-100 p-3 sm:grid-cols-[1fr_auto] sm:items-center md:p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
              Issue
            </span>
            <h2 className="text-sm font-bold text-slate-950 md:text-base">
              ติดตามรายการที่มีปัญหา
            </h2>
            {!canEdit && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-500">
                อ่านอย่างเดียว
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            รายการที่ยอดสั่งและยอดรับไม่ตรงกัน รอสต็อกตรวจสอบและปิดงาน
          </p>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-center">
          <div className="min-w-16 px-2.5 py-1.5">
            <p className="text-[11px] font-bold text-slate-500">ทั้งหมด</p>
            <p className="text-base font-bold tabular-nums text-slate-950">{activeIssues.length}</p>
          </div>
          <div className="min-w-16 border-l border-slate-200 px-2.5 py-1.5">
            <p className="text-[11px] font-bold text-red-500">ขาด</p>
            <p className="text-base font-bold tabular-nums text-red-600">{cartonShortage}</p>
          </div>
          <div className="min-w-16 border-l border-slate-200 px-2.5 py-1.5">
            <p className="text-[11px] font-bold text-emerald-600">เกิน</p>
            <p className="text-base font-bold tabular-nums text-emerald-700">{cartonOverage}</p>
          </div>
        </div>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto p-3 custom-scrollbar-h md:p-4">
        {activeIssues.map((item, index) => {
          const productId = getProductId(item);
          const productName = getProductName(item);
          const supplier = getSupplier(item);
          const orderedCarton = getOrderedCarton(item);
          const receivedCarton = getReceivedCarton(item);
          const expectedInner = getExpectedInner(item);
          const receivedInner = toNumber(item.Recv_Qty);
          const diffCarton = receivedCarton - orderedCarton;
          const diffInner = receivedInner - expectedInner;
          const cartonUnit = item.cartonUnit || 'ลัง';
          const innerUnit = item.innerUnit || item.Recv_Qty_Unit || 'ชิ้น';
          const status = getStatus(item) || 'WAITING';

          return (
            <article
              key={`issue-${productId}-${item.rowId || index}`}
              className="flex min-h-0 w-[17rem] shrink-0 snap-start flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-red-200 hover:shadow-md sm:w-[18rem]"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-slate-500">ID: {productId}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-950">
                    {productName}
                  </h3>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {status}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 p-3">
                {supplier !== '-' && (
                  <p className="truncate text-[11px] font-bold text-slate-400">
                    Supplier: <span className="text-slate-600">{supplier}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200">
                  <div className="bg-slate-50 p-2.5">
                    <p className="text-[11px] font-bold text-slate-500">ยอดสั่ง</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-950">
                      {orderedCarton}
                    </p>
                    <p className="text-[11px] text-slate-500">{cartonUnit}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      บรรจุ {expectedInner} {innerUnit}
                    </p>
                  </div>
                  <div className="border-l border-slate-200 bg-red-50/60 p-2.5">
                    <p className="text-[11px] font-bold text-red-500">ยอดรับจริง</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-red-700">
                      {receivedCarton}
                    </p>
                    <p className="text-[11px] text-red-500">{cartonUnit}</p>
                    <p className="mt-1 text-[11px] text-red-600">
                      บรรจุ {receivedInner} {innerUnit}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <DiffBadge
                    label={diffCarton < 0 ? 'ลังขาด' : 'ลังเกิน'}
                    value={diffCarton}
                    unit={cartonUnit}
                    tone={diffCarton < 0 ? 'danger' : 'success'}
                  />
                  <DiffBadge
                    label={diffInner < 0 ? 'เศษขาด' : 'เศษเกิน'}
                    value={diffInner}
                    unit={innerUnit}
                    tone={diffInner < 0 ? 'warning' : 'info'}
                  />
                </div>

                {item.Note_Stock && (
                  <p className="line-clamp-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold leading-5 text-amber-800">
                    {item.Note_Stock}
                  </p>
                )}
              </div>

              {canEdit && (
                <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 p-2.5">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="rounded-md bg-slate-950 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                    >
                      แก้ไข / รับเพิ่ม
                    </button>
                  )}
                  {onForceComplete && (
                    <button
                      type="button"
                      onClick={() => onForceComplete(item)}
                      className="rounded-md border border-red-200 bg-white px-3 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-[0.98]"
                    >
                      ตัดบิล
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
