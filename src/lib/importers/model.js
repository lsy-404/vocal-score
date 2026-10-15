// Shared contract for every project importer. An importer turns the bytes of one source file into the
// same project shape that parseSvp returns, so createScore and the rest of the app need not know the format.
//
// Project shape:
//   { format, title, version, tracks, tempos, meters, warnings, tuningSummary }
//   tracks: [{ id, name, notes: [{ onset, duration, pitch, lyrics, tuning }], instrument? }]
//   onset/duration are in blicks (BLICKS_PER_QUARTER per quarter note); pitch is an integer MIDI note.
//   tempos: [{ position (blicks), bpm }]; meters: [{ index (measure index), numerator, denominator }].
//   instrument (optional, instrumental sources): { name, family, order, clef, percussion }, see instruments.js.

export const BLICKS_PER_QUARTER = 705600000;

// Lyric that continues the previous syllable; createScore draws it as a melisma extension.
export const EXTENSION_LYRIC = '-';

export function emptyTuning() {
  return {
    detuneCents: 0,
    curvePointCount: 0,
    curveMode: null,
    curveRepresentativeCents: 0,
    curveApproximate: false,
    pitchControlCurveCount: 0,
    expression: {},
    systemExpression: {},
    referenceExpression: {},
    referenceTranspose: { cents: null, semitones: null }
  };
}

export function emptyTuningSummary() {
  return { nonzeroDetuneNotes: 0, pitchDeltaCurves: 0, pitchDeltaPoints: 0, pitchControlCurves: 0, explicitExpressionNotes: 0, systemExpressionNotes: 0, referenceExpressionNotes: 0 };
}

export function ticksToBlicks(ticks, ticksPerQuarter) {
  return Math.round(Number(ticks) * BLICKS_PER_QUARTER / Number(ticksPerQuarter));
}

// Converts time signatures placed at absolute ticks into measure indexes, honouring earlier changes.
export function metersFromTicks(signatures, ticksPerQuarter) {
  const sorted = [...signatures].filter(item => item && item.numerator > 0 && item.denominator > 0).sort((a, b) => a.tick - b.tick);
  const meters = [];
  let measure = 0, tick = 0, current = { numerator: 4, denominator: 4 };
  for (const signature of sorted) {
    const length = current.numerator * 4 / current.denominator * ticksPerQuarter;
    if (signature.tick > tick) {
      measure += Math.round((signature.tick - tick) / length);
      tick = signature.tick;
    }
    const meter = { index: measure, numerator: Number(signature.numerator), denominator: Number(signature.denominator) };
    if (meters.at(-1)?.index === measure) meters[meters.length - 1] = meter;
    else meters.push(meter);
    current = meter;
  }
  if (!meters.length || meters[0].index !== 0) meters.unshift({ index: 0, numerator: 4, denominator: 4 });
  return meters;
}

// Decodes text that may be UTF-8 (with or without BOM), UTF-16 with BOM, or Shift_JIS, the usual encodings of Japanese singing-synthesis files.
export function decodeText(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view[0] === 0xff && view[1] === 0xfe) return new TextDecoder('utf-16le').decode(view.subarray(2));
  if (view[0] === 0xfe && view[1] === 0xff) return new TextDecoder('utf-16be').decode(view.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(view).replace(/^﻿/, ''); }
  catch { return new TextDecoder('shift_jis').decode(view); }
}

// Parses XML with the platform DOMParser (tests install one). Importers should use only DOM Level 2 calls
// (getElementsByTagName, childNodes, getAttribute, textContent) so that both browsers and tests work.
export function parseXml(text) {
  const Parser = globalThis.DOMParser;
  if (!Parser) throw new Error('XML parsing is unavailable.');
  const doc = new Parser().parseFromString(String(text).replace(/^﻿/, ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid XML project file.');
  return doc;
}

/**
 * Validates and normalises an importer's result into the project shape. Notes with invalid timing or pitch are
 * dropped with a warning; tracks without notes are removed; ids are made unique; tempos and meters get defaults.
 */
export function createProject({ format, title = '', version = null, tracks = [], tempos = [], meters = [], warnings = [] }) {
  const output = { format: String(format), title: String(title || 'Untitled score'), version, tracks: [], tempos: [], meters: [], warnings: [...warnings], tuningSummary: emptyTuningSummary() };
  const ids = new Set();
  tracks.forEach((track, index) => {
    const name = String(track?.name || `Track ${index + 1}`);
    const notes = [];
    let dropped = 0;
    for (const note of track?.notes ?? []) {
      const onset = Number(note?.onset), duration = Number(note?.duration), pitch = Number(note?.pitch);
      if (!Number.isFinite(onset) || onset < 0 || !Number.isFinite(duration) || duration <= 0 || !Number.isInteger(pitch) || pitch < 0 || pitch > 127) { dropped += 1; continue; }
      notes.push({ onset: Math.round(onset), duration: Math.round(duration), pitch, lyrics: String(note.lyrics ?? ''), tuning: note.tuning ?? emptyTuning() });
    }
    if (dropped) output.warnings.push(`Track ${name}: skipped a note with invalid timing or pitch.`);
    if (!notes.length) return;
    notes.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
    let id = String(track.id ?? `${format}-track-${index + 1}`);
    while (ids.has(id)) id += '+';
    ids.add(id);
    output.tracks.push({ id, name, notes, ...(track.instrument ? { instrument: { ...track.instrument } } : {}) });
  });
  output.tempos = tempos.filter(item => Number.isFinite(Number(item?.position)) && Number(item?.bpm) > 0)
    .map(item => ({ position: Math.max(0, Math.round(Number(item.position))), bpm: Number(item.bpm) })).sort((a, b) => a.position - b.position);
  if (!output.tempos.length || output.tempos[0].position > 0) output.tempos.unshift({ position: 0, bpm: output.tempos[0]?.bpm ?? 120 });
  output.meters = meters.filter(item => Number.isInteger(Number(item?.index)) && Number(item?.numerator) > 0 && Number(item?.denominator) > 0)
    .map(item => ({ index: Number(item.index), numerator: Number(item.numerator), denominator: Number(item.denominator) })).sort((a, b) => a.index - b.index);
  if (!output.meters.length || output.meters[0].index !== 0) output.meters.unshift({ index: 0, numerator: 4, denominator: 4 });
  return output;
}
