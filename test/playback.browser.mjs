import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
const q=705600000;
// Three bars of quarters at 120 bpm: six seconds of score.
const notes=Array.from({length:12},(_,index)=>({onset:q*index,duration:q,pitch:[60,62,64,65,67,69][index%6],lyrics:['do','re','mi','fa','so','la'][index%6]}));
const project={version:153,projectName:'Playback',time:{tempo:[{position:0,bpm:120}],meter:[{index:0,numerator:4,denominator:4}]},tracks:[{name:'Lead',mainGroup:{uuid:'lead',notes},groups:[]}]};
// Seven seconds of a quiet tone, as a synthesizer's exported audio would be.
function wav(seconds,rate=8000){
  const samples=Math.round(seconds*rate),data=Buffer.alloc(44+samples*2);
  data.write('RIFF',0);data.writeUInt32LE(36+samples*2,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)data.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*220)*3000),44+i*2);
  return data;
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:900},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  await page.locator('#file-input').setInputFiles({name:'playback.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:60000});
  const time=()=>page.locator('#playback-time').textContent();
  // Where the playhead is drawn, in percent of its page.
  const playhead=()=>page.locator('.playhead').evaluate(node=>{const box=node.getBoundingClientRect(),bounds=node.closest('.score-viewer__page').getBoundingClientRect(),percent=value=>Math.round(value*1e4)/100;return{left:percent((box.left+box.width/2-bounds.left)/bounds.width),top:percent((box.top-bounds.top)/bounds.height),height:percent(box.height/bounds.height)};});
  assert.equal(await page.locator('#playback-duration').textContent(),'0:06','three bars of 4/4 at 120 bpm');
  assert.equal(await page.locator('#score .playback-mark').count(),3,'one playback mark per bar on the staff');
  assert.equal(await page.locator('.playhead').count(),0,'no playhead before playback is used');
  assert.equal(await page.locator('#audio-open').textContent(),'打开音频（推荐）','opening the exported audio is recommended');
  assert.equal(await page.locator('#piano-toggle').getAttribute('aria-pressed'),'true','the piano plays by default');

  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='暂停');
  await page.waitForTimeout(700);
  const early=await playhead();
  await page.waitForTimeout(900);
  const later=await playhead();
  assert.ok(later.left>early.left,`the playhead moves along the bar (${early.left} → ${later.left})`);
  assert.ok(early.height>2,'the playhead spans the staff');
  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='播放');
  const paused=await time(),pausedAt=await playhead();
  await page.waitForTimeout(400);
  assert.equal(await time(),paused,'pausing holds the time');
  assert.deepEqual(await playhead(),pausedAt,'and the playhead');

  // A click on the third bar moves the playhead there.
  const bar=await page.locator('.score-viewer__sheet .playback-mark').nth(2).boundingBox();
  await page.mouse.click(bar.x+bar.width*0.5,bar.y+bar.height*0.5);
  await page.waitForTimeout(100);
  assert.match(await time(),/^0:0[45]$/,'the third bar starts at four seconds');
  assert.ok(Math.abs((await playhead()).left-(await page.locator('.score-viewer__page').first().evaluate((page,box)=>{const bounds=page.getBoundingClientRect();return (box.x+box.width*0.5-bounds.left)/bounds.width*100;},bar)))<3,'the playhead stands where the score was clicked');

  // Space plays and pauses when no field has focus.
  await page.locator('#document-title').click();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='暂停');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='播放');

  // Playback runs to the end and comes back to the start.
  await page.locator('#rewind-button').click();
  assert.equal(await time(),'0:00');
  await page.locator('#playback-seek').evaluate(node=>{node.value='5.5';node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await time(),'0:05');
  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='播放'&&document.querySelector('#playback-time')?.textContent==='0:00',null,{timeout:5000});

  // Numbered notation carries the same marks.
  await page.locator('#jianpu-view').click();
  await page.waitForFunction(()=>document.querySelector('#score .jianpu-page')&&document.querySelectorAll('#score .playback-mark').length===3,null,{timeout:30000});
  await page.locator('#playback-seek').evaluate(node=>{node.value='2';node.dispatchEvent(new Event('change',{bubbles:true}));});
  const numbered=await playhead();
  const second=await page.locator('.score-viewer__sheet .playback-mark').nth(1).boundingBox(),pageBox=await page.locator('.score-viewer__page').first().boundingBox();
  assert.ok(numbered.left>=(second.x-pageBox.x)/pageBox.width*100-0.5&&numbered.left<=(second.x+second.width-pageBox.x)/pageBox.width*100,'at two seconds the numbered playhead is in the second bar');

  // The exported audio plays along: it becomes a song kept in this browser, attached to the project with an offset.
  await page.locator('.playback-bar__file').setInputFiles({name:'render.wav',mimeType:'audio/wav',buffer:wav(7)});
  await page.locator('#audio-name').waitFor();
  assert.equal(await page.locator('#audio-name').textContent(),'render.wav');
  assert.equal(await page.locator('#piano-toggle').getAttribute('aria-pressed'),'false','the recording replaces the piano');
  await page.waitForFunction(()=>document.querySelector('#playback-duration')?.textContent==='0:07',null,{timeout:10000});
  assert.match(await page.locator('#song-list .song-row').textContent(),/render\.wav.*已挂到 1 个工程/u,'the song is listed with the projects it serves');
  await page.locator('#audio-offset').fill('1');await page.locator('#audio-offset').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#playback-duration')?.textContent==='0:08');
  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='暂停');
  await page.waitForTimeout(500);
  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#storage-status')?.textContent?.includes('已保存在此浏览器'),null,{timeout:15000});
  await page.reload();
  await page.locator('#audio-name').waitFor({timeout:60000});
  assert.equal(await page.locator('#audio-name').textContent(),'render.wav','the song is kept in this browser');
  assert.equal(await page.locator('#audio-offset').inputValue(),'1',"with the project's offset");
  assert.equal(await page.locator('#piano-toggle').getAttribute('aria-pressed'),'false');
  await page.locator('#piano-toggle').click();
  assert.equal(await page.locator('#piano-toggle').getAttribute('aria-pressed'),'true','the piano can join the recording');
  await page.locator('#play-button').click();
  await page.waitForFunction(()=>document.querySelector('#play-button')?.getAttribute('aria-label')==='暂停',null,{timeout:10000});
  await page.locator('#play-button').click();

  // The exported SVG has no playback marks.
  await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:60000});
  const download=page.waitForEvent('download');await page.locator('#svg-button').click();
  const svg=await (await download).createReadStream().then(stream=>new Promise(resolve=>{let text='';stream.on('data',chunk=>{text+=chunk;});stream.on('end',()=>resolve(text));}));
  assert.ok(svg.includes('<svg')&&!svg.includes('playback-mark'),'exports leave the marks out');

  // Detaching keeps the song; it can be attached again from the play bar.
  await page.locator('#audio-detach').click();
  await page.locator('#audio-open').waitFor();
  assert.equal(await page.locator('#piano-toggle').getAttribute('aria-pressed'),'true','the piano is back');
  assert.match(await page.locator('#song-list .song-row').textContent(),/未挂接/u);
  await page.locator('#song-attach').selectOption({label:'render.wav'});
  await page.locator('#audio-name').waitFor();
  assert.equal(await page.locator('#audio-offset').inputValue(),'1','the project keeps its offset');

  // One song serves several projects.
  await page.locator('#file-input').setInputFiles({name:'second.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,projectName:'Second'}))});
  await page.waitForFunction(()=>document.querySelector('#document-title')?.textContent==='Second',null,{timeout:60000});
  await page.locator('#audio-open').waitFor();
  await page.locator('#song-list .song-row .file-item').click();
  await page.locator('#audio-name').waitFor();
  assert.match(await page.locator('#song-list .song-row').textContent(),/已挂到 2 个工程/u);
  assert.equal(await page.locator('#audio-offset').inputValue(),'0','each project has its own offset');

  // Deleting the song detaches it everywhere; an audio file dropped in goes to the project of the same name.
  await page.locator('#song-list .file-remove').click();
  await page.locator('#audio-open').waitFor();
  assert.equal(await page.locator('#song-section').isVisible(),false);
  await page.locator('#file-input').setInputFiles({name:'second.wav',mimeType:'audio/wav',buffer:wav(3)});
  await page.locator('#audio-name').waitFor();
  assert.equal(await page.locator('#audio-name').textContent(),'second.wav','imported audio attaches to the project of the same name');
  await page.waitForFunction(()=>document.querySelector('#storage-status')?.textContent?.includes('已保存在此浏览器'),null,{timeout:15000});
  await page.reload();
  await page.locator('#song-list .song-row').first().waitFor({timeout:60000});
  assert.equal(await page.locator('#song-list .song-row').count(),1,'only the new song remains after reload');
  assert.match(await page.locator('#song-list .song-row').textContent(),/second\.wav.*已挂到 1 个工程/u);

  // Lyrics typed as pinyin: the song supplies characters in a popup.
  const pinyinProject={version:153,projectName:'Pinyin',time:{tempo:[{position:0,bpm:120}],meter:[{index:0,numerator:4,denominator:4}]},tracks:[
    {name:'Lead',mainGroup:{uuid:'lead',notes:['我','们','一','起','唱','ge'].map((lyrics,index)=>({onset:q*index,duration:q,pitch:60+index,lyrics}))},groups:[]},
    {name:'Harmony',mainGroup:{uuid:'harmony',notes:['wo','men','yi','qi','chang','ge'].map((lyrics,index)=>({onset:q*index,duration:q,pitch:55+index,lyrics}))},groups:[]}
  ]};
  await page.locator('#file-input').setInputFiles({name:'pinyin.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pinyinProject))});
  await page.waitForFunction(()=>document.querySelector('#document-title')?.textContent==='Pinyin',null,{timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('.score-text-target--suggest').length===5,null,{timeout:30000});
  // On import the song's own matches are offered at once: the harmony sings with the lead.
  const dialog=page.locator('#self-check-dialog');
  await page.waitForFunction(()=>document.querySelector('#self-check-dialog')?.open,null,{timeout:30000});
  assert.match(await dialog.locator('header p').textContent(),/找到 5 处拼音.*同时唱 5 处，前后同句 0 处/u);
  assert.equal(await dialog.locator('.self-check__row').count(),5);
  assert.match(await dialog.locator('.self-check__group h3').textContent(),/Harmony/u);
  assert.equal(await dialog.locator('#self-check-apply').textContent(),'全部采用（5）');
  // Character by character: keep one as pinyin.
  await dialog.locator('.self-check__row').nth(4).locator('.self-check__keep').click();
  assert.equal(await dialog.locator('#self-check-apply').textContent(),'全部采用（4）');
  await dialog.locator('#self-check-apply').click();
  await page.waitForFunction(()=>!document.querySelector('#self-check-dialog')?.open);
  await page.waitForFunction(()=>document.querySelectorAll('.score-text-target[aria-label="编辑 我"]').length===2&&document.querySelectorAll('.score-text-target[aria-label="编辑 chang"]').length===1,null,{timeout:30000});
  assert.equal(await page.locator('#self-check-undo').textContent(),'已补 4 处 · 撤销');
  await page.locator('#self-check-undo').click();
  await page.waitForFunction(()=>document.querySelectorAll('.score-text-target[aria-label="编辑 wo"]').length===1&&document.querySelectorAll('.score-text-target--suggest').length===5,null,{timeout:30000});
  assert.equal(await page.locator('#self-check-undo').count(),0);
  // The lyric panel's self-check button asks again; later closes it.
  await page.locator('.sidebar-nav-item[data-section="lyrics"]').click();
  await page.locator('#self-check-button').click();
  await page.waitForFunction(()=>document.querySelector('#self-check-dialog')?.open);
  assert.equal(await dialog.locator('.self-check__row').count(),5);
  await page.locator('#self-check-later').click();
  await page.waitForFunction(()=>!document.querySelector('#self-check-dialog')?.open);
  assert.equal(await page.locator('.analysis-disclaimer',{hasText:'单独的 -'}).count(),0,'the note on a lone - is gone');
  assert.equal(await page.locator('.lyric-editor__segments > span').count(),0,'the write-as label is gone');
  await page.locator('.sidebar-nav-item[data-section="files"]').click();
  // The button in the heading opens each pinyin lyric's candidates in turn.
  assert.equal(await page.locator('#pinyin-button').textContent(),'5 处拼音可补汉字');
  await page.locator('#pinyin-button').click();
  await page.locator('.score-text-candidates').waitFor();
  assert.equal(await page.locator('.score-text-form input').first().inputValue(),'wo','the first pinyin lyric in reading order opens');
  await page.locator('#pinyin-button').click();
  await page.waitForFunction(()=>document.querySelector('.score-text-form input')?.value==='men');
  await page.keyboard.press('Escape');
  await page.locator('.score-text-target[aria-label="编辑 ge"]').first().click();
  await page.locator('.score-text-homophones').waitFor();
  assert.match(await page.locator('.score-text-together').textContent(),/ge（1 处）/u,'the harmony sings ge at the same time');
  await page.locator('.score-text-homophone',{hasText:'歌'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.score-text-target[aria-label="编辑 歌"]').length===2,null,{timeout:30000});
  await page.locator('.score-text-target[aria-label="编辑 wo"]').click();
  assert.match(await page.locator('.score-text-candidate').first().textContent(),/我.*Lead 同时唱/u);
  await page.locator('.score-text-fill').click();
  await page.waitForFunction(()=>!document.querySelector('.score-text-target[aria-label="编辑 wo"]')&&document.querySelectorAll('.score-text-target[aria-label="编辑 我"]').length===2,null,{timeout:30000});
  assert.equal(await page.locator('.score-text-target--suggest').count(),0,'every pinyin lyric took its character');

  // A phone keeps the transport on the screen.
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  const bar390=await page.locator('.playback-bar').boundingBox();
  assert.ok(bar390.x>=0&&bar390.x+bar390.width<=391&&bar390.y+bar390.height<=845,'the transport fits a phone screen');
  assert.deepEqual(errors,[]);
  console.log('PASS: piano playback with a smoothly moving playhead, pause, click to seek, space key, end of score, numbered notation, songs kept apart from projects (attach, detach, several projects with their own offsets, delete, import by name), exports without marks, pinyin candidates from other parts and homophones, and the phone layout.');
}finally{await browser.close();}
