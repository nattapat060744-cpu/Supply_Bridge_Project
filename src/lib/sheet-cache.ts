/**
 * Cache สั้นๆ ในหน่วยความจำ (per server instance) สำหรับ "รวม" การอ่าน Google Sheets
 * ที่มาพร้อมกันจากหลาย user/หลายแท็บที่ poll ทุก 30 วิ ให้เหลือ Sheets API call จริงแค่ครั้งเดียวต่อช่วงเวลา
 *
 * หมายเหตุ: นี่ไม่ใช่ cache แบบ persistent/distributed (รีสตาร์ท server หรือมีหลาย instance จะไม่ sync กัน)
 * เหมาะกับ deploy แบบ instance เดียว (เช่น Vercel serverless ก็ยังช่วยลดได้ในระดับ request ที่มาพร้อมกันในวินาทีเดียวกัน)
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

/** TTL สั้นพอที่จะยังเห็นข้อมูลใหม่เร็ว แต่กันการยิงซ้ำตอน user หลายคนกด refresh/poll พร้อมกัน */
const DEFAULT_TTL_MS = 4000;

export async function getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  for(const [oldKey,old] of store)if(oldKey!==key&&!old.inFlight&&old.expiresAt<=now)store.delete(oldKey);
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry) {
    if (entry.inFlight) {
      // มีคนกำลังยิง request อยู่แล้ว รอผลลัพธ์เดียวกันแทนที่จะยิงซ้ำ
      return entry.inFlight;
    }
    if (entry.expiresAt > now) {
      return entry.value;
    }
  }

  const promise = fetcher();
  store.set(key, { value: undefined as unknown as T, expiresAt: 0, inFlight: promise });

  try {
    const value = await promise;
    if(store.get(key)?.inFlight===promise)store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  } catch (err) {
    if(store.get(key)?.inFlight===promise)store.delete(key);
    throw err;
  }
}

/** เรียกหลัง POST/PATCH/DELETE สำเร็จ เพื่อให้ GET ครั้งถัดไปเห็นข้อมูลล่าสุดทันที ไม่ต้องรอ TTL หมดอายุ */
export function invalidateCache(key: string) {
  store.delete(key);
}
export function invalidateCachePrefix(prefix:string){for(const key of store.keys())if(key.startsWith(prefix))store.delete(key);}
