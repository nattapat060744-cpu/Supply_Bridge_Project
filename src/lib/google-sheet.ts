import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

type GoogleSheetEnv = {
  email: string;
  privateKey: string;
  sheetId: string;
};

function getGoogleSheetEnv(): GoogleSheetEnv {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !sheetId) {
    throw new Error('Missing Google Sheets environment variables');
  }

  return { email, privateKey, sheetId };
}

export function getGoogleSheetsAuth() {
  const { email, privateKey } = getGoogleSheetEnv();
  return new JWT({
    email,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });
}

export async function getSpreadsheet(): Promise<GoogleSpreadsheet> {
  const { sheetId } = getGoogleSheetEnv();
  const doc = new GoogleSpreadsheet(sheetId, getGoogleSheetsAuth());
  await doc.loadInfo();
  return doc;
}

export async function getOrdersSheet(): Promise<GoogleSpreadsheetWorksheet> {
  const doc = await getSpreadsheet();
  const sheet = doc.sheetsByTitle['Orders'];
  if (!sheet) throw new Error('Missing Orders sheet');
  return sheet;
}

export async function getPasswordRequestsSheet(): Promise<GoogleSpreadsheetWorksheet> {
  const doc = await getSpreadsheet();
  const sheet = doc.sheetsByTitle['User_Requests'];
  if (!sheet) throw new Error('Missing User_Requests sheet');
  return sheet;
}

export async function getFirstSheet(): Promise<GoogleSpreadsheetWorksheet> {
  const doc = await getSpreadsheet();
  const sheet = doc.sheetsByIndex[0];
  if (!sheet) throw new Error('Missing first worksheet');
  return sheet;
}
