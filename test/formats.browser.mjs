import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openSection} from './workspace.browser.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4190/';
// Optional real projects of any supported format, separated by semicolons; they are read locally and never stored.
const samples=(process.env.FORMAT_SAMPLE_FILES||'').split(';').filter(Boolean);

function midiFile(){
  const vlq=value=>{const bytes=[value&0x7f];while(value>>=7)bytes.unshift((value&0x7f)|0x80);return bytes;};
  const track=events=>{const body=events.flat();return [...Buffer.from('MTrk'),...[24,16,8,0].map(shift=>(body.length>>shift)&255),...body];};
  const meta=[[0,0xff,0x51,3,0x07,0xa1,0x20],[0,0xff,0x58,4,3,2,24,8],[0,0xff,0x2f,0]];
  const melody=[[0,0xff,0x03,6,...Buffer.from('Violin')],[0,0xc0,40]];
  [76,77,79,81,79,77,76,74,72].forEach(pitch=>melody.push([...vlq(0),0x90,pitch,90],[...vlq(240),0x80,pitch,0]));
  melody.push([0,0xff,0x2f,0]);
  const cello=[[0,0xff,0x03,5,...Buffer.from('Cello')],[0,0xc1,42],[0,0x91,36,90],[...vlq(1440),0x81,36,0],[0,0xff,0x2f,0]];
  return Buffer.from([...Buffer.from('MThd'),0,0,0,6,0,1,0,3,1,224,...track(meta),...track(melody),...track(cello)]);
}
const ust=Buffer.from('[#VERSION]\nUST Version1.2\n[#SETTING]\nTempo=120.00\nProjectName=UST check\n[#0000]\nLength=480\nLyric=ら\nNoteNum=60\n[#0001]\nLength=480\nLyric=R\nNoteNum=60\n[#0002]\nLength=960\nLyric=ら\nNoteNum=64\n[#TRACKEND]\n','utf8');
const ustx=Buffer.from('name: USTX check\nustx_version: "0.6"\nresolution: 480\nbpm: 100\nbeat_per_bar: 4\nbeat_unit: 4\ntracks:\n- track_name: Lead\nvoice_parts:\n- name: Part\n  track_no: 0\n  position: 0\n  notes:\n  - position: 0\n    duration: 480\n    tone: 62\n    lyric: la\n  - position: 480\n    duration: 480\n    tone: 64\n    lyric: +\n','utf8');

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#file-input')?.disabled);
  const accept=await page.locator('#file-input').getAttribute('accept');
  for(const extension of ['.svp','.acep','.vsqx','.vpr','.vsq','.mid','.ust','.ustx','.ccs','.musicxml','.mxl','.s5p','.dv','.ppsf','.tssln','.ufdata','.flp'])assert(accept.split(',').includes(extension),`file picker accepts ${extension}`);
  assert.match(await page.locator('.empty-score .format-list').textContent(),/ACEP.*MID.*FLP/s);
  const check=async(file,{parts,instrumental}={})=>{
    await page.locator('#file-input').setInputFiles(file);
    await page.waitForFunction(name=>document.querySelector('.file-item[aria-pressed=true]')?.textContent.includes(name),file.name??path.basename(file),{timeout:60000});
    await page.locator('#pdf-button:enabled').waitFor({timeout:120000});
    await page.locator('.score-viewer__sheet[data-rendered=true]').first().waitFor({timeout:60000});
    if(await page.locator('#message.error').count())assert.fail(`${file.name??file}: ${await page.locator('#message').textContent()}`);
    const meta=await page.locator('#note-meta').textContent();
    if(parts)assert.match(meta,new RegExp(`^${parts} 声部`),`${file.name}: ${meta}`);
    if(instrumental){const clefs=await page.evaluate(()=>[...document.querySelectorAll('#score svg')].length);assert(clefs>0);}
    return meta;
  };
  await check({name:'ensemble.mid',mimeType:'audio/midi',buffer:midiFile()},{parts:2,instrumental:true});
  assert.equal(await page.locator('.file-item[aria-pressed=true] .beta-badge').count(),1,'new formats are marked Beta');
  await check({name:'check.ust',mimeType:'text/plain',buffer:ust},{parts:1});
  await check({name:'check.ustx',mimeType:'text/yaml',buffer:ustx},{parts:1});
  await openSection(page,'files');
  await page.locator('#file-input').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('x')});
  await page.locator('#message.error').waitFor();assert.match(await page.locator('#message').textContent(),/不支持/);
  const results=[];
  for(const file of samples){
    let size;try{size=(await readFile(file)).length;}catch{continue;}
    const started=Date.now();const meta=await check(file);
    results.push({file:path.basename(file),bytes:size,meta,ms:Date.now()-started,pages:await page.locator('.score-viewer__page').count()});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',samples:results},null,1));
}finally{await browser.close();}
