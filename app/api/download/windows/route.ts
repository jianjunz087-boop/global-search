import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const runtime='nodejs';
const filename='BAIHUA-AI-TRADE-Setup-1.0.0-win-x64.exe';
async function respond(req:Request,head=false){try{const file=process.env.DESKTOP_INSTALLER_PATH||path.join(process.cwd(),'dist/windows',filename);const info=await stat(/* turbopackIgnore: true */ file);if(!info.isFile())throw Error();if(new URL(req.url).searchParams.has('checksum')){if(head)return new Response(null,{headers:{'Content-Type':'text/plain; charset=utf-8'}});const hash=createHash('sha256');for await(const chunk of createReadStream(/* turbopackIgnore: true */ file))hash.update(chunk);return new Response(`${hash.digest('hex')}  ${filename}\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="SHA256SUMS.txt"'}})}return new Response(head?null:Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file)) as ReadableStream,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':String(info.size),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}catch{return Response.json({error:'Installer not available on this server. Check the GitHub release page.'},{status:503})}}
export async function GET(req:Request){return respond(req)}
export async function HEAD(req:Request){return respond(req,true)}
