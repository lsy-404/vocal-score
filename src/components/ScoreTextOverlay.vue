<script setup>
import {computed,nextTick,ref,watch} from 'vue';
import {t} from '../i18n.js';

// suggestions: characters the song offers for lyrics typed as pinyin, by "trackId:noteIndex" (lyric-candidates.js).
// openId: a target to open from outside (the pinyin button), by its id.
const props=defineProps({targets:{type:Array,default:()=>[]},pageNumber:{type:Number,required:true},disabled:Boolean,suggestions:{type:Map,default:()=>new Map()},openId:{type:String,default:''}});
const emit=defineEmits(['commit','fill']);
const editing=ref(null),draft=ref(''),input=ref(null),withOthers=ref(true);
const pageTargets=computed(()=>props.targets.filter(target=>target.pageNumber===props.pageNumber));
const position=target=>({left:`${target.x*100}%`,top:`${target.y*100}%`,width:`${Math.max(target.width*100,0.8)}%`,height:`${Math.max(target.height*100,1)}%`});
const suggestionFor=target=>target?.kind==='lyric'?props.suggestions.get(`${target.trackId}:${target.noteIndex}`):undefined;
const suggestion=computed(()=>suggestionFor(editing.value));
// Pinyin in this part that another part sings in characters at the same time: the whole part can take them at once.
const partFill=computed(()=>{const item=suggestion.value;if(!item)return 0;let count=0;for(const entry of props.suggestions.values())if(String(entry.trackId)===String(item.trackId)&&entry.candidates[0]?.source.kind==='time')count++;return count;});
function sourceText(source){
  if(source.kind==='time')return t('{track} 同时唱',{track:source.trackName});
  if(source.kind==='word')return t('词语“{word}”',{word:source.word});
  return t('第 {bar} 小节“{snippet}”',{bar:source.bar,snippet:source.snippet});
}
async function start(target){
  if(props.disabled)return;
  editing.value=target;draft.value=target.text;withOthers.value=true;
  await nextTick();input.value?.focus();input.value?.select();
}
function cancel(){editing.value=null;}
watch(()=>props.targets,cancel);
watch(()=>props.openId,id=>{const target=id&&pageTargets.value.find(item=>item.id===id);if(target)start(target);else if(id)cancel();});
function save(){
  if(!editing.value||props.disabled)return;
  const target=editing.value;editing.value=null;
  if(draft.value!==target.text)emit('commit',{target,value:draft.value});
}
function choose(text){
  if(!editing.value||props.disabled)return;
  const target=editing.value,item=suggestion.value;editing.value=null;
  emit('commit',{target,value:text,also:withOthers.value?item?.together??[]:[]});
}
function fillPart(){
  if(!editing.value||props.disabled)return;
  const trackId=editing.value.trackId;editing.value=null;
  emit('fill',{trackId});
}
</script>

<template>
  <div class="score-text-overlay" :aria-label="t('谱面文字编辑')">
    <button v-for="target in pageTargets" :key="target.id" type="button" class="score-text-target" :class="{'score-text-target--suggest':suggestionFor(target)?.candidates.length}" :style="position(target)" :disabled="disabled" :data-edit-kind="target.kind" :data-text-id="target.id" :aria-label="t('编辑 {text}',{text:target.text})" :title="t(suggestionFor(target)?.candidates.length?'有候选汉字，点击选择':'点击谱面文字可编辑')" @click="start(target)" />
    <form v-if="editing" class="score-text-form" :class="{'score-text-form--wide':suggestion}" :style="{left:`${Math.min(editing.x*100,suggestion?55:65)}%`,top:`${(editing.y+editing.height)*100+0.4}%`}" :aria-label="t('修改谱面文字')" @submit.prevent="save" @keydown.esc.prevent="cancel">
      <input ref="input" v-model="draft" class="fluent-field__input" :aria-label="t('修改谱面文字')" :maxlength="editing.kind==='lyric'?300:160" autocomplete="off">
      <div v-if="suggestion" class="score-text-candidates" role="group" :aria-label="t('候选汉字')">
        <button v-for="item in suggestion.candidates" :key="item.text" type="button" class="score-text-candidate" :title="sourceText(item.source)" @click="choose(item.text)"><b>{{ item.text }}</b><small>{{ sourceText(item.source) }}</small></button>
        <details v-if="suggestion.homophones.length" class="score-text-homophones" :open="!suggestion.candidates.length"><summary>{{ t('更多同音字（{reading}）',{reading:suggestion.reading}) }}</summary><button v-for="text in suggestion.homophones" :key="text" type="button" class="score-text-homophone" @click="choose(text)">{{ text }}</button></details>
        <label v-if="suggestion.together.length" class="score-text-together"><input v-model="withOthers" type="checkbox"> {{ t('同时替换其他声部同一位置的 {reading}（{count} 处）',{reading:suggestion.reading,count:suggestion.together.length}) }}</label>
        <button v-if="partFill>1" type="button" class="fluent-button score-text-fill" @click="fillPart">{{ t('本声部 {count} 处拼音按同时演唱的汉字填入',{count:partFill}) }}</button>
      </div>
      <div class="score-text-form__actions"><button class="fluent-button fluent-button--primary" type="submit">{{ t('保存文字') }}</button><button class="fluent-button" type="button" @click="cancel">{{ t('取消编辑') }}</button></div>
    </form>
  </div>
</template>

<style scoped>
.score-text-overlay{position:absolute;inset:0;pointer-events:none}
.score-text-target{position:absolute;pointer-events:auto;padding:0;border:1px solid transparent;border-radius:2px;background:transparent;box-shadow:none;cursor:text;min-width:8px;min-height:10px}
.score-text-target:hover,.score-text-target:focus-visible{outline:1px solid var(--fluent-accent,#0078d4);background:rgb(0 120 212 / 10%)}
.score-text-target--suggest{border-bottom:2px dotted rgb(196 89 17 / 90%);border-radius:2px 2px 0 0;background:rgb(255 140 0 / 16%);cursor:pointer}
.score-text-target--suggest:hover{background:rgb(255 140 0 / 28%)}
.score-text-target:disabled{pointer-events:none}
.score-text-form{position:absolute;z-index:2;pointer-events:auto;width:clamp(140px,30%,300px);max-width:90%;padding:8px;border:1px solid var(--fluent-accent,#0078d4);border-radius:6px;background:var(--fluent-surface,#fff);box-shadow:0 4px 16px rgb(0 0 0 / 20%)}
.score-text-form--wide{width:clamp(220px,42%,380px)}
.score-text-form input{box-sizing:border-box;width:100%;min-width:0}
.score-text-candidates{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.score-text-candidate{display:flex;flex-direction:column;align-items:center;min-width:44px;max-width:100%;padding:3px 6px;border:1px solid var(--fluent-border,#d1d1d1);border-radius:4px;background:var(--fluent-surface,#fff);color:inherit;cursor:pointer}
.score-text-candidate:hover,.score-text-candidate:focus-visible{border-color:var(--fluent-accent,#0078d4);background:rgb(0 120 212 / 8%)}
.score-text-candidate b{font-size:18px;font-weight:600;line-height:1.2}
.score-text-candidate small{max-width:120px;overflow:hidden;font-size:10px;color:var(--fluent-muted,#616161);text-overflow:ellipsis;white-space:nowrap}
.score-text-homophones{flex-basis:100%;font-size:12px;color:var(--fluent-muted,#616161)}
.score-text-homophones summary{cursor:pointer}
.score-text-homophone{min-width:28px;margin:4px 2px 0 0;padding:2px 4px;border:1px solid var(--fluent-border,#d1d1d1);border-radius:3px;background:var(--fluent-surface,#fff);color:var(--fluent-text,#242424);font-size:15px;cursor:pointer}
.score-text-homophone:hover{border-color:var(--fluent-accent,#0078d4)}
.score-text-together{display:flex;flex-basis:100%;align-items:center;gap:4px;font-size:12px}
.score-text-together input{width:auto}
.score-text-fill{flex-basis:100%;min-height:28px;font-size:12px}
.score-text-form__actions{display:flex;gap:6px;margin-top:8px}
.score-text-form__actions button{min-width:0;padding-inline:8px;font-size:12px}
</style>
