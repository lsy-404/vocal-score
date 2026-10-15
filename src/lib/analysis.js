import { detect as detectChords } from '../vendor/tonal-analysis.js';

const SHARP_PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAX_REPEAT_BARS = 32;
const MAX_REPEAT_RESULTS = 30;
const KS_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
};
const SIGNATURES = [
  { fifths: -7, major: 'Cb', minor: 'Ab' },
  { fifths: -6, major: 'Gb', minor: 'Eb' },
  { fifths: -5, major: 'Db', minor: 'Bb' },
  { fifths: -4, major: 'Ab', minor: 'F' },
  { fifths: -3, major: 'Eb', minor: 'C' },
  { fifths: -2, major: 'Bb', minor: 'G' },
  { fifths: -1, major: 'F', minor: 'D' },
  { fifths: 0, major: 'C', minor: 'A' },
  { fifths: 1, major: 'G', minor: 'E' },
  { fifths: 2, major: 'D', minor: 'B' },
  { fifths: 3, major: 'A', minor: 'F#' },
  { fifths: 4, major: 'E', minor: 'C#' },
  { fifths: 5, major: 'B', minor: 'G#' },
  { fifths: 6, major: 'F#', minor: 'D#' },
  { fifths: 7, major: 'C#', minor: 'A#' }
];
const NOTE_NAME_PC = new Map([
  ['C', 0], ['B#', 0], ['C#', 1], ['Db', 1], ['D', 2], ['D#', 3], ['Eb', 3],
  ['E', 4], ['Fb', 4], ['E#', 5], ['F', 5], ['F#', 6], ['Gb', 6], ['G', 7],
  ['G#', 8], ['Ab', 8], ['A', 9], ['A#', 10], ['Bb', 10], ['B', 11], ['Cb', 11]
]);

function validTick(value) {
  return Number.isFinite(value);
}

function pitchClass(pitch) {
  return ((Math.round(pitch) % 12) + 12) % 12;
}

function keyFromSignature(fifths, mode, match) {
  const signature = SIGNATURES.find(item => item.fifths === fifths);
  return { tonic: signature[mode], mode, fifths, match };
}

function keyForPitchClass(pc, mode, match) {
  const field = mode;
  const choices = SIGNATURES.filter(signature => NOTE_NAME_PC.get(signature[field]) === pc);
  choices.sort((a, b) => Math.abs(a.fifths) - Math.abs(b.fifths) || b.fifths - a.fifths);
  return keyFromSignature(choices[0].fifths, mode, match);
}

function correlation(left, right) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index++) {
    const a = left[index] - leftMean;
    const b = right[index] - rightMean;
    numerator += a * b;
    leftSquares += a * a;
    rightSquares += b * b;
  }
  return numerator / Math.sqrt(leftSquares * rightSquares);
}

function pitchClassDurations(model) {
  const histogram = Array(12).fill(0);
  for (const track of Array.isArray(model?.tracks) ? model.tracks : []) {
    if (track?.percussion) continue;
    for (const note of Array.isArray(track?.notes) ? track.notes : []) {
      const start = Number(note?.start);
      const end = Number(note?.end);
      const pitch = Number(note?.pitch);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(pitch) || pitch < 0 || pitch > 127) continue;
      histogram[pitchClass(pitch)] += end - start;
    }
  }
  return histogram;
}

export function estimateKeys(model) {
  const histogram = pitchClassDurations(model);
  if (histogram.filter(weight => weight > 0).length < 3) return [];
  const total = histogram.reduce((sum, weight) => sum + weight, 0);
  const mean = total / histogram.length;
  const variance = histogram.reduce((sum, weight) => sum + (weight - mean) ** 2, 0);
  if (variance <= total ** 2 * 1e-12) return [];
  const estimates = [];
  for (const mode of ['major', 'minor']) {
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      const profile = Array.from({ length: 12 }, (_, pc) => KS_PROFILES[mode][(pc - tonicPc + 12) % 12]);
      const match = correlation(histogram, profile);
      const fifths = keyForPitchClass(tonicPc, mode, match).fifths;
      estimates.push({ tonic: keyFromSignature(fifths, mode, Number(match.toFixed(4))).tonic, mode, fifths, match });
    }
  }
  estimates.sort((a, b) => b.match - a.match || (a.mode === b.mode ? 0 : a.mode === 'major' ? -1 : 1) || a.fifths - b.fifths);
  return estimates.slice(0, 3).map(key => ({ ...key, match: Number(key.match.toFixed(4)) }));
}

function transposeNotes(model) {
  const notes = [];
  for (const track of Array.isArray(model?.tracks) ? model.tracks : []) {
    if (track?.percussion) continue;
    for (const note of Array.isArray(track?.notes) ? track.notes : []) {
      const start = Number(note?.start);
      const end = Number(note?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const pitch = Number(note?.pitch);
      if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
        throw new RangeError('Transpose analysis requires integer MIDI pitches from 0 through 127.');
      }
      notes.push({ pitch, duration: end - start });
    }
  }
  return notes;
}

function weightedMedian(notes) {
  const ordered = notes.slice().sort((a, b) => a.pitch - b.pitch);
  const half = ordered.reduce((sum, note) => sum + note.duration, 0) / 2;
  let weight = 0;
  for (const note of ordered) {
    weight += note.duration;
    if (weight >= half) return note.pitch;
  }
  return ordered.at(-1)?.pitch ?? null;
}

function transposeKey(key, semitones) {
  if (!key) return null;
  const shiftedPc = (NOTE_NAME_PC.get(key.tonic) + semitones + 120) % 12;
  return keyForPitchClass(shiftedPc, key.mode, key.match);
}

export function recommendTranspose(model, { low = 55, high = 79 } = {}) {
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 127 || low > high) {
    throw new RangeError('Target range must contain integer MIDI pitches from 0 through 127, with low <= high.');
  }
  const notes = transposeNotes(model);
  const keyBefore = estimateKeys(model)[0] || null;
  if (!notes.length) {
    return { semitones: 0, sourceRange: null, targetRange: { low, high }, resultRange: null, outsideNoteCount: 0, keyBefore, keyAfter: null };
  }

  const sourceRange = {
    low: notes.reduce((lowest, note) => Math.min(lowest, note.pitch), Infinity),
    high: notes.reduce((highest, note) => Math.max(highest, note.pitch), -Infinity)
  };
  const median = weightedMedian(notes);
  let best = null;
  for (let semitones = -24; semitones <= 24; semitones++) {
    if (notes.some(note => note.pitch + semitones < 0 || note.pitch + semitones > 127)) continue;
    let outsideCost = 0;
    let worstDistance = 0;
    for (const note of notes) {
      const pitch = note.pitch + semitones;
      const distance = pitch < low ? low - pitch : pitch > high ? pitch - high : 0;
      outsideCost += note.duration * distance * distance;
      worstDistance = Math.max(worstDistance, distance);
    }
    const shiftedMedian = median + semitones;
    const medianDistance = shiftedMedian < low ? low - shiftedMedian : shiftedMedian > high ? shiftedMedian - high : 0;
    const candidate = { semitones, outsideCost, medianDistance, worstDistance };
    if (!best || candidate.worstDistance < best.worstDistance ||
        (candidate.worstDistance === best.worstDistance && candidate.outsideCost < best.outsideCost - 1e-9) ||
        (candidate.worstDistance === best.worstDistance && Math.abs(candidate.outsideCost - best.outsideCost) <= 1e-9 && candidate.medianDistance < best.medianDistance - 1e-9) ||
        (candidate.worstDistance === best.worstDistance && Math.abs(candidate.outsideCost - best.outsideCost) <= 1e-9 && Math.abs(candidate.medianDistance - best.medianDistance) <= 1e-9 && Math.abs(candidate.semitones) < Math.abs(best.semitones))) {
      best = candidate;
    }
  }
  const semitones = best?.semitones ?? 0;
  const resultRange = { low: sourceRange.low + semitones, high: sourceRange.high + semitones };
  const outsideNoteCount = notes.filter(note => note.pitch + semitones < low || note.pitch + semitones > high).length;
  return {
    semitones,
    sourceRange,
    targetRange: { low, high },
    resultRange,
    outsideNoteCount,
    keyBefore,
    keyAfter: transposeKey(keyBefore, semitones)
  };
}

function normalizeMeasures(model) {
  if (!model || !Array.isArray(model.measures) || !Array.isArray(model.tracks)) return [];
  return model.measures
    .filter(measure => validTick(measure?.start) && validTick(measure?.end) && measure.end > measure.start)
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((measure, index) => ({ ...measure, index: Number.isInteger(measure.index) ? measure.index : index }));
}

function notesByMeasure(model, measures) {
  const buckets = measures.map(() => []);
  for (const [trackIndex, track] of (Array.isArray(model?.tracks) ? model.tracks : []).entries()) {
    if (track?.percussion) continue;
    for (const note of Array.isArray(track?.notes) ? track.notes : []) {
      const start = Number(note?.start);
      const end = Number(note?.end);
      const pitch = Number(note?.pitch);
      if (!validTick(start) || !validTick(end) || end <= start || !Number.isFinite(pitch)) continue;
      let low = 0;
      let high = measures.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (measures[middle].end <= start) low = middle + 1;
        else high = middle;
      }
      for (let measureIndex = low; measureIndex < measures.length; measureIndex++) {
        const measure = measures[measureIndex];
        if (measure.start >= end) break;
        const clippedStart = Math.max(start, measure.start);
        const clippedEnd = Math.min(end, measure.end);
        if (clippedEnd <= clippedStart) continue;
        buckets[measureIndex].push({
          trackIndex,
          start: clippedStart - measure.start,
          end: clippedEnd - measure.start,
          pitch: Math.round(pitch),
          voice: String(note?.voice ?? '1'),
          lyrics: String(note?.lyrics ?? '')
        });
      }
    }
  }
  for (const bucket of buckets) bucket.sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start || a.pitch - b.pitch || a.end - b.end);
  return buckets;
}

function measureSignature(measure, events) {
  const length = measure.end - measure.start;
  const meter = measure.meter || {};
  const structure = events.map(({ trackIndex, start, end, pitch, voice }) => [trackIndex, start, end, pitch, voice]);
  const lyrics = events.map(event => event.lyrics);
  return {
    structure: JSON.stringify([length, meter.numerator ?? null, meter.denominator ?? null, structure]),
    lyrics
  };
}

function chooseOccurrences(positions, length) {
  const result = [];
  let lastEnd = -1;
  for (const start of positions) {
    if (start < lastEnd) continue;
    result.push({ start, end: start + length - 1 });
    lastEnd = start + length;
  }
  return result;
}

function detectRepeats(measures, eventBuckets, maxBars) {
  const signatures = measures.map((measure, index) => measureSignature(measure, eventBuckets[index]));
  const requestedLimit = Number.isFinite(Number(maxBars)) ? Math.trunc(Number(maxBars)) : MAX_REPEAT_BARS;
  const limit = Math.min(MAX_REPEAT_BARS, Math.max(2, requestedLimit || MAX_REPEAT_BARS), measures.length);
  const selected = [];

  for (let length = limit; length >= 2; length--) {
    const groups = new Map();
    for (let start = 0; start + length <= measures.length; start++) {
      const events = eventBuckets.slice(start, start + length).reduce((sum, bucket) => sum + bucket.length, 0);
      if (events < 3) continue;
      const key = signatures.slice(start, start + length).map(item => item.structure).join('\u001e');
      const positions = groups.get(key) || [];
      positions.push(start);
      groups.set(key, positions);
    }

    for (const [key, positions] of groups) {
      const occurrences = chooseOccurrences(positions, length);
      if (occurrences.length < 2) continue;
      const lyricReference = lyricsFor(signatures, occurrences[0], length);
      const lyricsDiffer = occurrences.slice(1).some(occurrence =>
        JSON.stringify(lyricsFor(signatures, occurrence, length)) !== JSON.stringify(lyricReference));
      const publicOccurrences = occurrences.map(({ start, end }) => ({ startMeasure: start + 1, endMeasure: end + 1 }));
      const candidate = {
        id: `repeat-${occurrences[0].start + 1}-${length}`,
        label: `${length}-bar repeated section`,
        length,
        occurrences: publicOccurrences,
        lyricsDiffer,
        exact: true,
        consecutive: occurrences.some((occurrence, index) => index > 0 && occurrence.start === occurrences[index - 1].end + 1),
        _occurrences: occurrences,
        _key: key
      };
      const contained = selected.some(parent => candidate._occurrences.every(child =>
        parent._occurrences.some(occurrence => child.start >= occurrence.start && child.end <= occurrence.end)));
      if (!contained) selected.push(candidate);
    }
    selected.sort((a, b) => b.length - a.length || b.occurrences.length - a.occurrences.length || a.occurrences[0].startMeasure - b.occurrences[0].startMeasure);
    if (selected.length > MAX_REPEAT_RESULTS) selected.length = MAX_REPEAT_RESULTS;
  }

  return selected.map(({ _occurrences, _key, ...repeat }) => repeat);
}

function lyricsFor(signatures, occurrence, length) {
  return signatures.slice(occurrence.start, occurrence.start + length).map(item => item.lyrics);
}

function detectCandidates(pitchClasses, bassPc, match = 1) {
  const orderedPitchClasses = bassPc === undefined
    ? pitchClasses
    : [bassPc, ...pitchClasses.filter(pc => pc !== bassPc)];
  const names = orderedPitchClasses.map(pc => SHARP_PITCH_CLASSES[pc]);
  return detectChords(names, { assumePerfectFifth: false }).slice(0, 5).map(symbol => ({ symbol, match }));
}

function chordResult(measure, offset, pcs, evidence, bassPitch, match = 1) {
  const candidates = detectCandidates(pcs, bassPitch === undefined ? undefined : pitchClass(bassPitch), match);
  if (!candidates.length) return null;
  return {
    measureIndex: measure.index,
    offset,
    candidates,
    evidence,
    pitchClasses: pcs,
    ambiguous: candidates.length > 1
  };
}

function chordsForMeasure(measure, events, divisions) {
  const boundaries = [...new Set(events.flatMap(event => [event.start, event.end]))].sort((a, b) => a - b);
  const changes = new Map();
  for (const event of events) {
    if (!changes.has(event.start)) changes.set(event.start, { starts: [], ends: [] });
    if (!changes.has(event.end)) changes.set(event.end, { starts: [], ends: [] });
    changes.get(event.start).starts.push(event.pitch);
    changes.get(event.end).ends.push(event.pitch);
  }
  const activePitches = new Map();
  const simultaneous = [];
  for (let index = 0; index + 1 < boundaries.length; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const change = changes.get(start);
    for (const pitch of change.ends) {
      const count = activePitches.get(pitch) - 1;
      if (count) activePitches.set(pitch, count);
      else activePitches.delete(pitch);
    }
    for (const pitch of change.starts) activePitches.set(pitch, (activePitches.get(pitch) || 0) + 1);
    if (end <= start) continue;
    const pitches = [...activePitches.keys()];
    const pcs = [...new Set(pitches.map(pitchClass))].sort((a, b) => a - b);
    if (pcs.length < 3) continue;
    const bassPitch = Math.min(...pitches);
    const bassPc = pitchClass(bassPitch);
    const last = simultaneous.at(-1);
    if (last && last.offset + last._length === start && last._bassPc === bassPc && JSON.stringify(last.pitchClasses) === JSON.stringify(pcs)) {
      last._length += end - start;
    } else {
      const chord = chordResult(measure, start, pcs, 'simultaneous', bassPitch);
      if (chord) simultaneous.push({ ...chord, _length: end - start, _bassPc: bassPc });
    }
  }

  const beatTicks = Math.max(1, Math.round(divisions * 4 / Number(measure.meter?.denominator || 4)));
  const aggregate = [];
  for (let start = 0; start < measure.end - measure.start; start += beatTicks) {
    const end = Math.min(measure.end - measure.start, start + beatTicks);
    if (simultaneous.some(chord => chord.offset < end && chord.offset + chord._length > start)) continue;
    const weights = new Map();
    for (const event of events) {
      const overlap = Math.max(0, Math.min(end, event.end) - Math.max(start, event.start));
      if (overlap) weights.set(pitchClass(event.pitch), (weights.get(pitchClass(event.pitch)) || 0) + overlap);
    }
    const pcs = [...weights.keys()].sort((a, b) => a - b);
    if (pcs.length < 3) continue;
    const active = events.filter(event => event.start < end && event.end > start);
    const bassPitch = active.reduce((lowest, event) => Math.min(lowest, event.pitch), Infinity);
    const match = Math.min(1, Math.min(...pcs.map(pc => Math.min(end - start, weights.get(pc)))) * pcs.length / (end - start));
    const chord = chordResult(measure, start, pcs, 'aggregate', bassPitch, match);
    if (chord) aggregate.push(chord);
  }
  return [
    ...simultaneous.map(({ _length, _bassPc, ...chord }) => chord),
    ...aggregate
  ];
}

export function analyzeScore(model, { maxRepeatBars = MAX_REPEAT_BARS } = {}) {
  const measures = normalizeMeasures(model);
  const events = notesByMeasure(model, measures);
  const divisions = Number(model?.divisions);
  const chords = Number.isFinite(divisions) && divisions > 0
    ? measures.flatMap((measure, index) => chordsForMeasure(measure, events[index], divisions))
    : [];
  return {
    repeats: detectRepeats(measures, events, maxRepeatBars),
    chords,
    warnings: Number.isFinite(divisions) && divisions > 0 ? [] : ['Chord analysis skipped: score divisions are missing or invalid.']
  };
}
