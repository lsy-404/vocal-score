import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});

test('staff renderer preserves page geometry and maps lyrics to source notes in OSMD', { skip: !playwright && 'Playwright is unavailable in this checkout.' }, async () => {
  const { chromium } = playwright;
  const server=spawn(process.execPath,['test/staff-layout.browser-server.cjs'],{stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    const port=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Layout fixture server did not start.')),5000);
      server.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(Number(chunk.toString().trim()));});
      server.once('error',reject);
    });
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(()=>/^(PASS:|FAIL:)/.test(document.querySelector('#result')?.textContent||''),null,{timeout:30000});
    const result=await page.locator('#result').textContent();
    assert.match(result,/^PASS:/);
    assert.deepEqual(errors,[]);
  } finally {
    await browser?.close();
    server.kill();
  }
});
