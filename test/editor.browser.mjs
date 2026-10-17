import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4190/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const quarter=705600000;
const makeNotes=lyrics=>lyrics.map((text,index)=>({onset:index*quarter,duration:quarter,pitch:[60,62,64,65,67,69][index],lyrics:text}));
const project={
  version:'1.0',projectName:'Lyric Editor Fixture',
  time:{tempo:[{position:0,bpm:120}],meter:[{index:0,numerator:4,denominator:4}]},
  tracks:[
    {name:'Lead',mainGroup:{uuid:'lead-voice',notes:makeNotes(['alpha','-','+','','beta','gamma'])},groups:[]},
    {name:'Backing',mainGroup:{uuid:'backing-voice',notes:makeNotes(['back-one','back-two']).map((note,index)=>({...note,pitch:48+index*2}))},groups:[]}
  ]
};

try {
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('#file-input').waitFor({state:'attached'});
  await page.waitForFunction(()=>document.querySelector('#file-input')&&!document.querySelector('#file-input').disabled,{timeout:30000});
  assert.equal(await page.locator('#demo-button').count(),0,'built-in demo control should be removed');
  await page.locator('#file-input').setInputFiles({name:'lyrics-fixture.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project),'utf8')});
  const exportButton=page.locator('#export-button');
  await page.locator('#export-button:enabled').waitFor({timeout:30000});
  assert.equal(await page.locator('#message.error:visible').count(),0,'synthetic project should import without error');
  await page.locator('.sidebar-nav-item').filter({hasText:'歌词与声部文字'}).click();
  const panel=page.locator('#lyrics-panel');
  await openSection(page,'lyrics');
  if(!(await panel.evaluate(node=>node.open))) await panel.locator('summary').click();
  const editor=page.locator('.lyric-editor');
  await editor.waitFor({state:'visible'});
  const voices=editor.locator('[aria-label="选择声部"]');
  const lyricInputs=editor.locator('.lyric-editor__note input');
  const lyricInput=index=>editor.locator('.lyric-editor__note input').nth(index);
  const waitForExport=()=>page.locator('#export-button:enabled').waitFor({timeout:30000});
  const assertExportBlocked=async message=>assert.equal(await exportButton.isDisabled(),true,message);
  const exportXml=async()=>{
    await waitForExport();
    const downloadEvent=page.waitForEvent('download');
    await exportButton.click();
    const download=await downloadEvent;
    return readFile(await download.path(),'utf8');
  };

  assert.equal(await lyricInputs.count(),6,'lead voice should show all six fixture notes');
  assert.deepEqual(await lyricInputs.evaluateAll(inputs=>inputs.map(input=>input.value)),['alpha','-','+','','beta','gamma']);
  await lyricInput(0).fill('updated');
  await assertExportBlocked('lyric edits should synchronously disable export until score refresh');
  await waitForExport();
  assert.match(await exportXml(page),/<text>updated<\/text>/,'MusicXML should include edited lyric');
  assert.match(await lyricInput(0).getAttribute('title'),/小节 1 · 1 拍 · C4 · 1 拍/,'a note shows its bar, beat, pitch and length in beats');

  await editor.locator('.lyric-editor__tools button').nth(0).click();
  await assertExportBlocked('bulk clear should invalidate export immediately');
  assert.deepEqual(await lyricInputs.evaluateAll(inputs=>inputs.map(input=>input.value)),['','','','','','']);
  await editor.locator('.lyric-editor__tools button').nth(1).click();
  await waitForExport();
  assert.deepEqual(await lyricInputs.evaluateAll(inputs=>inputs.map(input=>input.value)),['updated','-','+','','beta','gamma'],'bulk restore should recover lyrics, extension markers, and empty slots');

  const trackName=editor.locator('[aria-label="声部名称"]');
  await trackName.fill('Lead <Renamed&>');
  await assertExportBlocked('track rename should synchronously invalidate export');
  await waitForExport();
  const renamedXml=await exportXml(page);
  assert.match(renamedXml,/<part-name>Lead &lt;Renamed&amp;&gt;<\/part-name>/,'MusicXML should escape the renamed part label');

  await voices.selectOption('lead-voice');
  await lyricInput(0).fill('rapid-lead');
  await assertExportBlocked('rapid lyric edit should disable export before rerender');
  await voices.selectOption('backing-voice');
  assert.equal(await lyricInputs.count(),2,'voice switch should render the selected track immediately');
  await lyricInput(0).fill('rapid-backing');
  await voices.selectOption('lead-voice');
  assert.equal(await lyricInput(0).inputValue(),'rapid-lead','rapid voice switches should keep edits attached to the lead track');
  await voices.selectOption('backing-voice');
  assert.equal(await lyricInput(0).inputValue(),'rapid-backing','rapid voice switches should keep edits attached to the backing track');
  await voices.selectOption('lead-voice');
  const finalXml=await exportXml(page);
  assert.match(finalXml,/<part-name>Lead &lt;Renamed&amp;&gt;<\/part-name>/);
  assert.match(finalXml,/<text>rapid-lead<\/text>/);
  assert.match(finalXml,/<text>rapid-backing<\/text>/);

  // Correcting from a pasted lyric: the box starts empty, and the lyric may be broken into lines any way.
  const paste=editor.locator('[aria-label="粘贴歌词文本"]');
  const apply=editor.locator('.lyric-editor__batch-tools .fluent-button--primary');
  const marks=editor.locator('.marked__layer');
  assert.equal(await paste.inputValue(),'','the correction box starts empty');
  assert.equal(await apply.count(),0,'nothing to apply before pasting');
  await lyricInput(0).fill('chong');
  await lyricInput(4).fill('qing');
  await lyricInput(5).fill('tian');
  await waitForExport();
  await paste.fill('火星\n\n重庆\n天');
  await editor.locator('.lyric-editor__legend').waitFor();
  assert.equal(await marks.locator('pre').textContent(),'火星\n\n重庆\n天 ','the marks layer mirrors the pasted text');
  assert.equal(await marks.locator('.mark-change').count(),3,'syllables the voice sings are marked for correction across line breaks');
  assert.equal(await marks.locator('.mark-none').count(),2,'syllables no voice sings are marked as missing');
  assert.match(await editor.locator('.lyric-editor__legend').textContent(),/将修正 3.*谱中没有 2/);
  assert.equal(await editor.locator('.lyric-editor__note input.is-pending').count(),3,'notes about to change are flagged in the grid');
  await paste.evaluate(field=>{const at=field.value.indexOf('重');field.focus();field.setSelectionRange(at,at);field.dispatchEvent(new Event('click'));});
  assert.match(await editor.locator('.lyric-editor__caret').textContent(),/小节 1 · 1 拍：chong → 重/,'the caret shows where a syllable goes');
  assert.equal(await apply.textContent(),'修正 3 个音符');
  await apply.click();
  await assertExportBlocked('a correction should invalidate export immediately');
  await waitForExport();
  assert.deepEqual(await lyricInputs.evaluateAll(inputs=>inputs.map(input=>input.value)),['重','-','+','','庆','天'],'corrections skip extension and empty notes');
  assert.match(await exportXml(page),/<text>重<\/text>/);
  assert.equal(await apply.isDisabled(),true,'a corrected lyric leaves nothing to correct');
  await editor.locator('.lyric-editor__batch-tools button').filter({hasText:'撤销'}).click();
  await waitForExport();
  assert.deepEqual(await lyricInputs.evaluateAll(inputs=>inputs.map(input=>input.value)),['chong','-','+','','qing','tian'],'undo restores every corrected note');
  await editor.getByRole('radio',{name:'拼音'}).click();
  await page.waitForTimeout(300);
  assert.equal(await apply.isDisabled(),true,'writing pinyin over the same pinyin changes nothing');
  assert.equal(await marks.locator('.mark-exact').count(),3,'syllables already right are marked as such');
  assert.deepEqual(errors,[],'production app should not report uncaught browser errors');
  process.stdout.write('PASS: production Vue import, synchronous export invalidation, XML lyric/name export, bulk restore, rapid voice switching, and correcting every voice from an unordered pasted lyric with marks, caret details, undo and pinyin writing.\n');
  await context.close();
} finally {
  await browser.close();
}
