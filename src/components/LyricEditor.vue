<script setup>
// Lyrics: paste the correct lyric once — in any order, with any paragraphs and line breaks — and every voice is
// corrected where it sings it. Below, the selected voice's notes can be edited one by one.
import {computed, nextTick, ref, watch} from 'vue';
import {t} from '../i18n.js';
import MarkedTextarea from './MarkedTextarea.vue';
import {alignLyricsToTracks, applyAlignedLyrics} from '../lib/lyric-alignment.js';

const QUARTER = 705600000;
const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FRACTIONS = [[1 / 2, '½'], [1 / 3, '⅓'], [2 / 3, '⅔'], [1 / 4, '¼'], [3 / 4, '¾'], [1 / 6, '⅙'], [5 / 6, '⅚'], [1 / 8, '⅛'], [3 / 8, '⅜'], [5 / 8, '⅝'], [7 / 8, '⅞']];
const MARK = {same: 'exact', change: 'change', low: 'low', none: 'none'};
const LEGEND = [['change', 'lyricEditor.markChange'], ['same', 'lyricEditor.markSame'], ['low', 'lyricEditor.markLow'], ['none', 'lyricEditor.markNone']];

const props = defineProps({project: {type: Object, required: true}});
const emit = defineEmits(['change']);
const revision = ref(0);
const tracks = computed(() => props.project.tracks);

// Where a note sits: bar and beat, following meter changes.
const bars = computed(() => {
  const meters = [...(props.project.meters ?? [])].filter(item => Number(item.numerator) > 0 && Number(item.denominator) > 0).sort((a, b) => Number(a.index) - Number(b.index));
  if (!meters.length) meters.push({index: 0, numerator: 4, denominator: 4});
  const until = tracks.value.reduce((end, track) => track.notes.reduce((last, note) => Math.max(last, Number(note.onset) || 0), end), 0);
  const starts = [];
  let meter = meters[0];
  for (let bar = 0, start = 0; start <= until && bar < 100000; bar += 1) {
    meter = meters.find(item => Number(item.index) === bar) ?? meter;
    starts.push({start, beat: QUARTER * 4 / Number(meter.denominator)});
    start += QUARTER * 4 * Number(meter.numerator) / Number(meter.denominator);
  }
  return starts;
});
function where(note) {
  const onset = Math.max(0, Number(note?.onset) || 0);
  let low = 0, high = bars.value.length - 1;
  while (low < high) { const middle = (low + high + 1) >> 1; if (bars.value[middle].start <= onset) low = middle; else high = middle - 1; }
  const bar = bars.value[low] ?? {start: 0, beat: QUARTER};
  return {bar: low + 1, beat: Math.floor((onset - bar.start) / bar.beat + 1e-6) + 1};
}
const positionLabel = note => { const {bar, beat} = where(note); return t('lyricEditor.position', {bar, beat}); };
const pitchLabel = pitch => { const value = Math.round(Number(pitch)); return `${PITCH_NAMES[((value % 12) + 12) % 12]}${Math.floor(value / 12) - 1}`; };
function beatsLabel(duration) {
  const beats = Math.max(0, Number(duration) || 0) / QUARTER, whole = Math.floor(beats + 1e-6), rest = beats - whole;
  const fraction = rest < 1e-6 ? '' : FRACTIONS.find(([value]) => Math.abs(value - rest) < 1e-6)?.[1];
  return t('lyricEditor.beats', {beats: fraction === undefined ? String(Number(beats.toFixed(2))) : `${whole || !fraction ? whole : ''}${fraction}`});
}

// Correcting with a pasted lyric. Alignment follows the text a moment after typing stops.
const text = ref('');
const settled = ref('');
const writeMode = ref('typed');
let timer = 0;
watch(text, value => { clearTimeout(timer); timer = setTimeout(() => { settled.value = value; }, 150); });
const result = computed(() => { revision.value; return settled.value.trim() ? alignLyricsToTracks(settled.value, tracks.value, {write: writeMode.value}) : null; });
const current = computed(() => (result.value && settled.value === text.value ? result.value : null));
const counts = computed(() => Object.fromEntries(LEGEND.map(([status]) => [status, current.value?.tokens.filter(token => token.status === status).length ?? 0])));
const spans = computed(() => {
  const value = text.value;
  if (!current.value) return [{text: value, kind: 'plain', group: -1}];
  const spans = [];
  let cursor = 0;
  current.value.tokens.forEach((token, index) => {
    if (token.start > cursor) spans.push({text: value.slice(cursor, token.start), kind: 'plain', group: -1});
    spans.push({text: value.slice(token.start, token.end), kind: MARK[token.status], group: index});
    cursor = token.end;
  });
  spans.push({text: value.slice(cursor), kind: 'plain', group: -1});
  return spans;
});
// What the syllable under the caret does in each voice.
const caretAt = ref(-1);
const caretIndex = computed(() => current.value?.tokens.findIndex(token => caretAt.value >= token.start && caretAt.value <= token.end) ?? -1);
const caretInfo = computed(() => {
  const token = current.value?.tokens[caretIndex.value];
  if (!token) return '';
  const source = token.alternativeOf >= 0 ? current.value.tokens[token.alternativeOf] : token;
  if (!source.pairs.length) return t('lyricEditor.caretNone', {text: token.value});
  return source.pairs.slice(0, 4).map(pair => `${tracks.value[pair.trackIndex]?.name ?? ''} ${positionLabel(tracks.value[pair.trackIndex]?.notes[pair.noteIndex])}：${pair.from || '_'} → ${pair.to}`).join('　');
});
const voices = computed(() => (current.value?.voices ?? []).map((voice, trackIndex) => ({...voice, trackIndex})).filter(voice => voice.syllables));
const changeCount = computed(() => current.value?.changes.length ?? 0);

// One undo step for a correction, across every voice.
let snapshot = null;
const hasSnapshot = ref(false);
function notify(change) { emit('change', change); }
function apply() {
  if (!changeCount.value) return;
  snapshot = tracks.value.map(track => track.notes.map(note => String(note.lyrics ?? '')));
  const count = applyAlignedLyrics(tracks.value, current.value.changes);
  hasSnapshot.value = true;
  revision.value += 1;
  notify({type: 'replace-track-lyrics', count});
}
function undo() {
  if (!snapshot) return;
  tracks.value.forEach((track, trackIndex) => track.notes.forEach((note, noteIndex) => { note.lyrics = snapshot[trackIndex]?.[noteIndex] ?? note.lyrics; }));
  snapshot = null;
  hasSnapshot.value = false;
  revision.value += 1;
  notify({type: 'undo-lyric-replacement'});
}

// Editing one voice note by note, laid out in sung lines (a rest of a beat or more starts a new line).
const activeTrackId = ref(String(tracks.value[0]?.id ?? ''));
const bulk = new Map();
watch(() => props.project, project => { activeTrackId.value = String(project.tracks[0]?.id ?? ''); snapshot = null; hasSnapshot.value = false; bulk.clear(); revision.value += 1; }, {flush: 'sync'});
const activeIndex = computed(() => tracks.value.findIndex(track => String(track.id) === activeTrackId.value));
const activeTrack = computed(() => tracks.value[activeIndex.value] ?? null);
const notes = computed(() => activeTrack.value?.notes ?? []);
const lines = computed(() => {
  const lines = [];
  let line = null, end = -Infinity;
  notes.value.forEach((note, index) => {
    const onset = Number(note.onset) || 0;
    if (!line || onset - end >= QUARTER || line.indices.length >= 16) { line = {indices: [], bar: where(note).bar}; lines.push(line); }
    line.indices.push(index);
    end = Math.max(end, onset + (Number(note.duration) || 0));
  });
  return lines;
});
const pending = computed(() => new Map((current.value?.changes ?? []).filter(change => change.trackIndex === activeIndex.value).map(change => [change.noteIndex, change.to])));
const uncovered = computed(() => new Set(current.value?.voices[activeIndex.value]?.uncoveredNotes ?? []));
const isExtension = lyrics => lyrics === '-' || lyrics === '+';
const cellSize = value => Math.max(2, [...String(value ?? '')].reduce((size, character) => size + (character.codePointAt(0) > 255 ? 2 : 1), 0));
function cellTitle(note, index) {
  const to = pending.value.get(index);
  return `${positionLabel(note)} · ${pitchLabel(note.pitch)} · ${beatsLabel(note.duration)}${to === undefined ? '' : ` → ${to}`}`;
}
function renameTrack(event) {
  if (!activeTrack.value) return;
  activeTrack.value.name = String(event.target.value).slice(0, 160);
  notify({type: 'track-name', trackId: activeTrack.value.id, trackName: activeTrack.value.name});
}
function setLyric(index, value) {
  const note = notes.value[index];
  if (!note || note.lyrics === value) return;
  note.lyrics = value;
  revision.value += 1;
  notify({type: 'lyric', trackId: activeTrack.value.id, noteIndex: index});
}
const hasBulk = computed(() => { revision.value; return bulk.has(activeTrackId.value); });
function clearAll() {
  if (!notes.value.length || bulk.has(activeTrackId.value)) return;
  bulk.set(activeTrackId.value, notes.value.map(note => String(note.lyrics ?? '')));
  notes.value.forEach(note => { note.lyrics = ''; });
  revision.value += 1;
  notify({type: 'clear-track-lyrics', trackId: activeTrack.value.id});
}
function restoreAll() {
  const saved = bulk.get(activeTrackId.value);
  if (!saved) return;
  notes.value.forEach((note, index) => { note.lyrics = saved[index] ?? ''; });
  bulk.delete(activeTrackId.value);
  revision.value += 1;
  notify({type: 'restore-track-lyrics', trackId: activeTrack.value.id});
}
const grid = ref(null);
function showNote(trackIndex, noteIndex) {
  activeTrackId.value = String(tracks.value[trackIndex]?.id ?? activeTrackId.value);
  nextTick(() => { const cell = grid.value?.querySelector(`[data-note="${noteIndex}"]`); cell?.scrollIntoView?.({block: 'nearest'}); cell?.focus({preventScroll: true}); });
}
// One button per bar with unmatched notes, leading to its first unmatched note.
function barsOf(voice) {
  const bars = new Map();
  for (const noteIndex of voice.uncoveredNotes) { const {bar} = where(tracks.value[voice.trackIndex].notes[noteIndex]); if (!bars.has(bar)) bars.set(bar, noteIndex); }
  return [...bars].map(([bar, noteIndex]) => ({bar, noteIndex}));
}
</script>

<template>
  <section class="lyric-editor">
    <div class="lyric-editor__heading"><h3>{{ t('lyricEditor.title') }}</h3></div>

    <div class="lyric-editor__card lyric-editor__paste">
      <div class="lyric-editor__row">
        <label for="lyric-editor-paste">{{ t('lyricEditor.correctTitle') }}</label>
        <div class="lyric-editor__segments" role="radiogroup" :aria-label="t('lyricEditor.writeAs')">
          <span>{{ t('lyricEditor.writeAs') }}</span>
          <button v-for="mode in ['typed', 'pinyin']" :key="mode" type="button" role="radio" :aria-checked="writeMode === mode" :class="{active: writeMode === mode}" @click="writeMode = mode">{{ t(mode === 'typed' ? 'lyricEditor.writeText' : 'lyricEditor.writeReading') }}</button>
        </div>
      </div>
      <MarkedTextarea input-id="lyric-editor-paste" v-model="text" :spans="spans" :active="caretIndex" :min-rows="5" label="粘贴歌词文本" :placeholder="t('lyricEditor.correctPlaceholder')" @caret="caretAt = $event" />
      <template v-if="current">
        <div class="lyric-editor__legend"><span v-for="[status, label] in LEGEND" :key="status"><i class="mark-swatch" :class="`mark-${MARK[status]}`" aria-hidden="true">abc</i>{{ t(label, {count: counts[status]}) }}</span></div>
        <p class="lyric-editor__caret" aria-live="polite">{{ caretInfo || t('lyricEditor.caretHint') }}</p>
        <ul class="lyric-editor__voices">
          <li v-for="voice in voices" :key="voice.trackId">
            <strong>{{ voice.name }}</strong>
            <span>{{ t('lyricEditor.voiceSummary', {changed: voice.changed, matched: voice.matched, syllables: voice.syllables}) }}</span>
            <span v-if="voice.uncovered" class="lyric-editor__uncovered">{{ t('lyricEditor.uncovered', {count: voice.uncovered}) }}<button v-for="item in barsOf(voice).slice(0, 10)" :key="item.bar" type="button" @click="showNote(voice.trackIndex, item.noteIndex)">{{ item.bar }}</button><template v-if="barsOf(voice).length > 10">…</template></span>
          </li>
        </ul>
      </template>
      <div v-if="current || hasSnapshot" class="lyric-editor__batch-tools">
        <button v-if="current" class="fluent-button fluent-button--primary" type="button" :disabled="!changeCount" @click="apply">{{ changeCount ? t('lyricEditor.correctCount', {count: changeCount}) : t('lyricEditor.noChange') }}</button>
        <button v-if="hasSnapshot" class="fluent-button fluent-button--subtle" type="button" @click="undo">{{ t('lyricEditor.undoBatch') }}</button>
      </div>
    </div>

    <div class="lyric-editor__card">
      <div class="lyric-editor__voice">
        <select id="lyric-editor-track" v-model="activeTrackId" class="fluent-select__control" aria-label="选择声部"><option v-for="track in tracks" :key="track.id" :value="String(track.id)">{{ track.name || t('lyricEditor.noVoice') }}</option></select>
        <input v-if="activeTrack" id="lyric-editor-name" :value="activeTrack.name" class="fluent-field__input" type="text" maxlength="160" autocomplete="off" aria-label="声部名称" @input="renameTrack">
      </div>
      <div class="lyric-editor__tools">
        <span>{{ t('lyricEditor.editNotes') }}</span>
        <button class="fluent-button fluent-button--subtle" type="button" :disabled="!notes.length || hasBulk" @click="clearAll">{{ t('lyricEditor.clearAll') }}</button>
        <button v-if="hasBulk" class="fluent-button fluent-button--subtle" type="button" @click="restoreAll">{{ t('lyricEditor.restoreAll') }}</button>
      </div>
      <div ref="grid" class="lyric-editor__grid" :aria-label="t('lyricEditor.notes')">
        <div v-for="(line, lineIndex) in lines" :key="lineIndex" class="lyric-editor__line">
          <span class="lyric-editor__bar">{{ line.bar }}</span>
          <div class="lyric-editor__note">
            <input v-for="index in line.indices" :key="index" :data-note="index" :value="notes[index].lyrics" :size="cellSize(notes[index].lyrics)" :class="{'is-extension': isExtension(String(notes[index].lyrics ?? '')), 'is-empty': !notes[index].lyrics, 'is-pending': pending.has(index), 'is-uncovered': uncovered.has(index)}" :title="cellTitle(notes[index], index)" :aria-label="t('lyricEditor.noteLyric', {index: index + 1})" autocomplete="off" spellcheck="false" placeholder="·" @input="$event.isComposing || setLyric(index, $event.target.value)" @compositionend="setLyric(index, $event.target.value)">
          </div>
        </div>
        <p v-if="!notes.length" class="lyric-editor__empty">{{ t('lyricEditor.noVoice') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lyric-editor{display:grid;gap:12px;color:var(--fluent-text,rgb(27 27 27));font:12px/1.5 system-ui,sans-serif}
.lyric-editor__heading h3{margin:0;font-size:14px}
.lyric-editor__card{display:grid;gap:8px;padding:10px;border:1px solid var(--fluent-border,rgba(0,0,0,.14));border-radius:var(--fluent-panel-radius,8px);background:var(--fluent-surface,#fff)}
.lyric-editor__row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}
.lyric-editor__row label{font-size:13px;font-weight:600}
.lyric-editor__segments{display:inline-flex;align-items:center;gap:4px;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__segments button{padding:2px 9px;border:1px solid var(--fluent-border,rgba(0,0,0,.14));border-radius:12px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.lyric-editor__segments button.active{border-color:var(--fluent-accent,#0067c0);background:rgb(0 103 192 / .1);color:var(--fluent-text,rgb(27 27 27))}
.lyric-editor__legend{display:flex;flex-wrap:wrap;gap:4px 12px;color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
.lyric-editor__caret{min-height:18px;margin:0;color:var(--fluent-muted,rgb(93 93 93));font-size:11px;overflow-wrap:anywhere}
.lyric-editor__voices{display:grid;gap:3px;margin:0;padding:6px 0 0;border-top:1px solid var(--fluent-border,rgba(0,0,0,.08));list-style:none;font-size:11px}
.lyric-editor__voices li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.lyric-editor__voices span{color:var(--fluent-muted,rgb(93 93 93))}
.lyric-editor__uncovered{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:3px}
.lyric-editor__uncovered button{padding:0 5px;border:1px solid var(--fluent-danger,#c42b1c);border-radius:8px;background:none;color:var(--fluent-danger,#c42b1c);font:inherit;font-size:10px;cursor:pointer}
.lyric-editor__batch-tools{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.lyric-editor .fluent-button{min-height:30px;padding:0 10px;font-size:12px;box-shadow:none}
.lyric-editor__voice{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lyric-editor__voice select,.lyric-editor__voice input{width:100%;min-width:0}
.lyric-editor__tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.lyric-editor__tools span{margin-right:auto;font-size:13px;font-weight:600}
.lyric-editor__grid{display:grid;gap:2px;max-height:min(60vh,520px);overflow:auto;scrollbar-width:thin}
.lyric-editor__line{display:grid;grid-template-columns:28px minmax(0,1fr);gap:6px;align-items:start;padding:3px 0;border-bottom:1px solid var(--fluent-border,rgba(0,0,0,.06))}
.lyric-editor__bar{padding-top:4px;color:var(--fluent-muted,rgb(93 93 93));font-size:10px;text-align:right}
.lyric-editor__note{display:flex;flex-wrap:wrap;gap:3px}
.lyric-editor__note input{min-width:0;padding:2px 4px;border:1px solid transparent;border-radius:3px;background:var(--fluent-control,rgb(0 0 0 / .04));color:inherit;font:14px/1.4 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;text-align:center}
.lyric-editor__note input:hover{border-color:var(--fluent-border,rgba(0,0,0,.2))}
.lyric-editor__note input:focus{border-color:var(--fluent-accent,#0067c0);background:var(--fluent-surface,#fff);outline:none}
.lyric-editor__note input.is-extension{color:var(--fluent-muted,rgb(93 93 93));background:transparent}
.lyric-editor__note input.is-empty{background:transparent;border-style:dashed;border-color:var(--fluent-border,rgba(0,0,0,.2))}
.lyric-editor__note input.is-pending{box-shadow:inset 0 -2px 0 var(--fluent-accent,#0067c0)}
.lyric-editor__note input.is-uncovered{box-shadow:inset 0 -2px 0 var(--fluent-danger,#c42b1c)}
.lyric-editor__empty{color:var(--fluent-muted,rgb(93 93 93));font-size:11px}
@media(max-width:700px){.lyric-editor__note input{font-size:16px}}
</style>
