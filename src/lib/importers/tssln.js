// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
// The JUCE ValueTree reader follows valuetree-ts (https://github.com/sevenc-nanashi/valuetree-ts, MIT), the parser UtaFormatix3 uses.
import { EXTENSION_LYRIC, createProject, metersFromTicks, ticksToBlicks } from './model.js';

// VoiSona clocks run at 960 per quarter note.
const CLOCKS_PER_QUARTER = 960;
const MAX_DEPTH = 64;
const REST_LYRICS = new Set(['', 'R', 'r', 'rest', 'sil', 'SP']);
const EXTENSION_LYRICS = new Set(['ー', '-']);
const utf8 = new TextDecoder();

const fail = message => { throw new Error(`Invalid VoiSona project: ${message}`); };

// JUCE ValueTree binary: type name (NUL-terminated UTF-8), property count, properties (NUL-terminated name, var),
// child count, children. Counts are compressed ints: a size byte (bit 7 = negative) then that many little-endian
// bytes. A var is a compressed byte length (0 = void) covering a type marker and its little-endian payload.
function parseTree(bytes, what) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const need = length => { if (length > bytes.length - pos) fail(`${what} is truncated.`); };
  const text = () => {
    const end = bytes.indexOf(0, pos);
    if (end < 0) fail(`${what} is truncated.`);
    const value = utf8.decode(bytes.subarray(pos, end));
    pos = end + 1;
    return value;
  };
  const compressed = () => {
    need(1);
    const head = bytes[pos++], size = head & 0x7f;
    if (size > 4) fail(`${what} contains an invalid number.`);
    need(size);
    let value = 0;
    for (let i = 0; i < size; i += 1) value += bytes[pos++] * 2 ** (8 * i);
    return head & 0x80 ? -value : value;
  };
  const count = () => {
    const value = compressed();
    if (value < 0 || value > bytes.length - pos) fail(`${what} contains an invalid item count.`);
    return value;
  };
  const variant = () => {
    const length = compressed();
    if (length < 0) fail(`${what} contains an invalid value length.`);
    if (!length) return undefined;
    need(length);
    const start = pos + 1, payload = bytes.subarray(start, pos + length);
    const fits = size => payload.length >= size || fail(`${what} contains a truncated value.`);
    pos += length;
    switch (bytes[start - 1]) {
      case 1: return fits(4) && view.getInt32(start, true);
      case 2: return true;
      case 3: return false;
      case 4: return fits(8) && view.getFloat64(start, true);
      case 5: {
        const end = payload.indexOf(0);
        return utf8.decode(end < 0 ? payload : payload.subarray(0, end));
      }
      case 6: return fits(8) && Number(view.getBigInt64(start, true));
      case 8: return payload;
      default: return undefined;
    }
  };
  const node = depth => {
    if (depth > MAX_DEPTH) fail(`${what} is nested too deeply.`);
    const type = text();
    const attributes = new Map();
    for (let i = count(); i > 0; i -= 1) attributes.set(text(), variant());
    const children = [];
    for (let i = count(); i > 0; i -= 1) children.push(node(depth + 1));
    return { type, attributes, children };
  };
  return node(0);
}

const kids = (node, type) => node.children.filter(child => child.type === type);
const number = (node, key) => typeof node.attributes.get(key) === 'number' ? node.attributes.get(key) : NaN;
const startsWith = (bytes, text) => text.length <= bytes.length && [...text].every((char, i) => bytes[i] === char.charCodeAt(0));

function stateOf(data, name) {
  // Plugin state saved through the VST wrapper carries a 48-byte host header before the tree.
  const state = parseTree(startsWith(data, 'VST') ? data.subarray(48) : data, `the plugin data of track "${name}"`);
  if (state.type !== 'StateInformation') fail(`track "${name}" has unrecognised plugin data.`);
  return state;
}

function parse(bytes, fileName = '') {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!startsWith(data, 'TSSolution\0')) fail('missing the TSSolution header.');
  const root = parseTree(data, 'the project file');
  const tracksNode = root.children.find(child => child.type === 'Tracks');
  if (!tracksNode) fail('the Tracks section is missing.');
  const tracks = [], warnings = [];
  let tempos = null, meters = null;

  // Type 0 marks a voice track; audio tracks have other types. Tempo and beat come from the first voice track.
  tracksNode.children.filter(track => track.attributes.get('Type') === 0).forEach((track, index) => {
    const label = track.attributes.get('Name');
    const name = typeof label === 'string' && label ? label : `Track ${index + 1}`;
    const pluginData = track.attributes.get('PluginData');
    if (!(pluginData instanceof Uint8Array)) {
      warnings.push(`Track ${name}: no VoiSona plugin data, skipped.`);
      return;
    }
    const songs = kids(stateOf(pluginData, name), 'Song');
    const tempoNodes = songs.flatMap(song => kids(song, 'Tempo')).flatMap(node => node.children);
    const beatNodes = songs.flatMap(song => kids(song, 'Beat')).flatMap(node => node.children);
    if (!tempos && tempoNodes.length) {
      tempos = tempoNodes.map(node => ({ position: ticksToBlicks(number(node, 'Clock'), CLOCKS_PER_QUARTER), bpm: number(node, 'Tempo') }));
    }
    if (!meters && beatNodes.length) {
      meters = metersFromTicks(beatNodes.map(node => ({ tick: number(node, 'Clock'), numerator: number(node, 'Beats'), denominator: number(node, 'BeatType') }))
        .filter(item => Number.isFinite(item.tick)), CLOCKS_PER_QUARTER);
    }
    const notes = [];
    for (const note of songs.flatMap(song => kids(song, 'Score')).flatMap(score => kids(score, 'Note'))) {
      const raw = String(note.attributes.get('Lyric') ?? '').trim();
      if (REST_LYRICS.has(raw)) continue;
      // Lyrics may carry explicit phonemes in brackets, e.g. "か[k,a]".
      const lyric = raw.replace(/\[.+?\]/gu, '').trim();
      notes.push({
        onset: ticksToBlicks(number(note, 'Clock'), CLOCKS_PER_QUARTER),
        duration: ticksToBlicks(number(note, 'Duration'), CLOCKS_PER_QUARTER),
        pitch: number(note, 'PitchOctave') * 12 + number(note, 'PitchStep') + 12,
        lyrics: EXTENSION_LYRICS.has(lyric) ? EXTENSION_LYRIC : lyric
      });
    }
    tracks.push({ name, notes });
  });

  const version = root.attributes.get('VersionOfAppFileSaved');
  return createProject({
    format: 'VoiSona',
    title: String(fileName).replace(/^.*[\\/]/u, '').replace(/\.[^.]*$/u, ''),
    version: typeof version === 'string' ? version : null,
    tracks,
    tempos: tempos ?? [],
    meters: meters ?? [],
    warnings
  });
}

export default { id: 'tssln', name: 'VoiSona', extensions: ['tssln'], beta: true, parse };
