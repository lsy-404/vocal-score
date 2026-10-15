<script setup>
import {computed,ref,shallowRef,watch,nextTick,onMounted,onBeforeUnmount,toRaw,defineAsyncComponent} from 'vue';
import {parseSvp,createScore} from './lib/converter.js';
import {renderJianpu} from './lib/jianpu.js';
import {analyzeScore,estimateKeys,recommendTranspose} from './lib/analysis.js';
import {annotateScore,scoreMetadata} from './lib/annotations.js';
import {decoratePages} from './lib/page-layout.js';
import {loadDocuments,saveDocument,deleteDocument} from './lib/storage.js';
import {createPdf,getPaperDimensions} from './lib/pdf.js';
import {collectScoreTextTargets,applyScoreTextEdit} from './lib/score-text.js';
import {t,i18n} from './i18n.js';
import {translateWarning,translateError} from './ui-messages.js';
import FluentCheckbox from './components/FluentCheckbox.vue';
import LanguagePicker from './components/LanguagePicker.vue';
import ScoreTextOverlay from './components/ScoreTextOverlay.vue';
const LyricEditor=defineAsyncComponent(()=>import('./components/LyricEditor.vue'));
const PdfViewer=defineAsyncComponent(()=>import('./components/PdfViewer.vue'));

const documents=ref([]),activeId=ref(''),ready=ref(false),busy=ref(false),dragging=ref(false);
const activeSidebar=ref('files'),sidebarCollapsed=ref(false),mobileSidebarOpen=ref(false);
const sidebarItems=[['files','工程文件'],['settings','谱面设置'],['analysis','乐段与和声分析'],['lyrics','歌词与声部文字'],['tuning','音高微调']];
const score=ref(null),paper=ref(null),fileInput=ref(null),rendered=shallowRef(null);
const pdfBytes=shallowRef(null),pdfError=ref(''),textTargets=shallowRef([]),exportingPdf=ref(false);
const error=ref(''),warnings=ref([]),storageState=ref('正在恢复文件…'),storageError=ref(false);
function preferredTheme(){try{const value=localStorage.getItem('svp-vocal-score.theme');if(value)return value==='dark';}catch{}return matchMedia('(prefers-color-scheme: dark)').matches;}
const dark=ref(preferredTheme());
const defaults=()=>({grid:16,view:'staff',targetRange:'60,84',merge:true,showChords:false,showRepeats:true,pitchAdjustment:true,threshold:50,font:'serif',lyricSize:14,titleSize:24,headerSize:12,header:'',by:'',pageNumbers:true,measureNumbers:true,paperSize:'a4',orientation:'portrait'});
const emptySettings=defaults();
const current=computed(()=>documents.value.find(item=>item.id===activeId.value));
const s=computed(()=>current.value?.settings||emptySettings);
const result=computed(()=>rendered.value?.result);
const analysis=computed(()=>rendered.value?.analysis||{repeats:[],chords:[]});
const canExport=computed(()=>Boolean(result.value)&&Boolean(pdfBytes.value)&&!busy.value&&!exportingPdf.value);
const paperDimensions=computed(()=>getPaperDimensions(s.value.paperSize,s.value.orientation));
const fonts={serif:'"SimSun", "Songti SC", "Times New Roman", serif',sans:'"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',kai:'"KaiTi", "STKaiti", "SimSun", serif',mono:'"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace'};
const keyChoices=[0,1,2,3,4,5,6,7,-1,-2,-3,-4,-5,-6,-7];
const keyLabels=['C / a','G / e','D / b','A / f♯','E / c♯','B / g♯','F♯ / d♯','C♯ / a♯','F / d','B♭ / g','E♭ / c','A♭ / f','D♭ / b♭','G♭ / e♭','C♭ / a♭'];
const removing=ref(new Set());
let writes=Promise.resolve(),scheduled,running=false,pending=false,revision=0,requestedSignature='',renderController;
let conversionCache,engravingKey='',engravingMessages=[],downloadPdfCache;
const saveQueue=new Map();let saveQueued=false;

const signed=value=>value>0?`+${value}`:String(value);
function noteName(midi){const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];return Number.isFinite(midi)?`${names[((midi%12)+12)%12]}${Math.floor(midi/12)-1}`:'—';}
const keyName=key=>`${key.tonic} ${t(key.mode==='minor'?'小调':'大调')}`;
const range=computed(()=>{const pitches=result.value?.model.tracks.flatMap(track=>track.notes.map(note=>note.pitch))||[];return pitches.length?`${noteName(pitches.reduce((value,pitch)=>Math.min(value,pitch),Infinity))}–${noteName(pitches.reduce((value,pitch)=>Math.max(value,pitch),-Infinity))}`:'—';});
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
  rendered.value=null;pdfError.value='';error.value='';warnings.value=[];textTargets.value=[];clearTimeout(scheduled);
  if(!current.value){pending=false;busy.value=false;pdfBytes.value=null;score.value?.replaceChildren();return;}
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
function pitchOptions(item){return{enabled:item.settings.pitchAdjustment,thresholdCents:Number(item.settings.threshold)};}

async function renderPending(){
  if(running||!pending||!current.value)return;
  running=true;busy.value=true;
  while(pending&&current.value){
    pending=false;const item=current.value,version=revision;renderController=new AbortController();
    try{
      const settings=item.settings,conversionKey=JSON.stringify([item.id,item.project,[...item.selected],settings.grid,item.transpose,item.fifths,settings.merge,pitchOptions(item)]);
      if(conversionCache?.key!==conversionKey){
        const converted=createScore(item.project,{trackIds:[...item.selected],grid:Number(settings.grid),transpose:item.transpose,fifths:item.fifths,mergeContinuations:settings.merge,pitchAdjustment:pitchOptions(item)});
        const found=analyzeScore(converted.model);found.repeats.forEach((repeat,index)=>{repeat.label=index<26?String.fromCharCode(65+index):`R${index+1}`;});
        conversionCache={key:conversionKey,converted,found};
      }
      const {found}=conversionCache;
      const annotated=annotateScore(conversionCache.converted.xml,found,{showChords:settings.showChords,showRepeats:settings.showRepeats,choices:item.chordChoices,translate:t});
      const layout=layoutOptions(item),converted={...conversionCache.converted,xml:scoreMetadata(annotated,layout)};
      const nextEngravingKey=JSON.stringify([annotated,settings.view,settings.paperSize,settings.orientation,layout.fontFamily,layout.lyricFontSize,layout.titleFontSize,layout.headerFontSize,Boolean(layout.title),Boolean(layout.header),Boolean(layout.by),layout.showPageNumbers,layout.showMeasureNumbers]);
      await nextTick();
      if(nextEngravingKey!==engravingKey){
      score.value.replaceChildren();engravingMessages=[];
      if(settings.view==='staff'){
        if(!globalThis.opensheetmusicdisplay?.OpenSheetMusicDisplay)throw new Error(t('乐谱排版组件未能加载，请刷新页面后重试。'));
        const osmd=new globalThis.opensheetmusicdisplay.OpenSheetMusicDisplay(score.value,{autoResize:false,backend:'svg',drawTitle:false,drawSubtitle:false,drawComposer:false,drawPartNames:true,drawMeasureNumbers:settings.measureNumbers,drawingParameters:'compacttight'});
        const dimensions=getPaperDimensions(settings.paperSize,settings.orientation);osmd.setCustomPageFormat(dimensions.width,dimensions.height);
        osmd.EngravingRules.DefaultFontFamily=layout.fontFamily;osmd.EngravingRules.VexFlowTextFontFamily=layout.fontFamily;osmd.EngravingRules.LyricsHeight=layout.lyricFontSize/10;osmd.EngravingRules.RenderMeasureNumbersOnlyAtSystemStart=false;
        await osmd.load(converted.xml);
        if(version!==revision)continue;
        osmd.Zoom=0.85;osmd.render();
      }else{
        const dimensions=getPaperDimensions(settings.paperSize,settings.orientation);
        const header=layout.title?layout.headerFontSize+layout.titleFontSize+(layout.by?layout.headerFontSize:0)+24:layout.header||layout.by?Math.max(30,layout.headerFontSize*(layout.by?2:1)+12):0;
        const numbered=await renderJianpu(converted.xml,score.value,{...layout,width:(dimensions.width-20)*5,height:(dimensions.height-20)*5-header-(layout.showPageNumbers?24:0),showPageNumbers:false,drawTitle:false});engravingMessages.push(...numbered.warnings);
      }
      if(version!==revision)continue;
      engravingKey=nextEngravingKey;
      }
      const pages=decoratePages(score.value,layout);
      const targets=collectScoreTextTargets(pages,item);
      const bytes=await createPdf(pages,{paperSize:settings.paperSize,orientation:settings.orientation,title:item.title,dpi:144,signal:renderController.signal});
      if(version!==revision)continue;
      pdfBytes.value=bytes;textTargets.value=targets;rendered.value={result:converted,analysis:found,pages};warnings.value=[...converted.warnings,...engravingMessages];
    }catch(cause){if(version===revision){engravingKey='';error.value=readableError(cause);score.value?.replaceChildren();}}
  }
  running=false;busy.value=false;
}

async function importFiles(files){
  const failures=[];let last;
  for(const file of files){
    try{
      if(!/\.svp$/i.test(file.name))throw new Error(t('请选择 .svp 工程文件。'));
      if(file.size>25*1024*1024)throw new Error(t('文件超过 25 MB，请缩小工程后再导入。'));
      const project=parseSvp(await file.text(),file.name);
      if(!project.tracks.length)throw new Error(t('工程中没有可转换的人声音符。'));
      const keys=estimateKeys(createScore(project).model);
      last={id:crypto.randomUUID(),name:file.name,sourceFile:new Blob([await file.arrayBuffer()],{type:'application/json'}),project,title:project.title,selected:new Set(project.tracks.map(track=>track.id)),chordChoices:new Map(),transpose:0,fifths:keys[0]?.fifths??0,pitchMessage:{type:'estimate',key:keys[0]||null},settings:defaults()};
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
function download(data,suffix,mime){const name=(current.value?.title||t('人声谱')).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');const url=URL.createObjectURL(new Blob([data],{type:mime}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name+suffix;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
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
    if(!downloadPdfCache)downloadPdfCache=await createPdf(pages,{paperSize:item.settings.paperSize,orientation:item.settings.orientation,title:item.title,signal:renderController.signal});
    if(version===revision)download(downloadPdfCache,'.pdf','application/pdf');
  }catch(cause){if(version===revision)pdfError.value=readableError(cause);}
  finally{exportingPdf.value=false;}
}
function editScoreText({target,value}){applyScoreTextEdit(current.value,target,value);}
function openSidebar(section){activeSidebar.value=section;sidebarCollapsed.value=false;}
function preventDrop(event){event.preventDefault();}
function drop(event){dragging.value=false;importFiles(event.dataTransfer.files);}
onMounted(async()=>{
  window.addEventListener('dragover',preventDrop);window.addEventListener('drop',preventDrop);
  try{const records=await loadDocuments();documents.value=records.map(record=>({...record,settings:{...defaults(),...record.settings},selected:new Set(record.selected),chordChoices:new Map(record.chordChoices)}));activeId.value=documents.value[0]?.id||'';storageMessage(documents.value.length?'已保存在此浏览器':'文件和设置保存在当前浏览器');}
  catch{storageMessage('无法读取浏览器存储；请检查浏览器的数据权限。',true);}
  ready.value=true;if(current.value)scheduleRender(false);
});
onBeforeUnmount(()=>{clearTimeout(scheduled);renderController?.abort();window.removeEventListener('dragover',preventDrop);window.removeEventListener('drop',preventDrop);});
</script>

<template>
  <header class="topbar">
    <a class="brand" href="./" :aria-label="t('声谱首页')"><span class="brand-mark" aria-hidden="true">♮</span><span>{{ t('声谱') }} <small>SVP TO SCORE</small></span></a>
    <div class="local-badge"><span/>{{ t('文件仅在本机处理') }}</div>
    <button id="theme-button" class="fluent-button fluent-button--subtle" :aria-pressed="dark" :aria-label="t(dark?'切换浅色主题':'切换深色主题')" @click="dark=!dark">{{ t(dark?'浅色':'深色') }}</button>
    <LanguagePicker/>
  </header>
  <div class="workspace" :class="{'sidebar-collapsed':sidebarCollapsed,'sidebar-open':mobileSidebarOpen}" @keydown.esc="mobileSidebarOpen=false">
    <aside id="workspace-sidebar" class="sidebar" :aria-label="t('工作区导航')">
      <div class="sidebar-navigation"><div class="sidebar-nav-heading"><strong>{{ t('工作区导航') }}</strong><button id="sidebar-collapse" class="fluent-button fluent-button--subtle" :aria-label="t(sidebarCollapsed?'展开侧栏':'收起侧栏')" :aria-expanded="!sidebarCollapsed" @click="sidebarCollapsed=!sidebarCollapsed">{{ sidebarCollapsed?'›':'‹' }}</button></div><nav :aria-label="t('工作区栏目')"><button v-for="item in sidebarItems" :key="item[0]" :data-section="item[0]" class="sidebar-nav-item" :class="{active:activeSidebar===item[0]}" :aria-current="activeSidebar===item[0]?'page':undefined" :aria-label="t(item[1])" :title="sidebarCollapsed?t(item[1]):undefined" @click="openSidebar(item[0])"><span class="sidebar-nav-icon" aria-hidden="true">{{ {files:'▤',settings:'⚙',analysis:'⌁',lyrics:'♫',tuning:'♭'}[item[0]] }}</span><span class="sidebar-nav-label">{{ t(item[1]) }}</span></button></nav></div>
      <div class="sidebar-content">
      <div v-show="activeSidebar==='files'" class="sidebar-panel sidebar-intro"><span class="eyebrow">SYNTHESIZER V</span><h1>{{ t('SVP 人声谱') }}</h1><p>{{ t('导入工程，生成五线谱与简谱。') }}</p></div>
      <label v-show="activeSidebar==='files'" id="dropzone" class="dropzone" :class="{dragover:dragging}" tabindex="0" role="button" for="file-input" @keydown.enter.prevent="fileInput.click()" @keydown.space.prevent="fileInput.click()" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent="drop">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V3m0 0-5 5m5-5 5 5M4 15v5h16v-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><strong>{{ t('选择或拖入 SVP') }}</strong><span>{{ t('支持同时导入多个 .svp 文件') }}</span>
      </label>
      <input id="file-input" ref="fileInput" type="file" accept=".svp,application/json" multiple hidden :disabled="!ready" @change="importFiles($event.target.files)">
      <section v-show="activeSidebar==='files'" class="setting-section sidebar-panel"><div class="section-label"><h2>{{ t('工程文件') }}</h2><span id="file-count">{{ documents.length }}</span></div>
        <div id="file-list" class="file-list" :aria-label="t('工程文件列表')"><div v-for="item in documents" :key="item.id" class="file-row"><button class="fluent-button fluent-button--subtle file-item" :class="{active:item.id===activeId}" :aria-pressed="item.id===activeId" @click="activeId=item.id"><span class="file-symbol" aria-hidden="true">♬</span><span>{{ item.name }}<small>{{ t('SVP {version} · {count} 个声部',{version:item.project.version??'',count:item.project.tracks.length}) }}</small></span><span class="file-selected">{{ item.id===activeId?'●':'' }}</span></button><button class="fluent-button fluent-button--subtle file-remove" :disabled="removing.has(item.id)" :aria-label="t('移除文件 {name}',{name:item.name})" :title="t('移除文件')" @click="removeDocument(item)">×</button></div></div>
        <p id="storage-status" class="setting-hint" :class="{error:storageError}" role="status" aria-live="polite">{{ t(storageState) }}</p><p class="setting-hint storage-hint">{{ t('文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。') }}</p>
      </section>
      <section v-show="activeSidebar==='files'" class="setting-section sidebar-panel"><div class="section-label"><h2>{{ t('人声声部') }}</h2><button id="all-tracks" class="fluent-button fluent-button--subtle text-button" :disabled="!current" @click="allTracks">{{ t('全选') }}</button></div><div id="track-list"><FluentCheckbox v-for="track in current?.project.tracks||[]" :key="track.id" class="track-item" :model-value="current.selected.has(track.id)" @update:model-value="selectTrack(track.id,$event)"><span class="track-name">{{ track.name }}</span><small>{{ t('{count} 音符',{count:track.notes.length}) }}</small></FluentCheckbox></div></section>
      <section v-show="activeSidebar==='settings'" class="setting-section settings sidebar-panel"><h2>{{ t('谱面设置') }}</h2>
        <label for="score-title">{{ t('乐谱标题') }}<input id="score-title" :value="current?.title||''" class="fluent-field__input" type="text" maxlength="160" autocomplete="off" :disabled="!current" @input="current.title=$event.target.value"></label>
        <div class="setting-row"><label for="grid">{{ t('节奏网格') }}<select id="grid" v-model.number="s.grid" class="fluent-select__control" :disabled="!current"><option :value="8">{{ t('八分音符') }}</option><option :value="16">{{ t('十六分音符') }}</option><option :value="32">{{ t('三十二分音符') }}</option></select></label><label for="key">{{ t('调号') }}<select id="key" :value="current?.fifths||0" class="fluent-select__control" :disabled="!current" @change="current.fifths=Number($event.target.value);current.pitchMessage={type:'manualKey'}"><option v-for="(fifths,index) in keyChoices" :key="fifths" :value="fifths">{{ keyLabels[index] }} · {{ fifths===0?t('无升降号'):`${Math.abs(fifths)}${fifths>0?'♯':'♭'}` }}</option></select></label></div>
        <div class="transpose-row"><span>{{ t('移调') }}</span><div class="stepper"><button id="transpose-down" class="fluent-button" :disabled="!current" :aria-label="t('降低半音')" @click="changeTranspose(-1)">−</button><output id="transpose-value">{{ signed(current?.transpose||0) }}</output><button id="transpose-up" class="fluent-button" :disabled="!current" :aria-label="t('升高半音')" @click="changeTranspose(1)">+</button></div><span class="unit">{{ t('半音') }}</span></div>
        <div class="pitch-tools"><label for="target-range">{{ t('目标音区') }}<select id="target-range" v-model="s.targetRange" class="fluent-select__control" :disabled="!current"><option value="48,72">{{ t('较低 · C3–C5') }}</option><option value="55,79">{{ t('中间 · G3–G5') }}</option><option value="60,84">{{ t('较高 · C4–C6') }}</option></select></label><button id="auto-transpose" class="fluent-button" :disabled="!current" @click="autoTranspose">{{ t('自动移调') }}</button></div>
        <p id="pitch-summary" class="setting-hint" aria-live="polite"><template v-if="current">{{ t('音域 {range} · {shift} 半音。',{range,shift:signed(current.transpose)}) }}{{ pitchMessage }}</template></p><p class="setting-hint">{{ t('调号只改变记谱方式；移调会改变音高。') }}<br>{{ t('节奏网格会整理音符的起止位置。') }}</p>
      </section>
      <section v-show="activeSidebar==='settings'" class="setting-section settings typography-settings sidebar-panel"><h2>{{ t('字体与页面') }}</h2>
        <div class="setting-row"><label for="paper-size">{{ t('纸张') }}<select id="paper-size" v-model="s.paperSize" class="fluent-select__control" :disabled="!current"><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="a3">A3</option><option value="a5">A5</option></select></label><label for="page-orientation">{{ t('方向') }}<select id="page-orientation" v-model="s.orientation" class="fluent-select__control" :disabled="!current"><option value="portrait">{{ t('纵向') }}</option><option value="landscape">{{ t('横向') }}</option></select></label></div>
        <label for="score-font">{{ t('谱面文字字体') }}<select id="score-font" v-model="s.font" class="fluent-select__control" :disabled="!current"><option value="serif">{{ t('宋体 / 衬线') }}</option><option value="sans">{{ t('黑体 / 无衬线') }}</option><option value="kai">{{ t('楷体') }}</option><option value="mono">{{ t('等宽') }}</option></select></label>
        <div class="setting-row"><label for="lyric-size">{{ t('歌词字号') }}<input id="lyric-size" v-model.number="s.lyricSize" class="fluent-field__input" type="number" min="10" max="24" :disabled="!current"></label><label for="title-size">{{ t('标题字号') }}<input id="title-size" v-model.number="s.titleSize" class="fluent-field__input" type="number" min="16" max="36" :disabled="!current"></label></div>
        <label for="page-header">{{ t('每页页眉') }}<input id="page-header" v-model="s.header" class="fluent-field__input" type="text" maxlength="120" :placeholder="t('可留空')" :disabled="!current"></label><label for="score-by">{{ t('by 署名') }}<input id="score-by" v-model="s.by" class="fluent-field__input" type="text" maxlength="100" :placeholder="t('首页标题下方')" :disabled="!current"></label>
        <div class="setting-row"><label for="header-size">{{ t('页眉 / 署名字号') }}<input id="header-size" v-model.number="s.headerSize" class="fluent-field__input" type="number" min="9" max="20" :disabled="!current"></label></div>
        <div id="number-settings"><FluentCheckbox v-model="s.pageNumbers" :disabled="!current" :label="t('页码')"/><FluentCheckbox v-model="s.measureNumbers" :disabled="!current" :label="t('小节号')"/></div><p class="setting-hint">{{ t('文字字体使用本机已安装字体；预览、打印和 SVG 同步。音乐符号保持标准制谱字体。') }}</p>
      </section>
      <section v-show="activeSidebar==='settings'" class="setting-section sidebar-panel"><h2>{{ t('声部整理') }}</h2><div id="merge-setting"><FluentCheckbox v-model="s.merge" :disabled="!current" :label="t('合并分散独唱')"/></div><p class="setting-hint">{{ t('不同声线中互不重叠的独唱片段，合并到上方；同时发声的音符保留分谱。') }}</p><p id="merge-summary" class="setting-hint"><template v-if="result?.merging.enabled">{{ t('{source} → {output} 个谱表，{count} 个音符向上合并',{source:result.merging.sourcePartCount,output:result.merging.outputPartCount,count:result.merging.movedNoteCount}) }}</template></p><details v-if="result?.merging.enabled" id="merge-details"><summary>{{ t('查看整理明细') }}</summary><div id="merge-detail-list"><p v-for="move in result.merging.moves" :key="move.fromId+move.toId">{{ t('{from} → {to}：{count} 个音符',{from:move.fromName,to:move.toName,count:move.count}) }}</p><p v-for="role in result.merging.roles.filter(role=>role.overlapRatio>0)" :key="role.id">{{ t('{name}：存在重叠发声，可能为和声或叠唱',{name:role.name}) }}</p></div></details></section>
      <section v-show="activeSidebar==='analysis'" id="analysis-sidebar-panel" class="sidebar-panel"><details v-if="current" id="analysis-panel" class="analysis-panel" open><summary>{{ t('乐段与和声分析') }}<span id="analysis-count">{{ t('{repeats} 组重复 · {chords} 处和弦候选',{repeats:analysis.repeats.length,chords:analysis.chords.length}) }}</span></summary><div class="analysis-body"><div id="annotation-settings"><FluentCheckbox v-model="s.showRepeats" :label="t('标记重复乐段')"/><FluentCheckbox v-model="s.showChords" :label="t('谱面显示推测和弦')"/></div><p class="analysis-disclaimer">{{ t('和弦是根据所选音轨推测的候选；匹配度不是正确率。重复段保留完整小节与歌词。') }}</p><div class="analysis-columns"><section><h3>{{ t('重复乐段') }}</h3><div id="repeat-list"><div v-for="repeat in analysis.repeats" :key="repeat.id" class="repeat-item"><strong>{{ repeat.label }} · {{ t('{length} 小节 × {count}',{length:repeat.length,count:repeat.occurrences.length}) }}</strong><span>{{ repeat.occurrences.map(item=>`${item.startMeasure}–${item.endMeasure}`).join(' / ') }}</span><span>{{ t(repeat.lyricsDiffer?'旋律与节奏相同，歌词有差异':'旋律、节奏与歌词相同') }}</span></div><p v-if="!analysis.repeats.length" class="analysis-empty">{{ t('未检测到至少两个小节的完全重复乐段。') }}</p></div></section><section><h3>{{ t('和弦候选') }} <span>{{ t('按小节') }}</span></h3><div id="chord-list"><div v-for="chord in analysis.chords" :key="chordKey(chord)" class="chord-item"><label>{{ t('{measure} 小节 · {beat} 拍',{measure:chord.measureIndex+1,beat:chordBeat(chord)}) }}</label><select class="fluent-select__control" :aria-label="t('推测和弦')" :value="selectedChord(chord)" @change="current.chordChoices.set(chordKey(chord),$event.target.value)"><option v-for="candidate in chord.candidates" :key="candidate.symbol" :value="candidate.symbol">{{ candidate.symbol }} · {{ t('匹配 {percent}%',{percent:Math.round(candidate.match*100)}) }}</option><option value="">{{ t('不标注') }}</option></select><small>{{ t(chord.evidence==='simultaneous'?'同时发声':'音符汇总') }}</small></div><p v-if="!analysis.chords.length" class="analysis-empty">{{ t('没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。') }}</p></div></section></div></div></details></section>
      <section v-show="activeSidebar==='lyrics'" class="sidebar-panel"><details v-if="current" id="lyrics-panel" class="analysis-panel" open><summary>{{ t('歌词与声部文字') }}<span>{{ t('可修改或清空') }}</span></summary><div class="analysis-body"><p class="analysis-disclaimer">{{ t('单独的 - 表示延长前一个字。清空文字会保留音符；修改会写入导出的曲谱。') }}</p><div id="lyric-editor"><LyricEditor :key="current.id" :project="current.project"/></div></div></details></section>
      <section v-show="activeSidebar==='tuning'" class="sidebar-panel"><details v-if="current" id="tuning-panel" class="analysis-panel" open><summary>{{ t('音高微调') }}<span id="tuning-count">{{ t('{adjusted} 个音符修正 · {detuned} 个音分微调',{adjusted:adjustment.adjustedNoteCount,detuned:sourceSummary.nonzeroDetuneNotes||0}) }}</span></summary><div class="analysis-body"><p class="analysis-disclaimer">{{ t('按音符音分和音高曲线中段的代表偏移修正半音，避免跟随短暂颤音。滑音、颤音参数单独列出；实际合成音高需要音频确认。') }}</p><div id="tuning-settings"><FluentCheckbox v-model="s.pitchAdjustment" :label="t('自动修正音阶')"/><label for="tuning-threshold">{{ t('偏移阈值') }}<select id="tuning-threshold" v-model.number="s.threshold" class="fluent-select__control"><option v-for="value in [50,75,100,150,200]" :key="value" :value="value">{{ t('{count} 音分',{count:value}) }}</option></select></label></div><div id="tuning-details"><p>{{ t('工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。',{points:sourceSummary.pitchDeltaPoints||0,curves:sourceSummary.pitchControlCurves||0,explicit:sourceSummary.explicitExpressionNotes||0,inherited:sourceSummary.systemExpressionNotes||0}) }}</p><p>{{ s.pitchAdjustment?t('代表偏移达到 {threshold} 音分时，按最近半音调整。100 音分 = 1 半音；剩余音分在下表显示，谱面使用半音音阶。',{threshold:s.threshold}):t('自动半音修正已关闭，谱面使用原始音符加整体移调。') }}</p><p v-if="adjustment.approximateNoteCount">{{ t('{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。',{count:adjustment.approximateNoteCount}) }}</p><div v-if="adjustment.notes.length" class="tuning-table-wrap"><table class="tuning-table"><thead><tr><th v-for="label in ['来源声部 / 音符','修正前','修正后','代表偏移','剩余音分']" :key="label">{{ t(label) }}</th></tr></thead><tbody><tr v-for="change in adjustment.notes" :key="`${change.sourceTrackId}:${change.sourceNoteIndex}`"><td>{{ trackName(change.sourceTrackId) }} / {{ change.sourceNoteIndex+1 }}</td><td>{{ noteName(change.fromPitch) }}</td><td>{{ noteName(change.toPitch) }}</td><td>{{ cents(change.cents) }}</td><td>{{ cents(change.residualCents) }}</td></tr></tbody></table></div><p v-else>{{ t('当前所选声部没有触发半音修正。') }}</p><details v-if="tuningFields.length"><summary>{{ t('查看滑音与颤音参数范围') }}</summary><p v-for="field in tuningFields" :key="field.label+field.key">{{ t(field.label) }} · {{ field.key }}: {{ Number(field.low.toFixed(4)) }}–{{ Number(field.high.toFixed(4)) }} ({{ field.count }})</p></details></div></div></details></section>
      <footer class="sidebar-footer">{{ t('本地转换 · 无需上传') }}<br><a href="https://github.com/opensheetmusicdisplay/opensheetmusicdisplay" target="_blank" rel="noopener">OpenSheetMusicDisplay</a> · <a href="https://github.com/lsy-404/platform-kit" target="_blank" rel="noopener">Platform Kit Fluent</a></footer></div>
    </aside>
    <main>
      <div class="score-toolbar"><button id="sidebar-mobile-toggle" class="fluent-button fluent-button--subtle mobile-sidebar-toggle" :aria-controls="'workspace-sidebar'" :aria-expanded="mobileSidebarOpen" :aria-label="t(mobileSidebarOpen?'关闭工作区栏目':'打开工作区栏目')" @click="mobileSidebarOpen=!mobileSidebarOpen">☰ {{ t('栏目') }}</button><div><span class="eyebrow">VOCAL SHEET MUSIC</span><h2 id="document-title">{{ t(current?(s.view==='staff'?'人声五线谱':'人声简谱'):'导入 SVP 开始制谱') }}</h2></div><div class="actions"><button id="pdf-button" class="fluent-button fluent-button--primary" :disabled="!canExport" @click="exportPdf">↓ {{ t(exportingPdf?'正在生成 PDF…':'下载 PDF') }}</button><button id="export-button" class="fluent-button" :disabled="!canExport" @click="exportXml">↓ {{ t('导出 MusicXML') }}</button></div></div>
      <div class="score-meta"><span id="source-meta">{{ current?`SVP ${current.project.version??''} · ${current.project.meters[0].numerator}/${current.project.meters[0].denominator} · ♩ = ${current.project.tempos[0].bpm}`:t('未导入工程') }}</span><div><span id="note-meta">{{ result?t('{parts} 声部 · {count} 音符',{parts:result.stats.partCount,count:result.stats.noteCount}):'' }}</span><span class="meta-divider">/</span><span id="measure-meta">{{ result?t('{count} 小节',{count:result.stats.measureCount}):'' }}</span></div></div>
      <div class="view-toolbar"><div class="view-switch" role="group" :aria-label="t('记谱方式')"><button v-for="mode in ['staff','jianpu']" :id="`${mode}-view`" :key="mode" class="fluent-button" :disabled="!current" :aria-pressed="s.view===mode" @click="s.view=mode">{{ t(mode==='staff'?'五线谱':'简谱') }}</button></div><button id="svg-button" class="fluent-button fluent-button--subtle text-button" :disabled="!canExport" @click="exportSvg">{{ t('导出当前谱面 SVG ↗') }}</button></div>
      <div v-if="error||warnings.length" id="message" class="fluent-notice" :class="[error?'error fluent-notice--danger':'fluent-notice--warning']" role="status" aria-live="polite">{{ error||warnings.map(translateWarning).join(' ') }}</div>
      <div v-if="busy" id="busy" class="busy" role="status"><span class="spinner"/>{{ t('正在排版乐谱…') }}</div>
      <div class="paper-wrap"><article id="paper" ref="paper" class="paper" :aria-label="t('乐谱预览')"><div v-if="!current" class="empty-score"><strong>{{ t('导入 SVP 开始制谱') }}</strong><p>{{ t('选择或拖入文件，生成五线谱与简谱。') }}</p></div><PdfViewer v-if="pdfBytes" :bytes="pdfBytes" @error="pdfError=readableError($event)"><template #page-overlay="{pageNumber}"><ScoreTextOverlay :targets="textTargets" :page-number="pageNumber" :disabled="busy||exportingPdf" @commit="editScoreText"/></template></PdfViewer><p v-if="pdfError" class="pdf-error">{{ pdfError }}</p></article></div>
      <div id="score" ref="score" class="score-source" :style="{width:`${paperDimensions.width*3.78}px`}" aria-hidden="true"/>
      <div class="canvas-footer"><span>{{ t('点击谱面文字可编辑') }}</span><span id="render-meta">{{ current?`${s.paperSize.toUpperCase()} · PDF`:'' }}</span></div>
    </main>
  </div>
</template>
