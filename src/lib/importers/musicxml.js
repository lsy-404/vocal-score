// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { unzipSync } from 'fflate';
import { BLICKS_PER_QUARTER, EXTENSION_LYRIC, createProject, decodeText, metersFromTicks, parseXml, ticksToBlicks } from './model.js';
import { classifyInstrument } from './instruments.js';

const FORMAT = 'MusicXML';
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const BEAT_UNITS = { maxima: 32, long: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625 };

const nameOf = node => node.localName || String(node.nodeName).replace(/^.*:/, '');
const elements = (node, name) => Array.from(node?.childNodes ?? []).filter(item => item.nodeType === 1 && (!name || nameOf(item) === name));
const child = (node, name) => elements(node, name)[0];
const value = (node, name) => child(node, name)?.textContent.trim();
const number = (node, name) => { const raw = value(node, name); return raw ? Number(raw) : NaN; };
const has = (node, name) => elements(node, name).length > 0;
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const toBytes = bytes => bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
const isZip = bytes => bytes[0] === 0x50 && bytes[1] === 0x4b;

function unpackMxl(bytes) {
  let files;
  try { files = unzipSync(bytes); } catch { throw new Error('Invalid MXL file: the archive could not be read.'); }
  let path;
  if (files['META-INF/container.xml']) {
    const rootfiles = elements(child(parseXml(decodeText(files['META-INF/container.xml'])).documentElement, 'rootfiles'), 'rootfile');
    const score = rootfiles.find(item => !item.getAttribute('media-type') || item.getAttribute('media-type') === 'application/vnd.recordare.musicxml+xml') ?? rootfiles[0];
    path = score?.getAttribute('full-path');
  }
  path ||= Object.keys(files).find(name => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name));
  if (!path || !files[path]) throw new Error('Invalid MXL file: no MusicXML score was found in the archive.');
  return files[path];
}

function readPitch(note) {
  const pitch = child(note, 'pitch');
  if (pitch) return (number(pitch, 'octave') + 1) * 12 + STEPS[value(pitch, 'step')?.toUpperCase()] + Math.round(number(pitch, 'alter') || 0);
  const unpitched = child(note, 'unpitched');
  if (unpitched) return (number(unpitched, 'display-octave') + 1) * 12 + STEPS[value(unpitched, 'display-step')?.toUpperCase()];
  return NaN;
}

// The first verse (number 1, or the first lyric when no verse is numbered 1).
function readLyric(note) {
  const lyrics = elements(note, 'lyric');
  const lyric = lyrics.find(item => (item.getAttribute('number') || '1') === '1') ?? lyrics[0];
  if (!lyric) return null;
  const extend = child(lyric, 'extend');
  return {
    text: elements(lyric, 'text').map(item => item.textContent.trim()).filter(Boolean).join(' '),
    hyphen: ['begin', 'middle'].includes(value(lyric, 'syllabic')),
    extend: extend ? extend.getAttribute('type') || 'start' : null
  };
}

function readTempo(direction) {
  const sound = Number(child(direction, 'sound')?.getAttribute('tempo'));
  if (sound > 0) return sound;
  for (const type of elements(direction, 'direction-type')) {
    for (const metronome of elements(type, 'metronome')) {
      const unit = BEAT_UNITS[value(metronome, 'beat-unit')];
      const perMinute = parseFloat(String(value(metronome, 'per-minute') ?? '').replace(/[^\d.]/g, ''));
      if (unit && perMinute > 0) return perMinute * unit * (2 - 0.5 ** elements(metronome, 'beat-unit-dot').length);
    }
  }
  return NaN;
}

// Reads one part measure by measure. Positions are kept relative to their measure until the shared timeline is known.
function readPart(part) {
  const state = { divisions: 1, time: { numerator: 4, denominator: 4 }, transpose: 0 };
  const measures = [], notes = [], ties = new Map(), melismas = new Map();
  const result = { id: part.getAttribute('id') || '', measures, notes, lyrics: false, percussion: false, repeats: false };
  for (const [index, measureNode] of elements(part, 'measure').entries()) {
    const measure = { time: null, tempos: [], length: 0, nominal: 0 };
    let cursor = 0, chordStart = 0, chordLyric = '';
    const duration = node => ticksToBlicks(number(node, 'duration') || 0, state.divisions);
    for (const item of elements(measureNode)) {
      measure.length = Math.max(measure.length, cursor);
      const type = nameOf(item);
      if (type === 'attributes') {
        if (number(item, 'divisions') > 0) state.divisions = number(item, 'divisions');
        const time = child(item, 'time');
        if (time && !has(time, 'senza-misura')) {
          const numerator = String(value(time, 'beats') ?? '').split('+').reduce((sum, beats) => sum + Number(beats), 0);
          const denominator = number(time, 'beat-type');
          if (numerator > 0 && denominator > 0) measure.time = state.time = { numerator, denominator };
        }
        const transpose = child(item, 'transpose');
        if (transpose) state.transpose = (number(transpose, 'chromatic') || 0) + 12 * (number(transpose, 'octave-change') || 0);
      } else if (type === 'direction' || type === 'sound') {
        const bpm = type === 'sound' ? Number(item.getAttribute('tempo')) : readTempo(item);
        if (bpm > 0) measure.tempos.push({ at: cursor + ticksToBlicks(number(item, 'offset') || 0, state.divisions), bpm });
      } else if (type === 'backup') {
        cursor = Math.max(0, cursor - duration(item));
      } else if (type === 'forward') {
        cursor += duration(item);
      } else if (type === 'barline') {
        result.repeats ||= has(item, 'repeat');
      } else if (type === 'note' && !has(item, 'grace')) {
        const chord = has(item, 'chord');
        const start = chord ? chordStart : cursor;
        const end = start + duration(item);
        if (!chord) { chordStart = cursor; cursor = end; }
        const voice = value(item, 'voice') || '1';
        if (has(item, 'rest')) { melismas.delete(voice); continue; }
        if (has(item, 'cue')) continue;
        result.percussion ||= has(item, 'unpitched');
        const pitch = readPitch(item) + (has(item, 'pitch') ? state.transpose : 0);
        const tie = new Set([...elements(item, 'tie'), ...elements(item, 'notations').flatMap(node => elements(node, 'tied'))].map(node => node.getAttribute('type')));
        const tieStart = tie.has('start') || tie.has('continue'), tieStop = tie.has('stop') || tie.has('continue');
        const open = tieStop ? ties.get(pitch) : null;
        if (open) {
          open.end = { measure: index, at: end };
          if (!tieStart) ties.delete(pitch);
          if (!chord) chordLyric = EXTENSION_LYRIC;
          continue;
        }
        const lyric = readLyric(item);
        let lyrics = '';
        if (chord) lyrics = lyric?.text || chordLyric;
        else if (lyric?.text) {
          lyrics = lyric.text;
          result.lyrics = true;
          melismas.set(voice, { extend: lyric.extend !== null && lyric.extend !== 'stop', hyphen: lyric.hyphen });
        } else if (melismas.get(voice)?.extend || melismas.get(voice)?.hyphen) {
          lyrics = EXTENSION_LYRIC;
          if (lyric?.extend === 'stop') melismas.get(voice).extend = false;
        }
        if (!chord) chordLyric = lyrics;
        const note = { measure: index, start, end: { measure: index, at: end }, pitch, lyrics };
        notes.push(note);
        if (tieStart) ties.set(pitch, note);
      }
    }
    measure.length = Math.max(measure.length, cursor);
    measure.nominal = state.time.numerator * 4 / state.time.denominator * BLICKS_PER_QUARTER;
    measures.push(measure);
  }
  return result;
}

function instrumentOf(part, scorePart) {
  const midi = child(scorePart, 'midi-instrument');
  return classifyInstrument({
    name: value(scorePart, 'part-name') || value(child(scorePart, 'score-instrument'), 'instrument-name') || '',
    program: number(midi, 'midi-program') - 1,
    percussion: part.percussion || number(midi, 'midi-channel') === 10
  });
}

export default {
  id: 'musicxml',
  name: FORMAT,
  extensions: ['musicxml', 'xml', 'mxl'],
  beta: true,
  detect(bytes, fileName = '') {
    const view = toBytes(bytes);
    if (isZip(view)) return /\.mxl$/i.test(fileName);
    return /<score-(partwise|timewise)[\s>]/.test(decodeText(view.subarray(0, 8192)));
  },
  parse(bytes, fileName = '') {
    const view = toBytes(bytes);
    let doc;
    const data = isZip(view) ? unpackMxl(view) : view;
    try { doc = parseXml(decodeText(data)); } catch { throw new Error('Invalid MusicXML file: the file is not valid XML.'); }
    const root = doc.documentElement;
    const rootName = root ? nameOf(root) : '';
    if (rootName === 'score-timewise') throw new Error('Unsupported MusicXML file: score-timewise documents are not supported; export the score as partwise MusicXML.');
    if (rootName !== 'score-partwise') throw new Error('Invalid MusicXML file: expected a score-partwise root element.');
    const scoreParts = new Map(elements(child(root, 'part-list'), 'score-part').map(node => [node.getAttribute('id'), node]));
    const parts = elements(root, 'part').map(readPart).filter(part => part.measures.length);
    if (!parts.length) throw new Error('Invalid MusicXML file: the score has no measures.');

    // Shared timeline: each measure lasts as long as its longest part, and a short first measure is a pickup
    // that ends on the first barline.
    const bars = [];
    let position = 0, pickup = 0;
    const count = Math.max(...parts.map(part => part.measures.length));
    for (let index = 0; index < count; index += 1) {
      const measures = parts.map(part => part.measures[index]).filter(Boolean);
      const actual = Math.max(...measures.map(measure => measure.length));
      if (index === 0 && actual > 0 && actual < measures[0].nominal) pickup = measures[0].nominal - actual;
      bars.push(position);
      position += actual > 0 ? actual + (index === 0 ? pickup : 0) : measures[0].nominal;
    }
    const at = (measure, offset) => bars[measure] + (measure === 0 ? pickup : 0) + offset;

    const seen = new Set();
    // A tempo at the start of a pickup applies from the very beginning.
    const tempos = parts.flatMap(part => part.measures.flatMap((measure, index) => measure.tempos.map(tempo => ({ position: index || tempo.at ? at(index, tempo.at) : 0, bpm: tempo.bpm }))))
      .filter(tempo => !seen.has(tempo.position) && seen.add(tempo.position));
    const meters = metersFromTicks(parts[0].measures.flatMap((measure, index) => measure.time ? [{ tick: bars[index], ...measure.time }] : []), BLICKS_PER_QUARTER);
    const tracks = parts.map((part, index) => {
      const scorePart = scoreParts.get(part.id);
      return {
        id: `musicxml-${part.id || index + 1}`,
        name: value(scorePart, 'part-name') || value(scorePart, 'part-abbreviation') || `Track ${index + 1}`,
        notes: part.notes.map(note => {
          const onset = at(note.measure, note.start);
          return { onset, duration: at(note.end.measure, note.end.at) - onset, pitch: note.pitch, lyrics: note.lyrics };
        }),
        ...(part.lyrics ? {} : { instrument: instrumentOf(part, scorePart) })
      };
    });
    const warnings = parts.some(part => part.repeats) ? ['MusicXML repeats are not expanded; the score is imported as written.'] : [];
    const title = value(child(root, 'work'), 'work-title') || value(root, 'movement-title') || baseName(fileName);
    return createProject({ format: FORMAT, title, version: root.getAttribute('version') || null, tracks, tempos, meters, warnings });
  }
};
