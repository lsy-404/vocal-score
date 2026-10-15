<script setup>
import {ref} from 'vue';
import {getLanguage, setLanguage, t} from '../i18n.js';

const selected = ref(getLanguage());
const options = [
  {value: 'zh-CN', label: '简体中文'},
  {value: 'en', label: 'English'},
  {value: 'ja', label: '日本語'},
  {value: 'ko', label: '한국어'}
];

function changeLanguage(event) {
  selected.value = setLanguage(event.target.value);
}
</script>

<template>
  <label class="language-picker">
    <span class="sr-only">{{ t('界面语言') }}</span>
    <select id="language-select" v-model="selected" class="fluent-select__control" :aria-label="t('界面语言')" @change="changeLanguage">
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </label>
</template>
