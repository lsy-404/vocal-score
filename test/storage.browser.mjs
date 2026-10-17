import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=spawn(process.execPath,['test/storage.browser-server.mjs'],{stdio:['ignore','pipe','inherit']});
let browser;
try {
  const port=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Fixture server did not start.')),5000);
    server.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(Number(chunk.toString().trim()));});
    server.once('error',error=>{clearTimeout(timeout);reject(error);});
    server.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Fixture server exited with ${code}.`));});
  });
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext();
  const errors=[];
  const watch=page=>{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  };
  const firstPage=await context.newPage();
  watch(firstPage);
  const base=`http://127.0.0.1:${port}/`;
  await firstPage.goto(base);
  await firstPage.waitForFunction(()=>/^(PASS:|FAIL:)/.test(document.querySelector('#result')?.textContent ?? ''),null,{timeout:15000});
  assert.deepEqual(errors,[],`first storage run should not report browser errors: ${errors.join('; ')}`);
  assert.match(await firstPage.locator('#result').textContent(),/^PASS:/);
  await firstPage.close();
  const page=await context.newPage();
  watch(page);
  await page.goto(`${base}?verify=1`);
  await page.waitForFunction(()=>/^(PASS:|FAIL:)/.test(document.querySelector('#result')?.textContent ?? ''),null,{timeout:15000});
  assert.deepEqual(errors,[],`reload verification should not report browser errors: ${errors.join('; ')}`);
  const result=await page.locator('#result').textContent();
  assert.match(result,/^PASS:/);
  process.stdout.write(`${result}\n`);
} finally {
  await browser?.close();
  server.kill();
}
