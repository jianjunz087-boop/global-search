const {app,BrowserWindow,dialog,utilityProcess,Menu,safeStorage,ipcMain}=require('electron');
const path=require('node:path');const fs=require('node:fs');const net=require('node:net');
let server,window,stopping=false;let origin='';
const dataDir=()=>path.join(app.getPath('userData'),'postgres-data');
const keyPath=()=>path.join(app.getPath('userData'),'search-key.enc');
function readKey(){try{if(safeStorage.isEncryptionAvailable()&&fs.existsSync(keyPath()))return safeStorage.decryptString(fs.readFileSync(keyPath()));}catch{}return '';}
function configureKey(){const w=new BrowserWindow({width:540,height:420,parent:window,modal:true,resizable:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});w.loadFile(path.join(__dirname,'settings.html'));}
ipcMain.handle('open-search-settings',async(event)=>{if(!window||event.sender!==window.webContents||new URL(event.sender.getURL()).origin!==origin)throw Error('Not authorized');configureKey();});
ipcMain.handle('save-search-key',async(event,key)=>{const sender=BrowserWindow.fromWebContents(event.sender);if(!sender||!event.sender.getURL().startsWith('file:')||!event.sender.getURL().endsWith('/settings.html'))throw Error('Not authorized');if(typeof key!=='string'||key.length<10||key.length>500)throw Error('Invalid key');if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure credential storage unavailable');fs.writeFileSync(keyPath(),safeStorage.encryptString(key));app.relaunch();app.exit(0);});
async function port(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
async function ready(url){for(let i=0;i<120;i++){try{const r=await fetch(url+'/api/leads');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,500))}throw Error('Local database did not become ready. Restart the app; if this persists contact support.');}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
app.whenReady().then(async()=>{try{
const base=app.isPackaged?path.join(process.resourcesPath,'server'):path.join(__dirname,'..','.next','standalone');const p=await port();origin=`http://127.0.0.1:${p}`;fs.mkdirSync(dataDir(),{recursive:true});
const env={...process.env,PORT:String(p),HOSTNAME:'127.0.0.1',NODE_ENV:'production',DESKTOP_DATA_DIR:dataDir()};delete env.DATABASE_URL;delete env.NODE_OPTIONS;const key=readKey();if(key)env.SERPAPI_API_KEY=key;
server=utilityProcess.fork(path.join(base,'server.js'),[],{cwd:base,env,stdio:'pipe'});let log='';server.stdout?.on('data',()=>{});server.stderr?.on('data',b=>{log=(log+b.toString()).slice(-2000)});server.on('exit',()=>{if(!stopping){dialog.showErrorBox('BAIHUA AI TRADE','The local service stopped. Please restart the application.');app.quit()}});
window=new BrowserWindow({width:1440,height:960,minWidth:390,minHeight:650,backgroundColor:'#f7f9f6',show:false,title:'BAIHUA AI TRADE',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
function openExternal(url){try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol))require('electron').shell.openExternal(parsed.href)}catch{}}
window.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'}});window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();openExternal(url)}});window.webContents.session.on('will-download',(_event,item)=>{item.once('done',(_e,state)=>{if(state==='completed')dialog.showMessageBox(window,{type:'info',message:'Excel exported / Excel 已导出',detail:item.getSavePath()})})});
Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'BAIHUA AI TRADE',submenu:[{label:'Configure SerpAPI key / 配置搜索密钥',click:configureKey},{label:'Open data folder / 打开数据目录',click:()=>require('electron').shell.openPath(app.getPath('userData'))},{type:'separator'},{role:'quit'}]},{label:'Edit / 编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View / 视图',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
await ready(origin);await window.loadURL(origin);window.show();
}catch(e){dialog.showErrorBox('BAIHUA AI TRADE',e.message);app.quit()}});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{stopping=true;if(server)server.kill()});
}
