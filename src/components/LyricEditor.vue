<script setup>
import {computed, ref, watch} from 'vue';
import {t} from '../i18n.js';
import FluentCheckbox from './FluentCheckbox.vue';
import {applyLocatedLyrics, locatePastedLyrics} from '../lib/lyric-alignment.js';

const props = defineProps({project: {type: Object, required: true}});
const emit = defineEmits(['change']);

const activeTrackId = ref(String(props.project.tracks[0]?.id ?? ''));
const pastedText = ref('');
const pasteMode = ref('pinyin');
const alignAllNotes = ref(false);
const phraseChoices = ref({});
const bulkSnapshots = new Map();
const batchSnapshots = new Map();
let noteSnapshots = new WeakMap();
const snapshotRevision = ref(0);

const activeTrack = computed(() => props.project.tracks.find(track => String(track.id) === activeTrackId.value) ?? null);
const trackKey = computed(() => String(activeTrack.value?.id ?? ''));
const notes = computed(() => activeTrack.value?.notes ?? []);
const hasBulkSnapshot = computed(() => {
  snapshotRevision.value;
  return bulkSnapshots.has(trackKey.value);
});
const hasBatchSnapshot = computed(() => {
  snapshotRevision.value;
  return batchSnapshots.has(trackKey.value);
});

watch([pastedText, pasteMode, activeTrackId], () => { phraseChoices.value = {}; });

watch(() => props.project, project => {
  activeTrackId.value = String(project.tracks[0]?.id ?? '');
  bulkSnapshots.clear();
  batchSnapshots.clear();
  noteSnapshots = new WeakMap();
  snapshotRevision.value += 1;
}, {flush: 'sync'});

function notify(change) {
  emit('change', {...change, trackId: activeTrack.value?.id});
}

function updateTrackName(event) {
  if (!activeTrack.value) return;
  activeTrack.value.name = event.target.value;
  notify({type: 'track-name', trackName: activeTrack.value.name});
}

function updateLyric(note, index, event) {
  note.lyrics = event.target.value;
  noteSnapshots.delete(note);
  snapshotRevision.value += 1;
  notify({type: 'lyric', noteIndex: index});
}

function toggleNoteLyric(note, index) {
  const current = String(note.lyrics ?? '');
  if (current) {
    noteSnapshots.set(note, current);
    note.lyrics = '';
  } else if (noteSnapshots.has(note)) {
    note.lyrics = noteSnapshots.get(note);
    noteSnapshots.delete(note);
  } else {
    return;
  }
  snapshotRevision.value += 1;
  notify({type: 'lyric', noteIndex: index});
}

function clearAllLyrics() {
  const track = activeTrack.value;
  if (!track || !track.notes.length || bulkSnapshots.has(trackKey.value)) return;
  bulkSnapshots.set(trackKey.value, track.notes.map(note => String(note.lyrics ?? '')));
  track.notes.forEach(note => { note.lyrics = ''; });
  snapshotRevision.value += 1;
  notify({type: 'clear-track-lyrics'});
}

function restoreAllLyrics() {
  const track = activeTrack.value;
  const snapshot = bulkSnapshots.get(trackKey.value);
  if (!track || !snapshot) return;
  track.notes.forEach((note, index) => { note.lyrics = snapshot[index] ?? ''; });
  bulkSnapshots.delete(trackKey.value);
  snapshotRevision.value += 1;
  notify({type: 'restore-track-lyrics'});
}

// Paste modes: keep the pasted words, write Chinese as pinyin, or write the Chinese characters.
const WRITE = {pinyin: 'typed', hanzi: 'pinyin', 'hanzi-text': 'hanzi'};
const pasteError = computed(() => {
  const text = pastedText.value.trim();
  if (!text || pasteMode.value === 'pinyin') return '';
  if (/[A-Za-z]/u.test(text)) return t('lyricEditor.rejectEnglish');
  if (!/\p{Script=Han}/u.test(text)) return t('lyricEditor.invalidHanzi');
  return '';
});
// Each pasted phrase is looked up in the existing lyrics first, so only the notes that already sing it change.
const located = computed(() => pasteError.value ? [] : locatePastedLyrics(pastedText.value, notes.value, {write: WRITE[pasteMode.value], choices: phraseChoices.value}));
const locatedCount = computed(() => located.value.filter(phrase => phrase.chosen >= 0).length);
const tokens = computed(() => ({tokens: located.value.flatMap(phrase => phrase.tokens.map(token => token.value)), error: pasteError.value}));
const targets = computed(() => notes.value
  .map((note, index) => ({note, index}))
  .filter(({note}) => alignAllNotes.value || (String(note.lyrics ?? '') !== '' && !['-', '+'].includes(String(note.lyrics ?? '')))));
const exactCount = computed(() => !tokens.value.error && tokens.value.tokens.length > 0 && tokens.value.tokens.length === targets.value.length);
// Located phrases win when every phrase is found; otherwise a paste covering the whole voice still replaces in order.
const strategy = computed(() => {
  if (tokens.value.error || !tokens.value.tokens.length) return 'none';
  if (locatedCount.value === located.value.length) return 'located';
  if (exactCount.value) return 'sequential';
  return locatedCount.value ? 'located' : 'none';
});
const locatedNotes = computed(() => located.value.reduce((sum, phrase) => sum + (phrase.chosen >= 0 ? phrase.tokens.length : 0), 0));
const countStatus = computed(() => {
  if (tokens.value.error) return tokens.value.error;
  if (strategy.value === 'located') return t('lyricEditor.locatedCount', {located: locatedCount.value, phrases: located.value.length, notes: locatedNotes.value});
  const params = {targets: targets.value.length, tokens: tokens.value.tokens.length};
  if (exactCount.value) return `${t('lyricEditor.replacementCount', params)} · ${t('lyricEditor.countExact')}`;
  const missing = Math.abs(targets.value.length - tokens.value.tokens.length);
  return `${t('lyricEditor.replacementCount', params)} · ${t(targets.value.length > tokens.value.tokens.length ? 'lyricEditor.countUnder' : 'lyricEditor.countOver', {difference: missing})}`;
});
const previewRows = computed(() => {
  const length = Math.min(10, Math.max(targets.value.length, tokens.value.tokens.length));
  return Array.from({length}, (_, index) => ({
    index,
    note: targets.value[index]?.note ?? null,
    token: tokens.value.tokens[index] ?? null
  }));
});
const previewMore = computed(() => Math.max(targets.value.length, tokens.value.tokens.length) > 10);

function pitchLabel(pitch) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const value = Math.round(Number(pitch));
  return `${names[((value % 12) + 12) % 12]}${Math.floor(value / 12) - 1}`;
}

function positionLabel(onset) {
  let remaining = Math.max(0, Number(onset) || 0) / 705600000;
  const meters = [...(props.project.meters ?? [])]
    .filter(item => Number.isFinite(Number(item.index)) && Number(item.numerator) > 0 && Number(item.denominator) > 0)
    .sort((a, b) => Number(a.index) - Number(b.index));
  if (!meters.length) meters.push({index: 0, numerator: 4, denominator: 4});
  let bar = 0;
  let meter = meters[0];
  for (; bar < 100000; bar += 1) {
    const length = Number(meter.numerator) * 4 / Number(meter.denominator);
    if (remaining < length || !Number.isFinite(length) || length <= 0) {
      return t('lyricEditor.position', {bar: bar + 1, beat: Math.floor(remaining) + 1});
    }
    remaining -= length;
    const change = meters.find(item => Number(item.index) === bar + 1);
    if (change) meter = change;
  }
  return t('lyricEditor.position', {bar: bar + 1, beat: Math.floor(remaining) + 1});
}

function choosePhrase(index, value) {
  phraseChoices.value = {...phraseChoices.value, [index]: Number(value)};
}

function phrasePairs(phrase) {
  return phrase.candidates[phrase.chosen].map((noteIndex, index) => `${notes.value[noteIndex]?.lyrics || t('lyricEditor.empty')}→${phrase.tokens[index].value}`).join(' · ');
}

function applyReplacement() {
  const track = activeTrack.value;
  if (!track || strategy.value === 'none') return;
  batchSnapshots.set(trackKey.value, track.notes.map(note => String(note.lyrics ?? '')));
  let count = targets.value.length;
  if (strategy.value === 'located') count = applyLocatedLyrics(track.notes, located.value);
  else targets.value.forEach(({note}, index) => { note.lyrics = tokens.value.tokens[index]; });
  snapshotRevision.value += 1;
  notify({type: 'replace-track-lyrics', count});
}

function undoReplacement() {
  const track = activeTrack.value;
  const snapshot = batchSnapshots.get(trackKey.value);
  if (!track || !snapshot) return;
  track.notes.forEach((note, index) => { note.lyrics = snapshot[index] ?? ''; });
  batchSnapshots.delete(trackKey.value);
  snapshotRevision.value += 1;
  notify({type: 'undo-lyric-replacement'});
}
</script>

<template>
  <section class="lyric-editor">
    <div class="lyric-editor__heading">
      <h3>{{ t('lyricEditor.title') }}</h3>
      <div class="lyric-editor__tools">
        <button class="fluent-button fluent-button--subtle" type="button" :disabled="!notes.length || hasBulkSnapshot" @click="clearAllLyrics">{{ t('lyricEditor.clearAll') }}</button>
        <button v-if="hasBulkSnapshot" class="fluent-button fluent-button--subtle" type="button" @click="restoreAllLyrics">{{ t('lyricEditor.restoreAll') }}</button>
      </div>
    </div>

    <div v-if="activeTrack" class="lyric-editor__voice">
      <label for="lyric-editor-track">{{ t('lyricEditor.voice') }}</label>
      <select id="lyric-editor-track" v-model="activeTrackId" class="fluent-select__control" aria-label="选择声部">
        <option v-for="track in project.tracks" :key="track.id" :value="String(track.id)">{{ track.name || t('lyricEditor.noVoice') }}</option>
      </select>
      <label for="lyric-editor-name">{{ t('lyricEditor.voiceName') }}</label>
      <input id="lyric-editor-name" v-model="activeTrack.name" class="fluent-field__input" type="text" maxlength="160" autocomplete="off" aria-label="声部名称" @input="updateTrackName">
    </div>

    <div class="lyric-editor__paste">
      <label for="lyric-editor-paste">{{ t('lyricEditor.pasteText') }}</label>
      <textarea id="lyric-editor-paste" v-model="pastedText" class="fluent-field__input" rows="3" spellcheck="false" aria-label="粘贴歌词文本" />
      <label class="lyric-editor__mode" for="lyric-editor-mode">
        <span>{{ t('lyricEditor.pasteMode') }}</span>
        <select id="lyric-editor-mode" v-model="pasteMode" class="fluent-select__control" aria-label="粘贴文本处理方式">
          <option value="pinyin">{{ t('lyricEditor.writeTyped') }}</option>
          <option value="hanzi">{{ t('lyricEditor.writePinyin') }}</option>
          <option value="hanzi-text">{{ t('lyricEditor.writeHanzi') }}</option>
        </select>
      </label>
      <div class="lyric-editor__alignment">
        <FluentCheckbox v-model="alignAllNotes" :label="t('lyricEditor.alignAll')" />
      </div>
      <div class="lyric-editor__preview" aria-live="polite">
        <p class="lyric-editor__counts" :class="{'is-mismatch': strategy==='none'}">{{ countStatus }}</p>
        <template v-if="strategy==='located'">
          <div v-for="(phrase,index) in located.slice(0,8)" :key="index" class="lyric-editor__phrase" :class="{'is-extra': phrase.chosen<0}">
            <span>「{{ phrase.text }}」 → {{ phrase.chosen>=0 ? positionLabel(notes[phrase.candidates[phrase.chosen][0]].onset) : t('lyricEditor.notFound') }}</span>
            <select v-if="phrase.candidates.length>1" class="fluent-select__control" :value="phrase.chosen" :aria-label="t('lyricEditor.chooseMatch')" @change="choosePhrase(index,$event.target.value)"><option v-for="(candidate,position) in phrase.candidates" :key="position" :value="position">{{ t('lyricEditor.occurrence',{index:position+1,count:phrase.candidates.length}) }} · {{ positionLabel(notes[candidate[0]].onset) }}</option></select>
            <small v-if="phrase.chosen>=0">{{ phrasePairs(phrase) }}</small>
          </div>
          <small v-if="located.length>8" class="lyric-editor__more">{{ t('lyricEditor.previewMore', {count: 8, total: located.length}) }}</small>
        </template>
        <template v-else>
        <div v-for="row in previewRows" :key="row.index" class="lyric-editor__pair" :class="{'is-extra': !row.note}">
          <span v-if="row.note">{{ row.index + 1 }}. {{ positionLabel(row.note.onset) }} {{ pitchLabel(row.note.pitch) }} · {{ row.note.lyrics || t('lyricEditor.empty') }} → {{ row.token ?? t('lyricEditor.missingLyric') }}</span>
          <span v-else>{{ row.index + 1 }}. {{ t('lyricEditor.extraLyric') }} → {{ row.token }}</span>
        </div>
        <small v-if="previewMore" class="lyric-editor__more">{{ t('lyricEditor.previewMore', {count: 10,total: Math.max(targets.length, tokens.tokens.length)}) }}</small>
        </template>
      </div>
      <div class="lyric-editor__batch-tools">
        <button class="fluent-button fluent-button--primary" type="button" :disabled="strategy==='none'" @click="applyReplacement">{{ t('lyricEditor.apply') }}</button>
        <button v-if="hasBatchSnapshot" class="fluent-button fluent-button--subtle" type="button" @click="undoReplacement">{{ t('lyricEditor.undoBatch') }}</button>
      </div>
    </div>

    <div class="lyric-editor__list" :aria-label="t('lyricEditor.notes')">
      <div v-for="(note, index) in notes" :key="index" class="lyric-editor__note">
        <div class="lyric-editor__note-meta">
          <span>{{ positionLabel(note.onset) }} · {{ pitchLabel(note.pitch) }}</span>
          <span>{{ t('lyricEditor.duration', {duration: note.duration}) }}</span>
        </div>
        <input
          v-model="note.lyrics"
          class="fluent-field__input"
          type="text"
          maxlength="512"
          autocomplete="off"
          :aria-label="t('lyricEditor.noteLyric',{index:index+1})"
          @input="updateLyric(note, index, $event)"
        >
        <button
          class="fluent-button fluent-button--subtle"
          type="button"
          :disabled="!note.lyrics && !noteSnapshots.has(note)"
          :aria-label="t(note.lyrics?'lyricEditor.clearNote':'lyricEditor.restoreNote',{index:index+1})"
          @click="toggleNoteLyric(note, index)"
        >{{ t(note.lyrics?'清除':'还原') }}</button>
      </div>
      <p v-if="!notes.length" class="lyric-editor__empty">{{ t('lyricEditor.noVoice') }}</p>
    </div>
  </section>
</template>

<style scoped>
.lyric-editor{background:var(--fluent-surface,rgb(250 250 250));border:1px solid var(--fluent-border,rgba(0,0,0,.14));border-radius:var(--fluent-panel-radius,8px);padding:14px;margin:0 0 18px;color:var(--fluent-text,rgb(27 27 27));font:12px/1.5 system-ui,sans-serif}
.lyric-editor__heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lyric-editor h3{font-size:14px;margin:0}
.lyric-editor__voice{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;margin:12px 0}
.lyric-editor__voice label,.lyric-editor__paste>label:first-child{color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__voice input,.lyric-editor__voice select{width:100%;min-width:0}
.lyric-editor__paste{padding:10px 0;border-top:1px solid var(--fluent-border,rgba(0,0,0,.14))}
.lyric-editor__paste>label:first-child{display:block;margin-bottom:5px}
.lyric-editor__paste textarea{display:block;width:100%;resize:vertical;font:12px/1.5 ui-monospace,monospace}
.lyric-editor__mode{display:grid;grid-template-columns:auto minmax(130px,1fr);align-items:center;gap:8px;margin-top:8px;color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__alignment{display:flex;align-items:center;gap:6px;margin:8px 0;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__counts{margin:5px 0;color:var(--fluent-accent,rgb(0 103 192));font-size:11px}
.lyric-editor__counts.is-mismatch,.lyric-editor__pair.is-extra,.lyric-editor__phrase.is-extra{color:var(--fluent-danger,rgb(196 43 28))}
.lyric-editor__pair{padding:3px 0;color:var(--fluent-text,rgb(27 27 27));font-size:11px;overflow-wrap:anywhere}
.lyric-editor__phrase{display:grid;gap:4px;padding:6px 0;border-bottom:1px solid var(--fluent-border,rgb(229 229 229));font-size:11px;overflow-wrap:anywhere}
.lyric-editor__phrase select{min-height:28px;font-size:11px}
.lyric-editor__phrase small{color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__more{display:block;color:var(--fluent-muted,rgb(93 93 93));margin-top:4px}
.lyric-editor__batch-tools{display:flex;gap:8px;margin-top:8px}
.lyric-editor__list{max-height:280px;overflow:auto;border-top:1px solid var(--fluent-border,rgba(0,0,0,.14));scrollbar-width:thin}
.lyric-editor__note{display:grid;grid-template-columns:minmax(112px,1fr) minmax(100px,1.4fr) auto;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--fluent-border,rgba(0,0,0,.1))}
.lyric-editor__note-meta{display:grid;color:var(--fluent-muted,rgb(93 93 93));font-size:10px;line-height:1.5}
.lyric-editor__note input{width:100%;min-width:0}
.lyric-editor .fluent-button{min-height:30px;padding:0 9px;font-size:11px;box-shadow:none}
.lyric-editor__tools{display:flex;align-items:center;gap:8px}
.lyric-editor__empty{color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
@media(max-width:560px){.lyric-editor__heading{align-items:flex-start;flex-direction:column}.lyric-editor__tools{flex-wrap:wrap}.lyric-editor__note{grid-template-columns:minmax(86px,.8fr) minmax(100px,1.2fr)}.lyric-editor__note button{grid-column:2;justify-self:start}}
</style>
