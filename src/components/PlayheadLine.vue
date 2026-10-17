<script setup>
import {computed} from 'vue';

// The playback position on one page. It moves by transform in pixels, so it glides in sub-pixel steps on the
// compositor, and only this line updates each frame, not the pages around it.
const props=defineProps({playback:{type:Object,required:true},pageNumber:{type:Number,required:true},width:{type:Number,default:0},height:{type:Number,default:0}});
const style=computed(()=>{
  const head=props.playback.playhead;
  if(!head||head.pageNumber!==props.pageNumber||!(props.width>0))return null;
  return {height:`${head.height*props.height}px`,transform:`translate3d(${head.x*props.width-1}px,${head.y*props.height}px,0)`,pointerEvents:'none'};
});
</script>

<template>
  <div v-if="style" class="playhead" aria-hidden="true" :style="style"/>
</template>
