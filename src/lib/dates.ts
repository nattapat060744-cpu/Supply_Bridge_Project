/** Legacy business timestamps are Bangkok time; ISO inputs retain their offset. */
export function parseBusinessDate(value: string | number | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (!value) return new Date(0);
  if (typeof value === 'number') return new Date(value);
  const slash = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (slash) {
    const [,day,month,year,hour='00',minute='00',second='00']=slash;
    const normalizedYear=Number(year)>=2400?Number(year)-543:Number(year);
    return new Date(`${normalizedYear}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hour.padStart(2,'0')}:${minute}:${second}+07:00`);
  }
  const normalized=value.trim().replace(/^(2[4-9]\d{2})(?=-)/,y=>String(Number(y)-543)).replace(' ','T');
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)?normalized:normalized.length===10?`${normalized}T00:00:00+07:00`:`${normalized}+07:00`);
}
export function formatBusinessDate(value:string|undefined):string{
  if(!value||value==='-')return '—';
  const date=parseBusinessDate(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'—';
}
