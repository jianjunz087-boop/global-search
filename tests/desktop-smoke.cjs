const { _electron: electron }=require('playwright');
const assert=require('node:assert/strict');
async function launch(){return electron.launch({args:['desktop'],timeout:90000});}
(async()=>{let app;try{
app=await launch();let page=await app.firstWindow({timeout:90000});await page.waitForSelector('tbody tr',{timeout:90000});assert.equal(await page.locator('tbody tr').count(),16);
await page.getByRole('button',{name:'View Lash Atelier · DEMO 1',exact:true}).click();await page.locator('.drawer textarea').fill('Windows desktop restart verified');await page.getByRole('button',{name:'Save follow-up'}).click();await page.getByRole('status').filter({hasText:'saved'}).waitFor();await app.close();app=undefined;
app=await launch();page=await app.firstWindow({timeout:90000});await page.waitForSelector('tbody tr',{timeout:90000});await page.getByRole('button',{name:'View Lash Atelier · DEMO 1',exact:true}).click();assert.equal(await page.locator('.drawer textarea').inputValue(),'Windows desktop restart verified');console.log('Windows Electron launch and CRM restart persistence passed');
}finally{if(app)await app.close()}})().catch(e=>{console.error(e);process.exitCode=1});
