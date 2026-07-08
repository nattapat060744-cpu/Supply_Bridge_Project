import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';
import { safeErrorResponse } from '@/lib/api-utils';
import { getOrFetch } from '@/lib/sheet-cache';

export const revalidate = 0; 

export async function GET() {
  try {
    // ✅ cache สั้นๆ 4 วินาที กัน user หลายคนเปิดหน้า history พร้อมกันยิง Sheets API ซ้ำ
    const data = await getOrFetch('history:list', async () => {
      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
      await doc.loadInfo();
      const historySheets = doc.sheetsByIndex.filter(
        (sheet) => sheet.title === 'Orders' || sheet.title.startsWith('Orders_Archive_')
      );

      const allRows = [];
      for (const sheet of historySheets) {
        const rows = await sheet.getRows();
        allRows.push(
          ...rows.map(row => ({
            row,
            sourceSheet: sheet.title,
          }))
        );
      }

      return allRows.map(({ row, sourceSheet }) => {
        return {
          rowId: row.rowNumber,
          sourceSheet,
          status: (row.get('Status') || 'PENDING').toString().trim().toUpperCase(),
          groupName: row.get('Group_ID') || '',
          productName: row.get('Product_Name') || '',
          supplier: row.get('Supplier') || '',
          orderCarton: row.get('Order_Carton') || '0',
          cartonUnit: row.get('Carton_Unit') || 'กล่อง',

          // ✅ จุดที่ต้องเช็ค: ต้องตรงกับหัวตารางใน Excel เป๊ะๆ
          qtyPerCarton: row.get('Qty_Per_Carton') || '0', 
          innerUnit: row.get('Inner_Unit') || 'ชิ้น',

          recvCarton: row.get('Recv_Carton') || '-',
          recvUnit: row.get('Recv_Unit') || 'กล่อง',
          recvQty: row.get('Recv_Qty') || '0',
          recvQtyUnit: row.get('Recv_Qty_Unit') || 'ชิ้น',
          invoiceNo: row.get('Invoice_No') || '-',
          receiver: row.get('Receiver_Name') || '-',
          recvDate: row.get('Recv_Date') || '-',
          createdAt: row.get('Created_At') || '',

          // ✅ ดึง Note ให้ครบ 3 แผนก
          noteRequest: row.get('Note_Request') || '',
          notePurchase: row.get('Note_Purchase') || '',
          noteStock: row.get('Note_Stock') || '',
        };
      }).reverse();
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    return safeErrorResponse(error, 'history.GET');
  }
}
