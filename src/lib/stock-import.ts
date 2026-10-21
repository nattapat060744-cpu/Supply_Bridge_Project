import * as XLSX from 'xlsx';
export type StockImportRow = Record<string,string|number|boolean|null|undefined>;
export function parseStockImport(sheet:XLSX.WorkSheet):StockImportRow[]{
  const rows=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',blankrows:true});
  const header=rows.findIndex(row=>row.includes('ID อ้างอิง')&&row.includes('รับจริง (กล่อง)'));
  if(header<0)throw new Error('ไม่พบหัวตารางใบตรวจรับ');
  return XLSX.utils.sheet_to_json<StockImportRow>(sheet,{range:header}).filter(row=>row['ID อ้างอิง']!==undefined && ((row['รับจริง (กล่อง)']!==undefined && row['รับจริง (กล่อง)']!=='') || (row['รับจริง (ชิ้น)']!==undefined && row['รับจริง (ชิ้น)']!=='')));
}
