import {getWorkPage} from '@/lib/work-page';
export const dynamic='force-dynamic';
export async function GET(req:Request){return getWorkPage(req,'purchase');}
