import assert from 'node:assert/strict';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4190/';
const origin=new URL(base).origin;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1000}});
const pageErrors=[],externalRequests=[];
const paperSelections={A:{},B:{}};
function observe(page){
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('request',request=>{
    try {
      const url=new URL(request.url());
      // On production, Cloudflare's edge may inject its Web Analytics beacon; the app itself makes no such request.
      if(process.env.ALLOW_CLOUDFLARE_ANALYTICS==='1'&&((url.origin==='https://static.cloudflareinsights.com'&&url.pathname.startsWith('/beacon.min.js'))||(url.origin===origin&&url.pathname==='/cdn-cgi/rum')))return;
      if(url.origin!==origin)externalRequests.push(request.url());
    }
    catch { externalRequests.push(request.url()); }
  });
  return page;
}
const quarter=705600000;
function fixture(title,voice,lyric,pitch){
  return {
    version:'1.0',projectName:title,
    time:{tempo:[{position:0,bpm:120}],meter:[{index:0,numerator:4,denominator:4}]},
    tracks:[{name:voice,mainGroup:{uuid:`${voice}-voice`,notes:[
      {onset:0,duration:quarter,pitch,lyrics:lyric},
      {onset:quarter,duration:quarter,pitch:pitch+2,lyrics:`${lyric}-two`}
    ]},groups:[]}]
  };
}
const encoded=project=>Buffer.from(JSON.stringify(project),'utf8');
const files=[
  {name:'state-a.svp',mimeType:'application/json',buffer:encoded(fixture('source A','Voice A','歌词原文A',60))},
  {name:'state-b.svp',mimeType:'application/json',buffer:encoded(fixture('source B','Voice B','歌词原文B',48))}
];
const recordRows=page=>page.evaluate(async()=>{
  const request=indexedDB.open('svp-vocal-score');
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try {
    if(!db.objectStoreNames.contains('documents'))return [];
    const transaction=db.transaction('documents','readonly');
    const result=await new Promise((resolve,reject)=>{const get=transaction.objectStore('documents').getAll();get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);});
    return await Promise.all(result.map(async record=>({
      id:record.id,name:record.name,title:record.title,transpose:record.transpose,fifths:record.fifths,
      selected:record.selected,settings:record.settings,lyrics:record.project.tracks.flatMap(track=>track.notes.map(note=>note.lyrics)),
      sourceType:record.sourceFile?.type,sourceBytes:Array.from(new Uint8Array(await record.sourceFile.arrayBuffer()))
    })));
  } finally { db.close(); }
});
const rowFor=(page,name)=>page.locator('#file-list .file-row').filter({hasText:name});
async function selectDocument(page,name){await openSection(page,'files');await rowFor(page,name).locator('.file-item').click();await page.locator('#export-button:enabled').waitFor({timeout:30000});}
async function setChecked(locator,value){if(await locator.isChecked()!==value)await locator.locator('xpath=..').click();}
async function openLyrics(page){await openSection(page,'lyrics');if(!(await page.locator('#lyrics-panel').evaluate(node=>node.open)))await page.locator('#lyrics-panel > summary').click();}
async function openDetails(page,id){await openSection(page,id==='tuning-panel'?'tuning':'analysis');const details=page.locator(`#${id}`);if(!(await details.evaluate(node=>node.open)))await details.locator('summary').click();}
async function waitSaved(page){await page.waitForFunction(()=>document.querySelector('#storage-status')?.textContent?.includes('已保存在此浏览器'),null,{timeout:15000});}
async function setOptionalPaperSettings(page,documentKey,index){
  await openSection(page,'settings');
  for(const id of ['paper-size','page-orientation']){
    const control=page.locator(`#${id}`);
    if(await control.count()&&await control.locator('option').count()>index){
      await control.selectOption({index});paperSelections[documentKey][id]=await control.inputValue();
    }
  }
}
async function assertOptionalPaperSettings(page,documentKey){
  for(const [id,value] of Object.entries(paperSelections[documentKey]))assert.equal(await page.locator(`#${id}`).inputValue(),value,`${id} should remain bound to its document`);
}
async function applyA(page){
  await openSection(page,'settings');
  await page.locator('#score-title').fill('标题 A <雪>');
  await page.locator('#grid').selectOption('8');
  await page.locator('#key').selectOption('2');
  await page.locator('#transpose-up').click();await page.locator('#transpose-up').click();
  await page.locator('#score-font').selectOption('sans');
  await page.locator('#lyric-size').fill('18');
  await page.locator('#title-size').fill('30');
  await page.locator('#page-header').fill('页眉 A');
  await page.locator('#score-by').fill('署名 A');
  await page.locator('#header-size').fill('15');
  await setChecked(page.locator('#number-settings input[type="checkbox"]').nth(0),false);
  await setChecked(page.locator('#number-settings input[type="checkbox"]').nth(1),true);
  await setChecked(page.locator('#merge-setting input[type="checkbox"]'),false);
  await openDetails(page,'tuning-panel');await page.locator('#tuning-threshold').selectOption('100');await setOptionalPaperSettings(page,'A',1);
  await page.locator('#jianpu-view').click();
  await openLyrics(page);
  await page.locator('#lyric-editor .lyric-editor__note input').nth(0).fill('修改后的歌词A');
  await page.locator('#export-button:enabled').waitFor({timeout:30000});await waitSaved(page);
}
async function applyB(page){
  await openSection(page,'settings');
  await page.locator('#score-title').fill('Title B');
  await page.locator('#grid').selectOption('32');
  await page.locator('#key').selectOption('-3');
  await page.locator('#transpose-down').click();
  await page.locator('#score-font').selectOption('mono');
  await page.locator('#lyric-size').fill('12');
  await page.locator('#title-size').fill('20');
  await page.locator('#page-header').fill('Header B');
  await page.locator('#score-by').fill('Byline B');
  await page.locator('#header-size').fill('10');
  await setChecked(page.locator('#number-settings input[type="checkbox"]').nth(0),true);
  await setChecked(page.locator('#number-settings input[type="checkbox"]').nth(1),false);
  await setChecked(page.locator('#merge-setting input[type="checkbox"]'),true);
  await openDetails(page,'tuning-panel');await page.locator('#tuning-threshold').selectOption('150');await setOptionalPaperSettings(page,'B',0);
  await page.locator('#staff-view').click();
  await openLyrics(page);
  await page.locator('#lyric-editor .lyric-editor__note input').nth(0).fill('Edited lyric B');
  await page.locator('#export-button:enabled').waitFor({timeout:30000});await waitSaved(page);
}
async function assertA(page){
  await openSection(page,'settings');
  assert.equal(await page.locator('#score-title').inputValue(),'标题 A <雪>');
  assert.equal(await page.locator('#grid').inputValue(),'8');assert.equal(await page.locator('#key').inputValue(),'4');
  assert.equal(await page.locator('#transpose-value').textContent(),'+2');assert.equal(await page.locator('#score-font').inputValue(),'sans');
  assert.equal(await page.locator('#lyric-size').inputValue(),'18');assert.equal(await page.locator('#title-size').inputValue(),'30');
  assert.equal(await page.locator('#page-header').inputValue(),'页眉 A');assert.equal(await page.locator('#score-by').inputValue(),'署名 A');
  assert.equal(await page.locator('#header-size').inputValue(),'15');
  assert.equal(await page.locator('#number-settings input[type="checkbox"]').nth(0).isChecked(),false);
  assert.equal(await page.locator('#number-settings input[type="checkbox"]').nth(1).isChecked(),true);
  assert.equal(await page.locator('#merge-setting input[type="checkbox"]').isChecked(),false);
  assert.equal(await page.locator('#tuning-threshold').inputValue(),'100');
  assert.equal(await page.locator('#jianpu-view').getAttribute('aria-pressed'),'true');
  await assertOptionalPaperSettings(page,'A');
  await openLyrics(page);
  assert.equal(await page.locator('#lyric-editor .lyric-editor__note input').nth(0).inputValue(),'修改后的歌词A');
}
async function assertB(page){
  await openSection(page,'settings');
  assert.equal(await page.locator('#score-title').inputValue(),'Title B');
  assert.equal(await page.locator('#grid').inputValue(),'32');assert.equal(await page.locator('#key').inputValue(),'2');
  assert.equal(await page.locator('#transpose-value').textContent(),'-1');assert.equal(await page.locator('#score-font').inputValue(),'mono');
  assert.equal(await page.locator('#lyric-size').inputValue(),'12');assert.equal(await page.locator('#title-size').inputValue(),'20');
  assert.equal(await page.locator('#page-header').inputValue(),'Header B');assert.equal(await page.locator('#score-by').inputValue(),'Byline B');
  assert.equal(await page.locator('#header-size').inputValue(),'10');
  assert.equal(await page.locator('#number-settings input[type="checkbox"]').nth(0).isChecked(),true);
  assert.equal(await page.locator('#number-settings input[type="checkbox"]').nth(1).isChecked(),false);
  assert.equal(await page.locator('#merge-setting input[type="checkbox"]').isChecked(),true);
  assert.equal(await page.locator('#tuning-threshold').inputValue(),'150');
  assert.equal(await page.locator('#staff-view').getAttribute('aria-pressed'),'true');
  await assertOptionalPaperSettings(page,'B');
  await openLyrics(page);
  assert.equal(await page.locator('#lyric-editor .lyric-editor__note input').nth(0).inputValue(),'Edited lyric B');
}

try {
  let page=observe(await context.newPage());
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#file-input')&&!document.querySelector('#file-input').disabled,null,{timeout:30000});
  assert.equal(await page.locator('#file-count').textContent(),'0','a new browser context should start without bundled demo documents');
  assert.equal(await page.locator('#demo-button').count(),0,'the app must not expose an in-memory demo');
  assert.equal(await page.locator('#export-button').isDisabled(),true,'export should be disabled before import');
  await page.locator('#file-input').setInputFiles(files);
  await page.waitForFunction(()=>document.querySelector('#file-count')?.textContent==='2',null,{timeout:30000});
  await page.locator('#export-button:enabled').waitFor({timeout:30000});

  await selectDocument(page,'state-a.svp');await applyA(page);
  await selectDocument(page,'state-b.svp');await applyB(page);
  await selectDocument(page,'state-a.svp');await assertA(page);
  await selectDocument(page,'state-b.svp');await assertB(page);

  const firstRecords=await recordRows(page);
  assert.equal(firstRecords.length,2,'both imported projects should be in IndexedDB');
  for(const source of files){
    const {name}=source;
    const record=firstRecords.find(item=>item.name===name);
    assert.ok(record,`${name} should be persisted`);
    assert.equal(record.sourceType,'application/json');
    assert.deepEqual(Buffer.from(record.sourceBytes),source.buffer,`${name} Blob bytes should match the uploaded source`);
  }
  const recordA=firstRecords.find(item=>item.name==='state-a.svp');
  const recordB=firstRecords.find(item=>item.name==='state-b.svp');
  assert.equal(recordA.title,'标题 A <雪>');assert.equal(recordA.transpose,2);assert.equal(recordA.fifths,4);
  assert.equal(recordA.settings.grid,8);assert.equal(recordA.settings.threshold,100);assert.equal(recordA.settings.view,'jianpu');
  assert.equal(recordA.settings.font,'sans');assert.equal(recordA.settings.lyricSize,18);assert.equal(recordA.settings.titleSize,30);
  assert.equal(recordA.settings.header,'页眉 A');assert.equal(recordA.settings.by,'署名 A');assert.equal(recordA.settings.headerSize,15);
  assert.equal(recordA.settings.pageNumbers,false);assert.equal(recordA.settings.measureNumbers,true);assert.equal(recordA.settings.merge,false);
  assert.deepEqual(recordA.lyrics,['修改后的歌词A','歌词原文A-two']);
  assert.equal(recordB.title,'Title B');assert.equal(recordB.transpose,-1);assert.equal(recordB.fifths,2);
  assert.equal(recordB.settings.grid,32);assert.equal(recordB.settings.threshold,150);assert.equal(recordB.settings.view,'staff');
  assert.equal(recordB.settings.font,'mono');assert.equal(recordB.settings.lyricSize,12);assert.equal(recordB.settings.titleSize,20);
  assert.equal(recordB.settings.header,'Header B');assert.equal(recordB.settings.by,'Byline B');assert.equal(recordB.settings.headerSize,10);
  assert.equal(recordB.settings.pageNumbers,true);assert.equal(recordB.settings.measureNumbers,false);assert.equal(recordB.settings.merge,true);
  assert.deepEqual(recordB.lyrics,['Edited lyric B','歌词原文B-two']);

  await page.reload();await page.locator('#export-button:enabled').waitFor({timeout:30000});
  assert.equal(await page.locator('#file-count').textContent(),'2');
  await selectDocument(page,'state-b.svp');await assertB(page);
  await selectDocument(page,'state-a.svp');await assertA(page);

  const localeTitles=[],localeHeadings=[];
  for(const locale of ['zh-CN','en','ja','ko']){
    await page.locator('#language-select').selectOption(locale);
    await page.waitForFunction(value=>document.documentElement.lang===value,locale,{timeout:10000});
    await page.locator('#export-button:enabled').waitFor({timeout:30000});
    const text=await page.locator('.lyric-editor__heading h3').textContent();
    localeTitles.push(text.trim());
    localeHeadings.push((await page.locator('.brand span').textContent()).trim());
    assert.ok(text.trim(),`${locale} should translate the editor heading`);
    assert.equal(await page.locator('#score-title').inputValue(),'标题 A <雪>','locale changes must not rewrite user titles');
    assert.equal(await page.locator('#lyric-editor .lyric-editor__note input').nth(0).inputValue(),'修改后的歌词A','locale changes must not rewrite lyrics');
    assert.equal(await page.locator('#file-count').textContent(),'2','locale changes must not add or remove documents');
  }
  assert.equal(new Set(localeTitles).size,4,'the editor heading should be translated in every supported locale');
  assert.equal(new Set(localeHeadings).size,4,'the main application heading should be translated in every supported locale');

  await page.close();
  page=observe(await context.newPage());
  await page.goto(base);await page.locator('#export-button:enabled').waitFor({timeout:30000});
  await page.waitForFunction(()=>document.documentElement.lang==='ko');
  assert.equal(await page.locator('#file-count').textContent(),'2','closing and reopening a page in the same browser context must restore both documents');
  assert.equal(await page.locator('#language-select').inputValue(),'ko','language preference should survive a new page');
  await assertA(page);

  await openSection(page,'files');await rowFor(page,'state-b.svp').locator('.file-remove').click();
  await page.waitForFunction(()=>document.querySelector('#file-count')?.textContent==='1',null,{timeout:10000});
  assert.equal((await recordRows(page)).length,1,'removal should delete the IndexedDB record');
  await page.reload();await page.locator('#export-button:enabled').waitFor({timeout:30000});
  assert.equal(await page.locator('#file-count').textContent(),'1','a removed project must not return after reload');
  assert.equal(await rowFor(page,'state-b.svp').count(),0);
  await assertA(page);

  assert.deepEqual(pageErrors,[],'the production app should not report uncaught browser errors');
  assert.deepEqual(externalRequests,[],'the app should not make requests outside its own origin');
  process.stdout.write('PASS: real-app startup, isolated settings and lyrics for two IndexedDB documents, source Blob integrity, reload and page-reopen recovery, four localized UI/editor modes, locale persistence, and durable document deletion.\n');
} finally {
  await context.close();
  await browser.close();
}
