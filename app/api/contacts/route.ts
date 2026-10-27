import {database} from '@/lib/db';
import {extractWhatsApp} from '@/lib/contacts';
export async function POST(req:Request){
 let body;try{body=await req.json()}catch{return Response.json({code:'INVALID_INPUT'},{status:400})}
 if(typeof body?.id!=='string')return Response.json({code:'INVALID_INPUT'},{status:400});
 const key=process.env.SERPAPI_API_KEY?.trim();if(!key)return Response.json({code:'MISSING_API_KEY'},{status:503});
 try{
  const db=await database();const row=await db.query('SELECT data FROM leads WHERE id=$1',[body.id]);const lead=row.rows[0]?.data;
  if(!lead||lead.mock)return Response.json({code:'INVALID_INPUT'},{status:400});
  const domain=new URL(lead.website).hostname.replace(/^www\./,'');
  const url=new URL('https://serpapi.com/search.json');url.searchParams.set('engine','google');url.searchParams.set('q',`site:${domain} ("WhatsApp" OR "wa.me" OR "api.whatsapp.com")`);url.searchParams.set('num','10');url.searchParams.set('api_key',key);
  let response;try{response=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'})}catch{return Response.json({code:'NETWORK_ERROR'},{status:502})}
  if(!response.ok)return Response.json({code:[401,403].includes(response.status)?'INVALID_API_KEY':[402,429].includes(response.status)?'QUOTA_EXCEEDED':'PROVIDER_ERROR'},{status:502});
  const data=await response.json();if(data.error)return Response.json({code:/key|unauthori/i.test(String(data.error))?'INVALID_API_KEY':/quota|limit|credit|searches|run out/i.test(String(data.error))?'QUOTA_EXCEEDED':'PROVIDER_ERROR'},{status:502});
  const contact=extractWhatsApp(data.organic_results,lead.website);
  if(!contact){await db.query('UPDATE leads SET data=data || $2::jsonb WHERE id=$1',[lead.id,JSON.stringify({whatsappCheckedAt:new Date().toISOString()})]);return Response.json({found:false});}
  const saved=await db.query('UPDATE leads SET data=data || $2::jsonb WHERE id=$1 RETURNING data',[lead.id,JSON.stringify({...contact,whatsappCheckedAt:new Date().toISOString()})]);
  return Response.json({found:true,lead:saved.rows[0].data});
 }catch{return Response.json({code:'DATABASE_ERROR'},{status:503})}
}
