// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
// The optional extN feature fields follow the layout described by LibreSVIP (https://github.com/SoulMelody/LibreSVIP, MIT).
import { EXTENSION_LYRIC, createProject, ticksToBlicks } from './model.js';

const TICKS_PER_QUARTER = 480;
// DeepVocal numbers keys downwards: the MIDI note is 115 minus the stored key.
const NOTE_KEY_SUM = 115;
// The first time signature sits at measure -3 and the song starts after four lead-in measures, at measure 1.
const FIRST_MEASURE = -3;
const LEAD_IN_MEASURES = 4;
const REST_LYRICS = new Set(['', 'R', 'r', 'rest', 'sil', 'SP']);
const utf8 = new TextDecoder();

const fail = message => { throw new Error(`Invalid DeepVocal project: ${message}`); };

// Integers are little-endian int32. Strings and blocks carry an int32 byte length; lists are blocks that start with an item count.
class Reader {
  constructor(bytes, start = 0, end = bytes.length, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)) {
    Object.assign(this, { bytes, pos: start, end, view });
  }

  need(length, what) {
    if (!(length >= 0) || length > this.end - this.pos) fail(`${what} is truncated or corrupt.`);
  }

  int(what) {
    this.need(4, what);
    this.pos += 4;
    return this.view.getInt32(this.pos - 4, true);
  }

  skip(length, what) {
    this.need(length, what);
    this.pos += length;
  }

  block(what) {
    const length = this.int(what);
    this.skip(length, what);
    return new Reader(this.bytes, this.pos - length, this.pos, this.view);
  }

  string(what) {
    const block = this.block(what);
    return utf8.decode(this.bytes.subarray(block.pos, block.end)).trim();
  }

  count(what, minSize) {
    const value = this.int(`the ${what} count`);
    if (value < 0 || value * minSize > this.end - this.pos) fail(`the ${what} count ${value} is out of range.`);
    return value;
  }

  list(what, minSize, read) {
    const block = this.block(`the ${what} list`);
    const items = Array.from({ length: block.count(what, minSize) }, () => read(block));
    if (block.pos !== block.end) fail(`the ${what} list does not match the expected layout.`);
    return items;
  }

  tag(text) {
    if (this.end - this.pos < text.length || [...text].some((char, i) => this.bytes[this.pos + i] !== char.charCodeAt(0))) return false;
    this.pos += text.length;
    return true;
  }
}

function readNote(r, features, offset) {
  const start = r.int('a note'), length = r.int('a note'), key = r.int('a note');
  r.skip(4, 'a note'); // vibrato setting
  const phoneme = r.string('a note phoneme'), word = r.string('a note lyric');
  r.skip(1, 'a note');
  r.block('note vibrato data');
  r.block('note parameters');
  if (features.has(1)) r.skip(18, 'note phoneme settings');
  if (features.has(2)) r.skip(16, 'note pitch bends');
  if (features.has(4)) r.skip(4, 'a note timbre');
  if (features.has(7)) {
    r.string('a cross lyric');
    r.skip(4, 'a cross timbre');
  }
  // The second string is the written lyric (usually Chinese characters), the first its pinyin.
  const lyric = word || phoneme;
  if (REST_LYRICS.has(lyric)) return null;
  return {
    onset: ticksToBlicks(offset + start, TICKS_PER_QUARTER),
    duration: ticksToBlicks(length, TICKS_PER_QUARTER),
    pitch: NOTE_KEY_SUM - key,
    lyrics: lyric === '-' ? EXTENSION_LYRIC : lyric
  };
}

function readSegment(r, features, prefix) {
  const offset = r.int('a segment start') - prefix;
  r.int('a segment length');
  r.string('a segment name');
  r.string('a voice bank name');
  const notes = r.list('note', 37, note => readNote(note, features, offset)).filter(Boolean);
  // Volume, pitch and breath curves, then one more curve for each of ext3, ext5, ext6 and ext7.
  const curves = 3 + [3, 5, 6, 7].filter(n => features.has(n)).length;
  for (let i = 0; i < curves; i += 1) r.block('a segment curve');
  return notes;
}

// Ticks covered by the lead-in measures, honouring time signatures placed inside them.
function leadInTicks(signatures) {
  let measure = 0, tick = 0, numerator = 4, denominator = 4;
  const goTo = target => {
    tick += (target - measure) * TICKS_PER_QUARTER * 4 * numerator / denominator;
    measure = target;
  };
  for (const signature of signatures) {
    const target = signature.measure - FIRST_MEASURE;
    if (target >= LEAD_IN_MEASURES) break;
    goTo(target);
    ({ numerator, denominator } = signature);
  }
  goTo(LEAD_IN_MEASURES);
  return tick;
}

// Keeps the last change at or before the song start, moved onto it, and counts the earlier ones it replaces.
function trimLeadIn(items, key) {
  const sorted = [...items].sort((a, b) => a[key] - b[key]);
  const first = sorted.findLastIndex(item => item[key] <= 0);
  if (first < 0) return { items: sorted, dropped: 0 };
  return { items: [{ ...sorted[first], [key]: 0 }, ...sorted.slice(first + 1)], dropped: first };
}

function parse(bytes, fileName = '') {
  const file = new Reader(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  if (!file.tag('SHARPKEY')) fail('missing the SHARPKEY signature.');
  const version = file.int('the file version');
  const body = file.block('the project body');
  // Feature tags ext1..ext7 appear in order; each one adds fields to notes or segments.
  const features = new Set([1, 2, 3, 4, 5, 6, 7].filter(n => body.tag(`ext${n}`)));
  const rawTempos = body.list('tempo', 8, r => ({ tick: r.int('a tempo'), bpm: r.int('a tempo') / 100 }));
  const signatures = body.list('time signature', 12, r => ({ measure: r.int('a time signature'), numerator: r.int('a time signature'), denominator: r.int('a time signature') }))
    .filter(item => item.numerator > 0 && item.denominator > 0)
    .sort((a, b) => a.measure - b.measure);
  const prefix = leadInTicks(signatures);
  const tempos = trimLeadIn(rawTempos.map(item => ({ tick: item.tick - prefix, bpm: item.bpm })), 'tick');
  const meters = trimLeadIn(signatures.map(item => ({ ...item, measure: item.measure - FIRST_MEASURE - LEAD_IN_MEASURES })), 'measure');
  const warnings = [];
  if (tempos.dropped) warnings.push(`Ignored ${tempos.dropped} tempo change(s) inside the DeepVocal lead-in measures.`);
  if (meters.dropped) warnings.push(`Ignored ${meters.dropped} time signature(s) inside the DeepVocal lead-in measures.`);

  const tracks = [];
  const trackCount = body.count('track', 22);
  for (let index = 0; index < trackCount; index += 1) {
    const type = body.int('a track type');
    const name = body.string('a track name');
    body.skip(10, 'the track settings'); // mute and solo bytes, volume and balance int32s
    if (type !== 0) {
      body.block('an audio track');
      continue;
    }
    tracks.push({ name, notes: body.list('segment', 32, segment => readSegment(segment, features, prefix)).flat() });
  }

  return createProject({
    format: 'DeepVocal',
    title: String(fileName).replace(/^.*[\\/]/u, '').replace(/\.[^.]*$/u, ''),
    version,
    tracks,
    tempos: tempos.items.map(item => ({ position: ticksToBlicks(item.tick, TICKS_PER_QUARTER), bpm: item.bpm })),
    meters: meters.items.map(item => ({ index: item.measure, numerator: item.numerator, denominator: item.denominator })),
    warnings
  });
}

export default { id: 'dv', name: 'DeepVocal', extensions: ['dv'], beta: true, parse };
