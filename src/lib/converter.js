import { detectKeyChanges } from './modulation.js';
import { mostCommonSinger, singerName } from './importers/model.js';

export const QUARTER = 705600000;

const finite = value => Number.isFinite(Number(value));
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function cleanText(text) {
  if (typeof text !== 'string') throw new TypeError('SVP input must be a JSON string.');
  return text.replace(/^\uFEFF/, '').replace(/[\0\s]+$/u, '');
}

function refGroupId(ref) {
  return ref?.groupID ?? ref?.groupId ?? ref?.uuid;
}

function getNoteSource(group) {
  return Array.isArray(group?.notes) ? group.notes : [];
}

const pitchExpressionFields = [
  'tF0Offset', 'tF0Left', 'tF0Right', 'dF0Left', 'dF0Right',
  'tF0VbrStart', 'tF0VbrLeft', 'tF0VbrRight', 'dF0Vbr', 'pF0Vbr',
  'fF0Vbr', 'dF0VbrMod'
];

function pitchExpression(source) {
  const result = {};
  for (const key of pitchExpressionFields) {
    if (Number.isFinite(source?.[key])) result[key] = source[key];
  }
  return result;
}

// Synthesizer V stores curve points flat ([blick, value, blick, value, …]); [blick, value] pairs are accepted too.
function curvePoints(curve) {
  const raw = Array.isArray(curve?.points) ? curve.points : [];
  const pairs = raw.every(Array.isArray) ? raw.map(point => [point[0], point[1]])
    : Array.from({ length: raw.length >> 1 }, (_, index) => [raw[index * 2], raw[index * 2 + 1]]);
  return pairs.filter(([position, value]) => Number.isFinite(position) && Number.isFinite(value)).sort((a, b) => a[0] - b[0]);
}

// A curve read once per group, so that each note samples it by binary search instead of re-reading every point.
function pitchCurve(curve) {
  return { points: curvePoints(curve), mode: typeof curve?.mode === 'string' ? curve.mode : null };
}

// The median of the curve over the middle 60% of [start, end): transitions at either end of the note do not count.
function representativeCents({ points, mode }, start, end) {
  const linear = mode?.toLowerCase() === 'linear';
  if (!points.length || end <= start) return { pointCount: points.length, mode, representativeCents: 0, approximate: points.length > 0 && !linear };
  const sample = position => {
    if (position <= points[0][0]) return points[0][1];
    if (position >= points.at(-1)[0]) return points.at(-1)[1];
    let low = 1, high = points.length - 1;
    while (low < high) { const middle = (low + high) >>> 1; if (points[middle][0] < position) low = middle + 1; else high = middle; }
    const leftPoint = points[low - 1];
    const rightPoint = points[low];
    if (rightPoint[0] === leftPoint[0]) return rightPoint[1];
    const ratio = (position - leftPoint[0]) / (rightPoint[0] - leftPoint[0]);
    return leftPoint[1] + (rightPoint[1] - leftPoint[1]) * ratio;
  };
  const samplePositions = Array.from({ length: 17 }, (_, index) => start + (end - start) * (0.2 + 0.6 * index / 16));
  const values = samplePositions.map(sample).sort((a, b) => a - b);
  return {
    pointCount: points.length,
    mode,
    representativeCents: values[Math.floor(values.length / 2)],
    approximate: !linear || samplePositions.some(position => position < points[0][0] || position > points.at(-1)[0])
  };
}

export function parseSvp(text, fileName = '') {
  let source;
  try {
    source = JSON.parse(cleanText(text));
  } catch (error) {
    throw new Error(`Invalid SVP JSON${error?.message ? `: ${error.message}` : ''}`);
  }
  if (!source || typeof source !== 'object' || !Array.isArray(source.tracks)) {
    throw new TypeError('Invalid SVP project: expected a tracks array.');
  }
  const warnings = [];
  const tuningSummary = {
    nonzeroDetuneNotes: 0,
    pitchDeltaCurves: 0,
    pitchDeltaPoints: 0,
    pitchControlCurves: 0,
    explicitExpressionNotes: 0,
    systemExpressionNotes: 0,
    referenceExpressionNotes: 0,
    autoPitchCurves: 0,
    autoPitchPoints: 0
  };
  const library = new Map((Array.isArray(source.library) ? source.library : [])
    .filter(group => group && (group.uuid || group.groupID))
    .map(group => [group.uuid ?? group.groupID, group]));
  const tracks = [];

  for (const [index, track] of source.tracks.entries()) {
    if (!track || typeof track !== 'object') continue;
    const candidates = [];
    const mainRef = track.mainRef ?? { blickOffset: 0, pitchOffset: 0 };
    if (track.mainGroup && getNoteSource(track.mainGroup).length && !mainRef.isInstrumental) {
      candidates.push({ ref: mainRef, group: track.mainGroup });
    }
    const refs = Array.isArray(track.groups) ? track.groups : [];
    for (const ref of refs) {
      if (ref?.isInstrumental) continue;
      const id = refGroupId(ref);
      const group = library.get(id);
      if (!group) {
        warnings.push(`Track ${track.name || index + 1}: group ${id || '(missing id)'} was not found.`);
        continue;
      }
      candidates.push({ ref, group });
    }
    if (mainRef && !mainRef.isInstrumental) {
      const id = refGroupId(mainRef);
      const group = library.get(id);
      if (group && !candidates.some(item => item.group === group) && !candidates.some(item => item.group.uuid === group.uuid)) candidates.push({ ref: mainRef, group });
    }

    const notes = [];
    for (const { ref, group } of candidates) {
      const offset = Number(ref?.blickOffset ?? 0);
      const pitchOffset = Number(ref?.pitchOffset ?? 0);
      // A group reference without its own voice bank sings with the track's.
      const singer = singerName(ref?.database?.name) || singerName(mainRef?.database?.name);
      const rawPitchCurve = group?.parameters?.pitchDelta;
      const manualCurve = pitchCurve(rawPitchCurve);
      if (rawPitchCurve && Array.isArray(rawPitchCurve.points)) {
        tuningSummary.pitchDeltaCurves += 1;
        tuningSummary.pitchDeltaPoints += manualCurve.points.length;
      }
      // The pitch Synthesizer V generates itself, in the group's time like pitchDelta; it is reported, never applied.
      const autoCurve = pitchCurve(ref?.systemPitchDelta);
      if (autoCurve.points.length) {
        tuningSummary.autoPitchCurves += 1;
        tuningSummary.autoPitchPoints += autoCurve.points.length;
      }
      const pitchControlCurveCount = Array.isArray(group?.pitchControls) ? group.pitchControls.length : 0;
      tuningSummary.pitchControlCurves += pitchControlCurveCount;
      const referenceExpression = pitchExpression(ref?.voice);
      const referenceTranspose = {
        cents: finite(ref?.voice?.transposeCents) ? Number(ref.voice.transposeCents) : null,
        semitones: finite(ref?.voice?.transposeSemitones) ? Number(ref.voice.transposeSemitones) : null
      };
      for (const note of getNoteSource(group)) {
        if (!finite(note?.onset) || !finite(note?.duration) || !finite(note?.pitch) || Number(note.duration) <= 0) {
          warnings.push(`Track ${track.name || index + 1}: skipped a note with invalid timing or pitch.`);
          continue;
        }
        const onset = Number(note.onset) + (finite(offset) ? offset : 0);
        const duration = Number(note.duration);
        if (onset + duration <= Number(ref?.blickAbsoluteBegin ?? -Infinity) ||
            (Number(ref?.blickAbsoluteEnd) >= 0 && onset >= Number(ref.blickAbsoluteEnd))) continue;
        const trimStart = Math.max(onset, Number(ref?.blickAbsoluteBegin ?? onset));
        const trimEnd = Number(ref?.blickAbsoluteEnd) >= 0 ? Math.min(onset + duration, Number(ref.blickAbsoluteEnd)) : onset + duration;
        if (trimEnd <= trimStart) continue;
        const curve = representativeCents(manualCurve, trimStart - offset, trimEnd - offset);
        const auto = representativeCents(autoCurve, trimStart - offset, trimEnd - offset);
        const rawDetune = note.detune;
        const detuneCents = rawDetune === undefined ? 0 : typeof rawDetune === 'number' && Number.isFinite(rawDetune) ? rawDetune : null;
        if (detuneCents === null) warnings.push(`Track ${track.name || index + 1}: ignored a non-finite note detune.`);
        if (detuneCents) tuningSummary.nonzeroDetuneNotes += 1;
        const expression = pitchExpression(note.attributes);
        const systemExpression = pitchExpression(note.systemAttributes);
        if (Object.keys(expression).length) tuningSummary.explicitExpressionNotes += 1;
        if (Object.keys(systemExpression).length) tuningSummary.systemExpressionNotes += 1;
        if (Object.keys(referenceExpression).length) tuningSummary.referenceExpressionNotes += 1;
        notes.push({
          onset: trimStart,
          duration: trimEnd - trimStart,
          pitch: Number(note.pitch) + (finite(pitchOffset) ? pitchOffset : 0),
          lyrics: String(note.lyrics ?? ''),
          ...(singer ? { singer } : {}),
          tuning: {
            detuneCents,
            curvePointCount: curve.pointCount,
            curveMode: curve.mode,
            curveRepresentativeCents: curve.representativeCents,
            curveApproximate: curve.approximate,
            autoCurvePointCount: auto.pointCount,
            autoCurveRepresentativeCents: auto.representativeCents,
            pitchControlCurveCount,
            expression,
            systemExpression,
            referenceExpression,
            referenceTranspose
          }
        });
      }
      if (Array.isArray(group.pitchControls) && group.pitchControls.length) {
        warnings.push(`Track ${track.name || index + 1}: pitch curves are not represented in MusicXML.`);
      }
    }
    if (notes.length) {
      notes.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
      const singer = mostCommonSinger(notes);
      tracks.push({ id: String(track.mainGroup?.uuid ?? mainRef?.groupID ?? `track-${index + 1}`), name: String(track.name || `Track ${index + 1}`), notes, ...(singer ? { singer } : {}) });
    }
  }

  const tempos = (Array.isArray(source.time?.tempo) ? source.time.tempo : [])
    .filter(item => finite(item?.position) && finite(item?.bpm) && Number(item.bpm) > 0)
    .map(item => ({ position: Number(item.position), bpm: Number(item.bpm) }))
    .sort((a, b) => a.position - b.position);
  const meters = (Array.isArray(source.time?.meter) ? source.time.meter : [])
    .filter(item => finite(item?.index) && finite(item?.numerator) && finite(item?.denominator) && Number(item.numerator) > 0 && Number(item.denominator) > 0)
    .map(item => ({ index: Number(item.index), numerator: Number(item.numerator), denominator: Number(item.denominator) }))
    .sort((a, b) => a.index - b.index);
  if (!tempos.length) tempos.push({ position: 0, bpm: 120 });
  if (!meters.length) meters.push({ index: 0, numerator: 4, denominator: 4 });
  const title = String(source.projectName ?? source.name ?? fileName.replace(/\.[^.]+$/, '') ?? 'Untitled score');
  return { title: title || 'Untitled score', version: source.version ?? null, tracks, tempos, meters, warnings, tuningSummary };
}

function meterAtBar(meters, bar) {
  let value = meters[0];
  for (const meter of meters) {
    if (meter.index > bar) break;
    value = meter;
  }
  return value;
}

function quantize(value, step) { return Math.max(0, Math.round(value / step) * step); }

// The triplet subdivision of a quarter beat at each rhythm grid: eighth triplets, or sixteenth triplets from a sixteenth grid up.
const TRIPLET_UNIT = { 8: QUARTER / 3, 16: QUARTER / 6, 32: QUARTER / 6 };

// Starts (in blicks) of the quarter beats of every bar up to `until`; triplets are only written in meters counted in quarters.
function quarterBeats(meters, until) {
  const beats = [];
  for (let bar = 0, start = 0; start < until && bar <= 10000; bar += 1) {
    const meter = meterAtBar(meters, bar);
    if (meter.denominator === 4) for (let beat = 0; beat < meter.numerator; beat += 1) beats.push(start + beat * QUARTER);
    start += QUARTER * 4 * meter.numerator / meter.denominator;
  }
  return beats;
}

function beatAt(beats, position) {
  let low = 0, high = beats.length;
  while (low < high) { const middle = (low + high) >>> 1; if (beats[middle] <= position) low = middle + 1; else high = middle; }
  return low > 0 && position < beats[low - 1] + QUARTER ? low - 1 : -1;
}

// How the note boundaries of each quarter beat fit the triplet grid against the straight grid. Onsets count fully and
// ends half; `offsets` are the triplet positions used and `half` marks a straight boundary in the middle of the beat.
function beatFits(notes, beats, step, unit) {
  const fit = new Map();
  const visit = (position, weight) => {
    const index = beatAt(beats, position);
    if (index < 0) return;
    const offset = position - beats[index], snapped = Math.round(offset / unit) * unit;
    const entry = fit.get(index) ?? { straight: 0, triplet: 0, fits: true, off: false, half: false, offsets: new Set() };
    entry.straight += weight * Math.abs(position - quantize(position, step));
    entry.triplet += weight * Math.abs(offset - snapped);
    if (weight === 1 && Math.abs(offset - snapped) >= QUARTER / 16) entry.fits = false;
    if ((beats[index] + snapped) % step) entry.off = true;
    if (quantize(position, step) - beats[index] === QUARTER / 2) entry.half = true;
    entry.offsets.add(snapped);
    fit.set(index, entry);
  };
  for (const note of notes) { visit(Number(note.onset), 1); visit(Number(note.onset) + Number(note.duration), 0.5); }
  return fit;
}

// Beats whose note boundaries sit clearly on the triplet grid and fit it far better than the straight grid; a beat needs
// a boundary off the straight grid, so straight rhythms never turn into triplets.
function tripletBeats(fit) {
  return new Set([...fit].filter(([, entry]) => entry.fits && entry.off && entry.triplet < entry.straight / 2).map(([index]) => index));
}

// Triplet beats that use only the beat start and its last third, a long-short (♩♪³) pair: under a Swing marking they are
// written as two straight eighths. `straight` counts the other beats with a straight eighth, which would then read as swung.
const SWING_OFFSET = QUARTER * 2 / 3;
function beatRhythm(fit, { triplets, swing }) {
  const found = tripletBeats(fit);
  const swung = swing ? new Set([...found].filter(index => [...fit.get(index).offsets].every(offset => offset === 0 || offset === SWING_OFFSET || offset === QUARTER))) : NO_TRIPLETS;
  return {
    triplets: triplets ? new Set([...found].filter(index => !swung.has(index))) : NO_TRIPLETS,
    swung,
    straight: swung.size ? [...fit].filter(([index, entry]) => entry.half && !found.has(index)).length : 0
  };
}

function noteValues(divisions) {
  return [
    ['whole', divisions * 4], ['half', divisions * 2], ['quarter', divisions], ['eighth', divisions / 2],
    ['16th', divisions / 4], ['32nd', divisions / 8], ['64th', divisions / 16]
  ].filter(([, duration]) => Number.isInteger(duration) && duration > 0).flatMap(([type, duration]) => [
    { type, dots: 0, duration },
    { type, dots: 1, duration: duration * 1.5 },
    { type, dots: 2, duration: duration * 1.75 }
  ]).filter(item => Number.isInteger(item.duration)).sort((a, b) => b.duration - a.duration);
}

// Beat starts within a measure, ending with the measure length. Compound meters group by three; odd x/8 meters end with a group of three.
function beatStarts(meter, divisions, length) {
  const unit = divisions * 4 / meter.denominator;
  const count = meter.numerator;
  if (!Number.isInteger(unit)) return [0, length];
  const groups = meter.denominator >= 8 && count % 3 === 0 ? Array(count / 3).fill(3)
    : meter.denominator >= 8 && count > 3 ? [...Array((count - (count % 2 ? 3 : 0)) / 2).fill(2), ...(count % 2 ? [3] : [])]
    : meter.denominator >= 8 ? [count] : Array(count).fill(1);
  const starts = [0];
  for (const group of groups) starts.push(starts.at(-1) + group * unit);
  return starts;
}

function beatIndex(starts, tick) {
  let beat = 0;
  while (beat < starts.length - 2 && starts[beat + 1] <= tick) beat += 1;
  return beat;
}

// Values written under a 3:2 bracket within one triplet beat, by the time they take: quarter, dotted eighth, eighth, 16th.
function tripletValues(divisions, unitTicks) {
  return noteValues(divisions).filter(item => item.dots < 2 && item.duration * 2 % 3 === 0)
    .map(item => ({ ...item, duration: item.duration * 2 / 3, tuplet: true }))
    .filter(item => item.duration < divisions && item.duration % unitTicks === 0);
}

const NO_TRIPLETS = new Set();

// Splits [start, end) into written values that show the beat: within a beat any single value fits; from a beat a value may
// span whole beats or be dotted past the next beat. Rests additionally keep the middle of an even bar visible. A triplet
// beat that is not covered whole is written in triplet values, and no straight value may end inside one.
function spellSpan(start, end, starts, values, rest, triplets = NO_TRIPLETS, triplet = []) {
  const count = starts.length - 1;
  const middle = count >= 4 && count % 2 === 0 ? starts[count / 2] : null;
  const insideTriplet = tick => { const beat = beatIndex(starts, tick); return triplets.has(beat) && tick > starts[beat] && tick < starts[beat + 1]; };
  const pieces = [];
  for (let cursor = start; cursor < end;) {
    const beat = beatIndex(starts, cursor);
    const beatEnd = starts[beat + 1];
    let value;
    if (triplets.has(beat) && (cursor !== starts[beat] || end < beatEnd)) {
      const limit = Math.min(end, beatEnd);
      value = triplet.find(item => item.duration === limit - cursor) || triplet.find(item => cursor + item.duration <= limit);
    } else if (cursor === starts[beat]) {
      value = values.find(item => {
        const stop = cursor + item.duration;
        if (stop > end || insideTriplet(stop)) return false;
        if (stop <= beatEnd) return true;
        const onBeat = starts.includes(stop);
        if (rest) return onBeat && (middle === null || stop <= middle || cursor >= middle || (cursor === 0 && stop === starts[count]));
        return onBeat || (item.dots === 1 && starts.includes(cursor + item.duration / 1.5));
      });
    } else {
      // An off-beat note lasting one beat (eighth–quarter–eighth) stays whole unless it would hide the middle of the bar.
      const beatLength = beatEnd - starts[beat];
      const syncopated = !rest && cursor - starts[beat] === beatLength / 2 && cursor + beatLength <= end && beatEnd !== middle && beat + 1 < count && !triplets.has(beat + 1);
      const limit = Math.min(end, beatEnd);
      value = (syncopated && values.find(item => item.duration === beatLength && !item.dots))
        || values.find(item => item.duration === limit - cursor) || values.find(item => cursor + item.duration <= limit);
    }
    if (!value) return null;
    pieces.push({ start: cursor, duration: value.duration, type: value.type, dots: value.dots, tuplet: Boolean(value.tuplet) });
    cursor += value.duration;
  }
  return pieces;
}

const BEAM_LEVELS = { eighth: 1, '16th': 2, '32nd': 3, '64th': 4 };

// Beams notes shorter than a quarter within each beat; four plain eighths share one beam across a half bar of an even x/4 meter.
// Each triplet beat gets one bracket from its first value to its last.
function beamPieces(pieces, starts, meter) {
  const count = starts.length - 1;
  const beamable = piece => !piece.span.rest && BEAM_LEVELS[piece.type];
  const group = pieces.map(piece => beatIndex(starts, piece.start));
  pieces.forEach((piece, index) => {
    if (!piece.tuplet) return;
    piece.tupletStart = !pieces[index - 1]?.tuplet || group[index - 1] !== group[index];
    piece.tupletStop = !pieces[index + 1]?.tuplet || group[index + 1] !== group[index];
  });
  if (meter.denominator === 4 && count % 2 === 0) {
    for (let beat = 0; beat < count; beat += 2) {
      const members = pieces.filter((piece, index) => group[index] === beat || group[index] === beat + 1);
      if (members.length === 4 && members.every(piece => beamable(piece) && piece.type === 'eighth' && !piece.dots && !piece.tuplet)) {
        pieces.forEach((piece, index) => { if (group[index] === beat + 1) group[index] = beat; });
      }
    }
  }
  for (let index = 0; index < pieces.length;) {
    let stop = index;
    while (beamable(pieces[index]) && stop + 1 < pieces.length && beamable(pieces[stop + 1]) && group[stop + 1] === group[index]) stop += 1;
    if (stop > index) {
      const run = pieces.slice(index, stop + 1), levels = run.map(piece => BEAM_LEVELS[piece.type]);
      run.forEach((piece, position) => {
        piece.beams = [];
        for (let level = 1; level <= levels[position]; level += 1) {
          const previous = position > 0 && levels[position - 1] >= level;
          const next = position < run.length - 1 && levels[position + 1] >= level;
          const value = previous && next ? 'continue' : next ? 'begin' : previous ? 'end'
            : position === 0 ? 'forward hook' : position === run.length - 1 ? 'backward hook'
            : piece.start % (piece.duration * 2) === 0 ? 'forward hook' : 'backward hook';
          piece.beams.push(`<beam number="${level}">${value}</beam>`);
        }
      });
    }
    index = stop + 1;
  }
}

function pitchXml(midi, fifths) {
  const namesSharp = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
  const namesFlat = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'];
  const sharpAlter = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const flatAlter = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];
  const pitch = Math.round(midi);
  const pc = ((pitch % 12) + 12) % 12;
  const flat = fifths < 0;
  const step = (flat ? namesFlat : namesSharp)[pc];
  const alter = (flat ? flatAlter : sharpAlter)[pc];
  const octave = Math.floor(pitch / 12) - 1;
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;
}

function musicXmlNoteId(note, segmentIndex = 0, measureIndex = 0, partIndex = 0, laneIndex = 0, fallbackNoteIndex = 0) {
  const sourceTrackIndex = Number.isInteger(note.sourceTrackIndex) ? note.sourceTrackIndex : partIndex;
  const sourceNoteIndex = Number.isInteger(note.sourceNoteIndex) ? note.sourceNoteIndex : fallbackNoteIndex;
  return `svp-n${sourceTrackIndex}-${sourceNoteIndex}-p${partIndex}-v${laneIndex + 1}-o${fallbackNoteIndex}-m${measureIndex}-s${segmentIndex}`;
}

const CLEFS = {
  treble: '<clef><sign>G</sign><line>2</line></clef>',
  bass: '<clef><sign>F</sign><line>4</line></clef>',
  alto: '<clef><sign>C</sign><line>3</line></clef>',
  percussion: '<clef><sign>percussion</sign></clef>'
};

// Staff positions for General MIDI drum keys: [display step, octave, notehead].
const DRUM_POSITIONS = new Map([
  [35, ['F', 4]], [36, ['F', 4]], [37, ['C', 5, 'x']], [38, ['C', 5]], [39, ['C', 5, 'x']], [40, ['C', 5]], [41, ['A', 4]], [42, ['G', 5, 'x']],
  [43, ['A', 4]], [44, ['D', 4, 'x']], [45, ['D', 5]], [46, ['G', 5, 'x']], [47, ['D', 5]], [48, ['E', 5]], [49, ['A', 5, 'x']], [50, ['E', 5]],
  [51, ['F', 5, 'x']], [52, ['A', 5, 'x']], [53, ['F', 5]], [55, ['A', 5, 'x']], [57, ['A', 5, 'x']], [59, ['F', 5, 'x']]
]);

function unpitchedXml(pitch) {
  const [step, octave, head] = DRUM_POSITIONS.get(pitch) ?? ['C', 5];
  return [`<unpitched><display-step>${step}</display-step><display-octave>${octave}</display-octave></unpitched>`, head ? `<notehead>${head}</notehead>` : ''];
}

// Triplet marks: a bracket with its number, the number alone, or (simile) the number only until a rhythm repeats.
function pieceXml(piece, fifths, measureIndex, partIndex, laneIndex, percussion = false, { extenders = true, tupletMarks = 'bracket' } = {}) {
  const { span } = piece;
  const modification = piece.tuplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : '';
  const tupletAttributes = tupletMarks === 'bracket' ? ' bracket="yes"' : ` bracket="no"${piece.tupletHidden ? ' show-number="none"' : ''}`;
  const bracket = `${piece.tupletStart ? `<tuplet type="start"${tupletAttributes}/>` : ''}${piece.tupletStop ? '<tuplet type="stop"/>' : ''}`;
  if (span.rest) return `<note><rest/><duration>${piece.duration}</duration><voice>${laneIndex + 1}</voice><type>${piece.type}</type>${'<dot/>'.repeat(piece.dots)}${modification}${bracket ? `<notations>${bracket}</notations>` : ''}</note>`;
  const tieIn = piece.index > 0 || span.before;
  const tieOut = !piece.last || span.after;
  const ties = `${tieIn ? '<tie type="stop"/>' : ''}${tieOut ? '<tie type="start"/>' : ''}`;
  const tied = `${tieIn ? '<tied type="stop"/>' : ''}${tieOut ? '<tied type="start"/>' : ''}`;
  // A melisma slur opens on the first written piece of its first note and closes on the last piece of its last note.
  const slur = `${span.note.slur === 'start' && piece.index === 0 && !span.before ? '<slur number="1" type="start"/>' : ''}${span.note.slur === 'stop' && piece.last && !span.after ? '<slur number="1" type="stop"/>' : ''}`;
  // A glide's slide runs from the end of the syllable's note to the start of the next note.
  const opening = piece.index === 0 && !span.before;
  const slide = `${span.note.slideIn && opening ? '<slide number="1" type="stop"/>' : ''}${span.note.slideOut && piece.last && !span.after ? '<slide number="1" type="start" line-type="solid"/>' : ''}`;
  const graces = opening && !percussion ? (span.note.graces ?? []).map(grace => `<note><grace slash="yes"/>${pitchXml(grace.pitch, fifths)}<voice>${laneIndex + 1}</voice><type>eighth</type></note>`).join('') : '';
  const write = (note, fallbackNoteIndex, chord) => {
    const [pitch, notehead] = percussion ? unpitchedXml(note.pitch) : [pitchXml(note.pitch, fifths), ''];
    const lyric = chord || piece.index > 0 ? '' : span.lyricMode === 'continue' ? (extenders ? '<lyric><extend type="continue"/></lyric>' : '') : lyricXml(note.lyrics, span.lyricMode, extenders);
    const notations = chord ? tied : tied + slur + slide + bracket;
    return `<note id="${musicXmlNoteId(note, piece.index, measureIndex, partIndex, laneIndex, fallbackNoteIndex)}">${chord ? '<chord/>' : ''}${pitch}<duration>${piece.duration}</duration>${ties}<voice>${laneIndex + 1}</voice><type>${piece.type}</type>${'<dot/>'.repeat(piece.dots)}${modification}${notehead}${chord ? '' : (piece.beams ?? []).join('')}${notations ? `<notations>${notations}</notations>` : ''}${lyric}</note>`;
  };
  return graces + [write(span.note, span.fallbackNoteIndex, false), ...span.chord.map(member => write(member.note, member.fallbackNoteIndex, true))].join('');
}

// Tempo points become readable marks: whole BPM, one point per grid position, and runs of small steps written as rit./accel.
function tempoMarks(tempos, step) {
  const points = [];
  for (const tempo of tempos) {
    const point = { position: quantize(tempo.position, step), bpm: Math.round(tempo.bpm * 100) / 100 };
    if (points.at(-1)?.position === point.position) points[points.length - 1] = point;
    else points.push(point);
  }
  const small = (from, to) => Math.abs(to.bpm - from.bpm) <= Math.max(2, from.bpm * 0.06) && to.position - from.position <= QUARTER * 4;
  const marks = [];
  let shown = null;
  for (let index = 0; index < points.length;) {
    const direction = Math.sign((points[index + 1]?.bpm ?? points[index].bpm) - points[index].bpm);
    let last = index;
    while (direction && last + 1 < points.length && Math.sign(points[last + 1].bpm - points[last].bpm) === direction && small(points[last], points[last + 1])) last += 1;
    if (last - index >= 2) {
      const first = points[index], final = points[last];
      if (Math.round(final.bpm) !== Math.round(first.bpm)) {
        marks.push({ position: first.position, bpm: Math.round(first.bpm) === shown ? null : first.bpm, words: direction < 0 ? 'rit.' : 'accel.' });
        marks.push({ position: final.position, bpm: final.bpm });
        shown = Math.round(final.bpm);
      }
      index = last + 1;
      continue;
    }
    if (Math.round(points[index].bpm) !== shown) { marks.push(points[index]); shown = Math.round(points[index].bpm); }
    index += 1;
  }
  return marks;
}

function lyricXml(lyrics, mode, extenders = true) {
  const silence = new Set(['', '+', '-', 'br', 'SP', 'sil']);
  if (mode === 'stop') return extenders ? '<lyric><extend type="stop"/></lyric>' : '';
  if (silence.has(lyrics)) return '';
  const boundary = /[-‐‑‒–—]/u;
  const starts = boundary.test(lyrics[0] || '');
  const ends = boundary.test(lyrics.at(-1) || '');
  const syllabic = starts && ends ? 'middle' : starts ? 'end' : ends ? 'begin' : boundary.test(lyrics) ? 'single' : null;
  const text = lyrics.replace(/^[-‐‑‒–—]+|[-‐‑‒–—]+$/gu, '');
  return `<lyric>${syllabic ? `<syllabic>${syllabic}</syllabic>` : ''}<text>${xml(text)}</text>${mode === 'start' && extenders ? '<extend type="start"/>' : ''}</lyric>`;
}

// Notes that do not overlap in the source must not overlap once snapped to the grid, or a very short note lands on its
// neighbour and shows up as a second voice. An overlapping note is trimmed; two notes on the same grid position become
// one, keeping the earlier note's syllable and the longer note's pitch.
function separateSnapped(notes) {
  const kept = [];
  let count = 0;
  const syllable = note => { const lyrics = String(note.lyrics ?? '').trim(); return lyrics && lyrics !== '-' && lyrics !== '+' && !lyrics.startsWith('.'); };
  for (const note of notes) {
    const previous = kept.at(-1);
    if (!previous || note.start >= previous.end || previous.sourceEnd > Number(note.onset)) { kept.push({ ...note }); continue; }
    count += 1;
    if (note.start > previous.start) {
      previous.end = note.start;
      previous.duration = previous.end - previous.start;
      kept.push({ ...note });
      continue;
    }
    const longer = note.sourceEnd - Number(note.onset) > previous.sourceEnd - Number(previous.onset) ? note : previous;
    const lyrics = syllable(previous) || !syllable(note) ? previous.lyrics : note.lyrics;
    kept[kept.length - 1] = { ...longer, start: previous.start, end: Math.max(previous.end, note.end), duration: Math.max(previous.end, note.end) - previous.start, lyrics };
  }
  return { notes: kept, count };
}

// How readily a note that only continues the previous syllable is folded into it. A continuation is a "-"/"+" lyric
// or, from medium up, the previous syllable's vowel sung again ("zou" then "ou"). Low joins "-" notes of the same
// pitch; medium also folds repeated vowels (joined at the same pitch, drawn as a melisma otherwise) and bridges one
// grid step; high also absorbs continuations of a sixteenth or less at any interval.
const NOTE_MERGE = {
  low: { gap: 0, vowels: false, ornament: 0 },
  medium: { gap: 1, vowels: true, ornament: 0 },
  high: { gap: 1, vowels: true, ornament: QUARTER / 4 }
};

const isExtension = lyrics => lyrics === '-' || lyrics === '+';
const repeatsVowel = (syllable, lyrics) => /^[aeiouv]+(?:n|ng|r)?$/iu.test(lyrics) && syllable.toLowerCase() !== lyrics.toLowerCase() && syllable.toLowerCase().endsWith(lyrics.toLowerCase());

function mergeConsecutive(notes, level, step) {
  const rule = NOTE_MERGE[level];
  if (!rule) return { notes, count: 0 };
  const kept = [];
  let count = 0, syllable = '';
  for (const note of notes) {
    const previous = kept.at(-1);
    const gap = previous ? note.start - previous.end : -1;
    const lyrics = String(note.lyrics ?? '').trim();
    const continuation = isExtension(lyrics) || (rule.vowels && repeatsVowel(syllable, lyrics));
    if (!previous || !continuation || gap < 0 || gap > rule.gap * step) {
      kept.push({ ...note });
      if (lyrics && !isExtension(lyrics)) syllable = lyrics;
      continue;
    }
    if (note.pitch === previous.pitch || note.duration <= rule.ornament) {
      previous.end = note.end;
      previous.duration = previous.end - previous.start;
    } else if (isExtension(lyrics)) {
      kept.push({ ...note });
      continue;
    } else {
      kept.push({ ...note, lyrics: '-' });
    }
    count += 1;
  }
  return { notes: kept, count };
}

// Automatic merging reads each continuation on its own. A held syllable at the same pitch joins its note; a note of a
// sixteenth or less that ends the syllable is a glide when it moves on toward (or lands on) the next pitch and an
// ornament when it turns back; longer notes at another pitch stay as a melisma. `glides` writes glides and ornaments:
// 'line' joins them to the syllable's note and draws a slide from it to the next note (ornaments are only joined),
// 'grace' joins them and writes their pitches as grace notes before the next note, 'absorb' only joins them, and
// 'keep' leaves them as notes.
const GLIDE_STYLES = ['line', 'grace', 'absorb', 'keep'];
const SHORT_NOTE = QUARTER / 4;

function mergeAuto(notes, step, glides) {
  const kept = [];
  let count = 0, glideCount = 0, ornamentCount = 0, syllable = '', slideIn = false, graces = [];
  const continues = lyrics => isExtension(lyrics) || repeatsVowel(syllable, lyrics);
  const push = note => {
    kept.push({ ...note, ...(slideIn ? { slideIn: true } : {}), ...(graces.length ? { graces } : {}) });
    slideIn = false;
    graces = [];
  };
  notes.forEach((note, index) => {
    const previous = kept.at(-1), next = notes[index + 1];
    const lyrics = String(note.lyrics ?? '').trim();
    const gap = previous ? note.start - previous.end : -1;
    if (!previous || !continues(lyrics) || gap < 0 || gap > step) {
      push(note);
      if (lyrics && !isExtension(lyrics)) syllable = lyrics;
      return;
    }
    if (note.pitch === previous.pitch) {
      previous.end = note.end;
      previous.duration = previous.end - previous.start;
      count += 1;
      return;
    }
    const adjacent = next && next.start - note.end <= step;
    const endsSyllable = !adjacent || !continues(String(next.lyrics ?? '').trim());
    if (note.duration > SHORT_NOTE || !endsSyllable || glides === 'keep') {
      // A re-sung vowel becomes part of the syllable's melisma, as at the medium level.
      if (!isExtension(lyrics)) count += 1;
      push({ ...note, lyrics: isExtension(lyrics) ? lyrics : '-' });
      return;
    }
    const glide = adjacent && (next.pitch === note.pitch || Math.sign(next.pitch - note.pitch) === Math.sign(note.pitch - previous.pitch));
    if (glide) glideCount += 1; else ornamentCount += 1;
    previous.end = note.end;
    previous.duration = previous.end - previous.start;
    count += 1;
    if (glides === 'line' && glide) { previous.slideOut = true; slideIn = true; }
    if (glides === 'grace' && adjacent) graces = [...graces, { pitch: note.pitch }];
  });
  return { notes: kept, count, glideCount, ornamentCount };
}

function partitionVoices(notes, step) {
  const lanes = [];
  for (const note of notes) {
    // A note sharing both start and end with a voice's last note joins it as a chord.
    let lane = lanes.find(items => items.at(-1).end <= note.start || (items.at(-1).start === note.start && items.at(-1).end === note.start + note.duration));
    if (!lane) { lane = []; lanes.push(lane); }
    lane.push({ ...note, end: note.start + note.duration });
  }
  return lanes;
}

function makeIntervalIndex(notes) {
  const intervals = notes.map(note => ({ start: note.start, end: note.end })).sort((a, b) => a.start - b.start);
  const prefixMaxEnd = [];
  intervals.forEach((interval, index) => {
    prefixMaxEnd[index] = Math.max(interval.end, index ? prefixMaxEnd[index - 1] : -Infinity);
  });
  return { intervals, prefixMaxEnd };
}

function overlapsInterval(index, note) {
  let low = 0;
  let high = index.intervals.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (index.intervals[middle].start < note.start) low = middle + 1;
    else high = middle;
  }
  return (low > 0 && index.prefixMaxEnd[low - 1] > note.start) ||
    (low < index.intervals.length && index.intervals[low].start < note.end);
}

// Notation styles: how a melisma is shown (extender line, slur or both) and how triplets are marked.
const MELISMA_STYLES = ['extender', 'slur', 'both'];
const TUPLET_MARKS = ['bracket', 'number', 'simile'];

// Notes sung to one syllable, the syllable's note and the continuations after it, get one slur over them. Notes with the
// same start and end are one chord, written by its first note, so the slur goes on that note.
function markMelismas(lane) {
  const chords = [];
  for (const note of lane) {
    const chord = chords.at(-1);
    if (chord && chord[0].start === note.start && chord[0].end === note.end) chord.push(note);
    else chords.push([note]);
  }
  const has = (chord, ...modes) => chord.some(note => modes.includes(note.lyricMode));
  for (let index = 0; index < chords.length; index += 1) {
    if (!has(chords[index], 'start')) continue;
    let last = index;
    while (last + 1 < chords.length && has(chords[last + 1], 'continue', 'stop')) {
      last += 1;
      if (!has(chords[last], 'continue')) break;
    }
    if (last > index) { chords[index][0].slur = 'start'; chords[last][0].slur = 'stop'; }
    index = last;
  }
}

// Simile triplets: once the same triplet rhythm follows itself beat after beat, its number is shown twice and then left
// out. `run` carries the rhythm, its count and where it ended from the previous measure; returns the run to carry on.
function hideRepeatedTuplets(pieces, measureStart, run) {
  for (let index = 0; index < pieces.length; index += 1) {
    if (!pieces[index].tupletStart) continue;
    let last = index;
    while (!pieces[last].tupletStop && last + 1 < pieces.length) last += 1;
    const group = pieces.slice(index, last + 1);
    const signature = group.map(piece => `${piece.span.rest ? 'r' : 'n'}${piece.duration}`).join(',');
    const start = measureStart + group[0].start, end = measureStart + group.at(-1).start + group.at(-1).duration;
    run = run && run.signature === signature && run.end === start ? { signature, count: run.count + 1, end } : { signature, count: 1, end };
    if (run.count > 2) for (const piece of group) piece.tupletHidden = true;
    index = last;
  }
  return run;
}

// Only sung tracks are merged; instrumental tracks keep their own staves.
const isVocal = track => !track.instrument;

// A phrase is a run of notes with less than a beat of rest between them; it moves to another part whole or not at all.
// A phrase that opens with an extension continues a syllable left behind in its source, so it stays there.
function splitPhrases(notes) {
  const phrases = [];
  for (const note of notes) {
    const phrase = phrases.at(-1);
    if (phrase && note.start - phrase.end < QUARTER) {
      phrase.notes.push(note);
      phrase.end = Math.max(phrase.end, note.end);
    } else phrases.push({ notes: [note], start: note.start, end: note.end, movable: !isExtension(String(note.lyrics ?? '').trim()) });
  }
  return phrases;
}

const medianPitch = notes => { const pitches = notes.map(note => note.pitch).sort((a, b) => a - b); return pitches[pitches.length >> 1]; };
const singersOf = notes => new Set(notes.map(note => note.singer).filter(Boolean));

// true when every voice bank of the source already sings in the target, false when one does not, null when either is unknown.
function sameSingers(source, target) {
  const from = singersOf(source), to = singersOf(target);
  return from.size && to.size ? [...from].every(singer => to.has(singer)) : null;
}

/**
 * Decides which earlier part a later vocal track continues, if any. Each candidate describes one earlier vocal part:
 *   overlapRatio  share of the source's sounding time during which the candidate also sounds (0 = never together)
 *   blockedShare  share of the source's notes in phrases that overlap the candidate and so stay behind
 *   pitchDistance semitones between the two parts' median pitches
 *   sameSinger    true / false / null (unknown voice bank); candidates with another voice bank are already
 *                 removed unless merging across voice banks is allowed
 *   order         position of the candidate in the score, 0 for the top part
 * A candidate qualifies when the two parts sound together for at most `tolerance` of the source's time. A phrase that
 * overlaps only partly stays behind whole, so up to twice that share of notes may stay; more would split the line over
 * two staves. Of the qualifying parts the one sounding least together wins, then a known same voice bank, then the
 * nearer register, then the higher part. Returns null to leave the source as its own part.
 */
function chooseMergeTarget(candidates, tolerance) {
  const singerRank = candidate => (candidate.sameSinger === true ? 0 : candidate.sameSinger === null ? 1 : 2);
  return candidates
    .filter(candidate => candidate.overlapRatio <= tolerance && candidate.blockedShare <= tolerance * 2)
    .sort((a, b) => a.overlapRatio - b.overlapRatio || singerRank(a) - singerRank(b) || a.pitchDistance - b.pitchDistance || a.order - b.order)[0] ?? null;
}

function mergeDisjointNotes(tracks, { acrossSingers = false, tolerance = 0 } = {}) {
  const outputs = tracks.map((track, sourceIndex) => ({
    ...track,
    sourceIndex,
    notes: track.lanes.flat().sort((a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder),
    changed: false
  }));
  const moves = [];
  let movedNoteCount = 0;
  for (let sourceIndex = 1; sourceIndex < outputs.length; sourceIndex += 1) {
    const source = outputs[sourceIndex];
    if (!isVocal(source) || !source.notes.length) continue;
    const phrases = splitPhrases(source.notes);
    const candidates = outputs.slice(0, sourceIndex).filter(target => isVocal(target) && target.notes.length).map((target, order) => {
      const index = makeIntervalIndex(target.notes);
      const fitting = [], blocked = [];
      for (const phrase of phrases) if (phrase.movable) (overlapsInterval(index, phrase) ? blocked : fitting).push(phrase);
      return {
        target,
        order,
        fitting,
        overlapRatio: overlapRatio(source.notes, mergedIntervals(target.notes)),
        blockedShare: blocked.reduce((count, phrase) => count + phrase.notes.length, 0) / source.notes.length,
        pitchDistance: Math.abs(medianPitch(source.notes) - medianPitch(target.notes)),
        sameSinger: sameSingers(source.notes, target.notes)
      };
    }).filter(candidate => acrossSingers || candidate.sameSinger !== false);
    const chosen = candidates.length ? chooseMergeTarget(candidates, tolerance) : null;
    if (!chosen?.fitting.length) continue;
    const moving = new Set(chosen.fitting.flatMap(phrase => phrase.notes));
    chosen.target.notes.push(...moving);
    source.notes = source.notes.filter(note => !moving.has(note));
    chosen.target.changed = source.changed = true;
    moves.push({ fromId: source.id, fromName: source.name, toId: chosen.target.id, toName: chosen.target.name, count: moving.size, kept: source.notes.length });
    movedNoteCount += moving.size;
  }
  // Parts that neither gave nor received notes keep their voices exactly as they were.
  const outputTracks = outputs.filter(track => track.notes.length).map(({ changed, ...track }) => {
    if (!changed) return track;
    track.notes.sort((a, b) => a.start - b.start || a.sourceTrackIndex - b.sourceTrackIndex || a.sourceOrder - b.sourceOrder || a.pitch - b.pitch);
    return { ...track, lanes: partitionVoices(track.notes, 0) };
  });
  return { outputTracks, movedNoteCount, moves };
}

// Where a part starts singing with another voice bank than before: [{ start (blicks), singer }], first one excluded.
function singerChanges(notes) {
  const changes = [];
  let current = '';
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    if (!note.singer || note.singer === current) continue;
    if (current) changes.push({ start: note.start, singer: note.singer });
    current = note.singer;
  }
  return changes;
}

function mergedIntervals(notes) {
  const intervals = notes.map(note => ({ start: note.start, end: note.end })).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push(interval);
  }
  return merged;
}

function overlapRatio(notes, signal) {
  const total = notes.reduce((sum, note) => sum + note.end - note.start, 0);
  if (!total || !signal.length) return 0;
  let covered = 0;
  let cursor = 0;
  for (const note of [...notes].sort((a, b) => a.start - b.start || a.end - b.end)) {
    while (cursor < signal.length && signal[cursor].end <= note.start) cursor += 1;
    for (let index = cursor; index < signal.length && signal[index].start < note.end; index += 1) {
      covered += Math.max(0, Math.min(note.end, signal[index].end) - Math.max(note.start, signal[index].start));
    }
  }
  return Math.min(1, covered / total);
}

export function createScore(project, { trackIds, grid = 16, transpose = 0, fifths = 0, title, mergeContinuations = false, mergeAcrossSingers = false, mergeOverlap = 0.05, modulation = false, noteMerge = 'none', preserveOrder = false, triplets = false, swing = false, melisma = 'extender', tupletMarks = 'bracket', glides = 'line', pitchAdjustment = { enabled: true, thresholdCents: 50 } } = {}) {
  if (!project || !Array.isArray(project.tracks)) throw new TypeError('Project must contain parsed tracks.');
  if (![4, 8, 16, 32].includes(grid)) throw new RangeError('Grid must be 4, 8, 16, or 32.');
  if (trackIds !== undefined && !Array.isArray(trackIds)) throw new TypeError('Track IDs must be an array.');
  if (typeof mergeContinuations !== 'boolean') throw new TypeError('mergeContinuations must be a boolean.');
  if (typeof mergeAcrossSingers !== 'boolean') throw new TypeError('mergeAcrossSingers must be a boolean.');
  if (!finite(mergeOverlap) || Number(mergeOverlap) < 0 || Number(mergeOverlap) > 0.5) throw new RangeError('mergeOverlap must be a share between 0 and 0.5.');
  if (typeof triplets !== 'boolean') throw new TypeError('triplets must be a boolean.');
  if (typeof swing !== 'boolean') throw new TypeError('swing must be a boolean.');
  if (!MELISMA_STYLES.includes(melisma)) throw new RangeError('melisma must be extender, slur or both.');
  if (!TUPLET_MARKS.includes(tupletMarks)) throw new RangeError('tupletMarks must be bracket, number or simile.');
  if (noteMerge !== 'none' && noteMerge !== 'auto' && !NOTE_MERGE[noteMerge]) throw new RangeError('noteMerge must be auto, none, low, medium or high.');
  if (!GLIDE_STYLES.includes(glides)) throw new RangeError('glides must be line, grace, absorb or keep.');
  if (!pitchAdjustment || typeof pitchAdjustment !== 'object' || typeof pitchAdjustment.enabled !== 'boolean' || !finite(pitchAdjustment.thresholdCents) || Number(pitchAdjustment.thresholdCents) <= 0 || Number(pitchAdjustment.thresholdCents) > 1200) throw new RangeError('Pitch adjustment requires an enabled flag and threshold between 0 and 1200 cents.');
  if (!finite(transpose) || !Number.isInteger(Number(transpose)) || !finite(fifths) || !Number.isInteger(Number(fifths)) || Number(fifths) < -7 || Number(fifths) > 7) throw new RangeError('Invalid transposition or key signature.');
  const chosen = trackIds === undefined ? project.tracks : project.tracks.filter(track => trackIds.includes(track.id));
  if (!chosen.length) throw new Error('Select at least one vocal track.');
  // Instrumental sources are laid out in score order (woodwinds, brass, percussion, keyboards, voices, strings) and never merged.
  const instrumental = chosen.some(track => track.instrument);
  const selected = instrumental && !preserveOrder ? [...chosen].sort((a, b) => (a.instrument?.order ?? 80) - (b.instrument?.order ?? 80)) : chosen;
  const merging = mergeContinuations && selected.some(isVocal);
  const warnings = [...(project.warnings || [])];
  const step = QUARTER * 4 / grid;
  const meters = [...project.meters].sort((a, b) => a.index - b.index);
  const tempos = [...project.tempos].sort((a, b) => a.position - b.position);
  // Triplet and swung beats are chosen per part for instruments and across all voices, so that merging vocal parts never
  // re-times a note.
  const unit = triplets || swing ? TRIPLET_UNIT[grid] : undefined;
  const beats = unit ? quarterBeats(meters, selected.reduce((last, track) => track.notes.reduce((end, note) => Math.max(end, Number(note.onset) + Number(note.duration)), last), 0) + QUARTER) : [];
  const plain = { triplets: NO_TRIPLETS, swung: NO_TRIPLETS, straight: 0 };
  const shared = unit ? beatRhythm(beatFits(selected.filter(isVocal).flatMap(track => track.notes), beats, step, unit), { triplets, swing }) : plain;
  const rhythms = selected.map(track => (!unit ? plain : isVocal(track) ? shared : beatRhythm(beatFits(track.notes, beats, step, unit), { triplets, swing })));
  const tripletSets = rhythms.map(rhythm => rhythm.triplets);
  const swungCount = new Set(rhythms.flatMap(rhythm => [...rhythm.swung])).size;
  const straightCount = Math.max(0, ...rhythms.map(rhythm => rhythm.straight));
  if (swungCount && straightCount) warnings.push(`Swing notation: ${straightCount} beat(s) with straight eighths will read as swung.`);
  // Triplets need a third of the straight tick, so the divisions only grow when a score has them.
  const divisions = tripletSets.some(set => set.size) ? grid * 3 : grid;
  let mergedNoteCount = 0, glideCount = 0, ornamentCount = 0;
  const normalized = selected.map((track, sourceIndex) => {
    let shifted = 0, residual = 0, curved = 0, approximated = new Set();
    const tripletSet = tripletSets[sourceIndex], swung = rhythms[sourceIndex].swung;
    const tripletBeat = position => { if (!tripletSet.size) return null; const index = beatAt(beats, position); return index >= 0 && tripletSet.has(index) ? beats[index] : null; };
    // In a swung beat the long-short pair is written straight: its last third becomes the half beat.
    const swungBeat = position => { if (!swung.size) return null; const index = beatAt(beats, position); return index >= 0 && swung.has(index) ? beats[index] : null; };
    const snap = position => {
      const swingStart = swungBeat(position);
      if (swingStart !== null) { const offset = Math.round((position - swingStart) / unit) * unit; return swingStart + (offset >= QUARTER ? QUARTER : offset >= SWING_OFFSET ? QUARTER / 2 : 0); }
      const beat = tripletBeat(position);
      return beat === null ? quantize(position, step) : beat + Math.round((position - beat) / unit) * unit;
    };
    const notes = track.notes.map((note, sourceOrder) => {
      const start = snap(Number(note.onset));
      const originalEnd = Number(note.onset) + Number(note.duration);
      const end = Math.max(start + (tripletBeat(start) === null ? step : unit), snap(originalEnd));
      if (start !== Number(note.onset) || end !== originalEnd) shifted += 1;
      const tuning = note.tuning ?? {};
      const detune = tuning.detuneCents === null ? 0 : Number.isFinite(tuning.detuneCents) ? tuning.detuneCents : 0;
      const curve = finite(tuning.curveRepresentativeCents) ? Number(tuning.curveRepresentativeCents) : 0;
      const representativeCents = detune + curve;
      const adjustmentSemitones = pitchAdjustment.enabled && Math.abs(representativeCents) >= Number(pitchAdjustment.thresholdCents)
        ? Math.sign(representativeCents) * Math.floor(Math.abs(representativeCents) / 100 + 0.5)
        : 0;
      const pitch = Number(note.pitch) + Number(transpose) + adjustmentSemitones;
      if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
        throw new RangeError(`${track.name}: pitch ${pitch} is outside the supported MIDI range 0–127 or uses fractional semitones.`);
      }
      const normalizedTuning = {
        detuneCents: tuning.detuneCents === null ? null : detune,
        curvePointCount: Number(tuning.curvePointCount) || 0,
        curveMode: tuning.curveMode ?? null,
        curveRepresentativeCents: curve,
        curveApproximate: Boolean(tuning.curveApproximate),
        autoCurvePointCount: Number(tuning.autoCurvePointCount) || 0,
        autoCurveRepresentativeCents: finite(tuning.autoCurveRepresentativeCents) ? Number(tuning.autoCurveRepresentativeCents) : 0,
        pitchControlCurveCount: Number(tuning.pitchControlCurveCount) || 0,
        expression: { ...(tuning.expression || {}) },
        systemExpression: { ...(tuning.systemExpression || {}) },
        referenceExpression: { ...(tuning.referenceExpression || {}) },
        referenceTranspose: { cents: tuning.referenceTranspose?.cents ?? null, semitones: tuning.referenceTranspose?.semitones ?? null },
        representativeCents,
        adjustmentSemitones,
        residualCents: representativeCents - adjustmentSemitones * 100
      };
      if (normalizedTuning.curveApproximate && normalizedTuning.curvePointCount) approximated.add(normalizedTuning.curveMode || 'unknown');
      else if (normalizedTuning.curvePointCount) curved += 1;
      if (normalizedTuning.residualCents) residual += 1;
      return { ...note, start, duration: end - start, pitch, end, sourceEnd: originalEnd, tuning: normalizedTuning, sourceOrder, sourceNoteIndex: note.sourceNoteIndex ?? sourceOrder, sourceTrackIndex: sourceIndex, sourceTrackId: track.id, sourceTrackName: track.name };
    }).sort((a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder);
    if (shifted) warnings.push(`${track.name}: ${shifted} note(s) shifted by grid quantization.`);
    // Tuning notices are summed per part: one line per curve mode and one count of notes keeping cents as metadata.
    if (pitchAdjustment.enabled) {
      for (const mode of approximated) warnings.push(`${track.name}: ${mode} pitch curve uses a linear sampling approximation for note adjustment.`);
      if (curved) warnings.push(`${track.name}: pitch curve shape is reduced to one representative value per note for score display.`);
      if (residual) warnings.push(`${track.name}: ${residual} note(s) keep a remaining tuning deviation as metadata, not engraved.`);
    }
    const snapped = separateSnapped(notes);
    if (snapped.count) warnings.push(`${track.name}: ${snapped.count} very short note(s) merged into a neighbour at this rhythm grid.`);
    const merged = noteMerge === 'auto' ? mergeAuto(snapped.notes, step, glides) : mergeConsecutive(snapped.notes, noteMerge, step);
    mergedNoteCount += merged.count;
    glideCount += merged.glideCount ?? 0;
    ornamentCount += merged.ornamentCount ?? 0;
    const lanes = partitionVoices(merged.notes, step).map(lane => lane.map((note, index) => {
      const next = lane[index + 1];
      let lyricMode = 'normal';
      const extender = note.lyrics === '+' || note.lyrics === '-';
      const nextExtender = (next?.lyrics === '+' || next?.lyrics === '-') && next.start <= note.end;
      if (extender) lyricMode = nextExtender ? 'continue' : 'stop';
      else if (note.lyrics && note.lyrics !== 'br' && note.lyrics !== 'SP' && note.lyrics !== 'sil' && nextExtender) lyricMode = 'start';
      return { ...note, lyricMode };
    }));
    return { ...track, sourceIndex, lanes, triplets: tripletSet };
  });
  const sourcePartCount = normalized.length;
  const mergeResult = merging ? mergeDisjointNotes(normalized, { acrossSingers: mergeAcrossSingers, tolerance: Number(mergeOverlap) }) : {
    outputTracks: normalized,
    movedNoteCount: 0,
    moves: []
  };
  const outputTracks = merging ? mergeResult.outputTracks : normalized;
  if (merging && !outputTracks.length) throw new Error('Selected tracks contain no vocal notes.');
  for (const track of outputTracks) {
    if (track.lanes.length > 1) warnings.push(`${track.name}: overlapping notes are rendered as ${track.lanes.length} voices.`);
    if (melisma !== 'extender') for (const lane of track.lanes) markMelismas(lane);
  }
  const leadTrack = normalized.find(track => isVocal(track) && track.lanes.some(lane => lane.length));
  const leadId = leadTrack?.id;
  const leadSignal = mergedIntervals(leadTrack?.lanes.flat() ?? []);
  const roles = outputTracks.filter(isVocal).map(track => {
    const notes = track.lanes.flat();
    const continuationNotes = notes.filter(note => note.sourceTrackId !== leadId);
    const ratio = overlapRatio(continuationNotes, leadSignal);
    const sourceIds = new Set(notes.map(note => note.sourceTrackId));
    const role = sourceIds.size > 1 ? 'mixed' : track.id === leadId ? 'lead' : ratio >= 0.5 ? 'harmony' : ratio <= 0.1 ? 'continuation' : 'mixed';
    return { id: track.id, name: track.name, role, overlapRatio: Number(ratio.toFixed(4)) };
  });
  let latestEnd = 0;
  for (const track of outputTracks) {
    for (const lane of track.lanes) {
      for (const note of lane) latestEnd = Math.max(latestEnd, note.end);
    }
  }
  const finalTick = latestEnd * divisions / QUARTER;
  let bar = 0;
  let cursorTick = 0;
  const measures = [];
  while (cursorTick < finalTick || !measures.length) {
    const meter = meterAtBar(meters, bar);
    const length = meter.numerator * 4 / meter.denominator * divisions;
    if (!Number.isInteger(length) || length <= 0) throw new Error('Unsupported time signature length.');
    measures.push({ index: bar, start: cursorTick, end: cursorTick + length, meter });
    cursorTick += length;
    bar += 1;
    if (bar > 10000) throw new Error('Score exceeds the supported measure limit.');
  }
  const tick = position => position * divisions / QUARTER;
  const clefs = outputTracks.map(track => {
    if (track.instrument?.percussion) return 'percussion';
    if (track.instrument?.clef === 'bass' || track.instrument?.clef === 'alto') return track.instrument.clef;
    const pitches = track.lanes.flat().map(note => note.pitch).sort((a, b) => a - b);
    return (pitches[pitches.length >> 1] ?? 60) < (track.instrument ? 55 : 50) ? 'bass' : 'treble';
  });
  const keyChanges = modulation ? detectKeyChanges(measures, outputTracks.filter((track, index) => clefs[index] !== 'percussion').flatMap(track => track.lanes.flat().map(note => ({ start: tick(note.start), end: tick(note.end), pitch: note.pitch }))), { initialFifths: Math.trunc(fifths), divisions }) : [];
  const measureFifths = [];
  for (const [index] of measures.entries()) measureFifths.push(keyChanges.find(change => change.measureIndex === index)?.fifths ?? measureFifths.at(-1) ?? Math.trunc(fifths));
  const marks = tempoMarks(tempos, step);
  const values = noteValues(divisions);
  const tripletList = unit ? tripletValues(divisions, Math.round(unit / QUARTER * divisions)) : [];
  const style = { extenders: melisma !== 'slur', tupletMarks };
  // MusicXML 4.0 swing: eighths are played long-short, 2:1, which the marking shows as ♫ = ♩♪³.
  const swingXml = swungCount ? '<direction placement="above"><direction-type><words font-weight="bold">Swing (♫ = ♩♪³)</words></direction-type><sound><swing><first>2</first><second>1</second><swing-type>eighth</swing-type></swing></sound></direction>' : '';
  const parts = outputTracks.map((track, partIndex) => {
    const id = `P${partIndex + 1}`;
    const tupletRuns = [];
    const body = measures.map((measure, measureIndex) => {
      const changingMeter = measureIndex === 0 || measure.meter !== measures[measureIndex - 1].meter;
      // Drum staves carry no key signature (OSMD ignores print-object="no", so they stay in C throughout).
      const keyXml = clefs[partIndex] === 'percussion' ? (measureIndex === 0 ? '<key><fifths>0</fifths></key>' : '')
        : measureIndex === 0 || measureFifths[measureIndex] !== measureFifths[measureIndex - 1] ? `<key><fifths>${measureFifths[measureIndex]}</fifths></key>` : '';
      const attrs = keyXml || changingMeter
        ? `<attributes>${measureIndex === 0 ? `<divisions>${divisions}</divisions>` : ''}${keyXml}${changingMeter ? `<time><beats>${measure.meter.numerator}</beats><beat-type>${measure.meter.denominator}</beat-type></time>` : ''}${measureIndex === 0 ? CLEFS[clefs[partIndex]] : ''}</attributes>` : '';
      const directionXml = marks.filter(mark => tick(mark.position) >= measure.start && tick(mark.position) < measure.end).map(mark => {
        const offset = tick(mark.position) - measure.start;
        const types = `${mark.words ? `<direction-type><words font-style="italic">${mark.words}</words></direction-type>` : ''}${mark.bpm !== null ? `<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(mark.bpm)}</per-minute></metronome></direction-type>` : ''}`;
        return `<direction placement="above">${types}${offset ? `<offset>${offset}</offset>` : ''}${mark.bpm !== null ? `<sound tempo="${xml(mark.bpm)}"/>` : ''}</direction>`;
      }).join('');
      const measureLength = measure.end - measure.start;
      const starts = beatStarts(measure.meter, divisions, measureLength);
      const measureTriplets = track.triplets?.size && measure.meter.denominator === 4
        ? new Set(starts.slice(0, -1).flatMap((offset, beat) => (track.triplets.has(beatAt(beats, Math.round((measure.start + offset) * QUARTER / divisions))) ? [beat] : [])))
        : NO_TRIPLETS;
      const voiceXml = [];
      track.lanes.forEach((lane, laneIndex) => {
        let local = 0;
        const spans = [];
        lane.forEach((note, fallbackNoteIndex) => {
          const start = Math.max(measure.start, tick(note.start));
          const end = Math.min(measure.end, tick(note.end));
          if (end <= start || start >= measure.end || end <= measure.start) return;
          const previous = spans.at(-1);
          if (previous && !previous.rest && previous.note.start === note.start && previous.note.end === note.end) { previous.chord.push({ note, fallbackNoteIndex }); return; }
          const onset = Math.round(start - measure.start);
          const duration = Math.round(end - start);
          if (onset > local) spans.push({ rest: true, start: local, end: onset });
          const before = tick(note.start) < measure.start;
          const after = tick(note.end) > measure.end;
          const lyricMode = before ? (after || note.lyricMode !== 'stop' ? 'continue' : 'stop') : after && note.lyricMode === 'stop' ? 'continue' : note.lyricMode;
          spans.push({ rest: false, start: onset, end: onset + duration, note, chord: [], before, after, lyricMode, fallbackNoteIndex });
          local = Math.max(local, onset + duration);
        });
        if (local < measureLength) spans.push({ rest: true, start: local, end: Math.round(measureLength) });
        const pieces = spans.flatMap(span => {
          const spelled = spellSpan(span.start, span.end, starts, values, span.rest, measureTriplets, tripletList);
          if (!spelled) throw new Error(`Cannot represent ${span.rest ? 'rest ' : ''}duration ${span.end - span.start} at the selected grid.`);
          return spelled.map((piece, index) => ({ ...piece, span, index, last: index === spelled.length - 1 }));
        });
        beamPieces(pieces, starts, measure.meter);
        if (tupletMarks === 'simile') tupletRuns[laneIndex] = hideRepeatedTuplets(pieces, measure.start, tupletRuns[laneIndex]);
        if (laneIndex > 0) voiceXml.push(`<backup><duration>${Math.round(measureLength)}</duration></backup>`);
        voiceXml.push(pieces.map(piece => pieceXml(piece, measureFifths[measureIndex], measureIndex, partIndex, laneIndex, clefs[partIndex] === 'percussion', style)).join(''));
      });
      const barline = '<barline location="right"><bar-style>regular</bar-style></barline>';
      return `<measure number="${measureIndex + 1}">${attrs}${measureIndex === 0 && partIndex === 0 ? swingXml : ''}${directionXml}${voiceXml.join('')}${barline}</measure>`;
    }).join('');
    return { id, name: track.name, xml: `<part id="${id}">${body}</part>`, track };
  });
  const partList = parts.map(part => `<score-part id="${part.id}"><part-name>${xml(part.name)}</part-name></score-part>`).join('');
  const xmlDoc = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><work><work-title>${xml(title || project.title || 'Untitled score')}</work-title></work><identification><encoding><software>织音机</software></encoding></identification><part-list>${partList}</part-list>${parts.map(part => part.xml).join('')}</score-partwise>`;
  const model = {
    divisions,
    measures: measures.map(measure => ({
      index: measure.index,
      start: measure.start,
      end: measure.end,
      meter: { numerator: measure.meter.numerator, denominator: measure.meter.denominator }
    })),
    tracks: outputTracks.map((track, index) => ({
      id: track.id,
      name: track.name,
      clef: clefs[index],
      percussion: clefs[index] === 'percussion',
      // The voice bank the part opens with, then each place it changes, as a measure index and an offset in divisions.
      singer: [...track.lanes.flat()].sort((a, b) => a.start - b.start).find(note => note.singer)?.singer ?? track.singer ?? '',
      singerChanges: singerChanges(track.lanes.flat()).map(change => {
        const position = Math.round(tick(change.start));
        const measureIndex = Math.max(0, measures.findIndex(measure => position < measure.end));
        return { measureIndex, offset: position - measures[measureIndex].start, singer: change.singer };
      }),
      notes: track.lanes.flatMap((lane, laneIndex) => lane.map(note => ({
        start: Math.round(note.start / QUARTER * divisions),
        end: Math.round(note.end / QUARTER * divisions),
        pitch: note.pitch,
        lyrics: note.lyrics,
        voice: laneIndex + 1,
        sourceTrackId: note.sourceTrackId,
        sourceTrackName: note.sourceTrackName,
        sourceTrackIndex: note.sourceTrackIndex,
        sourceNoteIndex: note.sourceNoteIndex,
        tuning: {
          ...note.tuning,
          expression: { ...note.tuning.expression },
          systemExpression: { ...note.tuning.systemExpression },
          referenceExpression: { ...note.tuning.referenceExpression },
          referenceTranspose: { ...note.tuning.referenceTranspose }
        }
      }))).sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.voice - b.voice)
    })),
    tempos: tempos
      .filter(tempo => tempo.position >= 0 && tempo.position < measures.at(-1).end / divisions * QUARTER)
      .map(tempo => ({ position: Math.round(quantize(tempo.position, step) / QUARTER * divisions), bpm: tempo.bpm }))
  };
  return {
    xml: xmlDoc,
    warnings: [...new Set(warnings)],
    stats: { noteCount: outputTracks.reduce((sum, track) => sum + track.lanes.reduce((total, lane) => total + lane.length, 0), 0), measureCount: measures.length, partCount: parts.length },
    parts: parts.map(({ id, name }) => ({ id, name })),
    keyChanges: keyChanges.map(change => ({ ...change })),
    noteMerge: { level: noteMerge, mergedCount: mergedNoteCount, glideCount, ornamentCount },
    triplets: { enabled: triplets, beatCount: new Set(tripletSets.flatMap(set => [...set])).size },
    swing: { enabled: swing, beatCount: swungCount, straightBeatCount: swungCount ? straightCount : 0 },
    model,
    merging: { enabled: merging, movedNoteCount: mergeResult.movedNoteCount, sourcePartCount, outputPartCount: outputTracks.length, moves: mergeResult.moves, roles },
    pitchAdjustments: {
      enabled: pitchAdjustment.enabled,
      thresholdCents: Number(pitchAdjustment.thresholdCents),
      adjustedNoteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => note.tuning.adjustmentSemitones !== 0).length, 0),
      approximateNoteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => note.tuning.curvePointCount > 0).length, 0),
      // Synthesizer V's own pitch is reported for reference only and never changes a note.
      auto: {
        noteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => note.tuning.autoCurvePointCount > 0).length, 0),
        offsetNoteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => Math.abs(note.tuning.autoCurveRepresentativeCents) >= Number(pitchAdjustment.thresholdCents)).length, 0)
      },
      notes: normalized.flatMap(track => track.lanes.flat().filter(note => note.tuning.adjustmentSemitones !== 0).map(note => ({
        sourceTrackId: note.sourceTrackId,
        sourceNoteIndex: note.sourceNoteIndex,
        fromPitch: note.pitch - note.tuning.adjustmentSemitones,
        toPitch: note.pitch,
        cents: note.tuning.representativeCents,
        residualCents: note.tuning.residualCents,
        autoCents: note.tuning.autoCurveRepresentativeCents
      })))
    }
  };
}
