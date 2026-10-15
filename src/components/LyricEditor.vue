<script setup>
import {computed, ref, watch} from 'vue';
import {pinyin} from 'pinyin-pro';
import {t} from '../i18n.js';
import FluentCheckbox from './FluentCheckbox.vue';
import {applyHanziMatch, matchHanziLyrics} from '../lib/lyric-alignment.js';

const props = defineProps({project: {type: Object, required: true}});
const emit = defineEmits(['change']);

const activeTrackId = ref(String(props.project.tracks[0]?.id ?? ''));
const pastedText = ref('');
const pasteMode = ref('pinyin');
const alignAllNotes = ref(false);
const matchSelection = ref(-1);
const matchSnapshots = new Map();
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
const hasMatchSnapshot = computed(() => {
  snapshotRevision.value;
  return matchSnapshots.has(trackKey.value);
});
const hanziMatch = computed(() => matchHanziLyrics(pastedText.value, notes.value));
const selectedMatch = computed(() => {
  if (hanziMatch.value.matches.length === 1) return hanziMatch.value.matches[0];
  return hanziMatch.value.matches[matchSelection.value] ?? null;
});

watch([pastedText, pasteMode, activeTrackId], () => { matchSelection.value = -1; });

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

function textTokens() {
  const text = pastedText.value.trim();
  if (!text) return {tokens: [], error: ''};
  if (pasteMode.value === 'hanzi-match') return {tokens: [], error: ''};
  if (pasteMode.value === 'hanzi' || pasteMode.value === 'hanzi-text') {
    if (/[A-Za-z]/u.test(text)) return {tokens: [], error: t('lyricEditor.rejectEnglish')};
    if (!/\p{Script=Han}/u.test(text)) return {tokens: [], error: t('lyricEditor.invalidHanzi')};
    return {tokens: pasteMode.value === 'hanzi-text' ? text.match(/\p{Script=Han}/gu) : pinyin(text, {toneType: 'none', type: 'array', nonZh: 'removed'}), error: ''};
  }
  return {tokens: text.split(/\s+/u).filter(Boolean), error: ''};
}

const tokens = computed(textTokens);
const targets = computed(() => notes.value
  .map((note, index) => ({note, index}))
  .filter(({note}) => alignAllNotes.value || (String(note.lyrics ?? '') !== '' && !['-', '+'].includes(String(note.lyrics ?? '')))));
const exactCount = computed(() => pasteMode.value !== 'hanzi-match' && !tokens.value.error && tokens.value.tokens.length > 0 && tokens.value.tokens.length === targets.value.length);
const countStatus = computed(() => {
  if (tokens.value.error) return tokens.value.error;
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

function applyHanziReplacement() {
  const track = activeTrack.value;
  const match = selectedMatch.value;
  if (!track || !match || hasMatchSnapshot.value) return;
  matchSnapshots.set(trackKey.value, {
    noteIndices: [...match.noteIndices],
    lyrics: match.noteIndices.map(index => String(track.notes[index]?.lyrics ?? ''))
  });
  if (!applyHanziMatch(track.notes, match)) {
    matchSnapshots.delete(trackKey.value);
    return;
  }
  snapshotRevision.value += 1;
  notify({type: 'match-hanzi-lyrics', count: match.noteIndices.length});
}

function undoHanziReplacement() {
  const track = activeTrack.value;
  const snapshot = matchSnapshots.get(trackKey.value);
  if (!track || !snapshot) return;
  snapshot.noteIndices.forEach((index, snapshotIndex) => {
    if (track.notes[index]) track.notes[index].lyrics = snapshot.lyrics[snapshotIndex] ?? '';
  });
  matchSnapshots.delete(trackKey.value);
  snapshotRevision.value += 1;
  notify({type: 'undo-hanzi-match'});
}

function applyReplacement() {
  if (!exactCount.value || !activeTrack.value) return;
  batchSnapshots.set(trackKey.value, activeTrack.value.notes.map(note => String(note.lyrics ?? '')));
  targets.value.forEach(({note}, index) => { note.lyrics = tokens.value.tokens[index]; });
  snapshotRevision.value += 1;
  notify({type: 'replace-track-lyrics', count: targets.value.length});
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
          <option value="pinyin">{{ t('lyricEditor.pinyinMode') }}</option>
          <option value="hanzi">{{ t('lyricEditor.hanziMode') }}</option>
          <option value="hanzi-text">{{ t('汉字替换拼音') }}</option>
          <option value="hanzi-match">{{ t('lyricEditor.hanziMatchMode') }}</option>
        </select>
      </label>
      <div class="lyric-editor__alignment">
        <FluentCheckbox v-model="alignAllNotes" :label="t('lyricEditor.alignAll')" />
      </div>
      <div v-if="pasteMode==='hanzi-match'" class="lyric-editor__match" aria-live="polite">
        <p class="lyric-editor__counts" :class="{'is-mismatch': !hanziMatch.matches.length}">{{ hanziMatch.matches.length ? t('lyricEditor.matchFound', {count: hanziMatch.matches.length, syllables: hanziMatch.characters.length}) : t('lyricEditor.matchNone') }}</p>
        <label v-if="hanziMatch.matches.length > 1" class="lyric-editor__match-choice" for="lyric-match-choice">{{ t('lyricEditor.chooseMatch') }}
          <select id="lyric-match-choice" v-model.number="matchSelection" class="fluent-select__control" :aria-label="t('lyricEditor.chooseMatch')">
            <option :value="-1">{{ t('lyricEditor.chooseMatchPlaceholder') }}</option>
            <option v-for="(match,index) in hanziMatch.matches" :key="match.noteIndices.join(',')" :value="index">{{ t('lyricEditor.matchAt', {index: match.startNote + 1, count: match.noteIndices.length}) }}</option>
          </select>
        </label>
        <div v-if="selectedMatch" class="lyric-editor__pairs"><span v-for="(character,index) in selectedMatch.characters" :key="index">{{ character }} ← {{ notes[selectedMatch.noteIndices[index]]?.lyrics }}</span></div>
        <div class="lyric-editor__batch-tools">
          <button class="fluent-button fluent-button--primary" type="button" :disabled="!selectedMatch || hasMatchSnapshot" @click="applyHanziReplacement">{{ t('lyricEditor.applyMatch') }}</button>
          <button v-if="hasMatchSnapshot" class="fluent-button fluent-button--subtle" type="button" @click="undoHanziReplacement">{{ t('lyricEditor.undoMatch') }}</button>
        </div>
      </div>
      <div v-if="pasteMode!=='hanzi-match'" class="lyric-editor__preview" aria-live="polite">
        <p class="lyric-editor__counts" :class="{'is-mismatch': !exactCount}">{{ countStatus }}</p>
        <div v-for="row in previewRows" :key="row.index" class="lyric-editor__pair" :class="{'is-extra': !row.note}">
          <span v-if="row.note">{{ row.index + 1 }}. {{ positionLabel(row.note.onset) }} {{ pitchLabel(row.note.pitch) }} · {{ row.note.lyrics || t('lyricEditor.empty') }} → {{ row.token ?? t('lyricEditor.missingLyric') }}</span>
          <span v-else>{{ row.index + 1 }}. {{ t('lyricEditor.extraLyric') }} → {{ row.token }}</span>
        </div>
        <small v-if="previewMore" class="lyric-editor__more">{{ t('lyricEditor.previewMore', {count: 10,total: Math.max(targets.length, tokens.tokens.length)}) }}</small>
      </div>
      <div v-if="pasteMode!=='hanzi-match'" class="lyric-editor__batch-tools">
        <button class="fluent-button fluent-button--primary" type="button" :disabled="!exactCount" @click="applyReplacement">{{ t('lyricEditor.apply') }}</button>
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
.lyric-editor__counts.is-mismatch,.lyric-editor__pair.is-extra{color:var(--fluent-danger,rgb(196 43 28))}
.lyric-editor__pair{padding:3px 0;color:var(--fluent-text,rgb(27 27 27));font-size:11px;overflow-wrap:anywhere}
.lyric-editor__more{display:block;color:var(--fluent-muted,rgb(93 93 93));margin-top:4px}
.lyric-editor__batch-tools{display:flex;gap:8px;margin-top:8px}
.lyric-editor__match{padding:8px 0}
.lyric-editor__match-choice{display:grid;gap:5px;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__pairs{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.lyric-editor__pairs span{padding:3px 6px;border-radius:4px;background:var(--fluent-control);font-size:11px}
.lyric-editor__list{max-height:280px;overflow:auto;border-top:1px solid var(--fluent-border,rgba(0,0,0,.14));scrollbar-width:thin}
.lyric-editor__note{display:grid;grid-template-columns:minmax(112px,1fr) minmax(100px,1.4fr) auto;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--fluent-border,rgba(0,0,0,.1))}
.lyric-editor__note-meta{display:grid;color:var(--fluent-muted,rgb(93 93 93));font-size:10px;line-height:1.5}
.lyric-editor__note input{width:100%;min-width:0}
.lyric-editor .fluent-button{min-height:30px;padding:0 9px;font-size:11px;box-shadow:none}
.lyric-editor__tools{display:flex;align-items:center;gap:8px}
.lyric-editor__empty{color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
@media(max-width:560px){.lyric-editor__heading{align-items:flex-start;flex-direction:column}.lyric-editor__tools{flex-wrap:wrap}.lyric-editor__note{grid-template-columns:minmax(86px,.8fr) minmax(100px,1.2fr)}.lyric-editor__note button{grid-column:2;justify-self:start}}
</style>
