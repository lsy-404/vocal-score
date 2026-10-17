import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const quarter=705600000;
const fixture={version:153,projectName:'Text editing study',time:{tempo:[{position:0,bpm:100}],meter:[{index:0,numerator:4,denominator:4}]},tracks:[{name:'Lead',mainGroup:{uuid:'lead',notes:Array.from({length:24},(_,index)=>({onset:index*quarter,duration:quarter,pitch:60+index%5,lyrics:index===0?'first':'la'}))}},{name:'Backing',mainGroup:{uuid:'backing',notes:[{onset:0,duration:quarter,pitch:48,lyrics:'la'}]}}]};
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1080},acceptDownloads:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  const ready=async()=>{await page.locator('#pdf-button:enabled').waitFor({timeout:60000});await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:30000});};
  await page.locator('#file-input').setInputFiles({name:'text-editing.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await ready();
  const changeText=async(kind,text,index=0)=>{
    const target=page.locator(`.score-text-target[data-edit-kind="${kind}"]`).nth(index);
    await target.click();
    await page.locator('.score-text-form input').fill(text);
    await page.locator('.score-text-form button[type=submit]').click();
    await ready();
  };
  await page.locator('.score-text-target[data-edit-kind=title]').first().waitFor({timeout:30000});
  await changeText('title','Title from the page');
  await openSection(page,'settings');assert.equal(await page.locator('#score-title').inputValue(),'Title from the page');
  await page.locator('#page-header').fill('Header');await page.locator('#score-by').fill('Credit');await ready();
  await changeText('header','Header from the page');await changeText('by','Credit from the page');
  assert.equal(await page.locator('#page-header').inputValue(),'Header from the page');assert.equal(await page.locator('#score-by').inputValue(),'Credit from the page');
  const lyricTarget=page.locator('.score-text-target[data-edit-kind=lyric]').first();
  await lyricTarget.click();await page.locator('.score-text-form input').fill('未保存');await page.locator('.score-text-form').press('Escape');assert.equal(await page.locator('.score-text-form').count(),0);
  await changeText('lyric','新字');
  const xmlEvent=page.waitForEvent('download');await page.locator('#export-button').click();const xml=await readFile(await (await xmlEvent).path(),'utf8');
  assert.match(xml,/<work-title>Title from the page<\/work-title>/);assert.match(xml,/<creator>Credit from the page<\/creator>/);assert.match(xml,/<text>新字<\/text>/);assert.doesNotMatch(xml,/<text>未保存<\/text>/);
  assert.match(xml,/<part id="P2">[\s\S]*?<text>la<\/text>/,'Editing the lead must preserve the backing lyric.');
  await page.locator('#jianpu-view').click();await ready();
  assert(await page.locator('.score-text-target[data-edit-kind=lyric]').count()>0,'Numbered notation also offers direct lyric editing.');
  await changeText('lyric','简谱字');
  await page.locator('.score-text-target[data-edit-kind=title]').first().click();await page.locator('.score-text-form input').fill('Wrong file');
  await page.locator('#file-input').setInputFiles({name:'other.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fixture,projectName:'Other file'}))});await page.waitForFunction(()=>document.querySelector('.file-item[aria-pressed=true]')?.textContent.includes('other.svp'));await ready();
  assert.equal(await page.locator('.score-text-form').count(),0,'Changing documents closes an unfinished edit.');
  assert.equal(await page.locator('#score-title').inputValue(),'Other file');
  await page.reload();await ready();await openSection(page,'files');await page.locator('.file-item').filter({hasText:'text-editing.svp'}).click();await ready();await openSection(page,'settings');
  assert.equal(await page.locator('#score-title').inputValue(),'Title from the page');
  const saved=await page.evaluate(async()=>{
    const request=indexedDB.open('svp-vocal-score');const db=await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);});
    const rows=await new Promise(resolve=>{const get=db.transaction('documents').objectStore('documents').getAll();get.onsuccess=()=>resolve(get.result);});db.close();return rows.find(row=>row.name==='text-editing.svp').project.tracks.map(track=>track.notes.map(note=>note.lyrics));
  });
  assert.equal(saved[0][0],'简谱字');assert.equal(saved[1][0],'la');assert.deepEqual(errors,[]);
  console.log('PASS: direct PDF title/header/credit/lyric edits, cancellation, MusicXML export, numbered notation, document isolation, and durable saving.');
}finally{await browser.close();}
