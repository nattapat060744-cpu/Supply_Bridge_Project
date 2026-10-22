import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
// Keep credentials in memory; never print the key or request headers.
const env=parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8'));
const key=env.SUPABASE_SECRET_KEY;
const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/stock_verify_save_probe',{
 method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},
 body:'{}',signal:AbortSignal.timeout(15000),
});
const result=await response.json();
console.log(JSON.stringify({status:response.status,...result}));
assert.equal(response.status,200);assert.equal(result.success,true);assert.equal(result.fixturesRolledBack,true);
