<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {t} from '../i18n.js';
import FluentCheckbox from './FluentCheckbox.vue';
import {applyLocatedLyrics, locatePastedLyrics, matchLevel} from '../lib/lyric-alignment.js';

const props = defineProps({project: {type: Object, required: true}});
const emit = defineEmits(['change']);

const activeTrackId = ref(String(props.project.tracks[0]?.id ?? ''));
const pastedText = ref('');
const pasteMode = ref('pinyin');
const alignAllNotes = ref(false);
const phraseChoices = ref({});
const skipped = ref(new Set());
const activePhrase = ref(-1);
const pasteField = ref(null);
const phraseList = ref(null);
const pasteScroll = ref({top: 0, left: 0, bar: 0});
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

watch([pastedText, pasteMode, activeTrackId], () => { phraseChoices.value = {}; skipped.value = new Set(); });

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
const countStatus = computed(() => {
  if (tokens.value.error) return tokens.value.error;
  if (strategy.value === 'located') return t('lyricEditor.locatedCount', {located: locatedCount.value, phrases: located.value.length, notes: changeCount.value});
  const params = {targets: targets.value.length, tokens: tokens.value.tokens.length};
  if (exactCount.value) return `${t('lyricEditor.replacementCount', params)} · ${t('lyricEditor.countExact')}`;
  const missing = Math.abs(targets.value.length - tokens.value.tokens.length);
  return `${t('lyricEditor.replacementCount', params)} · ${t(targets.value.length > tokens.value.tokens.length ? 'lyricEditor.countUnder' : 'lyricEditor.countOver', {difference: missing})}`;
});
const LEVELS = ['exact', 'high', 'low', 'none'];
const LEVEL_LABELS = {exact: 'lyricEditor.levelExact', high: 'lyricEditor.levelHigh', low: 'lyricEditor.levelLow', none: 'lyricEditor.levelNone'};
const levels = computed(() => located.value.map(matchLevel));
const levelCounts = computed(() => Object.fromEntries(LEVELS.map(level => [level, levels.value.filter(item => item === level).length])));
// Old → new for each syllable of a located phrase: a change, the same lyric again, or a pasted syllable with no note.
function phrasePairs(phrase) {
  return phrase.candidates[phrase.chosen].map((noteIndex, index) => {
    const to = String(phrase.tokens[index].value);
    if (noteIndex < 0) return {from: to, to: t('lyricEditor.noNote'), kind: 'missing'};
    const from = String(notes.value[noteIndex]?.lyrics ?? '');
    return {from: from || t('lyricEditor.empty'), to, kind: from === to ? 'same' : 'change'};
  });
}
const changeCount = computed(() => {
  if (strategy.value === 'sequential') return targets.value.filter(({note}, index) => String(note.lyrics ?? '') !== tokens.value.tokens[index]).length;
  if (strategy.value !== 'located') return 0;
  return located.value.reduce((sum, phrase, index) => sum + (phrase.chosen < 0 || skipped.value.has(index) ? 0 : phrasePairs(phrase).filter(pair => pair.kind === 'change').length), 0);
});
// Marks drawn under the pasted text, as in CASSIE's editor: each syllable takes its phrase's level, a syllable without a
// note is not found, a left-out phrase is plain, and an in-order replacement marks every syllable alike.
const marks = computed(() => {
  const text = pastedText.value;
  const spans = [];
  let cursor = 0;
  located.value.forEach((phrase, index) => phrase.tokens.forEach((token, position) => {
    const kind = strategy.value === 'sequential' ? 'order' : skipped.value.has(index) ? 'skipped' : phrase.chosen < 0 || phrase.candidates[phrase.chosen][position] < 0 ? 'none' : levels.value[index];
    if (token.start > cursor) spans.push({text: text.slice(cursor, token.start), kind: 'plain', phrase: -1});
    spans.push({text: text.slice(token.start, token.end), kind, phrase: index});
    cursor = token.end;
  }));
  // A trailing space keeps a final empty line as tall as the textarea's.
  spans.push({text: `${text.slice(cursor)} `, kind: 'plain', phrase: -1});
  return spans;
});
function syncPasteScroll() {
  const field = pasteField.value;
  if (!field) return;
  const style = getComputedStyle(field);
  pasteScroll.value = {top: field.scrollTop, left: field.scrollLeft, bar: Math.max(0, field.offsetWidth - field.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth))};
}
// The phrase under the caret is highlighted in the text and in the list, and the list follows it.
function followCaret() {
  syncPasteScroll();
  const at = pasteField.value?.selectionStart ?? -1;
  activePhrase.value = located.value.findIndex(phrase => at >= phrase.start && at <= phrase.end);
}
watch(activePhrase, index => nextTick(() => phraseList.value?.querySelector(`[data-phrase="${index}"]`)?.scrollIntoView?.({block: 'nearest'})));
function selectPhrase(index) {
  const phrase = located.value[index], field = pasteField.value;
  if (!phrase || !field) return;
  activePhrase.value = index;
  field.focus({preventScroll: true});
  field.setSelectionRange(phrase.start, phrase.end);
  syncPasteScroll();
}
function toggleSkip(index) {
  const next = new Set(skipped.value);
  if (next.has(index)) next.delete(index); else next.add(index);
  skipped.value = next;
}
let pasteObserver = null;
onMounted(() => {
  if (typeof ResizeObserver !== 'function' || !pasteField.value) return;
  pasteObserver = new ResizeObserver(syncPasteScroll);
  pasteObserver.observe(pasteField.value);
});
onBeforeUnmount(() => pasteObserver?.disconnect());

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

function firstNote(candidate) {
  return notes.value[candidate.find(noteIndex => noteIndex >= 0)];
}

function applyReplacement() {
  const track = activeTrack.value;
  if (!track || strategy.value === 'none') return;
  batchSnapshots.set(trackKey.value, track.notes.map(note => String(note.lyrics ?? '')));
  let count = targets.value.length;
  if (strategy.value === 'located') count = applyLocatedLyrics(track.notes, located.value.filter((phrase, index) => !skipped.value.has(index)));
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
      <div class="lyric-editor__field" :style="{'--bar': `${pasteScroll.bar}px`}">
        <textarea id="lyric-editor-paste" ref="pasteField" v-model="pastedText" class="fluent-field__input" rows="4" spellcheck="false" aria-label="粘贴歌词文本" @scroll="syncPasteScroll" @input="followCaret" @click="followCaret" @keyup="followCaret" @select="followCaret" @focus="followCaret" />
        <div class="lyric-editor__marks" aria-hidden="true"><pre :style="{transform: `translate(${-pasteScroll.left}px, ${-pasteScroll.top}px)`}"><span v-for="(span, index) in marks" :key="index" :class="[`mark-${span.kind}`, {'is-active': span.phrase >= 0 && span.phrase === activePhrase}]">{{ span.text }}</span></pre></div>
      </div>
      <div v-if="strategy==='located'" class="lyric-editor__legend"><span v-for="level in LEVELS" :key="level"><i :class="`mark-${level}`" aria-hidden="true">abc</i>{{ t(LEVEL_LABELS[level]) }} {{ levelCounts[level] }}</span></div>
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
        <div v-if="strategy==='located'" ref="phraseList" class="lyric-editor__phrases">
          <div v-for="(phrase,index) in located" :key="index" :data-phrase="index" class="lyric-editor__phrase" :class="[`is-${levels[index]}`, {'is-active': index===activePhrase, 'is-skipped': skipped.has(index)}]">
            <div class="lyric-editor__phrase-head">
              <input v-if="phrase.chosen>=0" type="checkbox" :checked="!skipped.has(index)" :aria-label="t('lyricEditor.includePhrase',{text:phrase.text})" @change="toggleSkip(index)">
              <button type="button" class="lyric-editor__phrase-text" :title="t('lyricEditor.showInText')" @click="selectPhrase(index)">{{ phrase.text }}</button>
              <span class="lyric-editor__level">{{ t(LEVEL_LABELS[levels[index]]) }}<template v-if="phrase.chosen>=0&&phrase.mismatches[phrase.chosen]"> · {{ t('lyricEditor.approximate',{count:phrase.mismatches[phrase.chosen]}) }}</template></span>
              <span v-if="phrase.chosen>=0" class="lyric-editor__where">{{ positionLabel(firstNote(phrase.candidates[phrase.chosen]).onset) }}</span>
              <select v-if="phrase.candidates.length>1" class="fluent-select__control" :value="phrase.chosen" :aria-label="t('lyricEditor.chooseMatch')" @change="choosePhrase(index,$event.target.value)"><option v-for="(candidate,position) in phrase.candidates" :key="position" :value="position">{{ t('lyricEditor.occurrence',{index:position+1,count:phrase.candidates.length}) }} · {{ positionLabel(firstNote(candidate).onset) }}</option></select>
            </div>
            <div v-if="phrase.chosen>=0" class="lyric-editor__pairs"><span v-for="(pair,position) in phrasePairs(phrase)" :key="position" :class="`pair-${pair.kind}`">{{ pair.kind==='same' ? pair.to : `${pair.from}→${pair.to}` }}</span></div>
          </div>
        </div>
        <template v-else>
        <div v-for="row in previewRows" :key="row.index" class="lyric-editor__pair" :class="{'is-extra': !row.note}">
          <span v-if="row.note">{{ row.index + 1 }}. {{ positionLabel(row.note.onset) }} {{ pitchLabel(row.note.pitch) }} · {{ row.note.lyrics || t('lyricEditor.empty') }} → {{ row.token ?? t('lyricEditor.missingLyric') }}</span>
          <span v-else>{{ row.index + 1 }}. {{ t('lyricEditor.extraLyric') }} → {{ row.token }}</span>
        </div>
        <small v-if="previewMore" class="lyric-editor__more">{{ t('lyricEditor.previewMore', {count: 10,total: Math.max(targets.length, tokens.tokens.length)}) }}</small>
        </template>
      </div>
      <div class="lyric-editor__batch-tools">
        <button class="fluent-button fluent-button--primary" type="button" :disabled="strategy==='none'||!changeCount" @click="applyReplacement">{{ changeCount ? t('lyricEditor.applyCount',{count:changeCount}) : t('lyricEditor.apply') }}</button>
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
.lyric-editor__field{position:relative}
.lyric-editor__field textarea,.lyric-editor__marks pre{box-sizing:border-box;margin:0;padding:6px 8px;font:13px/22px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
.lyric-editor__field textarea{position:relative;display:block;width:100%;min-height:96px;border-width:1px;resize:vertical;color:transparent;caret-color:var(--fluent-text,rgb(27 27 27));background:var(--fluent-surface,#fff)}
.lyric-editor__field textarea::selection{color:transparent;background:var(--fluent-selection,rgb(0 103 192 / .25))}
.lyric-editor__marks{position:absolute;inset:1px calc(1px + var(--bar,0px)) 1px 1px;overflow:hidden;pointer-events:none}
.lyric-editor__marks pre{min-height:100%;color:var(--fluent-text,rgb(27 27 27));border:0}
.lyric-editor__marks span,.lyric-editor__legend i{text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:4px;text-decoration-skip-ink:none}
.lyric-editor .mark-plain,.lyric-editor .mark-skipped{text-decoration-line:none}
.lyric-editor .mark-skipped{color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor .mark-exact{text-decoration-color:var(--fluent-success,#0f7b0f)}
.lyric-editor .mark-high{text-decoration-color:var(--fluent-accent,#0067c0)}
.lyric-editor .mark-low{text-decoration-color:var(--fluent-warning,#9d5d00);text-decoration-style:dashed}
.lyric-editor .mark-none{text-decoration-color:var(--fluent-danger,#c42b1c);text-decoration-style:wavy;text-decoration-thickness:1.5px}
.lyric-editor .mark-order{text-decoration-color:var(--fluent-accent,#0067c0);text-decoration-style:dotted}
.lyric-editor__marks span.is-active{background:var(--fluent-selection,rgb(0 103 192 / .18));border-radius:2px}
.lyric-editor__legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__legend i{margin-right:4px;font-style:normal;color:transparent}
.lyric-editor__mode{display:grid;grid-template-columns:auto minmax(130px,1fr);align-items:center;gap:8px;margin-top:8px;color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__alignment{display:flex;align-items:center;gap:6px;margin:8px 0;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__counts{margin:5px 0;color:var(--fluent-accent,rgb(0 103 192));font-size:11px}
.lyric-editor__counts.is-mismatch,.lyric-editor__pair.is-extra,.lyric-editor__phrase.is-extra{color:var(--fluent-danger,rgb(196 43 28))}
.lyric-editor__pair{padding:3px 0;color:var(--fluent-text,rgb(27 27 27));font-size:11px;overflow-wrap:anywhere}
.lyric-editor__phrases{max-height:300px;overflow:auto;margin:4px 0;border:1px solid var(--fluent-border,rgba(0,0,0,.14));border-radius:var(--fluent-radius,4px);scrollbar-width:thin}
.lyric-editor__phrase{display:grid;gap:4px;padding:6px 8px;border-bottom:1px solid var(--fluent-border,rgb(229 229 229));border-left:3px solid transparent;font-size:11px;overflow-wrap:anywhere}
.lyric-editor__phrase:last-child{border-bottom:0}
.lyric-editor__phrase.is-exact{border-left-color:var(--fluent-success,#0f7b0f)}
.lyric-editor__phrase.is-high{border-left-color:var(--fluent-accent,#0067c0)}
.lyric-editor__phrase.is-low{border-left-color:var(--fluent-warning,#9d5d00)}
.lyric-editor__phrase.is-none{border-left-color:var(--fluent-danger,#c42b1c);color:var(--fluent-danger,#c42b1c)}
.lyric-editor__phrase.is-active{background:var(--fluent-selection,rgb(0 103 192 / .1))}
.lyric-editor__phrase.is-skipped .lyric-editor__pairs,.lyric-editor__phrase.is-skipped .lyric-editor__phrase-text{opacity:.5;text-decoration:line-through}
.lyric-editor__phrase-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.lyric-editor__phrase-head input{margin:0}
.lyric-editor__phrase-text{min-height:0;padding:0;border:0;border-radius:0;box-shadow:none;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-align:left}
.lyric-editor__phrase-text:hover{text-decoration:underline}
.lyric-editor__level{color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__where{margin-left:auto;color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__phrase select{min-height:26px;font-size:11px;max-width:100%}
.lyric-editor__pairs{display:flex;flex-wrap:wrap;gap:3px}
.lyric-editor__pairs span{padding:0 5px;border-radius:3px;background:var(--fluent-control,rgb(0 0 0 / .05))}
.lyric-editor__pairs .pair-same{color:var(--fluent-muted,rgb(93 93 93));background:none}
.lyric-editor__pairs .pair-change{font-weight:600}
.lyric-editor__pairs .pair-missing{color:var(--fluent-danger,#c42b1c)}
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
