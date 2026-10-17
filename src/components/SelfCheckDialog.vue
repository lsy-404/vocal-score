<script setup>
import {computed,nextTick,reactive,ref,watch} from 'vue';
import {t} from '../i18n.js';

// Self-check: lyrics typed as pinyin that the song itself can fill in (another part singing the same words at the same
// time, or the same phrase earlier or later). Each row starts on that character; another candidate or keeping the
// pinyin can be picked per lyric, and one button applies them all.
const props=defineProps({open:Boolean,rows:{type:Array,default:()=>[]},trackNames:{type:Object,default:()=>({})}});
const emit=defineEmits(['apply','close']);
const dialog=ref(null),choices=reactive(new Map());
const keyOf=row=>`${row.trackId}:${row.noteIndex}`;
const groups=computed(()=>{
  const byTrack=new Map();
  for(const row of props.rows){const list=byTrack.get(row.trackId)??[];list.push(row);byTrack.set(row.trackId,list);}
  return [...byTrack].map(([trackId,rows])=>({trackId,name:props.trackNames[trackId]??'',rows}));
});
const counts=computed(()=>{let time=0,context=0;for(const row of props.rows){if(row.candidates.find(item=>item.confident)?.source.kind==='time')time++;else context++;}return {time,context};});
const chosen=computed(()=>props.rows.filter(row=>choices.get(keyOf(row))));
function sourceText(source){
  if(source.kind==='time')return t('{track} 同时唱',{track:source.trackName});
  if(source.kind==='word')return t('词语“{word}”',{word:source.word});
  return t('第 {bar} 小节“{snippet}”',{bar:source.bar,snippet:source.snippet});
}
watch(()=>[props.open,props.rows],async([open])=>{
  choices.clear();
  for(const row of props.rows)choices.set(keyOf(row),row.candidates.find(item=>item.confident)?.text??'');
  await nextTick();
  if(open&&!dialog.value?.open)dialog.value?.showModal();
  if(!open&&dialog.value?.open)dialog.value.close();
},{immediate:true});
function apply(){emit('apply',chosen.value.map(row=>({trackId:row.trackId,noteIndex:row.noteIndex,text:choices.get(keyOf(row))})));}
</script>

<template>
  <dialog ref="dialog" id="self-check-dialog" class="self-check" aria-labelledby="self-check-title" @close="emit('close')" @cancel.prevent="emit('close')">
    <header class="self-check__header">
      <h2 id="self-check-title">{{ t('自校：用本曲补全拼音') }}</h2>
      <p v-if="rows.length">{{ t('在本曲中找到 {count} 处拼音可以补成汉字：其他声部同时唱 {time} 处，前后同句 {context} 处。可以逐字选择，或全部采用。',{count:rows.length,time:counts.time,context:counts.context}) }}</p>
      <p v-else>{{ t('本曲中没有可以直接补全的拼音。') }}</p>
    </header>
    <div v-if="rows.length" class="self-check__list">
      <section v-for="group in groups" :key="group.trackId" class="self-check__group">
        <h3>{{ group.name }}<span>{{ group.rows.length }}</span></h3>
        <div v-for="row in group.rows" :key="`${row.trackId}:${row.noteIndex}`" class="self-check__row" :data-row="`${row.trackId}:${row.noteIndex}`">
          <div class="self-check__context"><small>{{ t('第 {bar} 小节',{bar:row.bar}) }}</small><span>{{ row.before.join(' ') }} <mark>{{ row.reading }}</mark> {{ row.after.join(' ') }}</span></div>
          <div class="self-check__choices" role="radiogroup" :aria-label="row.reading">
            <button v-for="item in row.candidates" :key="item.text" type="button" role="radio" class="self-check__choice" :class="{confident:item.confident}" :aria-checked="choices.get(`${row.trackId}:${row.noteIndex}`)===item.text" :title="sourceText(item.source)" @click="choices.set(`${row.trackId}:${row.noteIndex}`,item.text)"><b>{{ item.text }}</b><small>{{ sourceText(item.source) }}</small></button>
            <button type="button" role="radio" class="self-check__choice self-check__keep" :aria-checked="!choices.get(`${row.trackId}:${row.noteIndex}`)" @click="choices.set(`${row.trackId}:${row.noteIndex}`,'')"><b>{{ row.reading }}</b><small>{{ t('保留拼音') }}</small></button>
          </div>
        </div>
      </section>
    </div>
    <footer class="self-check__footer">
      <button v-if="rows.length" id="self-check-apply" type="button" class="fluent-button fluent-button--primary" autofocus :disabled="!chosen.length" @click="apply">{{ t('全部采用（{count}）',{count:chosen.length}) }}</button>
      <button id="self-check-later" type="button" class="fluent-button" :autofocus="!rows.length" @click="emit('close')">{{ t(rows.length?'以后再说':'关闭') }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.self-check{width:min(760px,calc(100vw - 32px));max-height:min(86vh,900px);padding:0;border:1px solid var(--fluent-border);border-radius:10px;background:var(--fluent-surface);color:var(--fluent-text);box-shadow:0 16px 48px rgb(0 0 0 / 28%)}
.self-check[open]{display:flex;flex-direction:column}
.self-check::backdrop{background:rgb(0 0 0 / 35%)}
.self-check__header{padding:16px 20px 8px}
.self-check__header h2{margin:0 0 6px;font-size:17px}
.self-check__header p{margin:0;color:var(--fluent-muted);font-size:13px;line-height:1.5}
.self-check__list{flex:1;min-height:0;overflow:auto;padding:4px 20px 8px}
.self-check__group h3{position:sticky;top:0;display:flex;gap:6px;align-items:baseline;margin:10px 0 4px;padding:4px 0;background:var(--fluent-surface);font-size:13px}
.self-check__group h3 span{color:var(--fluent-muted);font-weight:400}
.self-check__row{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--fluent-border)}
.self-check__context{display:flex;flex-direction:column;min-width:0;font-size:13px}
.self-check__context small{color:var(--fluent-muted);font-size:11px}
.self-check__context span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.self-check__context mark{padding:0 3px;border-radius:3px;background:rgb(255 140 0 / 22%);color:inherit}
.self-check__choices{display:flex;flex-wrap:wrap;gap:4px}
.self-check__choice{display:flex;flex-direction:column;align-items:center;min-width:42px;max-width:150px;padding:2px 6px;border:1px solid var(--fluent-border);border-radius:5px;background:transparent;color:inherit;cursor:pointer}
.self-check__choice b{font-size:16px;line-height:1.25}
.self-check__choice small{max-width:136px;overflow:hidden;color:var(--fluent-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.self-check__choice:not(.confident):not(.self-check__keep) b{font-weight:400}
.self-check__choice[aria-checked="true"]{border-color:var(--fluent-accent);background:color-mix(in srgb,var(--fluent-accent) 14%,transparent)}
.self-check__keep b{font-size:13px;font-weight:400}
.self-check__footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--fluent-border)}
@media(max-width:560px){.self-check__row{grid-template-columns:1fr}.self-check__header,.self-check__list,.self-check__footer{padding-inline:14px}}
</style>
