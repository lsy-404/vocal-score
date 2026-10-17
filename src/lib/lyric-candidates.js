// Characters for lyrics typed as pinyin. A syllable such as "yue" among Chinese lyrics usually stands for a character
// the song already writes somewhere: in another part singing the same words at the same time, or in the same phrase
// earlier or later in the song. Those places, matched by reading, are the candidates; the more of the neighbouring
// syllables that also match, the closer the place is to the same words. A character that makes a known word with its
// neighbour (音 + yue → 音乐) is offered too, and every common character of the reading is listed last.
import {pinyin, polyphonic, segment} from 'pinyin-pro';
import {normalizePinyin} from './lyric-alignment.js';

const QUARTER = 705600000;
const SAME_TIME = QUARTER / 4;
const HAN = /\p{Script=Han}/u;
const MARKERS = new Set(['-', '+']);
const SILENT = new Set(['br', 'sil', 'sp', 'ap', 'r', 'cl', 'pau']);
// A toneless pinyin syllable (ü written v), loosely: an optional initial, a medial and a final.
const PINYIN = /^(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:[iuv])?(?:a|o|e|ai|ei|ao|ou|an|en|ang|eng|ong|er|i|u|v|n|ng|in|ing|un|ui|iu|ie|ue|ve)?$/u;

/** True for a lyric written as one pinyin syllable (tone digits and marks allowed). */
export function isPinyinLyric(lyric) {
  const text = String(lyric ?? '').trim();
  if (!/^\p{Script=Latin}+[0-5]?$/u.test(text)) return false;
  const reading = normalizePinyin(text);
  return Boolean(reading) && PINYIN.test(reading) && !SILENT.has(reading);
}

// The 3,755 common characters (GB 2312 level 1), read from the GBK decoder so no list ships with the app.
let readingIndex = null;
function charactersByReading() {
  if (readingIndex) return readingIndex;
  readingIndex = new Map();
  let decoder;
  try { decoder = new TextDecoder('gbk'); } catch { return readingIndex; }
  for (let high = 0xb0; high <= 0xd7; high += 1) {
    for (let low = 0xa1; low <= 0xfe && !(high === 0xd7 && low > 0xf9); low += 1) {
      const character = decoder.decode(new Uint8Array([high, low]));
      for (const reading of polyphonic(character, {type: 'array', toneType: 'none'})[0] ?? []) {
        const key = normalizePinyin(reading);
        if (!key) continue;
        const list = readingIndex.get(key) ?? [];
        if (!list.includes(character)) list.push(character);
        readingIndex.set(key, list);
      }
    }
  }
  return readingIndex;
}

// Two characters pinyin-pro's dictionary knows as one word (its words are the ones a polyphonic character needs).
const wordCache = new Map();
function isWord(text) {
  if (!wordCache.has(text)) {
    const parts = segment(text);
    wordCache.set(text, parts.length === 1 && parts[0].origin === text);
  }
  return wordCache.get(text);
}

// Characters of a reading that make a word with a neighbour: a written character, or any character of a neighbour
// typed as pinyin too ("yin yue" → 音乐).
const pairCache = new Map();
function wordsWith(reading, neighbour, before) {
  if (!neighbour || !['han', 'pinyin'].includes(neighbour.kind) || !neighbour.reading) return [];
  const options = charactersByReading().get(reading) ?? [];
  if (neighbour.kind === 'han') {
    return options.filter(character => isWord(before ? neighbour.text + character : character + neighbour.text)).map(character => ({text: character, word: before ? neighbour.text + character : character + neighbour.text}));
  }
  // Words are kept by their two readings in order, so both syllables of a pair share them: the target takes its side.
  const [first, second] = before ? [neighbour.reading, reading] : [reading, neighbour.reading];
  const key = `${first}|${second}`;
  if (!pairCache.has(key)) {
    const words = [];
    for (const left of charactersByReading().get(first) ?? []) {
      for (const right of charactersByReading().get(second) ?? []) if (isWord(left + right)) words.push(left + right);
    }
    pairCache.set(key, words);
  }
  return pairCache.get(key).map(word => ({text: [...word][before ? 1 : 0], word}));
}

// Each track's syllables in order: Han characters with their readings in context, typed pinyin, and other sung text.
function trackSyllables(track) {
  const syllables = [];
  (track.notes ?? []).forEach((note, noteIndex) => {
    const text = String(note?.lyrics ?? '').trim();
    if (!text || MARKERS.has(text) || SILENT.has(text.toLowerCase())) return;
    const at = {noteIndex, onset: Number(note.onset) || 0, end: (Number(note.onset) || 0) + (Number(note.duration) || 0)};
    if (HAN.test(text)) {
      for (const character of [...text].filter(value => HAN.test(value))) syllables.push({...at, kind: 'han', text: character, reading: ''});
    } else if (isPinyinLyric(text)) {
      syllables.push({...at, kind: 'pinyin', text, reading: normalizePinyin(text)});
    } else {
      syllables.push({...at, kind: 'other', text, reading: normalizePinyin(text)});
    }
  });
  // Characters read in context, so polyphonic ones (乐 in 音乐 and in 快乐) get the reading the words give them.
  const han = syllables.filter(syllable => syllable.kind === 'han');
  if (han.length) {
    const readings = pinyin(han.map(syllable => syllable.text).join(''), {type: 'array', toneType: 'none', nonZh: 'removed'});
    han.forEach((syllable, index) => { syllable.reading = normalizePinyin(readings[index]); });
  }
  return syllables;
}

// How alike the syllables around two places read: neighbours next to each other count most, and each side stops at
// its first difference.
function contextMatch(left, i, right, k) {
  let score = 0;
  for (const direction of [-1, 1]) {
    for (let step = 1, weight = 1; step <= 3; step += 1, weight *= 0.6) {
      const a = left[i + direction * step], b = right[k + direction * step];
      if (!a?.reading || a.reading !== b?.reading) break;
      score += weight;
    }
  }
  return score;
}

// Bar numbers (from 1) for positions in blicks, from the project's meters.
function barCounter(meters) {
  const sorted = [...(meters ?? [])].filter(meter => meter?.numerator > 0 && meter?.denominator > 0).sort((a, b) => a.index - b.index);
  if (!sorted.length || sorted[0].index > 0) sorted.unshift({index: 0, numerator: 4, denominator: 4});
  return onset => {
    let start = 0;
    for (const [position, meter] of sorted.entries()) {
      const length = meter.numerator * 4 / meter.denominator * QUARTER;
      const next = sorted[position + 1];
      const end = next ? start + (next.index - meter.index) * length : Infinity;
      if (onset < end) return meter.index + Math.floor((onset - start) / length) + 1;
      start = end;
    }
    return 1;
  };
}

/**
 * Candidates for every pinyin lyric that the song can supply a character for.
 * @returns {Array<{trackId, noteIndex, reading, bar, before, after, candidates: Array<{text, source, confident}>, homophones: string[], together: Array<{trackId, noteIndex}>}>}
 *   source is {kind: 'time', trackName} for another part at the same time, {kind: 'context', bar, snippet} for the
 *   same words elsewhere, or {kind: 'word', word} for a word with a neighbour; homophones are the other common
 *   characters of the reading; together lists pinyin of the same reading sung at the same time in other parts. A
 *   confident candidate comes from the song itself (same time, or the same reading with matching neighbours); bar,
 *   before and after place the lyric for a list of them.
 */
export function findLyricCandidates(tracks, meters, {limit = 6} = {}) {
  const lines = (tracks ?? []).map(track => ({track, syllables: trackSyllables(track)}));
  const byReading = new Map();
  for (const line of lines) {
    line.syllables.forEach((syllable, index) => {
      if (syllable.kind !== 'han' || !syllable.reading) return;
      const list = byReading.get(syllable.reading) ?? [];
      list.push({line, index});
      byReading.set(syllable.reading, list);
    });
  }
  const barOf = barCounter(meters);
  const snippet = (syllables, index) => syllables.slice(Math.max(0, index - 2), index + 2).map(syllable => syllable.text).join('');
  const results = [];
  for (const line of lines) {
    line.syllables.forEach((target, i) => {
      if (target.kind !== 'pinyin') return;
      const scores = new Map();
      const offer = (text, score, source) => {
        const entry = scores.get(text);
        if (!entry) scores.set(text, {text, score, source, count: 1});
        else {
          entry.count += 1;
          if (score > entry.score) Object.assign(entry, {score, source});
        }
      };
      for (const {line: other, index: k} of byReading.get(target.reading) ?? []) {
        const source = other.syllables[k];
        const context = contextMatch(line.syllables, i, other.syllables, k);
        const sameTime = other !== line && Math.abs(source.onset - target.onset) <= SAME_TIME;
        if (sameTime) offer(source.text, 10 + context, {kind: 'time', trackName: other.track.name});
        else offer(source.text, context > 0 ? 2 + context * 2 : 1, {kind: 'context', bar: barOf(source.onset), snippet: snippet(other.syllables, k), matched: Math.round(context * 100) / 100});
      }
      for (const [neighbour, before] of [[line.syllables[i - 1], true], [line.syllables[i + 1], false]]) {
        for (const {text, word} of wordsWith(target.reading, neighbour, before)) offer(text, 6, {kind: 'word', word});
      }
      const homophones = (charactersByReading().get(target.reading) ?? []).filter(text => !scores.has(text));
      if (!scores.size && !homophones.length) return;
      const together = [];
      for (const other of lines) {
        if (other === line) continue;
        for (const syllable of other.syllables) {
          if (syllable.kind === 'pinyin' && syllable.reading === target.reading && Math.abs(syllable.onset - target.onset) <= SAME_TIME) together.push({trackId: other.track.id, noteIndex: syllable.noteIndex});
        }
      }
      const candidates = [...scores.values()]
        .map(entry => ({...entry, score: entry.score + Math.min(1, (entry.count - 1) * 0.2)}))
        .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
        .slice(0, limit)
        // The song's own sources to fill in without asking each time: another part at the same time, or the same
        // reading where the neighbouring syllables match too.
        .map(({text, source}) => ({text, source, confident: source.kind === 'time' || (source.kind === 'context' && source.matched > 0)}));
      const around = (from, to) => line.syllables.slice(Math.max(0, from), Math.max(0, to)).map(syllable => syllable.text);
      results.push({trackId: line.track.id, noteIndex: target.noteIndex, reading: target.reading, bar: barOf(target.onset), before: around(i - 3, i), after: around(i + 1, i + 3), candidates, homophones, together});
    });
  }
  return results;
}
