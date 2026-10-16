<script setup>
import {computed,ref,shallowRef,watch,nextTick,onMounted,onBeforeUnmount,toRaw,defineAsyncComponent} from 'vue';
import {createScore} from './lib/converter.js';
import {ACCEPT,FORMATS,formatsFor,importProject} from './lib/importers/index.js';
import {renderJianpu} from './lib/jianpu.js';
import {renderStaffScore} from './lib/staff.js';
import {analyzeScore,estimateKeys,recommendTranspose} from './lib/analysis.js';
import {annotateScore,scoreMetadata} from './lib/annotations.js';
import {decoratePages} from './lib/page-layout.js';
import {loadDocuments,saveDocument,deleteDocument} from './lib/storage.js';
import {createPdf,getPaperDimensions} from './lib/pdf.js';
import {collectScoreTextTargets,applyScoreTextEdit} from './lib/score-text.js';
import {t,i18n} from './i18n.js';
import {translateWarning,translateError,groupWarnings} from './ui-messages.js';
import FluentCheckbox from './components/FluentCheckbox.vue';
import LanguagePicker from './components/LanguagePicker.vue';
import ScoreTextOverlay from './components/ScoreTextOverlay.vue';
import ScoreViewer from './components/ScoreViewer.vue';
import StartupScreen from './components/StartupScreen.vue';
import logoUrl from './assets/logo.svg';
const LyricEditor=defineAsyncComponent(()=>import('./components/LyricEditor.vue'));

const documents=ref([]),activeId=ref(''),ready=ref(false),busy=ref(false),dragging=ref(false);
const activeSidebar=ref('files'),sidebarCollapsed=ref(false),mobileSidebarOpen=ref(false);
const sidebarItems=[['files','工程文件'],['settings','谱面设置'],['analysis','乐段与和声分析'],['lyrics','歌词与声部文字'],['tuning','音高微调']];
const score=ref(null),fileInput=ref(null),rendered=shallowRef(null);
const previewPages=shallowRef([]),pdfError=ref(''),textTargets=shallowRef([]),exportingPdf=ref(false);
const error=ref(''),warnings=ref([]),storageState=ref('正在恢复文件…'),storageError=ref(false);
function preferredTheme(){try{const value=localStorage.getItem('svp-vocal-score.theme');if(value)return value==='dark';}catch{}return matchMedia('(prefers-color-scheme: dark)').matches;}
const dark=ref(preferredTheme());
const defaults=()=>({grid:16,view:'staff',targetRange:'60,84',merge:true,showChords:false,showRepeats:true,useTuning:false,threshold:50,font:'serif',lyricSize:14,titleSize:24,headerSize:12,header:'',by:'',margin:10,modulation:true,triplets:true,noteMerge:'low',pageNumbers:true,measureNumbers:true,paperSize:'a4',orientation:'portrait'});
const emptySettings=defaults();
const current=computed(()=>documents.value.find(item=>item.id===activeId.value));
const s=computed(()=>current.value?.settings||emptySettings);
const result=computed(()=>rendered.value?.result);
const analysis=computed(()=>rendered.value?.analysis||{repeats:[],chords:[]});
const warningGroups=computed(()=>groupWarnings(warnings.value,(current.value?.project.tracks||[]).map(track=>track.name)));
// A notice shown under its part's heading drops the repeated part name.
function noticeText(warning,name){const text=translateWarning(warning);return name&&text.startsWith(name)?text.slice(name.length).replace(/^s*[:：]s*/u,''):text;}
const canExport=computed(()=>Boolean(result.value)&&!busy.value&&!exportingPdf.value);
const paperDimensions=computed(()=>getPaperDimensions(s.value.paperSize,s.value.orientation));
const fonts={serif:'"SimSun", "Songti SC", "Times New Roman", serif',sans:'"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',kai:'"KaiTi", "STKaiti", "SimSun", serif',mono:'"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace'};
const keyChoices=[0,1,2,3,4,5,6,7,-1,-2,-3,-4,-5,-6,-7];
const keyLabels=['C / a','G / e','D / b','A / f♯','E / c♯','B / g♯','F♯ / d♯','C♯ / a♯','F / d','B♭ / g','E♭ / c','A♭ / f','D♭ / b♭','G♭ / e♭','C♭ / a♭'];
const removing=ref(new Set());
const startupSteps=ref([]),startupReady=ref(false),startupVisible=ref(true);
const formatList=[...new Set(FORMATS.map(format=>format.short))].join(' · ');
let writes=Promise.resolve(),scheduled,running=false,pending=false,revision=0,requestedSignature='',renderController;
let conversionCache,engravingKey='',engravingMessages=[],downloadPdfCache;
const saveQueue=new Map();let saveQueued=false;

const signed=value=>value>0?`+${value}`:String(value);
function noteName(midi){const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];return Number.isFinite(midi)?`${names[((midi%12)+12)%12]}${Math.floor(midi/12)-1}`:'—';}
const keyName=key=>`${key.tonic} ${t(key.mode==='minor'?'小调':'大调')}`;
const range=computed(()=>{const pitches=result.value?.model.tracks.flatMap(track=>track.notes.map(note=>note.pitch))||[];return pitches.length?`${noteName(pitches.reduce((value,pitch)=>Math.min(value,pitch),Infinity))}–${noteName(pitches.reduce((value,pitch)=>Math.max(value,pitch),-Infinity))}`:'—';});
const keyChangeSummary=computed(()=>(result.value?.keyChanges||[]).map(change=>t('第 {measure} 小节转为 {key}',{measure:change.measureIndex+1,key:keyLabels[keyChoices.indexOf(change.fifths)]??change.fifths})).join('；'));
const pitchMessage=computed(()=>{
  const message=current.value?.pitchMessage;if(!message)return '';
  if(message.type==='estimate')return message.key?t('调性推测：{key}，可手动修改。',{key:keyName(message.key)}):t('音高信息不足以确定调性，请手动选择调号。');
  if(message.type==='manualKey')return t('调号为手动设置。');
  if(message.type==='manualTranspose')return t('调号已随整体移调更新。');
  const change=message.recommendation;
  return `${noteName(change.sourceRange.low)}–${noteName(change.sourceRange.high)} → ${noteName(change.resultRange.low)}–${noteName(change.resultRange.high)}。${change.keyAfter?t('调性推测 {before} → {after}。',{before:keyName(change.keyBefore),after:keyName(change.keyAfter)}):''}${change.outsideNoteCount?t('仍有 {count} 个音符超出目标音区。',{count:change.outsideNoteCount}):t('音符均在目标音区内。')}`;
});
const tuningFields=computed(()=>{
  const fields=new Map();
  for(const track of current.value?.project.tracks||[])for(const note of track.notes)for(const [source,label]of[['expression','显式'],['systemExpression','继承'],['referenceExpression','声线']])for(const [key,value]of Object.entries(note.tuning?.[source]||{})){
    const id=`${label}:${key}`,field=fields.get(id)||{label,key,low:Infinity,high:-Infinity,count:0};field.low=Math.min(field.low,value);field.high=Math.max(field.high,value);field.count++;fields.set(id,field);
  }
  return [...fields.values()];
});
const sourceSummary=computed(()=>current.value?.project.tuningSummary||{});
const adjustment=computed(()=>result.value?.pitchAdjustments||{adjustedNoteCount:0,notes:[]});
const trackName=id=>current.value?.project.tracks.find(track=>track.id===id)?.name||t('声部');
const cents=value=>`${signed(Number(value.toFixed(1)))} ¢`;

function storageMessage(key,failed=false){storageState.value=key;storageError.value=failed;}
function persist(item){
  if(removing.value.has(item.id))return writes;
  const record=structuredClone({id:item.id,name:item.name,sourceFile:item.sourceFile,project:toRaw(item.project),title:item.title,selected:[...item.selected],chordChoices:[...item.chordChoices],transpose:item.transpose,fifths:item.fifths,pitchMessage:toRaw(item.pitchMessage),settings:{...item.settings},updatedAt:Date.now()});
  storageMessage('正在保存…');
  writes=writes.then(()=>saveDocument(record)).then(()=>storageMessage('已保存在此浏览器')).catch(()=>storageMessage('保存失败；请保留原文件并检查浏览器存储空间。',true));
  return writes;
}

function queueSave(item){
  saveQueue.set(item.id,item);if(saveQueued)return;saveQueued=true;
  queueMicrotask(()=>{saveQueued=false;for(const document of saveQueue.values())persist(document);saveQueue.clear();});
}

function scheduleRender(save=true){
  if(save&&current.value)queueSave(current.value);
  const item=current.value;
  const signature=item?JSON.stringify([item.id,item.project,[...item.selected],[...item.chordChoices],item.transpose,item.fifths,item.title,Object.fromEntries(Object.entries(item.settings).filter(([key])=>key!=='targetRange')),i18n.global.locale.value]):'';
  if(signature===requestedSignature)return;
  requestedSignature=signature;revision++;renderController?.abort();downloadPdfCache=null;
  if(rendered.value?.id!==item?.id){rendered.value=null;previewPages.value=[];textTargets.value=[];}
  pdfError.value='';error.value='';warnings.value=[];clearTimeout(scheduled);
  if(!current.value){pending=false;busy.value=false;engravingKey='';score.value?.replaceChildren();return;}
  busy.value=true;
  pending=true;scheduled=setTimeout(renderPending,100);
}

watch(current,()=>{if(ready.value)scheduleRender();},{deep:true,flush:'sync'});
watch(()=>i18n.global.locale.value,()=>{if(ready.value)scheduleRender(false);});
watch(dark,value=>{document.body.dataset.fluentTheme=value?'dark':'light';try{localStorage.setItem('svp-vocal-score.theme',value?'dark':'light');}catch{}},{immediate:true});

function readableError(cause){
  const text=String(cause?.message||cause);
  if(text.includes('Select at least one'))return t('请至少选择一个人声声部。');
  if(text.includes('Invalid SVP JSON'))return t('文件不是有效的 SVP JSON，请检查文件是否完整。');
  if(text.includes('expected a tracks array'))return t('这个 JSON 文件不是 Synthesizer V 工程。');
  return translateError(cause);
}

const size=(value,low,high,otherwise)=>Math.min(high,Math.max(low,Number(value)||otherwise));
function layoutOptions(item){return{title:item.title,header:item.settings.header,by:item.settings.by,fontFamily:fonts[item.settings.font],lyricFontSize:size(item.settings.lyricSize,10,24,14),titleFontSize:size(item.settings.titleSize,16,36,24),headerFontSize:size(item.settings.headerSize,9,20,12),showPageNumbers:item.settings.pageNumbers,showMeasureNumbers:item.settings.measureNumbers};}
function pageMargin(item){const value=item.settings.margin;return value===''||value==null||!Number.isFinite(Number(value))?10:Math.min(30,Math.max(0,Number(value)));}
function pitchOptions(item){return{enabled:Boolean(item.settings.useTuning),thresholdCents:Number(item.settings.threshold)};}

async function renderPending(){
  if(running||!pending||!current.value)return;
  running=true;busy.value=true;
  while(pending&&current.value){
    pending=false;const item=current.value,version=revision;renderController=new AbortController();
    try{
      const settings=item.settings,conversionKey=JSON.stringify([item.id,item.project,[...item.selected],settings.grid,item.transpose,item.fifths,settings.merge,settings.modulation,settings.triplets,settings.noteMerge,pitchOptions(item)]);
      if(conversionCache?.key!==conversionKey){
        const converted=createScore(item.project,{trackIds:[...item.selected],grid:Number(settings.grid),transpose:item.transpose,fifths:item.fifths,mergeContinuations:settings.merge,modulation:settings.modulation,triplets:Boolean(settings.triplets),noteMerge:settings.noteMerge,preserveOrder:true,pitchAdjustment:pitchOptions(item)});
        const found=analyzeScore(converted.model);found.repeats.forEach((repeat,index)=>{repeat.label=index<26?String.fromCharCode(65+index):`R${index+1}`;});
        conversionCache={key:conversionKey,converted,found};
      }
      const {found}=conversionCache;
      const annotated=annotateScore(conversionCache.converted.xml,found,{showChords:settings.showChords,showRepeats:settings.showRepeats,choices:item.chordChoices,translate:t});
      const layout=layoutOptions(item),converted={...conversionCache.converted,xml:scoreMetadata(annotated,layout)};
      // Staff pages get their title, header and page numbers from decoratePages; only numbered notation reserves room for them while engraving.
      const margin=pageMargin(item),pageText=settings.view==='staff'?[]:[margin,layout.titleFontSize,layout.headerFontSize,Boolean(layout.title),Boolean(layout.header),Boolean(layout.by),layout.showPageNumbers];
      const nextEngravingKey=JSON.stringify([annotated,settings.view,settings.paperSize,settings.orientation,layout.fontFamily,layout.lyricFontSize,layout.showMeasureNumbers,...pageText]);
      await nextTick();
      if(nextEngravingKey!==engravingKey){
      score.value.replaceChildren();engravingMessages=[];
      if(settings.view==='staff'){
        await renderStaffScore(score.value,converted.xml,{...layout,paperSize:settings.paperSize,orientation:settings.orientation,model:converted.model});
      }else{
        const dimensions=getPaperDimensions(settings.paperSize,settings.orientation);
        const header=layout.title?layout.headerFontSize+layout.titleFontSize+(layout.by?layout.headerFontSize:0)+24:layout.header||layout.by?Math.max(30,layout.headerFontSize*(layout.by?2:1)+12):0;
        const numbered=await renderJianpu(converted.xml,score.value,{...layout,width:(dimensions.width-margin*2)*5,height:(dimensions.height-margin*2)*5-header-(layout.showPageNumbers?24:0),showPageNumbers:false,drawTitle:false,model:converted.model});engravingMessages.push(...numbered.warnings);
      }
      if(version!==revision)continue;
      engravingKey=nextEngravingKey;
      }
      const pages=decoratePages(score.value,layout);
      textTargets.value=collectScoreTextTargets(pages,item,margin);previewPages.value=pages;
      rendered.value={id:item.id,result:converted,analysis:found,pages,margin,paper:getPaperDimensions(settings.paperSize,settings.orientation)};warnings.value=[...converted.warnings,...engravingMessages];
    }catch(cause){if(version===revision){engravingKey='';rendered.value=null;previewPages.value=[];textTargets.value=[];error.value=readableError(cause);score.value?.replaceChildren();}}
  }
  running=false;busy.value=false;
}

async function importFiles(files){
  const failures=[];let last;
  for(const file of files){
    try{
      if(!formatsFor(file.name).length)throw new Error(t('不支持此文件类型。'));
      if(file.size>25*1024*1024)throw new Error(t('文件超过 25 MB，请缩小工程后再导入。'));
      const bytes=new Uint8Array(await file.arrayBuffer()),project=await importProject(bytes,file.name);
      // Instrumental projects start in score order; afterwards the part list order is the user's.
      if(project.tracks.some(track=>track.instrument))project.tracks.sort((a,b)=>(a.instrument?.order??80)-(b.instrument?.order??80));
      if(!project.tracks.length)throw new Error(t('工程中没有可转换的音符。'));
      const keys=estimateKeys(createScore(project).model);
      last={id:crypto.randomUUID(),name:file.name,sourceFile:new Blob([bytes],{type:file.type||'application/octet-stream'}),project,title:project.title,selected:new Set(project.tracks.map(track=>track.id)),chordChoices:new Map(),transpose:0,fifths:keys[0]?.fifths??0,pitchMessage:{type:'estimate',key:keys[0]||null},settings:{...defaults(),merge:!project.tracks.some(track=>track.instrument)}};
      documents.value.push(last);await persist(last);
    }catch(cause){failures.push(`${file.name}: ${readableError(cause)}`);}
  }
  if(last)activeId.value=last.id;
  if(failures.length)error.value=failures.join(' ');
  if(fileInput.value)fileInput.value.value='';
}

async function removeDocument(item){
  removing.value.add(item.id);await writes;
  try{await deleteDocument(item.id);}catch{removing.value.delete(item.id);storageMessage('移除失败，请重试。',true);return;}
  const index=documents.value.indexOf(item);documents.value.splice(index,1);
  if(activeId.value===item.id)activeId.value=documents.value[Math.min(index,documents.value.length-1)]?.id||'';
  storageMessage('已移除');
}
function selectTrack(id,value){if(value)current.value.selected.add(id);else current.value.selected.delete(id);}
const dragTrack=ref(-1),dropTarget=ref(-1),dropAbove=ref(true);
function moveTrack(from,to){const tracks=current.value.project.tracks;if(to<0||to>=tracks.length||from===to)return;const [track]=tracks.splice(from,1);tracks.splice(to,0,track);}
function startTrackDrag(index,event){dragTrack.value=index;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));}
function overTrack(index,event){if(dragTrack.value<0)return;const box=event.currentTarget.getBoundingClientRect();dropTarget.value=index;dropAbove.value=event.clientY<box.top+box.height/2;}
function endTrackDrag(){dragTrack.value=-1;dropTarget.value=-1;}
function dropTrack(index){const from=dragTrack.value;if(from<0)return;let to=dropAbove.value?index:index+1;if(from<to)to-=1;moveTrack(from,to);endTrackDrag();}
function renameTrack(track,value){const name=value.trim();if(name&&name!==track.name)track.name=name.slice(0,160);}
function allTracks(){current.value.selected=new Set(current.value.project.tracks.map(track=>track.id));}
function shiftedFifths(fifths,delta){const tonic=((7*fifths+delta)%12+12)%12;return[0,-5,2,-3,4,-1,fifths<0?-6:6,1,-4,3,-2,5][tonic];}
function changeTranspose(change){const item=current.value,previous=item.transpose;item.transpose=Math.min(24,Math.max(-24,item.transpose+change));item.fifths=shiftedFifths(item.fifths,item.transpose-previous);item.pitchMessage={type:'manualTranspose'};}
function autoTranspose(){
  try{const item=current.value;const model=createScore(item.project,{trackIds:[...item.selected],grid:Number(s.value.grid),mergeContinuations:s.value.merge,pitchAdjustment:pitchOptions(item)}).model;
    const[low,high]=s.value.targetRange.split(',').map(Number),recommendation=recommendTranspose(model,{low,high});if(!recommendation.sourceRange)throw new Error(t('请选择含音符的人声声部。'));
    item.fifths=recommendation.keyAfter?.fifths??shiftedFifths(item.fifths,recommendation.semitones-item.transpose);item.transpose=recommendation.semitones;item.pitchMessage={type:'auto',recommendation};
  }catch(cause){error.value=readableError(cause);}
}
const chordKey=chord=>`${chord.measureIndex}:${chord.offset}`;
const selectedChord=chord=>current.value.chordChoices.has(chordKey(chord))?current.value.chordChoices.get(chordKey(chord)):chord.candidates[0]?.symbol;
function chordBeat(chord){const meter=result.value.model.measures[chord.measureIndex]?.meter;return Number((1+chord.offset/(result.value.model.divisions*4/(meter?.denominator||4))).toFixed(2));}
function download(data,suffix,mime){const name=(current.value?.title||t('织音机')).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');const url=URL.createObjectURL(new Blob([data],{type:mime}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name+suffix;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportXml(){if(canExport.value)download(result.value.xml,'.musicxml','application/vnd.recordare.musicxml+xml;charset=utf-8');}
function exportSvg(){
  if(!canExport.value)return;const pages=[...score.value.querySelectorAll('svg')].filter(svg=>!svg.parentElement.closest('svg')),combined=document.createElementNS('http://www.w3.org/2000/svg','svg');combined.setAttribute('xmlns','http://www.w3.org/2000/svg');let height=0,width=0;
  for(const source of pages){const bounds=source.viewBox.baseVal,w=bounds.width,h=bounds.height,copy=source.cloneNode(true);copy.setAttribute('x','0');copy.setAttribute('y',String(height));copy.setAttribute('width',String(w));copy.setAttribute('height',String(h));combined.append(copy);width=Math.max(width,w);height+=h;}
  combined.setAttribute('viewBox',`0 0 ${width} ${height}`);combined.setAttribute('width',String(width));combined.setAttribute('height',String(height));combined.setAttribute('style','background:white');download(new XMLSerializer().serializeToString(combined),s.value.view==='staff'?'_staff.svg':'_jianpu.svg','image/svg+xml;charset=utf-8');
}
async function exportPdf(){
  if(!canExport.value)return;
  const version=revision,item=current.value,pages=rendered.value.pages;
  exportingPdf.value=true;
  try{
    if(!downloadPdfCache)downloadPdfCache=await createPdf(pages,{paperSize:item.settings.paperSize,orientation:item.settings.orientation,margin:rendered.value.margin,title:item.title,signal:renderController.signal});
    if(version===revision)download(downloadPdfCache,'.pdf','application/pdf');
  }catch(cause){if(version===revision)pdfError.value=readableError(cause);}
  finally{exportingPdf.value=false;}
}
function editScoreText({target,value}){if(!busy.value&&!exportingPdf.value)applyScoreTextEdit(current.value,target,value);}
function openSidebar(section){activeSidebar.value=section;sidebarCollapsed.value=false;}
function showNotices(){openSidebar('analysis');if(matchMedia('(max-width:700px)').matches)mobileSidebarOpen.value=true;}
function preventDrop(event){event.preventDefault();}
function drop(event){dragging.value=false;importFiles(event.dataTransfer.files);}
function startupStep(id,label,status='pending',detail=''){const steps=startupSteps.value,index=steps.findIndex(step=>step.id===id),step={id,label,status,detail};if(index<0)steps.push(step);else steps[index]=step;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Resolves once the current render settles, or after limit ms so a very large score never blocks the start screen.
function renderSettled(limit){
  return new Promise(resolve=>{let stop=null,settled=false;const finish=()=>{if(settled)return;settled=true;stop?.();clearTimeout(timer);resolve();};const timer=setTimeout(finish,limit);stop=watch(busy,value=>{if(!value)finish();});if(!busy.value)finish();});
}
onMounted(async()=>{
  window.addEventListener('dragover',preventDrop);window.addEventListener('drop',preventDrop);
  const engine=Boolean(globalThis.opensheetmusicdisplay?.OpenSheetMusicDisplay);
  startupStep('engine',t('加载制谱引擎'),engine?'ok':'warn',engine?'':t('五线谱暂不可用，简谱仍可使用'));
  startupStep('fonts',t('准备字体'));
  await Promise.race([document.fonts?.ready,pause(3000)]);
  startupStep('fonts',t('准备字体'),'ok');
  startupStep('storage',t('恢复浏览器中的工程'));
  try{const records=await loadDocuments();documents.value=records.map(record=>({...record,settings:{...defaults(),...record.settings},selected:new Set(record.selected),chordChoices:new Map(record.chordChoices)}));activeId.value=documents.value[0]?.id||'';storageMessage(documents.value.length?'已保存在此浏览器':'文件和设置保存在当前浏览器');startupStep('storage',t('恢复浏览器中的工程'),'ok',t('{count} 个工程',{count:documents.value.length}));}
  catch{storageMessage('无法读取浏览器存储；请检查浏览器的数据权限。',true);startupStep('storage',t('恢复浏览器中的工程'),'warn',t('无法读取浏览器存储；请检查浏览器的数据权限。'));}
  const worker=typeof Worker==='function';
  startupStep('export',t('检查 PDF 导出'),worker?'ok':'warn',worker?'':t('此浏览器无法在后台生成 PDF'));
  ready.value=true;
  if(current.value){
    const label=t('排版《{title}》',{title:current.value.title||current.value.name});
    startupStep('render',label);scheduleRender(false);await renderSettled(15000);
    startupStep('render',label,error.value||busy.value?'warn':'ok',error.value||(busy.value?t('仍在排版，可先进入'):''));
  }
  startupReady.value=true;
  await pause(matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);
  startupVisible.value=false;
});
onBeforeUnmount(()=>{clearTimeout(scheduled);renderController?.abort();window.removeEventListener('dragover',preventDrop);window.removeEventListener('drop',preventDrop);});
</script>

<template>
  <Transition name="startup-fade"><StartupScreen v-if="startupVisible" :steps="startupSteps" :ready="startupReady"/></Transition>
  <header class="topbar" :inert="startupVisible||undefined" :aria-hidden="startupVisible||undefined">
    <a class="brand" href="./" :aria-label="t('织音机首页')"><img class="brand-logo" :src="logoUrl" alt="" width="30" height="30"><span>{{ t('织音机') }}</span></a>
    <a class="main-menu-link fluent-button fluent-button--subtle" href="/" :aria-label="t('返回 Tiny Projects 主菜单')"><span aria-hidden="true">←</span><span class="main-menu-label">{{ t('返回主菜单') }}</span><span class="main-menu-short" aria-hidden="true">{{ t('主菜单') }}</span></a>
    <button id="theme-button" class="fluent-button fluent-button--subtle" :aria-pressed="dark" :aria-label="t(dark?'切换浅色主题':'切换深色主题')" @click="dark=!dark">{{ t(dark?'浅色':'深色') }}</button>
    <LanguagePicker/>
  </header>
  <div class="workspace" :inert="startupVisible||undefined" :aria-hidden="startupVisible||undefined" :class="{'sidebar-collapsed':sidebarCollapsed,'sidebar-open':mobileSidebarOpen}" @keydown.esc="mobileSidebarOpen=false">
    <aside id="workspace-sidebar" class="sidebar" :aria-label="t('工作区导航')">
      <div class="sidebar-navigation"><button id="sidebar-collapse" class="sidebar-nav-item sidebar-toggle" :aria-label="t(sidebarCollapsed?'展开侧栏':'收起侧栏')" :aria-expanded="!sidebarCollapsed" :title="t(sidebarCollapsed?'展开侧栏':'收起侧栏')" @click="sidebarCollapsed=!sidebarCollapsed"><span class="sidebar-nav-icon" aria-hidden="true">☰</span></button><nav :aria-label="t('工作区栏目')"><button v-for="item in sidebarItems" :key="item[0]" :data-section="item[0]" class="sidebar-nav-item" :class="{active:activeSidebar===item[0]}" :aria-current="activeSidebar===item[0]?'page':undefined" :aria-label="t(item[1])" :title="sidebarCollapsed?t(item[1]):undefined" @click="openSidebar(item[0])"><span class="sidebar-nav-icon" aria-hidden="true">{{ {files:'▤',settings:'⚙',analysis:'⌁',lyrics:'♫',tuning:'♭'}[item[0]] }}</span><span class="sidebar-nav-label">{{ t(item[1]) }}</span></button></nav></div>
      <div class="sidebar-content">
      <label v-show="activeSidebar==='files'&&documents.length" id="dropzone" class="dropzone" :class="{dragover:dragging}" tabindex="0" role="button" for="file-input" @keydown.enter.prevent="fileInput.click()" @keydown.space.prevent="fileInput.click()" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent="drop">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V3m0 0-5 5m5-5 5 5M4 15v5h16v-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><strong>{{ t('选择或拖入工程') }}</strong>
      </label>
      <input id="file-input" ref="fileInput" type="file" :accept="ACCEPT" multiple hidden :disabled="!ready" @change="importFiles($event.target.files)">
      <section v-show="activeSidebar==='files'" class="setting-section sidebar-panel"><div class="section-label"><h2>{{ t('工程文件') }}</h2><span id="file-count">{{ documents.length }}</span></div>
        <div id="file-list" class="file-list" :aria-label="t('工程文件列表')"><div v-for="item in documents" :key="item.id" class="file-row"><button class="fluent-button fluent-button--subtle file-item" :class="{active:item.id===activeId}" :aria-pressed="item.id===activeId" @click="activeId=item.id"><span class="file-symbol" aria-hidden="true">♬</span><span>{{ item.name }}<small>{{ t('{format} · {count} 个声部',{format:item.project.format||'Synthesizer V Studio',count:item.project.tracks.length}) }}<b v-if="item.project.beta" class="beta-badge">Beta</b></small></span><span class="file-selected">{{ item.id===activeId?'●':'' }}</span></button><button class="fluent-button fluent-button--subtle file-remove" :disabled="removing.has(item.id)" :aria-label="t('移除文件 {name}',{name:item.name})" :title="t('移除文件')" @click="removeDocument(item)">×</button></div></div>
        <p id="storage-status" class="setting-hint" :class="{error:storageError}" role="status" aria-live="polite">{{ t(storageState) }}</p>
      </section>
      <section v-show="activeSidebar==='files'&&current" class="setting-section sidebar-panel"><div class="section-label"><h2>{{ t('声部') }}</h2><button id="all-tracks" class="fluent-button fluent-button--subtle text-button" :disabled="!current" @click="allTracks">{{ t('全选') }}</button></div><div id="track-list"><div v-for="(track,index) in current?.project.tracks||[]" :key="track.id" class="track-row" :class="{dragging:dragTrack===index,'drop-before':dropTarget===index&&dropAbove&&dragTrack!==index,'drop-after':dropTarget===index&&!dropAbove&&dragTrack!==index}" draggable="true" @dragstart="startTrackDrag(index,$event)" @dragover.prevent="overTrack(index,$event)" @drop.prevent="dropTrack(index)" @dragend="endTrackDrag"><span class="track-handle" :title="t('拖动排序')" aria-hidden="true">⋮⋮</span><FluentCheckbox class="track-item" :model-value="current.selected.has(track.id)" :aria-label="track.name" @update:model-value="selectTrack(track.id,$event)"/><input class="track-name-input" :value="track.name" :aria-label="t('声部名称')" maxlength="160" autocomplete="off" draggable="false" @dragstart.stop.prevent @change="renameTrack(track,$event.target.value)" @keydown.enter="$event.target.blur()"><small>{{ t('{count} 音符',{count:track.notes.length}) }}</small><span class="track-move"><button class="fluent-button fluent-button--subtle" type="button" :disabled="index===0" :aria-label="t('上移')" @click="moveTrack(index,index-1)">↑</button><button class="fluent-button fluent-button--subtle" type="button" :disabled="index===current.project.tracks.length-1" :aria-label="t('下移')" @click="moveTrack(index,index+1)">↓</button></span></div></div></section>
      <section v-show="activeSidebar==='settings'" class="setting-section settings sidebar-panel"><h2>{{ t('谱面设置') }}</h2>
        <label for="score-title">{{ t('乐谱标题') }}<input id="score-title" :value="current?.title||''" class="fluent-field__input" type="text" maxlength="160" autocomplete="off" :disabled="!current" @input="current.title=$event.target.value"></label>
        <div class="setting-row"><label for="grid">{{ t('节奏网格') }}<select id="grid" v-model.number="s.grid" class="fluent-select__control" :disabled="!current"><option :value="8">{{ t('八分音符') }}</option><option :value="16">{{ t('十六分音符') }}</option><option :value="32">{{ t('三十二分音符') }}</option></select></label><label for="key">{{ t('调号') }}<select id="key" :value="current?.fifths||0" class="fluent-select__control" :disabled="!current" @change="current.fifths=Number($event.target.value);current.pitchMessage={type:'manualKey'}"><option v-for="(fifths,index) in keyChoices" :key="fifths" :value="fifths">{{ keyLabels[index] }} · {{ fifths===0?t('无升降号'):`${Math.abs(fifths)}${fifths>0?'♯':'♭'}` }}</option></select></label></div>
        <div id="triplet-setting"><FluentCheckbox v-model="s.triplets" :disabled="!current" :label="t('识别三连音')"/></div>
        <div class="transpose-row"><span>{{ t('移调') }}</span><div class="stepper"><button id="transpose-down" class="fluent-button" :disabled="!current" :aria-label="t('降低半音')" @click="changeTranspose(-1)">−</button><output id="transpose-value">{{ signed(current?.transpose||0) }}</output><button id="transpose-up" class="fluent-button" :disabled="!current" :aria-label="t('升高半音')" @click="changeTranspose(1)">+</button></div><span class="unit">{{ t('半音') }}</span></div>
        <div class="pitch-tools"><label for="target-range">{{ t('目标音区') }}<select id="target-range" v-model="s.targetRange" class="fluent-select__control" :disabled="!current"><option value="48,72">{{ t('较低 · C3–C5') }}</option><option value="55,79">{{ t('中间 · G3–G5') }}</option><option value="60,84">{{ t('较高 · C4–C6') }}</option></select></label><button id="auto-transpose" class="fluent-button" :disabled="!current" @click="autoTranspose">{{ t('自动移调') }}</button></div>
        <p id="pitch-summary" class="setting-hint" aria-live="polite"><template v-if="current">{{ t('音域 {range} · {shift} 半音。',{range,shift:signed(current.transpose)}) }}{{ pitchMessage }}</template></p><div id="modulation-setting"><FluentCheckbox v-model="s.modulation" :disabled="!current" :label="t('识别转调')"/></div><div id="tuning-switch"><FluentCheckbox v-model="s.useTuning" :disabled="!current" :label="t('考虑调校参数')"/></div><p v-if="keyChangeSummary" id="modulation-summary" class="setting-hint">{{ keyChangeSummary }}</p>
      </section>
      <section v-show="activeSidebar==='settings'" class="setting-section settings typography-settings sidebar-panel"><h2>{{ t('字体与页面') }}</h2>
        <div class="setting-row"><label for="paper-size">{{ t('纸张') }}<select id="paper-size" v-model="s.paperSize" class="fluent-select__control" :disabled="!current"><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="a3">A3</option><option value="a5">A5</option></select></label><label for="page-orientation">{{ t('方向') }}<select id="page-orientation" v-model="s.orientation" class="fluent-select__control" :disabled="!current"><option value="portrait">{{ t('纵向') }}</option><option value="landscape">{{ t('横向') }}</option></select></label></div>
        <label for="score-font">{{ t('谱面文字字体') }}<select id="score-font" v-model="s.font" class="fluent-select__control" :disabled="!current"><option value="serif">{{ t('宋体 / 衬线') }}</option><option value="sans">{{ t('黑体 / 无衬线') }}</option><option value="kai">{{ t('楷体') }}</option><option value="mono">{{ t('等宽') }}</option></select></label>
        <div class="setting-row"><label for="lyric-size">{{ t('歌词字号') }}<input id="lyric-size" v-model.number="s.lyricSize" class="fluent-field__input" type="number" min="10" max="24" :disabled="!current"></label><label for="title-size">{{ t('标题字号') }}<input id="title-size" v-model.number="s.titleSize" class="fluent-field__input" type="number" min="16" max="36" :disabled="!current"></label></div>
        <label for="page-header">{{ t('每页页眉') }}<input id="page-header" v-model="s.header" class="fluent-field__input" type="text" maxlength="120" :placeholder="t('可留空')" :disabled="!current"></label><label for="score-by">{{ t('by 署名') }}<input id="score-by" v-model="s.by" class="fluent-field__input" type="text" maxlength="100" :placeholder="t('首页标题下方')" :disabled="!current"></label>
        <div class="setting-row"><label for="header-size">{{ t('页眉 / 署名字号') }}<input id="header-size" v-model.number="s.headerSize" class="fluent-field__input" type="number" min="9" max="20" :disabled="!current"></label><label for="page-margin">{{ t('页边距 (mm)') }}<input id="page-margin" v-model.number="s.margin" class="fluent-field__input" type="number" min="0" max="30" :disabled="!current"></label></div>
        <div id="number-settings"><FluentCheckbox v-model="s.pageNumbers" :disabled="!current" :label="t('页码')"/><FluentCheckbox v-model="s.measureNumbers" :disabled="!current" :label="t('小节号')"/></div>
      </section>
      <section v-show="activeSidebar==='settings'" class="setting-section sidebar-panel"><h2>{{ t('声部整理') }}</h2><div id="merge-setting"><FluentCheckbox v-model="s.merge" :disabled="!current" :label="t('合并分散独唱')"/></div><label for="note-merge" class="note-merge">{{ t('合并连续音符') }}<select id="note-merge" v-model="s.noteMerge" class="fluent-select__control" :disabled="!current"><option value="none">{{ t('不合并') }}</option><option value="low">{{ t('低 · 同音延长') }}</option><option value="medium">{{ t('中 · 含元音续唱') }}</option><option value="high">{{ t('高 · 含短装饰音') }}</option></select></label><p v-if="result?.noteMerge?.mergedCount" id="note-merge-summary" class="setting-hint">{{ t('{count} 个续唱音符并入前一字',{count:result.noteMerge.mergedCount}) }}</p><p id="merge-summary" class="setting-hint"><template v-if="result?.merging.enabled">{{ t('{source} → {output} 个谱表，{count} 个音符向上合并',{source:result.merging.sourcePartCount,output:result.merging.outputPartCount,count:result.merging.movedNoteCount}) }}</template></p><details v-if="result?.merging.enabled" id="merge-details"><summary>{{ t('查看整理明细') }}</summary><div id="merge-detail-list"><p v-for="move in result.merging.moves" :key="move.fromId+move.toId">{{ t('{from} → {to}：{count} 个音符',{from:move.fromName,to:move.toName,count:move.count}) }}</p><p v-for="role in result.merging.roles.filter(role=>role.overlapRatio>0)" :key="role.id">{{ t('{name}：存在重叠发声，可能为和声或叠唱',{name:role.name}) }}</p></div></details></section>
      <section v-show="activeSidebar==='analysis'" id="analysis-sidebar-panel" class="sidebar-panel"><section v-if="current&&warningGroups.length" id="notice-panel" class="notice-panel"><h2>{{ t('转换提示') }}<span>{{ t('{count} 条',{count:warnings.length}) }}</span></h2><div v-for="group in warningGroups" :key="group.name" class="notice-group"><h3>{{ group.name||t('整体') }}</h3><ul><li v-for="(item,index) in group.items" :key="index">{{ noticeText(item,group.name) }}</li></ul></div></section><details v-if="current" id="analysis-panel" class="analysis-panel" open><summary>{{ t('乐段与和声分析') }}<span id="analysis-count">{{ t('{repeats} 组重复 · {chords} 处和弦候选',{repeats:analysis.repeats.length,chords:analysis.chords.length}) }}</span></summary><div class="analysis-body"><div id="annotation-settings"><FluentCheckbox v-model="s.showRepeats" :label="t('标记重复乐段')"/><FluentCheckbox v-model="s.showChords" :label="t('谱面显示推测和弦')"/></div><div class="analysis-columns"><section><h3>{{ t('重复乐段') }}</h3><div id="repeat-list"><div v-for="repeat in analysis.repeats" :key="repeat.id" class="repeat-item"><strong>{{ repeat.label }} · {{ t('{length} 小节 × {count}',{length:repeat.length,count:repeat.occurrences.length}) }}</strong><span>{{ repeat.occurrences.map(item=>`${item.startMeasure}–${item.endMeasure}`).join(' / ') }}</span><span>{{ t(repeat.lyricsDiffer?'旋律与节奏相同，歌词有差异':'旋律、节奏与歌词相同') }}</span></div><p v-if="!analysis.repeats.length" class="analysis-empty">{{ t('未检测到至少两个小节的完全重复乐段。') }}</p></div></section><section><h3>{{ t('和弦候选') }} <span>{{ t('按小节') }}</span></h3><div id="chord-list"><div v-for="chord in analysis.chords" :key="chordKey(chord)" class="chord-item"><label>{{ t('{measure} 小节 · {beat} 拍',{measure:chord.measureIndex+1,beat:chordBeat(chord)}) }}</label><select class="fluent-select__control" :aria-label="t('推测和弦')" :value="selectedChord(chord)" @change="current.chordChoices.set(chordKey(chord),$event.target.value)"><option v-for="candidate in chord.candidates" :key="candidate.symbol" :value="candidate.symbol">{{ candidate.symbol }} · {{ t('匹配 {percent}%',{percent:Math.round(candidate.match*100)}) }}</option><option value="">{{ t('不标注') }}</option></select><small>{{ t(chord.evidence==='simultaneous'?'同时发声':'音符汇总') }}</small></div><p v-if="!analysis.chords.length" class="analysis-empty">{{ t('没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。') }}</p></div></section></div></div></details></section>
      <section v-show="activeSidebar==='lyrics'" class="sidebar-panel"><details v-if="current" id="lyrics-panel" class="analysis-panel" open><summary>{{ t('歌词与声部文字') }}<span>{{ t('可修改或清空') }}</span></summary><div class="analysis-body"><p class="analysis-disclaimer">{{ t('单独的 - 表示延长前一个字。') }}</p><div id="lyric-editor"><LyricEditor :key="current.id" :project="current.project"/></div></div></details></section>
      <section v-show="activeSidebar==='tuning'" class="sidebar-panel"><details v-if="current" id="tuning-panel" class="analysis-panel" open><summary>{{ t('音高微调') }}<span id="tuning-count">{{ t('{adjusted} 个音符修正 · {detuned} 个音分微调',{adjusted:adjustment.adjustedNoteCount,detuned:sourceSummary.nonzeroDetuneNotes||0}) }}</span></summary><div class="analysis-body"><div id="tuning-settings"><FluentCheckbox v-model="s.useTuning" :label="t('考虑调校参数')"/><label for="tuning-threshold">{{ t('偏移阈值') }}<select id="tuning-threshold" v-model.number="s.threshold" class="fluent-select__control"><option v-for="value in [50,75,100,150,200]" :key="value" :value="value">{{ t('{count} 音分',{count:value}) }}</option></select></label></div><div id="tuning-details"><p>{{ t('工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。',{points:sourceSummary.pitchDeltaPoints||0,curves:sourceSummary.pitchControlCurves||0,explicit:sourceSummary.explicitExpressionNotes||0,inherited:sourceSummary.systemExpressionNotes||0}) }}</p><p v-if="adjustment.approximateNoteCount">{{ t('{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。',{count:adjustment.approximateNoteCount}) }}</p><div v-if="adjustment.notes.length" class="tuning-table-wrap"><table class="tuning-table"><thead><tr><th v-for="label in ['来源声部 / 音符','修正前','修正后','代表偏移','剩余音分']" :key="label">{{ t(label) }}</th></tr></thead><tbody><tr v-for="change in adjustment.notes" :key="`${change.sourceTrackId}:${change.sourceNoteIndex}`"><td>{{ trackName(change.sourceTrackId) }} / {{ change.sourceNoteIndex+1 }}</td><td>{{ noteName(change.fromPitch) }}</td><td>{{ noteName(change.toPitch) }}</td><td>{{ cents(change.cents) }}</td><td>{{ cents(change.residualCents) }}</td></tr></tbody></table></div><p v-else>{{ t('当前所选声部没有触发半音修正。') }}</p><details v-if="tuningFields.length"><summary>{{ t('查看滑音与颤音参数范围') }}</summary><p v-for="field in tuningFields" :key="field.label+field.key">{{ t(field.label) }} · {{ field.key }}: {{ Number(field.low.toFixed(4)) }}–{{ Number(field.high.toFixed(4)) }} ({{ field.count }})</p></details></div></div></details></section>
      <footer class="sidebar-footer"><a href="https://github.com/opensheetmusicdisplay/opensheetmusicdisplay" target="_blank" rel="noopener">OpenSheetMusicDisplay</a> · <a href="https://github.com/lsy-404/platform-kit" target="_blank" rel="noopener">Platform Kit Fluent</a> · <a href="https://github.com/sdercolin/utaformatix3" target="_blank" rel="noopener">UtaFormatix</a><br>{{ t('感谢奥莉安多提供的样本数据和改善建议') }}</footer></div>
    </aside>
    <div class="sidebar-backdrop" aria-hidden="true" @click="mobileSidebarOpen=false"></div>
    <main>
      <div class="score-toolbar" :class="{'score-toolbar--empty':!current}"><button id="sidebar-mobile-toggle" class="fluent-button fluent-button--subtle mobile-sidebar-toggle" :aria-controls="'workspace-sidebar'" :aria-expanded="mobileSidebarOpen" :aria-label="t(mobileSidebarOpen?'关闭工作区栏目':'打开工作区栏目')" @click="mobileSidebarOpen=!mobileSidebarOpen">☰</button><div class="score-heading"><h1 id="document-title">{{ current?(current.title||current.name):'' }}</h1><p v-if="current" class="score-meta"><span id="source-meta">{{ `${current.project.meters[0].numerator}/${current.project.meters[0].denominator} · ♩ = ${current.project.tempos[0].bpm}` }}</span><span id="note-meta">{{ result?t('{parts} 声部 · {count} 音符',{parts:result.stats.partCount,count:result.stats.noteCount}):'' }}</span><span id="measure-meta">{{ result?t('{count} 小节',{count:result.stats.measureCount}):'' }}</span><button v-if="warnings.length" id="notice-button" type="button" class="notice-button" :title="t('在分析页查看转换提示')" @click="showNotices">{{ t('{count} 条提示',{count:warnings.length}) }}</button></p></div><div class="actions"><button id="pdf-button" class="fluent-button fluent-button--primary" :disabled="!canExport" @click="exportPdf">{{ t(exportingPdf?'正在生成 PDF…':'下载 PDF') }}</button><button id="export-button" class="fluent-button" :disabled="!canExport" :title="t('导出 MusicXML')" @click="exportXml">MusicXML</button><button id="svg-button" class="fluent-button" :disabled="!canExport" :title="t('导出 SVG')" @click="exportSvg">SVG</button></div></div>
      <div v-if="error||pdfError" id="message" class="fluent-notice error fluent-notice--danger" role="status" aria-live="polite">{{ error||pdfError }}</div>
      <div class="score-stage">
        <label v-if="!current" for="file-input" class="empty-score" :class="{dragover:dragging}" tabindex="0" role="button" @keydown.enter.prevent="fileInput.click()" @keydown.space.prevent="fileInput.click()" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent="drop"><img :src="logoUrl" alt="" width="64" height="64"><strong>{{ t('选择或拖入工程') }}</strong><span class="format-list">{{ formatList }}</span><span>{{ t('文件仅在本机处理') }}</span></label>
        <ScoreViewer v-else :pages="previewPages" :paper="rendered?.paper||paperDimensions" :margin="rendered?.margin??10"><template #toolbar-start><div class="view-switch" role="group" :aria-label="t('记谱方式')"><button v-for="mode in ['staff','jianpu']" :id="`${mode}-view`" :key="mode" class="fluent-button" :aria-pressed="s.view===mode" @click="s.view=mode">{{ t(mode==='staff'?'五线谱':'简谱') }}</button></div><span v-if="busy" id="busy" class="busy" role="status"><span class="spinner"/><span class="busy-label">{{ t('正在排版乐谱…') }}</span></span></template><template #page-overlay="{pageNumber}"><ScoreTextOverlay :targets="textTargets" :page-number="pageNumber" :disabled="busy||exportingPdf" @commit="editScoreText"/></template></ScoreViewer>
      </div>
      <div id="score" ref="score" class="score-source" :style="{width:`${paperDimensions.width*3.78}px`}" aria-hidden="true"/>
    </main>
  </div>
</template>
