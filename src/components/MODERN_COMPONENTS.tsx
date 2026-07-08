'use client';
import { useState, useMemo } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * 📊 IMPROVED MODERN TABLE COMPONENT
 * 
 * Features:
 * ✓ Better spacing & padding
 * ✓ Alternating row colors
 * ✓ Hover effects
 * ✓ Status badges
 * ✓ Action buttons
 * ✓ Sorting
 * ✓ Pagination
 * ✓ Responsive design
 */

type TableRow = Record<string, unknown>;

function toSortableValue(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();

  const text = String(value ?? '');
  const numberValue = Number(text);
  return text.trim() !== '' && Number.isFinite(numberValue)
    ? numberValue
    : text.toLowerCase();
}

interface TableColumn<T extends TableRow = TableRow> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

interface TableProps<T extends TableRow = TableRow> {
  columns: TableColumn<T>[];
  data: T[];
  title?: string;
  onRowClick?: (row: T) => void;
  itemsPerPage?: number;
}

export default function ModernTable<T extends TableRow = TableRow>({
  columns,
  data,
  title,
  onRowClick,
  itemsPerPage = 10,
}: TableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(item =>
      columns.some(col =>
        String(item[col.key]).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = toSortableValue(a[sortConfig.key]);
      const bValue = toSortableValue(b[sortConfig.key]);

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {title && (
          <div>
            <h2 className="text-2xl font-black text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600 mt-1">
              แสดง {paginatedData.length} จาก {sortedData.length} รายการ
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="ค้นหา..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-64 px-4 py-2 pl-10 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full">
          {/* Table Header */}
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-left ${column.width || ''}`}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-2 text-xs font-black text-slate-600 uppercase tracking-wider hover:text-slate-900 transition-colors"
                    >
                      {column.label}
                      <svg className={`w-3 h-3 transition-transform ${
                        sortConfig?.key === column.key
                          ? sortConfig.direction === 'asc'
                            ? ''
                            : 'rotate-180'
                          : 'text-slate-300'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 7a1 1 0 011-1h12a1 1 0 011 1v.01a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                      {column.label}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  } hover:bg-blue-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4">
                      <div className="text-sm text-slate-900 font-medium">
                        {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="font-semibold">ไม่พบข้อมูล</p>
                    <p className="text-xs mt-1">ลองค้นหาคำอื่น หรือ เพิ่มข้อมูลใหม่</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-sm text-slate-600 font-semibold">
            หน้า <span className="font-black text-slate-900">{currentPage}</span> จาก <span className="font-black text-slate-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ← ย้อนกลับ
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 🧩 USAGE EXAMPLE:
 * 
 * const columns: TableColumn[] = [
 *   { key: 'id', label: 'ID', width: 'w-20' },
 *   { key: 'name', label: 'ชื่อ', sortable: true },
 *   { key: 'email', label: 'Email', sortable: true },
 *   { 
 *     key: 'status', 
 *     label: 'สถานะ',
 *     render: (value) => (
 *       <span className="badge-success">{value}</span>
 *     )
 *   },
 * ];
 * 
 * const data = [
 *   { id: 1, name: 'สมชาย', email: 'somchai@example.com', status: 'Active' },
 *   // ...
 * ];
 * 
 * <ModernTable columns={columns} data={data} title="ผู้ใช้งาน" />
 */

/**
 * ═══════════════════════════════════════════════════════
 * MODERN UI COMPONENTS - COPY & PASTE READY
 * ═══════════════════════════════════════════════════════
 */

// 🏷️ STATUS BADGE COMPONENT
export function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-700',
  };

  const labels = {
    pending: '⏳ รอดำเนินการ',
    approved: '✅ อนุมัติแล้ว',
    rejected: '❌ ปฏิเสธ',
    processing: '🔄 กำลังดำเนินการ',
    completed: '✓ เสร็จสิ้น',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// 🔘 MODERN BUTTON COMPONENT
interface ModernButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
}

export function ModernButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  ...props
}: ModernButtonProps) {
  const baseStyles = 'font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4';

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/20 shadow-lg hover:shadow-xl',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500/20 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/20 shadow-lg hover:shadow-xl',
    ghost: 'text-slate-700 hover:bg-slate-100 focus:ring-slate-500/20',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 text-xs gap-1',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-2',
  };

  return (
    <button className={`inline-flex items-center ${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

// 📝 MODERN INPUT COMPONENT
interface ModernInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function ModernInput({ label, error, icon, ...props }: ModernInputProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          className={`w-full ${icon ? 'pl-10' : 'px-4'} py-3 bg-slate-50 border-2 rounded-xl outline-none font-semibold transition-all ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
              : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
          }`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
    </div>
  );
}

// 📊 SUMMARY CARD COMPONENT
interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down'; value: number };
}

export function SummaryCard({ icon, label, value, trend }: SummaryCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
            trend.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

/**
 * 🎯 COPY THESE COMPONENTS TO YOUR PROJECT:
 * 
 * src/components/
 * ├── Table.tsx (ModernTable)
 * ├── Badge.tsx (StatusBadge)
 * ├── Button.tsx (ModernButton)
 * ├── Input.tsx (ModernInput)
 * └── Card.tsx (SummaryCard)
 */
