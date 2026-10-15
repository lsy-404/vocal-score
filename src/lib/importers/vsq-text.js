// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
// Shared reader for VSQ (VOCALOID 2) and VOCALOID MIDI files: SMF files whose tracks carry an INI-like text body
// ([Common], [Master], [EventList], [ID#nnnn], [h#nnnn] ...) inside text meta events.
import { EXTENSION_LYRIC, createProject, decodeText, metersFromTicks, ticksToBlicks } from './model.js';
import { META, metaText, parseMidiFile, readTiming } from './midi-file.js';

const DM_PREFIX = /^DM:\d+:/;

// The body is split over text events prefixed "DM:nnnn:" at arbitrary byte boundaries (possibly inside a Shift_JIS
// character), so the bytes are joined before decoding.
function trackText(events) {
  const chunks = events.filter(event => event.kind === 'meta' && event.type === META.text).flatMap(event => {
    const prefix = DM_PREFIX.exec(String.fromCharCode(...event.data.subarray(0, 16)));
    return prefix ? [event.data.subarray(prefix[0].length)] : [];
  });
  if (!chunks.length) return '';
  const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  chunks.reduce((offset, chunk) => (joined.set(chunk, offset), offset + chunk.length), 0);
  return decodeText(joined);
}

/** Splits the text body into sections: name -> [[key, value], ...] in file order. */
export function parseSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\[(.+)\]\s*$/.exec(line);
    if (header) sections.set(header[1], current = []);
    else if (current && line.indexOf('=') > 0) current.push([line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]);
  }
  return sections;
}

const vsqTracks = midi => midi.tracks.map(events => ({ events, sections: parseSections(trackText(events)) })).filter(track => track.sections.size);

export const hasVsqText = midi => vsqTracks(midi).length > 0;

export function isVsqMidi(bytes) {
  try { return hasVsqText(parseMidiFile(bytes)); }
  catch { return false; }
}

// Tick where measure `measure` starts, following the file's time signatures.
function measureTick(signatures, ticksPerQuarter, measure) {
  let bar = 0, tick = 0, length = 4 * ticksPerQuarter;
  for (const signature of [...signatures].sort((a, b) => a.tick - b.tick)) {
    const bars = Math.round((signature.tick - tick) / length);
    if (bar + bars >= measure) break;
    bar += bars;
    tick = signature.tick;
    length = signature.numerator * 4 / signature.denominator * ticksPerQuarter;
  }
  return tick + (measure - bar) * length;
}

// Moves items by -shift; of those at or before the new origin only the last survives, placed at 0.
function shiftOrigin(items, key, shift) {
  const shifted = items.map(item => ({ ...item, [key]: item[key] - shift })).sort((a, b) => a[key] - b[key]);
  const start = shifted.filter(item => item[key] <= 0).at(-1);
  return [...(start ? [{ ...start, [key]: 0 }] : []), ...shifted.filter(item => item[key] > 0)];
}

const value = (section, key) => section?.find(([name]) => name === key)?.[1];

const lyricOf = handle => {
  const text = value(handle, 'L0') ?? '';
  const lyric = (/^"([^"]*)"/.exec(text)?.[1] ?? text.split(',')[0]).trim();
  return lyric === '-' ? EXTENSION_LYRIC : lyric;
};

/** Parses a VSQ or VOCALOID MIDI file. `format` is the display name, `label` the noun used in errors. */
export function parseVsqMidi(bytes, fileName, { format, label }) {
  const midi = parseMidiFile(bytes, label);
  const tracks = vsqTracks(midi);
  if (!tracks.length) throw new Error(`Invalid ${label}: no VOCALOID track data found.`);
  const ppq = midi.ticksPerQuarter;
  // VOCALOID reserves PreMeasure bars before the song; event ticks include them.
  const preMeasure = Number(value(tracks.map(track => track.sections.get('Master')).find(Boolean), 'PreMeasure')) || 0;
  const timing = readTiming(midi);
  const prefix = preMeasure ? measureTick(timing.signatures, ppq, preMeasure) : 0;
  const warnings = [...midi.warnings];
  const outputTracks = tracks.map(({ events, sections }, index) => {
    const midiName = events.filter(event => event.kind === 'meta' && event.type === META.trackName).map(metaText)[0];
    const name = value(sections.get('Common'), 'Name') || midiName || `Track ${index + 1}`;
    const notes = [];
    let early = 0;
    for (const [tickText, ids] of sections.get('EventList') ?? []) {
      for (const id of ids.split(',')) {
        const event = sections.get(id.trim());
        if (value(event, 'Type') !== 'Anote') continue;
        const tick = Number(tickText) - prefix, length = Number(value(event, 'Length'));
        if (tick < 0) { early += 1; continue; }
        notes.push({
          onset: ticksToBlicks(tick, ppq),
          duration: ticksToBlicks(tick + length, ppq) - ticksToBlicks(tick, ppq),
          pitch: Number(value(event, 'Note#')),
          lyrics: lyricOf(sections.get(value(event, 'LyricHandle')))
        });
      }
    }
    if (early) warnings.push(`Track ${name}: skipped ${early} note(s) inside the pre-measure.`);
    return { id: `vsq-track-${index + 1}`, name, notes };
  });
  const meters = shiftOrigin(metersFromTicks(timing.signatures, ppq), 'index', preMeasure);
  const tempos = shiftOrigin(timing.tempos, 'tick', prefix).map(tempo => ({ position: ticksToBlicks(tempo.tick, ppq), bpm: tempo.bpm }));
  const title = String(fileName ?? '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  return createProject({ format, title, tracks: outputTracks, tempos, meters, warnings });
}
