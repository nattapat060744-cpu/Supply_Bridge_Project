// Shared UI design tokens and components — used across all pages
export const DS = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  surface2: '#f9fafb',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  blue: '#2563eb',
  blueLight: '#eff6ff',
  blueMid: '#dbeafe',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  amber: '#d97706',
  amberLight: '#fffbeb',
  red: '#dc2626',
  redLight: '#fef2f2',
  purple: '#7c3aed',
  purpleLight: '#f5f3ff',
  radius: '12px',
  radiusLg: '16px',
  radiusXl: '20px',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
  font: "'Sarabun','Noto Sans Thai',Arial,sans-serif",
};

// Status config
export const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  PENDING:   { label: 'รอจัดซื้อ',    bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  ORDERED:   { label: 'กำลังส่ง',     bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  RECEIVED:  { label: 'รับบางส่วน',   bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
  COMPLETED: { label: 'เสร็จสิ้น',    bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  REJECTED:  { label: 'ปฏิเสธ',       bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  REJECT:    { label: 'ปฏิเสธ',       bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

export function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toUpperCase()] || STATUS_CONFIG.PENDING;
}
