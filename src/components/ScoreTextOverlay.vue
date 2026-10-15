<script setup>
import {computed,nextTick,ref,watch} from 'vue';
import {t} from '../i18n.js';

const props=defineProps({targets:{type:Array,default:()=>[]},pageNumber:{type:Number,required:true},disabled:Boolean});
const emit=defineEmits(['commit']);
const editing=ref(null),draft=ref(''),input=ref(null);
const pageTargets=computed(()=>props.targets.filter(target=>target.pageNumber===props.pageNumber));
const position=target=>({left:`${target.x*100}%`,top:`${target.y*100}%`,width:`${Math.max(target.width*100,0.8)}%`,height:`${Math.max(target.height*100,1)}%`});
async function start(target){
  if(props.disabled)return;
  editing.value=target;draft.value=target.text;
  await nextTick();input.value?.focus();input.value?.select();
}
function cancel(){editing.value=null;}
watch(()=>props.targets,cancel);
function save(){
  if(!editing.value||props.disabled)return;
  const target=editing.value;editing.value=null;
  if(draft.value!==target.text)emit('commit',{target,value:draft.value});
}
</script>

<template>
  <div class="score-text-overlay" :aria-label="t('谱面文字编辑')">
    <button v-for="target in pageTargets" :key="target.id" type="button" class="score-text-target" :style="position(target)" :disabled="disabled" :data-edit-kind="target.kind" :data-text-id="target.id" :aria-label="t('编辑 {text}',{text:target.text})" :title="t('点击谱面文字可编辑')" @click="start(target)" />
    <form v-if="editing" class="score-text-form" :style="{left:`${Math.min(editing.x*100,65)}%`,top:`${editing.y*100}%`}" :aria-label="t('修改谱面文字')" @submit.prevent="save" @keydown.esc.prevent="cancel">
      <input ref="input" v-model="draft" class="fluent-field__input" :aria-label="t('修改谱面文字')" :maxlength="editing.kind==='lyric'?300:160" autocomplete="off">
      <div class="score-text-form__actions"><button class="fluent-button fluent-button--primary" type="submit">{{ t('保存文字') }}</button><button class="fluent-button" type="button" @click="cancel">{{ t('取消编辑') }}</button></div>
    </form>
  </div>
</template>

<style scoped>
.score-text-overlay{position:absolute;inset:0;pointer-events:none}
.score-text-target{position:absolute;pointer-events:auto;padding:0;border:1px solid transparent;border-radius:2px;background:transparent;cursor:text;min-width:8px;min-height:10px}
.score-text-target:hover,.score-text-target:focus-visible{outline:1px solid var(--fluent-accent,#0078d4);background:rgb(0 120 212 / 10%)}
.score-text-target:disabled{pointer-events:none}
.score-text-form{position:absolute;z-index:2;pointer-events:auto;width:clamp(140px,30%,300px);max-width:90%;padding:8px;border:1px solid var(--fluent-accent,#0078d4);border-radius:6px;background:var(--fluent-surface,#fff);box-shadow:0 4px 16px rgb(0 0 0 / 20%)}
.score-text-form input{box-sizing:border-box;width:100%;min-width:0}
.score-text-form__actions{display:flex;gap:6px;margin-top:8px}
.score-text-form__actions button{min-width:0;padding-inline:8px;font-size:12px}
</style>
