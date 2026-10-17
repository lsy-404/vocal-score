import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
const out=process.env.QA_OUTPUT_DIR;
if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const q=705600000;
const project={version:153,projectName:'Pitch study',time:{tempo:[{position:0,bpm:96}],meter:[{index:0,numerator:4,denominator:4}]},tracks:[{name:'Lead',mainGroup:{uuid:'lead',notes:Array.from({length:32},(_,index)=>({onset:index*q,duration:q,pitch:[60,64,67,72,71,67,65,64][index%8],lyrics:'la'}))}},{name:'Low',mainGroup:{uuid:'low',notes:Array.from({length:8},(_,index)=>({onset:index*q*4,duration:q*4,pitch:48,lyrics:'la'}))}}]};
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1080},acceptDownloads:true});
  const errors=[],external=[],edgeAnalytics=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const url=request.url();
    if(process.env.ALLOW_CLOUDFLARE_ANALYTICS==='1'&&/^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/|$)/.test(url)){edgeAnalytics.push(url);return;}
    if(!url.startsWith(base)&&!url.startsWith('blob:')&&!url.startsWith('data:')){
      if(process.env.ALLOW_CLOUDFLARE_ANALYTICS==='1'&&new URL(url).origin===new URL(base).origin&&new URL(url).pathname==='/cdn-cgi/rum'){edgeAnalytics.push(url);return;}
      external.push(url);
    }
  });
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  assert.equal(await page.locator('#file-count').textContent(),'0');
  assert.equal(await page.locator('#demo-button').count(),0);
  assert(await page.locator('#pdf-button').isDisabled());
  await page.locator('#file-input').setInputFiles({name:'pitch-study.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  const ready=async()=>{await page.locator('#pdf-button:enabled').waitFor({timeout:60000});await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:30000});};
  await ready();
  assert.equal(await page.locator('#message.error').count(),0);
  assert((await page.locator('.score-viewer__page').first().evaluate(node=>node.clientWidth))>600,'Score preview starts at a readable page width');
  const navigation=await page.locator('.score-viewer__navigation').boundingBox(),zoom=await page.locator('.score-viewer__zoom').boundingBox();
  assert(navigation.x+navigation.width<=zoom.x+1,'Preview navigation and zoom do not overlap');
  await page.locator('#theme-button').click();assert.equal(await page.locator('body').getAttribute('data-fluent-theme'),'dark');
  const darkBackground=await page.locator('.score-viewer__toolbar').evaluate(node=>getComputedStyle(node.parentElement).backgroundColor);assert.match(darkBackground,/41, 41, 41/);
  await page.reload();await ready();assert.equal(await page.locator('body').getAttribute('data-fluent-theme'),'dark','Theme preference persists');
  if(out)await page.screenshot({path:path.join(out,'pdf-dark.png'),fullPage:false});
  await page.locator('#theme-button').click();
  await openSection(page,'settings');await page.locator('#page-header').fill('Practice header');await page.locator('#score-by').fill('Editor');await page.locator('#score-font').selectOption('kai');await page.locator('#lyric-size').fill('20');await page.locator('#title-size').fill('32');await ready();
  assert.match(await page.locator('#score .page-decoration').first().textContent(),/Practice header.*Pitch study.*by Editor/s);
  const font=await page.locator('#score svg text').filter({hasText:'la'}).first().evaluate(node=>getComputedStyle(node).fontFamily);
  assert.match(font,/KaiTi/);
  const downloadPdf=async(name)=>{const event=page.waitForEvent('download');await page.locator('#pdf-button').click();const download=await event;assert.match(download.suggestedFilename(),/\.pdf$/);const bytes=await readFile(await download.path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');if(out)await download.saveAs(path.join(out,name));return bytes.toString('latin1');};
  const formats={a4:[210,297],letter:[215.9,279.4],legal:[215.9,355.6],a3:[297,420],a5:[148,210]};
  for(const [size,dimensions]of Object.entries(formats)){
    await page.locator('#paper-size').selectOption(size);await ready();
    const pdf=await downloadPdf(`pdf-${size}.pdf`),match=pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    assert(match,'PDF has a physical page rectangle');
    assert(Math.abs(Number(match[1])-dimensions[0]*72/25.4)<0.1,`${size} width`);assert(Math.abs(Number(match[2])-dimensions[1]*72/25.4)<0.1,`${size} height`);
  }
  await page.locator('#paper-size').selectOption('letter');await page.locator('#page-orientation').selectOption('landscape');await ready();
  const landscape=await downloadPdf('pdf-letter-landscape.pdf');const box=landscape.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);assert(Number(box[1])>Number(box[2]));
  await page.locator('#auto-transpose').click();await ready();assert.equal(await page.locator('#transpose-value').textContent(),'+12');
  await page.locator('#jianpu-view').click();await ready();assert(await page.locator('#score .jianpu-note').count()>0);
  const xmlEvent=page.waitForEvent('download');await page.locator('#export-button').click();const xml=await xmlEvent;const xmlText=await readFile(await xml.path(),'utf8');assert.match(xmlText,/<creator>Editor<\/creator>/);assert.match(xmlText,/lyric-font/);
  await downloadPdf('pdf-numbered.pdf');
  if(out)await page.screenshot({path:path.join(out,'pdf-numbered-preview.png'),fullPage:false});
  const files=(process.env.SVP_SAMPLE_FILES||'').split(';').filter(Boolean);
  if(files.length){
    await page.locator('#file-input').setInputFiles(files);await page.waitForFunction(()=>document.querySelector('#note-meta')?.textContent.includes('568'),null,{timeout:60000});await ready();
    // 573 source notes; the default automatic merging joins 5 held notes into their syllables.
    assert.match(await page.locator('#note-meta').textContent(),/568/);assert.match(await page.locator('#measure-meta').textContent(),/102/);assert.equal(await page.locator('#key').inputValue(),'2');
    assert.equal(await page.locator('#message.error').count(),0);
    await downloadPdf('pdf-vocal-staff.pdf');
    if(out)await page.screenshot({path:path.join(out,'pdf-staff-preview.png'),fullPage:false});
    await openSection(page,'analysis');assert(await page.locator('#chord-list select').count()>0);await page.locator('#annotation-settings label').nth(1).click();await ready();
    await openSection(page,'settings');await page.locator('#auto-transpose').click();await ready();assert.equal(await page.locator('#transpose-value').textContent(),'+3');assert.equal(await page.locator('#key').inputValue(),'-1');assert.match(await page.locator('#pitch-summary').textContent(),/超出目标音区/);
    await page.locator('#jianpu-view').click();await ready();await downloadPdf('pdf-vocal-numbered.pdf');
    const event=page.waitForEvent('download');await page.locator('#export-button').click();const song=await event;if(out)await song.saveAs(path.join(out,'vocal-score.musicxml'));
    const svgEvent=page.waitForEvent('download');await page.locator('#svg-button').click();const svg=await svgEvent;assert.match(svg.suggestedFilename(),/_jianpu\.svg$/);if(out)await svg.saveAs(path.join(out,'vocal-numbered.svg'));
  }
  const tuned=structuredClone(project);tuned.projectName='Tuning study';tuned.tracks=tuned.tracks.slice(0,1);tuned.tracks[0].mainGroup.notes=tuned.tracks[0].mainGroup.notes.slice(0,4);tuned.tracks[0].mainGroup.notes[0].detune=70;tuned.tracks[0].mainGroup.notes[1].detune=-60;
  await page.locator('#file-input').setInputFiles({name:'tuning.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tuned))});await page.waitForFunction(()=>document.querySelector('.file-item[aria-pressed=true]')?.textContent.includes('tuning.svp'),null,{timeout:30000});await ready();
  await openSection(page,'tuning');assert.match(await page.locator('#tuning-count').textContent(),/0 个音符修正/,'tuning parameters are ignored until switched on');await page.locator('#tuning-settings .fluent-checkbox').click();await ready();assert.match(await page.locator('#tuning-count').textContent(),/2 个音符修正/);assert.equal(await page.locator('.tuning-table tbody tr').count(),2);
  await page.locator('#tuning-threshold').selectOption('100');await ready();assert.match(await page.locator('#tuning-count').textContent(),/0 个音符修正/);
  await page.locator('#tuning-threshold').selectOption('50');await ready();await page.locator('#tuning-settings .fluent-checkbox').click();await ready();assert.match(await page.locator('#tuning-count').textContent(),/0 个音符修正/);
  await openSection(page,'settings');await page.locator('#score-title').fill('<img src=x onerror=alert(1)>');await ready();assert.equal(await page.locator('#score img[onerror]').count(),0);
  await page.locator('#file-input').setInputFiles({name:'broken.svp',mimeType:'application/json',buffer:Buffer.from('{invalid')});await page.locator('#message.error').waitFor();assert.match(await page.locator('#message').textContent(),/有效/);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const mobileNavigation=await page.locator('.score-viewer__navigation').boundingBox(),mobileZoom=await page.locator('.score-viewer__zoom').boundingBox();assert(mobileNavigation.x+mobileNavigation.width<=mobileZoom.x+1,'Mobile preview controls stay separate');
  if(out)await page.screenshot({path:path.join(out,'pdf-mobile.png'),fullPage:false});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({status:'passed',formats:Object.keys(formats),files:files.length,browserErrors:errors.length,externalRequests:external.length,edgeAnalyticsRequests:edgeAnalytics.length}));
}finally{await browser.close();}
