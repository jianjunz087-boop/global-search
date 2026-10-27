export function extractWhatsApp(results:unknown,website:string){
 const domain=new URL(website).hostname.toLowerCase().replace(/^www\./,'');
 if(!Array.isArray(results))return null;
 for(const r of results){
  if(typeof r?.link!=='string')continue;
  let source:URL;try{source=new URL(r.link)}catch{continue}
  if(!['https:','http:'].includes(source.protocol)||source.hostname.toLowerCase().replace(/^www\./,'')!==domain)continue;
  const text=[r.snippet,r.title].filter(x=>typeof x==='string').join(' ');
  const linked=text.match(/(?:https?:\/\/)?wa\.me\/(\d{6,15})(?!\d)/i)||text.match(/api\.whatsapp\.com\/send\?phone=\+?(\d{6,15})(?!\d)/i);
  const labeled=text.match(/whats\s*app\s*(?:business\s*)?[:：-]?\s*(\+\d[\d ().-]{5,25}\d)/i);
  const number=linked?.[1]||labeled?.[1]?.replace(/\D/g,'');
  if(number&&/^[1-9]\d{5,14}$/.test(number))return {whatsapp:number,whatsappSource:source.href};
 }
 return null;
}
