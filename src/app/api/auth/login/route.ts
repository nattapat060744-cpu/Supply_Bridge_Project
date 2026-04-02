import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    // 1. รับค่าจาก Request
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบครับ' }, { status: 400 });
    }

    // 2. ตรวจสอบ Spreadsheet ID
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return Response.json({ 
        success: false, 
        message: 'ระบบขัดข้อง: ไม่พบ SPREADSHEET_ID ในไฟล์ .env ครับ' 
      }, { status: 500 });
    }

    // 3. เตรียม Credentials
    const credentialsRaw = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    let credentials;
    if (credentialsRaw && credentialsRaw !== "undefined") {
      credentials = JSON.parse(credentialsRaw);
    } else if (privateKey && clientEmail) {
      credentials = {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      };
    } else {
      return Response.json({ success: false, message: 'ระบบขัดข้อง: ไม่พบ Google Credentials' }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 4. เรียกข้อมูลจาก Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Users!A2:D100', 
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return Response.json({ message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' }, { status: 404 });
    }

    // 5. ค้นหา User
    const user = rows.find((row: any[]) => {
        const dbUser = row[0]?.toString().trim();
        const dbPass = row[1]?.toString().trim();
        return dbUser === username.toString().trim() && dbPass === password.toString().trim();
    });

    if (user) {
      // --- จุดที่ปรับปรุง: ส่งวันที่ในฟอร์แมตที่ Navbar เข้าใจง่าย ---
      const loginDate = new Date().toLocaleDateString('th-TH');

      return Response.json({
        success: true,
        user: {
          username: user[0],
          name: user[2],
          department: user[3]?.toString().trim().toUpperCase(),
          loginDate: loginDate 
        }
      });
    }

    return Response.json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้องครับ' }, { status: 401 });

  } catch (error: any) {
    console.error('Login Error:', error);
    return Response.json({ message: 'ระบบขัดข้อง: ' + error.message }, { status: 500 });
  }
}