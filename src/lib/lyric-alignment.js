import {polyphonic, pinyin} from 'pinyin-pro';

const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/gu;
const MARKERS = new Set(['-', '+']);

export function normalizePinyin(value) {
  return String(value ?? '')
    .replace(/[üǖǘǚǜ]/gu, 'v')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/ü/gu, 'v')
    .replace(/[1-5]/gu, '')
    .replace(/[^a-zv]/gu, '')
    // Spelling variants people type for the same syllable: lue/lve, nue/nve, and ju/jv (ü after j, q, x, y).
    .replace(/^([nl])ue$/u, '$1ve')
    .replace(/^([jqxy])v/u, '$1u');
}

// Notes that carry no syllable of their own: breaths, silences, rests and SV's other placeholders.
const SILENT = new Set(['br', 'sil', 'sp', 'ap', 'r', 'cl', 'pau']);

function hanSyllables(text) {
  const characters = [...String(text ?? '').matchAll(HAN_RUN)].flatMap(match => [...match[0]]);
  if (!characters.length) return {characters: [], choices: []};
  const contextual = pinyin(characters.join(''), {type: 'array', toneType: 'none', nonZh: 'removed'});
  const contextualChoices = contextual.map(reading => [normalizePinyin(reading)].filter(Boolean));
  const allChoices = characters.map((character, index) => {
    const candidates = new Set(contextualChoices[index]);
    for (const reading of polyphonic(character, {type: 'array', toneType: 'none', nonZh: 'removed'})[0] ?? []) {
      const normalized = normalizePinyin(reading);
      if (normalized) candidates.add(normalized);
    }
    return [...candidates];
  });
  return {characters, contextualChoices, allChoices};
}

function sourceSyllables(lyric, noteIndex) {
  const text = String(lyric ?? '').trim();
  if (!text || MARKERS.has(text) || SILENT.has(text.toLowerCase())) return [];
  // SV phoneme input (".iA N") still sings a syllable, but its reading is unknown: it matches whatever is pasted there.
  if (text.startsWith('.')) return [{choices: [], wildcard: true, character: null, noteIndex}];
  if (HAN.test(text)) {
    const result = hanSyllables(text);
    return result.contextualChoices.map(choices => ({choices, character: null, noteIndex}));
  }
  return text.split(/[\s,，;；、]+/u)
    .map(normalizePinyin)
    .filter(Boolean)
    .map(value => ({choices: [value], character: null, noteIndex}));
}

// Wordless singing ("a", "ha", "m") is often left out of written lyrics.
const VOCALISE = new Set(['a', 'o', 'e', 'ha', 'ah', 'oh', 'en', 'm', 'n', 'ng', 'hm']);

// The syllables sung by the notes. A vowel that may only continue the previous syllable ("zou" then "ou") and wordless
// singing are optional: they can take a pasted syllable ("jiao ao" for 骄傲, "a" for 啊) but cost nothing to leave out.
function sourceSequence(notes) {
  const sequence = [];
  let previous = '';
  (notes ?? []).forEach((note, noteIndex) => {
    for (const item of sourceSyllables(note?.lyrics, noteIndex)) {
      const reading = item.choices[0] ?? '';
      const resung = previous && /^[aeiouv]+(?:n|ng|r)?$/u.test(reading) && reading !== previous && previous.endsWith(reading);
      sequence.push(resung || VOCALISE.has(reading) ? {...item, optional: true} : item);
      if (reading) previous = reading;
    }
  });
  return sequence;
}

// Syllables of a pasted lyric and where they were typed. Punctuation, spaces and line breaks are not syllables, so
// paragraphs and line breaks never need to match the score. In "心声/新生" the second spelling rides on the first.
function lyricSyllables(text) {
  const source = String(text ?? '');
  const readings = new Map();
  for (const run of source.matchAll(HAN_RUN)) {
    const {contextualChoices, allChoices} = hanSyllables(run[0]);
    let offset = run.index;
    [...run[0]].forEach((character, index) => { readings.set(offset, {choices: contextualChoices[index] ?? [], allChoices: allChoices[index] ?? []}); offset += character.length; });
  }
  const tokens = [...source.matchAll(/\p{Script=Han}|[A-Za-zÀ-ÿüÜ]+[0-5]?/gu)].map(match => {
    const reading = readings.get(match.index) ?? {choices: [normalizePinyin(match[0])].filter(Boolean), allChoices: [normalizePinyin(match[0])].filter(Boolean)};
    return {value: match[0], start: match.index, end: match.index + match[0].length, ...reading, alternativeOf: -1};
  });
  // A doubled character (层层叠叠) is often sung once, so the second of a pair costs nothing to leave out.
  tokens.forEach((token, index) => { token.optional = index > 0 && HAN.test(token.value) && token.value === tokens[index - 1].value; });
  // The two spellings are the characters next to the slash that read alike: 将心声/新生镌刻 pairs 心声 with 新生.
  const byStart = new Map(tokens.map((token, index) => [token.start, index]));
  for (const match of source.matchAll(/(\p{Script=Han}+)\s*[/／]\s*(\p{Script=Han}+)/gu)) {
    const before = tokens.filter(token => token.start >= match.index && token.end <= match.index + match[1].length);
    const after = tokens.filter(token => token.start >= match.index + match[0].length - match[2].length && token.end <= match.index + match[0].length);
    const readsAlike = (left, right) => left.allChoices.some(reading => right.allChoices.includes(reading));
    for (let length = Math.min(before.length, after.length); length > 0; length -= 1) {
      const first = before.slice(-length), second = after.slice(0, length);
      if (!first.every((token, index) => readsAlike(token, second[index]))) continue;
      second.forEach((token, index) => { tokens[byStart.get(token.start)].alternativeOf = byStart.get(first[index].start); });
      break;
    }
  }
  return tokens;
}

const GAP = 2;
// A syllable read the usual way scores most, another reading of a polyphonic character a little less, a phoneme note
// (whose reading is unknown) a little; a different syllable costs as much as a skipped one.
function pairScore(token, item) {
  if (item.wildcard) return 1;
  if (token.choices.some(reading => item.choices.includes(reading))) return 3;
  if (token.allChoices.some(reading => item.choices.includes(reading))) return 2;
  return -GAP;
}

// Best local alignment (Smith-Waterman) of source items [from, to) against the pasted syllables that are available.
function bestLocalAlignment(tokens, available, items, from, to) {
  const rows = to - from, columns = tokens.length, width = columns + 1;
  const score = new Int32Array((rows + 1) * width);
  let best = 0, bestRow = 0, bestColumn = 0;
  for (let row = 1; row <= rows; row += 1) {
    const item = items[from + row - 1];
    for (let column = 1; column <= columns; column += 1) {
      const diagonal = available[column - 1] ? score[(row - 1) * width + column - 1] + pairScore(tokens[column - 1], item) : 0;
      const value = Math.max(0, diagonal, score[(row - 1) * width + column] - (item.optional ? 0 : GAP), score[row * width + column - 1] - (tokens[column - 1].optional ? 0 : GAP));
      score[row * width + column] = value;
      if (value > best) { best = value; bestRow = row; bestColumn = column; }
    }
  }
  const pairs = [];
  for (let row = bestRow, column = bestColumn; row > 0 && column > 0 && score[row * width + column] > 0;) {
    const value = score[row * width + column];
    if (available[column - 1] && value === score[(row - 1) * width + column - 1] + pairScore(tokens[column - 1], items[from + row - 1])) {
      pairs.push({token: column - 1, item: from + row - 1});
      row -= 1;
      column -= 1;
    } else if (value === score[(row - 1) * width + column] - (items[from + row - 1].optional ? 0 : GAP)) row -= 1;
    else column -= 1;
  }
  pairs.reverse();
  // A lone syllable across a gap at either end ("…没唱 | 我们一起唱歌" reaching back for "chang") adds almost nothing
  // and steals a note from the line before; ends worth no more than a point are trimmed.
  const gapCost = (left, right) => {
    let cost = 0;
    for (let token = left.token + 1; token < right.token; token += 1) cost += tokens[token].optional ? 0 : GAP;
    for (let item = left.item + 1; item < right.item; item += 1) cost += items[item].optional ? 0 : GAP;
    return cost;
  };
  const worth = (pair, neighbour, before) => pairScore(tokens[pair.token], items[pair.item]) - (before ? gapCost(pair, neighbour) : gapCost(neighbour, pair));
  while (pairs.length > 1 && worth(pairs[0], pairs[1], true) <= 1) pairs.shift();
  while (pairs.length > 1 && worth(pairs.at(-1), pairs.at(-2), false) <= 1) pairs.pop();
  const kept = pairs.reduce((sum, pair, index) => sum + pairScore(tokens[pair.token], items[pair.item]) - (index ? gapCost(pairs[index - 1], pair) : 0), 0);
  return {score: Math.min(best, kept), pairs, first: pairs[0]?.item ?? from, last: pairs.at(-1)?.item ?? from};
}

// Aligns one voice: its best-matching stretch is taken first, then the next best among the notes still free, until no
// stretch of about three syllables is left. A second round lets a chorus written once cover each time it is sung.
function alignVoice(tokens, items) {
  const matches = [];
  const used = tokens.map(() => false);
  let runs = [[0, items.length]];
  for (const [reuse, threshold] of [[false, 8], [true, 11]]) {
    const cache = new Map();
    for (;;) {
      const available = tokens.map((token, index) => token.alternativeOf < 0 && (reuse || !used[index]));
      let best = null;
      for (const run of runs) {
        const key = run.join(':');
        let found = cache.get(key);
        if (!found || (!reuse && found.pairs.some(pair => !available[pair.token]))) { found = bestLocalAlignment(tokens, available, items, run[0], run[1]); cache.set(key, found); }
        if (!best || found.score > best.found.score) best = {run, found};
      }
      if (!best || best.found.score < threshold) break;
      const {run, found} = best;
      for (const pair of found.pairs) { matches.push(pair); used[pair.token] = true; }
      runs = runs.filter(item => item !== run);
      if (found.first > run[0]) runs.push([run[0], found.first]);
      if (found.last + 1 < run[1]) runs.push([found.last + 1, run[1]]);
    }
  }
  return matches;
}

/**
 * Aligns one pasted lyric, in any order and with any paragraphs, to every voice at once. Each pasted syllable is
 * 'same' (the note already says it), 'change' (a note sings it and will be corrected), 'low' (aligned to a note that
 * sings another syllable) or 'none' (no voice sings it). write: 'typed' writes the pasted text, 'pinyin' its reading.
 */
export function alignLyricsToTracks(text, tracks, {write = 'typed'} = {}) {
  const tokens = lyricSyllables(text).map(token => ({...token, pairs: []}));
  const changes = new Map();
  const voices = (tracks ?? []).map((track, trackIndex) => {
    const notes = track.notes ?? [];
    const items = sourceSequence(notes);
    const pairs = alignVoice(tokens, items);
    const matchedNotes = new Set();
    for (const {token: tokenIndex, item: itemIndex} of pairs) {
      const token = tokens[tokenIndex], {noteIndex} = items[itemIndex];
      if (matchedNotes.has(noteIndex)) continue;
      matchedNotes.add(noteIndex);
      const from = String(notes[noteIndex].lyrics ?? '');
      const to = write === 'pinyin' ? token.choices[0] ?? token.value : token.value;
      const kind = pairScore(token, items[itemIndex]) < 0 ? 'low' : from === to ? 'same' : 'change';
      token.pairs.push({trackIndex, noteIndex, from, to, kind});
      if (from !== to) changes.set(`${trackIndex}:${noteIndex}`, {trackIndex, trackId: track.id, noteIndex, from, to, kind});
    }
    // Notes that sing a syllable of their own; re-sung vowels and phoneme notes are not expected in a pasted lyric.
    const sung = new Set(items.filter(item => !item.wildcard && !item.optional).map(item => item.noteIndex));
    const uncoveredNotes = [...sung].filter(noteIndex => !matchedNotes.has(noteIndex));
    return {trackId: track.id, name: track.name, syllables: sung.size, matched: sung.size - uncoveredNotes.length, changed: [...changes.values()].filter(change => change.trackIndex === trackIndex).length, uncovered: uncoveredNotes.length, uncoveredNotes};
  });
  for (const token of tokens) {
    const source = token.alternativeOf >= 0 ? tokens[token.alternativeOf] : token;
    token.status = !source.pairs.length ? 'none' : source.pairs.some(pair => pair.kind === 'change') ? 'change' : source.pairs.every(pair => pair.kind === 'low') ? 'low' : 'same';
  }
  // The unsung half of a doubled character goes with the half that was matched.
  tokens.forEach((token, index) => { if (token.optional && token.status === 'none' && tokens[index - 1].status !== 'none') token.status = tokens[index - 1].status; });
  return {tokens, voices, changes: [...changes.values()]};
}
