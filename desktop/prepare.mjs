import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('.next/standalone');
fs.rmSync(path.join(root,'.env.local'),{force:true});fs.rmSync(path.join(root,'.env'),{force:true});
fs.cpSync('.next/static',path.join(root,'.next/static'),{recursive:true});
// Never distribute environment credentials or build-machine state.
for(const p of fs.readdirSync(root))if(p.startsWith('.env'))fs.rmSync(path.join(root,p),{force:true});
fs.writeFileSync('desktop/package.json',JSON.stringify({name:'baihua-ai-trade',productName:'BAIHUA AI TRADE',version:'1.0.0',description:'Bilingual eyelash trade prospecting and CRM desktop demo',author:'BAIHUA AI TRADE',main:'main.cjs'},null,2));
// Resolve Linux build-time symlinks before shipping to Windows.
fs.rmSync('desktop-runtime',{recursive:true,force:true});
fs.cpSync(root,'desktop-runtime',{recursive:true,dereference:true});
function materialize(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);let stat=fs.lstatSync(p);if(stat.isSymbolicLink()){const target=fs.realpathSync(p);fs.unlinkSync(p);fs.cpSync(target,p,{recursive:true,dereference:true});stat=fs.lstatSync(p);}if(stat.isDirectory())materialize(p);}}
materialize('desktop-runtime');
