import {polyphonic, pinyin} from 'pinyin-pro';

const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/gu;
const LATIN_SYLLABLE = /[a-züv]+[0-5]?/giu;
const MARKERS = new Set(['-', '+']);

export function normalizePinyin(value) {
  return String(value ?? '')
    .replace(/[üǖǘǚǜ]/gu, 'v')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/ü/gu, 'v')
    .replace(/[1-5]/gu, '')
    .replace(/[^a-zv]/gu, '');
}

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
  if (!text || MARKERS.has(text)) return [];
  if (HAN.test(text)) {
    const result = hanSyllables(text);
    return result.contextualChoices.map(choices => ({choices, character: null, noteIndex}));
  }
  return text.split(/[\s,，;；、]+/u)
    .map(normalizePinyin)
    .filter(Boolean)
    .map(value => ({choices: [value], character: null, noteIndex}));
}

function findCandidates(choices, source) {
  const matches = [];
  const seen = new Set();
  for (let start = 0; start <= source.length - choices.length; start += 1) {
    const window = source.slice(start, start + choices.length);
    if (window.some((item, index) => !choices[index].some(reading => item.choices.includes(reading)))) continue;
    const noteIndices = window.map(item => item.noteIndex);
    if (new Set(noteIndices).size !== noteIndices.length) continue;
    const signature = noteIndices.join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    matches.push({startNote: noteIndices[0], noteIndices});
  }
  return matches;
}

export function matchHanziLyrics(text, notes) {
  const {characters, contextualChoices, allChoices} = hanSyllables(text);
  if (!characters.length) return {characters: [], matches: []};
  const source = (notes ?? []).flatMap((note, noteIndex) => sourceSyllables(note?.lyrics, noteIndex));
  const matches = findCandidates(contextualChoices, source);
  const resolved = matches.length && characters.length > 1 ? matches : findCandidates(allChoices, source);
  return {characters, matches: resolved.map(match => ({...match, characters: [...characters]}))};
}

export function applyHanziMatch(notes, match) {
  if (!match || !Array.isArray(match.noteIndices) || !Array.isArray(match.characters) || match.noteIndices.length !== match.characters.length) return false;
  const targets = match.noteIndices.map(index => notes?.[index]);
  if (targets.some(note => !note || !note.lyrics || MARKERS.has(String(note.lyrics).trim()))) return false;
  targets.forEach((note, index) => { note.lyrics = match.characters[index]; });
  return true;
}
