import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { NextResponse } from 'next/server';

const getDoc = async () => {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, auth);
  await doc.loadInfo();
  return doc;
};

export async function GET() {
  try {
    const doc = await getDoc();
    let allHistory: any[] = [];

    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      const rows = await sheet.getRows();

      const sheetData = rows
        .filter(r => {
          // ปรับให้เป็นตัวใหญ่และตัดช่องว่างก่อนเช็ค COMPLETED
          const status = r.get('Status')?.toString().trim().toUpperCase();
          return status === 'COMPLETED'; 
        })
        .map(r => ({
          rowId: r.rowNumber,
          sheetName: sheet.title,
          groupId: r.get('Group_ID'),
          date: r.get('Created_At'), 
          recvDate: r.get('Recv_Date'), 
          productID: r.get('Product_ID'),
          productName: r.get('Product_Name'),
          supplier: r.get('Supplier'),
          orderCarton: r.get('Order_Carton'),
          cartonUnit: r.get('Carton_Unit'),
          qtyPerCarton: r.get('Qty_Per_Carton'),
          innerUnit: r.get('Inner_Unit'),
          recvCarton: r.get('Recv_Carton'),
          recvQty: r.get('Recv_Qty'),
          receiver: r.get('Receiver_Name'),
          note: r.get('Note_Purchase'),
          noteStock: r.get('Note_Stock'),
          // จุดสำคัญ: บังคับให้เป็นตัวใหญ่เสมอ เพื่อให้หน้าบ้านเช็คเงื่อนไขง่ายขึ้น
          status: r.get('Status')?.toString().trim().toUpperCase()
        }));

      allHistory = [...allHistory, ...sheetData];
    }

    // เรียงจากใหม่ไปเก่า
    allHistory.reverse();
    return NextResponse.json(allHistory);
  } catch (error: any) {
    console.error("History API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}