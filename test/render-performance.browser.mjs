import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
const files=(process.env.SVP_SAMPLE_FILES||'').split(';').filter(Boolean);
assert(files.length,'Set SVP_SAMPLE_FILES to benchmark a real project.');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1080}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  const timings={};
  const measure=async(name,action)=>{
    const start=performance.now();
    await action();
    await page.locator('#pdf-button:enabled').waitFor({timeout:90000});
    await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:30000});
    timings[name]=Math.round(performance.now()-start);
  };
  await measure('importMs',()=>page.locator('#file-input').setInputFiles(files[0]));
  await openSection(page,'settings');
  const firstPage=await page.locator('#score svg').first().elementHandle();
  const client=process.env.PROFILE_RENDER?await page.context().newCDPSession(page):null;
  if(client){await client.send('Profiler.enable');await client.send('Profiler.start');}
  await measure('titleMs',()=>page.locator('#score-title').fill('Performance study'));
  assert(await firstPage.evaluate(node=>node.isConnected),'Title text edits reuse engraved music.');
  if(client){
    const {profile}=await client.send('Profiler.stop');
    if(process.env.QA_OUTPUT_DIR){await mkdir(process.env.QA_OUTPUT_DIR,{recursive:true});await writeFile(path.join(process.env.QA_OUTPUT_DIR,'title-render.cpuprofile'),JSON.stringify(profile));}
    const names=new Map();for(const node of profile.nodes){const name=node.callFrame.functionName||'(anonymous)';names.set(name,(names.get(name)||0)+(node.hitCount||0));}
    console.log(JSON.stringify({profileTop:[...names].sort((a,b)=>b[1]-a[1]).slice(0,20)}));
  }
  await measure('headerMs',()=>page.locator('#page-header').fill('Practice'));
  await measure('paperMs',()=>page.locator('#paper-size').selectOption('letter'));
  const metrics=await page.evaluate(()=>({pages:document.querySelectorAll('#score>div svg, #score>svg').length,svgTexts:document.querySelectorAll('#score text').length}));
  assert.deepEqual(errors,[]);
  const result={timings,metrics,errors};
  if(process.env.QA_OUTPUT_DIR){await mkdir(process.env.QA_OUTPUT_DIR,{recursive:true});await writeFile(path.join(process.env.QA_OUTPUT_DIR,'render-performance.json'),JSON.stringify(result,null,2));}
  console.log(JSON.stringify(result));
}finally{await browser.close();}
