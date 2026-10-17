import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['test/jianpu.browser-server.cjs'],{stdio:['ignore','pipe','inherit']});
let browser;
try{
  const port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Fixture server did not start.')),5000);server.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(Number(chunk.toString().trim()));});server.once('error',reject);});
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`);await page.waitForFunction(()=>/^(PASS:|FAIL:)/.test(document.querySelector('#result')?.textContent||''),null,{timeout:20000});
  const result=await page.locator('#result').textContent();assert.match(result,/^PASS:/);assert.deepEqual(errors,[]);console.log(result);
}finally{await browser?.close();server.kill();}
