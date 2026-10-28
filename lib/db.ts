import {Pool} from 'pg';
import {seed,Lead} from './leads';
type Result={rows:any[];rowCount:number|null};
type Connection={query:(sql:string,params?:any[])=>Promise<Result>;release:()=>void};
type DB={query:Connection['query'];connect:()=>Promise<Connection>;close?:()=>Promise<void>};
const globalDB=globalThis as unknown as {pool?:DB;ready?:Promise<void>;embedded?:Promise<DB>};
const pool=globalDB.pool??new Pool({connectionString:process.env.DATABASE_URL});globalDB.pool=pool;
async function selectPool():Promise<DB>{
if(!process.env.DESKTOP_DATA_DIR)return pool;
if(!globalDB.embedded)globalDB.embedded=(async()=>{const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite(process.env.DESKTOP_DATA_DIR!);await db.waitReady;const query:Connection['query']=async(sql,params)=>{const r=await db.query(sql,params);return {rows:r.rows,rowCount:r.rows.length||r.affectedRows||0}};return {query,connect:async()=>({query,release(){}}),close:()=>db.close()};})();
return globalDB.embedded;
}
export async function database(){const selected=await selectPool();if(!process.env.DESKTOP_DATA_DIR&&!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');if(!globalDB.ready)globalDB.ready=(async()=>{const client=await selected.connect();try{await client.query('BEGIN');if(!process.env.DESKTOP_DATA_DIR)await client.query('SELECT pg_advisory_xact_lock(894312)');await client.query('CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY, data jsonb NOT NULL)');await client.query('CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY)');const initialized=await client.query("SELECT key FROM app_meta WHERE key='seeded'");if(!initialized.rowCount){for(const lead of seed)await client.query('INSERT INTO leads VALUES ($1,$2) ON CONFLICT DO NOTHING',[lead.id,JSON.stringify(lead)]);await client.query("INSERT INTO app_meta VALUES ('seeded') ON CONFLICT DO NOTHING");}await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}})().catch(e=>{globalDB.ready=undefined;throw e});await globalDB.ready;return selected;}
export async function getLeads():Promise<Lead[]>{const db=await database();return(await db.query('SELECT data FROM leads ORDER BY id')).rows.map(r=>r.data);}

export async function closeDatabase(){if(globalDB.embedded){await(await globalDB.embedded).close?.();globalDB.embedded=undefined;}else if(pool instanceof Pool){await pool.end();}globalDB.ready=undefined;}
