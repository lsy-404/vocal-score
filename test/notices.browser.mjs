import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
const q=705600000;
// The first note starts off the sixteenth grid, so the conversion reports a shifted note.
const project={version:153,projectName:'Notices',time:{tempo:[{position:0,bpm:100}],meter:[{index:0,numerator:4,denominator:4}]},tracks:[{name:'Lead',mainGroup:{uuid:'lead',notes:[{onset:q*0.3,duration:q,pitch:60,lyrics:'la'},{onset:q*2,duration:q*2,pitch:62,lyrics:'li'}]},mainRef:{groupID:'lead',blickOffset:0,pitchOffset:0}}]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  await page.locator('#file-input').setInputFiles({name:'notices.svp',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:60000});
  assert.equal(await page.locator('#message').count(),0,'notices no longer fold above the score');
  assert.match(await page.locator('#notice-button').textContent(),/^\d+ 条提示$/);
  await page.locator('#notice-button').click();
  assert.equal(await page.locator('.sidebar-nav-item[data-section="analysis"]').getAttribute('aria-current'),'page','the notice button opens the analysis page');
  await page.locator('#notice-panel').waitFor();
  assert.match(await page.locator('#notice-panel').textContent(),/音符的起止位置经节奏网格调整/,'notices are listed in full on the analysis page');
  assert.equal(await page.locator('#notice-panel details').count(),0,'notices are not folded');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  const open=()=>page.locator('.workspace').evaluate(node=>node.classList.contains('sidebar-open'));
  await page.locator('#sidebar-mobile-toggle').click();assert(await open(),'the menu button opens the sidebar');
  await page.mouse.click(370,600);await page.waitForTimeout(300);
  assert.equal(await open(),false,'tapping outside the open sidebar closes it');
  assert((await page.locator('.sidebar').boundingBox()).x+(await page.locator('.sidebar').boundingBox()).width<=1,'the closed sidebar slides off screen');
  await page.locator('#notice-button').click();
  assert(await open(),'on a phone the notice button opens the sidebar on the analysis page');
  assert(await page.locator('#notice-panel').isVisible());
  await page.mouse.click(370,600);await page.waitForTimeout(300);
  assert.equal(await open(),false);
  await page.locator('#sidebar-mobile-toggle').click();await page.waitForTimeout(300);await page.mouse.click(100,400);await page.waitForTimeout(100);
  assert(await open(),'taps inside the sidebar keep it open');
  assert.deepEqual(errors,[]);
  console.log('PASS: notices listed unfolded on the analysis page, notice button on desktop and phone, and outside taps close the phone sidebar.');
}finally{await browser.close();}
