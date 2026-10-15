<script setup>
defineProps({modelValue:Boolean,label:String,disabled:Boolean});
defineEmits(['update:modelValue']);
</script>

<template>
  <label class="fluent-checkbox">
    <input class="fluent-checkbox__input" type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue',$event.target.checked)">
    <span class="fluent-checkbox__box" :class="{'fluent-checkbox__box--checked':modelValue}" aria-hidden="true">
      <svg class="fluent-checkbox__check" viewBox="0 0 16 16" :style="{visibility:modelValue?'visible':'hidden'}"><path d="M3 8.5 6.2 11.5 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </span>
    <span v-if="label">{{ label }}</span><slot/>
  </label>
</template>
