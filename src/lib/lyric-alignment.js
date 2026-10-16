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

// The syllables sung by the notes, without vowels re-sung to continue the previous syllable ("zou" then "ou").
function sourceSequence(notes) {
  const sequence = [];
  let previous = '';
  (notes ?? []).forEach((note, noteIndex) => {
    for (const item of sourceSyllables(note?.lyrics, noteIndex)) {
      const reading = item.choices[0] ?? '';
      if (previous && /^[aeiouv]+(?:n|ng|r)?$/u.test(reading) && reading !== previous && previous.endsWith(reading)) continue;
      sequence.push(item);
      if (reading) previous = reading;
    }
  });
  return sequence;
}

// Windows of the source whose syllables match the pasted readings, allowing up to `tolerance` mismatches.
function findCandidates(choices, source, tolerance = 0) {
  const matches = [];
  const seen = new Set();
  for (let start = 0; start <= source.length - choices.length; start += 1) {
    const window = source.slice(start, start + choices.length);
    let mismatches = 0;
    for (let index = 0; index < window.length && mismatches <= tolerance; index += 1) {
      if (!window[index].wildcard && !choices[index].some(reading => window[index].choices.includes(reading))) mismatches += 1;
    }
    if (mismatches > tolerance) continue;
    const noteIndices = window.map(item => item.noteIndex);
    if (new Set(noteIndices).size !== noteIndices.length) continue;
    const signature = noteIndices.join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    matches.push({startNote: noteIndices[0], noteIndices, mismatches});
  }
  return matches.sort((a, b) => a.mismatches - b.mismatches);
}

// Near matches: aligns the pasted readings to the source starting at each syllable, where a different, missing or extra
// syllable each costs one. noteIndices holds -1 for a pasted syllable that has no note.
function alignCandidates(choices, source, limit) {
  const matches = [];
  const seen = new Set();
  const same = (token, item) => item.wildcard || choices[token].some(reading => item.choices.includes(reading));
  for (let start = 0; start < source.length; start += 1) {
    if (!same(0, source[start])) continue;
    const width = Math.min(source.length - start, choices.length + limit);
    const cost = Array.from({length: choices.length + 1}, (_, token) => Array.from({length: width + 1}, (_, item) => (item === 0 ? token : token === 0 ? Infinity : 0)));
    for (let token = 1; token <= choices.length; token += 1) {
      for (let item = 1; item <= width; item += 1) {
        cost[token][item] = Math.min(
          cost[token - 1][item - 1] + (same(token - 1, source[start + item - 1]) ? 0 : 1),
          cost[token - 1][item] + 1,
          cost[token][item - 1] + 1
        );
      }
    }
    let end = 1;
    for (let item = 2; item <= width; item += 1) if (cost[choices.length][item] < cost[choices.length][end]) end = item;
    const mismatches = cost[choices.length][end];
    if (mismatches > limit) continue;
    const noteIndices = new Array(choices.length).fill(-1);
    for (let token = choices.length, item = end; token > 0;) {
      if (item > 0 && cost[token][item] === cost[token - 1][item - 1] + (same(token - 1, source[start + item - 1]) ? 0 : 1)) { noteIndices[token - 1] = source[start + item - 1].noteIndex; token -= 1; item -= 1; }
      else if (cost[token][item] === cost[token - 1][item] + 1) token -= 1;
      else item -= 1;
    }
    const placed = noteIndices.filter(index => index >= 0);
    if (new Set(placed).size !== placed.length) continue;
    const signature = noteIndices.join(',');
    if (seen.has(signature)) continue;
    seen.add(signature);
    matches.push({startNote: placed[0], noteIndices, mismatches});
  }
  return matches.sort((a, b) => a.mismatches - b.mismatches);
}

export function matchHanziLyrics(text, notes) {
  const {characters, contextualChoices, allChoices} = hanSyllables(text);
  if (!characters.length) return {characters: [], matches: []};
  const source = sourceSequence(notes);
  const matches = findCandidates(contextualChoices, source);
  const resolved = matches.length && characters.length > 1 ? matches : findCandidates(allChoices, source);
  return {characters, matches: resolved.map(match => ({...match, characters: [...characters]}))};
}

const PHRASE = /[^\r\n，。！？；、,.!?;:：…—~～]+/gu;

// Splits pasted text into phrases of tokens. Each token has the value to write, the pinyin readings used to find it, and
// its [start, end) in the pasted text so the input can be marked where each syllable was typed.
function pastedPhrases(text, write) {
  const source = String(text ?? '');
  const reading = value => [normalizePinyin(value)].filter(Boolean);
  const phrases = [];
  for (const part of source.matchAll(PHRASE)) {
    // Chinese text is phrased by spaces too; pinyin keeps spaces between its syllables.
    const words = [...part[0].matchAll(/\S+/gu)].map(word => ({text: word[0], start: part.index + word.index}));
    for (const piece of HAN.test(part[0]) ? words.map(word => [word]) : [words]) {
      const tokens = [];
      for (const word of piece) {
        for (const run of word.text.matchAll(/\p{Script=Han}+|[^\p{Script=Han}]+/gu)) {
          let start = word.start + run.index;
          if (!HAN.test(run[0])) { tokens.push({value: run[0], choices: reading(run[0]), allChoices: reading(run[0]), start, end: start + run[0].length}); continue; }
          const {characters, contextualChoices, allChoices} = hanSyllables(run[0]);
          const readings = pinyin(run[0], {type: 'array', toneType: 'none', nonZh: 'removed'});
          characters.forEach((character, index) => {
            tokens.push({value: write === 'pinyin' ? readings[index] : character, choices: contextualChoices[index], allChoices: allChoices[index], start, end: start + character.length});
            start += character.length;
          });
        }
      }
      if (!tokens.length) continue;
      const start = piece[0].start, end = piece.at(-1).start + piece.at(-1).text.length;
      phrases.push({text: source.slice(start, end), tokens, start, end});
    }
  }
  return phrases;
}

/**
 * Finds every pasted phrase in the existing lyrics, in order, so that replacements land where the words already are.
 * write: 'typed' keeps pasted words, 'pinyin' writes readings of Chinese characters, 'hanzi' writes the characters.
 * Each phrase gets all candidate positions and a default choice: the first one after the previous phrase.
 */
export function locatePastedLyrics(text, notes, {write = 'typed', choices = {}} = {}) {
  const phrases = pastedPhrases(text, write);
  const source = sourceSequence(notes);
  const used = new Set();
  let after = -1;
  return phrases.map((phrase, index) => {
    // via: how the phrase was found — its usual readings, another reading of a polyphonic character, or a near match.
    let via = 'reading';
    let candidates = findCandidates(phrase.tokens.map(token => token.choices), source);
    if (!candidates.length) { via = 'polyphonic'; candidates = findCandidates(phrase.tokens.map(token => token.allChoices), source); }
    // A phrase of four syllables or more may differ in one syllable per four (a typo, or a lyric changed while tuning).
    if (!candidates.length && phrase.tokens.length >= 4) { via = 'approximate'; candidates = alignCandidates(phrase.tokens.map(token => token.allChoices), source, Math.floor(phrase.tokens.length / 4)); }
    const free = candidates.map((candidate, position) => ({candidate, position})).filter(({candidate}) => candidate.noteIndices.every(note => note < 0 || !used.has(note)));
    const requested = Number.isInteger(choices[index]) ? free.find(({position}) => position === choices[index]) : null;
    const chosen = requested ?? free.find(({candidate}) => candidate.startNote > after) ?? free[0] ?? null;
    if (chosen) {
      chosen.candidate.noteIndices.forEach(note => { if (note >= 0) used.add(note); });
      after = Math.max(...chosen.candidate.noteIndices);
    }
    return {...phrase, via: candidates.length ? via : null, candidates: candidates.map(candidate => candidate.noteIndices), mismatches: candidates.map(candidate => candidate.mismatches), chosen: chosen ? chosen.position : -1};
  });
}

/**
 * How sure the editor is about where a located phrase goes: 'exact', 'high', 'low', or 'none' when it was not found.
 * A phrase carries via ('reading' | 'polyphonic' | 'approximate'), its candidates (note indices per position, -1 for a
 * pasted syllable without a note), the mismatches of each candidate, and the chosen candidate.
 */
export function matchLevel(phrase) {
  if (!phrase || phrase.chosen < 0) return 'none';
  const candidate = phrase.candidates[phrase.chosen], mismatches = phrase.mismatches[phrase.chosen];
  // A near match stays high while it differs in at most one syllable in eight and every pasted syllable has a note.
  if (mismatches) return mismatches * 8 <= candidate.length && !candidate.includes(-1) ? 'high' : 'low';
  // A short phrase found in several places may sit in the wrong one, and another reading of a polyphonic character is
  // less certain than the usual one.
  const ambiguous = phrase.candidates.length > 1 && candidate.length < 3;
  return phrase.via === 'reading' && !ambiguous ? 'exact' : 'high';
}

/** Writes located phrases into the notes; returns the number of notes changed. */
export function applyLocatedLyrics(notes, phrases) {
  let count = 0;
  for (const phrase of phrases) {
    const noteIndices = phrase.candidates[phrase.chosen];
    if (!noteIndices) continue;
    noteIndices.forEach((noteIndex, index) => {
      if (!notes[noteIndex] || phrase.tokens[index] === undefined) return;
      notes[noteIndex].lyrics = phrase.tokens[index].value;
      count += 1;
    });
  }
  return count;
}

export function applyHanziMatch(notes, match) {
  if (!match || !Array.isArray(match.noteIndices) || !Array.isArray(match.characters) || match.noteIndices.length !== match.characters.length) return false;
  const targets = match.noteIndices.map(index => notes?.[index]);
  if (targets.some(note => !note || !note.lyrics || MARKERS.has(String(note.lyrics).trim()))) return false;
  targets.forEach((note, index) => { note.lyrics = match.characters[index]; });
  return true;
}
