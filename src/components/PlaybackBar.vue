<script setup>
import {ref} from 'vue';
import {t} from '../i18n.js';
import {formatTime} from '../lib/playback.js';

// The transport under the score: play from the playhead, the built-in piano, and the opened audio with its offset.
const props=defineProps({playback:{type:Object,required:true},disabled:Boolean});
const audioInput=ref(null);
function chooseAudio(event){const [file]=event.target.files||[];if(file)props.playback.openAudio(file);event.target.value='';}
</script>

<template>
  <div class="playback-bar" role="group" :aria-label="t('播放控制')">
    <button id="play-button" class="fluent-button fluent-button--primary playback-bar__play" type="button" :disabled="disabled" :aria-label="t(playback.playing||playback.preparing?'暂停':'播放')" :title="t('空格键播放或暂停，播放后点击谱面可跳转。')" @click="playback.toggle()"><span aria-hidden="true">{{ playback.playing||playback.preparing?'❚❚':'▶' }}</span></button>
    <button id="rewind-button" class="fluent-button fluent-button--subtle playback-bar__icon" type="button" :disabled="disabled" :aria-label="t('回到开头')" :title="t('回到开头')" @click="playback.rewind()"><span aria-hidden="true">⏮&#xFE0E;</span></button>
    <span class="playback-bar__time"><span id="playback-time">{{ formatTime(playback.position) }}</span> / <span id="playback-duration">{{ formatTime(playback.duration) }}</span></span>
    <input id="playback-seek" class="playback-bar__seek" type="range" min="0" :max="Math.max(playback.duration,0.01)" step="0.05" :value="playback.position" :disabled="disabled" :aria-label="t('播放进度')" :aria-valuetext="`${formatTime(playback.position)} / ${formatTime(playback.duration)}`" @input="playback.scrub=$event.target.valueAsNumber" @change="playback.seek($event.target.valueAsNumber)">
    <button id="piano-toggle" class="fluent-button fluent-button--subtle playback-bar__toggle" type="button" :aria-pressed="playback.pianoOn" :title="t('按谱用内置钢琴播放')" @click="playback.setPiano(!playback.pianoOn)">{{ t('钢琴') }}</button>
    <template v-if="playback.audio">
      <button id="audio-toggle" class="fluent-button fluent-button--subtle playback-bar__toggle" type="button" :aria-pressed="playback.audioOn" :title="t('播放打开的音频')" @click="playback.setAudioEnabled(!playback.audioOn)">{{ t('音频') }}</button>
      <span id="audio-name" class="playback-bar__audio-name" :title="playback.audio.name">{{ playback.audio.name }}</span>
      <label class="playback-bar__offset" :title="t('正值表示音频比谱面晚开始。')"><span>{{ t('音频偏移（秒）') }}</span><input id="audio-offset" class="fluent-field__input" type="number" step="0.01" min="-600" max="600" :value="playback.audioOffset" @change="playback.setAudioOffset($event.target.valueAsNumber)"></label>
      <button id="audio-detach" class="fluent-button fluent-button--subtle playback-bar__icon" type="button" :aria-label="t('解除挂接')" :title="t('解除挂接（歌曲仍保留，可挂到其他工程）')" @click="playback.detach()">⏏&#xFE0E;</button>
    </template>
    <template v-else>
      <button id="audio-open" class="fluent-button playback-bar__open" type="button" :title="t('打开合成器导出的音频，光标跟着真实人声走；文件只在本机读取。')" @click="audioInput.click()">{{ t('打开音频（推荐）') }}</button>
      <select v-if="playback.songs.length" id="song-attach" class="fluent-select__control playback-bar__songs" :aria-label="t('挂接已有歌曲')" value="" @change="playback.attach($event.target.value);$event.target.value=''">
        <option value="" disabled>{{ t('挂接已有歌曲') }}</option>
        <option v-for="song in playback.songs" :key="song.id" :value="song.id">{{ song.name }}</option>
      </select>
    </template>
    <input ref="audioInput" class="playback-bar__file" type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac,.opus" tabindex="-1" aria-hidden="true" @change="chooseAudio">
    <span v-if="playback.preparing" class="playback-bar__status" role="status">{{ t('正在准备播放…') }}</span>
    <span v-if="playback.error" id="playback-error" class="playback-bar__error" role="alert">{{ playback.error }}</span>
  </div>
</template>

<style scoped>
.playback-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-height:44px;padding:5px 8px;border-top:1px solid var(--fluent-border);background:var(--fluent-surface)}
.playback-bar .fluent-button{min-height:30px;font-size:12px}
.playback-bar__play{min-width:38px;padding:0;font-size:13px}
.playback-bar__icon{min-width:30px;padding:0;font-size:15px;box-shadow:none}
.playback-bar__time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--fluent-muted);white-space:nowrap}
.playback-bar__seek{flex:1 1 140px;min-width:100px;accent-color:var(--fluent-accent)}
.playback-bar__toggle{box-shadow:none}
.playback-bar__toggle[aria-pressed="true"]{background:color-mix(in srgb,var(--fluent-accent) 15%,transparent);color:var(--fluent-accent)}
.playback-bar__audio-name{max-width:150px;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.playback-bar__offset{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--fluent-muted);white-space:nowrap}
.playback-bar__offset input{width:68px;min-height:28px;padding-inline:4px;font-size:12px;font-variant-numeric:tabular-nums}
.playback-bar__file{display:none}
.playback-bar__songs{width:auto;max-width:180px;min-height:30px;font-size:12px}
.playback-bar__status{font-size:12px;color:var(--fluent-muted)}
.playback-bar__error{font-size:12px;color:var(--fluent-danger,#c50f1f)}
@media(max-width:560px){.playback-bar__seek{order:10;flex-basis:100%}.playback-bar__audio-name{max-width:96px}}
</style>
