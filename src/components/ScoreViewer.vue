<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import {t} from '../i18n.js';

// Pages are shown as the engraved SVGs, placed on paper with the same margin and fit as the downloaded PDF.
const props=defineProps({pages:{type:Array,default:()=>[]},paper:{type:Object,required:true},margin:{type:Number,default:10}});
const viewportElement=ref(null),pageElements=[];
const pageNumber=ref(1),pageInput=ref(1),zoom=ref('width'),layout=ref({width:1,height:1});
const PAGE_GAP=10,PX_PER_MM=96/25.4,MAX_FIT_WIDTH=1400;
const attached=new Map();
let resizeObserver=null,resizeFrame=0,scrollFrame=0;

const totalPages=computed(()=>props.pages.length);
const pageLabel=computed(()=>t('第 {page} 页，共 {total} 页',{page:pageNumber.value,total:totalPages.value}));
const sheetStyle=computed(()=>{const {width,height}=props.paper,m=props.margin;return{left:`${m/width*100}%`,top:`${m/height*100}%`,width:`${(width-m*2)/width*100}%`,height:`${(height-m*2)/height*100}%`};});

function calculateLayout(){
  const viewport=viewportElement.value;if(!viewport)return;
  const baseWidth=props.paper.width*PX_PER_MM,baseHeight=props.paper.height*PX_PER_MM;
  const widthScale=Math.min(MAX_FIT_WIDTH,Math.max(1,viewport.clientWidth-24))/baseWidth;
  const scale=zoom.value==='width'?widthScale:zoom.value==='fit'?Math.min(widthScale,Math.max(1,viewport.clientHeight-24)/baseHeight):Number(zoom.value);
  layout.value={width:baseWidth*scale,height:baseHeight*scale};
}

function sheetOf(index){return pageElements[index]?.querySelector('.score-viewer__sheet');}
function attach(index){
  const sheet=sheetOf(index),source=props.pages[index];
  if(!sheet||!source||attached.get(index)===source)return;
  const copy=source.cloneNode(true);
  copy.removeAttribute('id');copy.removeAttribute('style');
  copy.setAttribute('width','100%');copy.setAttribute('height','100%');copy.setAttribute('preserveAspectRatio','xMidYMin meet');
  sheet.replaceChildren(copy);sheet.dataset.rendered='true';attached.set(index,source);
}
function detach(index){const sheet=sheetOf(index);if(sheet){sheet.replaceChildren();delete sheet.dataset.rendered;}attached.delete(index);}

function setCurrentPage(number){
  if(number<1||number>totalPages.value||number===pageNumber.value)return;
  pageNumber.value=number;
  if(document.activeElement!==document.querySelector('.score-viewer__page-input'))pageInput.value=number;
}
function updatePageWindow(){
  const viewport=viewportElement.value,first=pageElements[0];
  if(!viewport||!first||!totalPages.value)return;
  const firstTop=first.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  const step=layout.value.height+PAGE_GAP,margin=Math.max(viewport.clientHeight,500);
  const low=Math.max(0,Math.floor((viewport.scrollTop-margin-firstTop)/step));
  const high=Math.min(totalPages.value-1,Math.ceil((viewport.scrollTop+viewport.clientHeight+margin-firstTop)/step));
  for(const index of [...attached.keys()])if(index<low||index>high)detach(index);
  for(let index=low;index<=high;index++)attach(index);
  setCurrentPage(Math.min(totalPages.value,Math.max(1,Math.floor((viewport.scrollTop+viewport.clientHeight/2-firstTop)/step)+1)));
}

function bindPage(element,index){pageElements[index]=element||undefined;}
function navigateToPage(){
  const requested=Math.min(totalPages.value,Math.max(1,Math.trunc(Number(pageInput.value)||1)));
  pageInput.value=requested;setCurrentPage(requested);
  pageElements[requested-1]?.scrollIntoView({behavior:'smooth',block:'start'});
}
function step(delta){pageInput.value=Math.min(totalPages.value,Math.max(1,pageNumber.value+delta));navigateToPage();}
function onResize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(async()=>{calculateLayout();await nextTick();updatePageWindow();});}
function onScroll(){cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(updatePageWindow);}

watch(()=>props.pages,async()=>{
  for(const index of [...attached.keys()])detach(index);
  pageElements.length=props.pages.length;
  if(pageNumber.value>totalPages.value){pageNumber.value=Math.max(1,totalPages.value);pageInput.value=pageNumber.value;}
  calculateLayout();await nextTick();updatePageWindow();
},{flush:'post'});
watch(()=>[props.paper.width,props.paper.height,zoom.value],onResize);

onMounted(async()=>{
  viewportElement.value.addEventListener('scroll',onScroll,{passive:true});
  resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(viewportElement.value);
  calculateLayout();await nextTick();updatePageWindow();
});
onBeforeUnmount(()=>{cancelAnimationFrame(resizeFrame);cancelAnimationFrame(scrollFrame);viewportElement.value?.removeEventListener('scroll',onScroll);resizeObserver?.disconnect();});
</script>

<template>
  <section class="score-viewer" :aria-label="t('乐谱预览')">
    <header class="score-viewer__toolbar">
      <slot name="toolbar-start"/>
      <div class="score-viewer__navigation">
        <button class="fluent-button fluent-button--subtle" type="button" :disabled="pageNumber<=1" :aria-label="t('上一页')" @click="step(-1)">‹</button>
        <label class="score-viewer__page-control">
          <input v-model.number="pageInput" class="fluent-field__input score-viewer__page-input" type="number" min="1" :max="totalPages||1" :disabled="!totalPages" :aria-label="t('页码')" @change="navigateToPage" @keydown.enter.prevent="navigateToPage">
          <span class="score-viewer__page-count" aria-live="polite"><span class="sr-only">{{ pageLabel }}</span><span aria-hidden="true">/ {{ totalPages }}</span></span>
        </label>
        <button class="fluent-button fluent-button--subtle" type="button" :disabled="pageNumber>=totalPages" :aria-label="t('下一页')" @click="step(1)">›</button>
      </div>
      <select v-model="zoom" class="fluent-select__control score-viewer__zoom" :aria-label="t('缩放')">
        <option value="width">{{ t('适合页宽') }}</option>
        <option value="fit">{{ t('适合页面') }}</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
      </select>
    </header>
    <div ref="viewportElement" class="score-viewer__viewport">
      <div class="score-viewer__pages">
        <article v-for="(page,index) in pages" :key="index" :ref="element=>bindPage(element,index)" class="score-viewer__page" :data-page-number="index+1" :style="{width:`${layout.width}px`,height:`${layout.height}px`}" :aria-label="t('第 {page} 页，共 {total} 页',{page:index+1,total:totalPages})">
          <div class="score-viewer__sheet" :style="sheetStyle"/>
          <div class="score-viewer__page-overlay"><slot name="page-overlay" :page-number="index+1"/></div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.score-viewer{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;border:1px solid var(--fluent-border);border-radius:var(--fluent-panel-radius,8px);background:var(--fluent-surface);color:var(--fluent-text)}
.score-viewer__toolbar{display:flex;align-items:center;gap:10px;min-height:44px;padding:5px 8px;border-bottom:1px solid var(--fluent-border)}
.score-viewer__navigation{display:flex;align-items:center;gap:4px;margin-left:auto}
.score-viewer__navigation .fluent-button{min-width:30px;min-height:30px;padding:0;font-size:17px;box-shadow:none}
.score-viewer__page-control{display:flex;align-items:center;gap:6px;font-size:12px;font-variant-numeric:tabular-nums;color:var(--fluent-muted)}
.score-viewer__page-input{width:48px;min-height:30px;padding-inline:4px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums}
.score-viewer__page-count{min-width:2.6em}
.score-viewer__zoom{width:118px;flex:none;min-height:30px;font-size:12px}
.score-viewer__viewport{flex:1;min-height:0;overflow:auto;padding:12px;background:var(--fluent-bg);overscroll-behavior:contain}
.score-viewer__pages{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:100%;width:max-content;margin:0 auto}
.score-viewer__page{position:relative;flex:none;background:#fff;box-shadow:0 1px 6px rgb(0 0 0 / 14%)}
.score-viewer__sheet{position:absolute;overflow:hidden}
.score-viewer__sheet :deep(svg){display:block}
.score-viewer__page-overlay{position:absolute;inset:0;pointer-events:none}
.score-viewer__page-overlay :deep(*){pointer-events:auto}
@media(max-width:560px){.score-viewer__toolbar{gap:6px;padding-inline:6px}.score-viewer__navigation{gap:2px}.score-viewer__page-input{width:40px}.score-viewer__page-count{min-width:0}.score-viewer__zoom{width:94px}}
</style>
