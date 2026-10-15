import { detectKeyChanges } from './modulation.js';

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

function groupPitchCurve(group, start, end) {
  const curve = group?.parameters?.pitchDelta;
  const rawPoints = Array.isArray(curve?.points) ? curve.points : [];
  const points = rawPoints.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(point => [point[0], point[1]])
    .sort((a, b) => a[0] - b[0]);
  const mode = typeof curve?.mode === 'string' ? curve.mode : null;
  if (!points.length || end <= start) {
    return { pointCount: rawPoints.length, mode, representativeCents: 0, approximate: rawPoints.length > 0 && mode?.toLowerCase() !== 'linear' };
  }
  const sample = position => {
    if (position <= points[0][0]) return points[0][1];
    if (position >= points.at(-1)[0]) return points.at(-1)[1];
    let right = 1;
    while (right < points.length && points[right][0] < position) right += 1;
    const leftPoint = points[right - 1];
    const rightPoint = points[right];
    if (rightPoint[0] === leftPoint[0]) return rightPoint[1];
    const ratio = (position - leftPoint[0]) / (rightPoint[0] - leftPoint[0]);
    return leftPoint[1] + (rightPoint[1] - leftPoint[1]) * ratio;
  };
  const samplePositions = Array.from({ length: 17 }, (_, index) => start + (end - start) * (0.2 + 0.6 * index / 16));
  const values = samplePositions.map(sample).sort((a, b) => a - b);
  return {
    pointCount: rawPoints.length,
    mode,
    representativeCents: values[Math.floor(values.length / 2)],
    approximate: mode?.toLowerCase() !== 'linear' || samplePositions.some(position => position < points[0][0] || position > points.at(-1)[0])
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
    referenceExpressionNotes: 0
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
      const rawPitchCurve = group?.parameters?.pitchDelta;
      if (rawPitchCurve && Array.isArray(rawPitchCurve.points)) {
        tuningSummary.pitchDeltaCurves += 1;
        tuningSummary.pitchDeltaPoints += rawPitchCurve.points.length;
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
        const curve = groupPitchCurve(group, trimStart - offset, trimEnd - offset);
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
          tuning: {
            detuneCents,
            curvePointCount: curve.pointCount,
            curveMode: curve.mode,
            curveRepresentativeCents: curve.representativeCents,
            curveApproximate: curve.approximate,
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
      tracks.push({ id: String(track.mainGroup?.uuid ?? mainRef?.groupID ?? `track-${index + 1}`), name: String(track.name || `Track ${index + 1}`), notes });
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

// Splits [start, end) into written values that show the beat: within a beat any single value fits; from a beat a value may
// span whole beats or be dotted past the next beat. Rests additionally keep the middle of an even bar visible.
function spellSpan(start, end, starts, values, rest) {
  const count = starts.length - 1;
  const middle = count >= 4 && count % 2 === 0 ? starts[count / 2] : null;
  const pieces = [];
  for (let cursor = start; cursor < end;) {
    let beat = 0;
    while (beat < count - 1 && starts[beat + 1] <= cursor) beat += 1;
    const beatEnd = starts[beat + 1];
    let value;
    if (cursor === starts[beat]) {
      value = values.find(item => {
        const stop = cursor + item.duration;
        if (stop > end) return false;
        if (stop <= beatEnd) return true;
        const onBeat = starts.includes(stop);
        if (rest) return onBeat && (middle === null || stop <= middle || cursor >= middle || (cursor === 0 && stop === starts[count]));
        return onBeat || (item.dots === 1 && starts.includes(cursor + item.duration / 1.5));
      });
    } else {
      // An off-beat note lasting one beat (eighth–quarter–eighth) stays whole unless it would hide the middle of the bar.
      const beatLength = beatEnd - starts[beat];
      const syncopated = !rest && cursor - starts[beat] === beatLength / 2 && cursor + beatLength <= end && beatEnd !== middle && beat + 1 < count;
      const limit = Math.min(end, beatEnd);
      value = (syncopated && values.find(item => item.duration === beatLength && !item.dots))
        || values.find(item => item.duration === limit - cursor) || values.find(item => cursor + item.duration <= limit);
    }
    if (!value) return null;
    pieces.push({ start: cursor, duration: value.duration, type: value.type, dots: value.dots });
    cursor += value.duration;
  }
  return pieces;
}

const BEAM_LEVELS = { eighth: 1, '16th': 2, '32nd': 3, '64th': 4 };

// Beams notes shorter than a quarter within each beat; four plain eighths share one beam across a half bar of an even x/4 meter.
function beamPieces(pieces, starts, meter) {
  const count = starts.length - 1;
  const beatOf = tick => { let beat = 0; while (beat < count - 1 && starts[beat + 1] <= tick) beat += 1; return beat; };
  const beamable = piece => !piece.span.rest && BEAM_LEVELS[piece.type];
  const group = pieces.map(piece => beatOf(piece.start));
  if (meter.denominator === 4 && count % 2 === 0) {
    for (let beat = 0; beat < count; beat += 2) {
      const members = pieces.filter((piece, index) => group[index] === beat || group[index] === beat + 1);
      if (members.length === 4 && members.every(piece => beamable(piece) && piece.type === 'eighth' && !piece.dots)) {
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

function pieceXml(piece, fifths, measureIndex, partIndex, laneIndex, percussion = false) {
  const { span } = piece;
  if (span.rest) return `<note><rest/><duration>${piece.duration}</duration><voice>${laneIndex + 1}</voice><type>${piece.type}</type>${'<dot/>'.repeat(piece.dots)}</note>`;
  const tieIn = piece.index > 0 || span.before;
  const tieOut = !piece.last || span.after;
  const ties = `${tieIn ? '<tie type="stop"/>' : ''}${tieOut ? '<tie type="start"/>' : ''}`;
  const notations = `${tieIn ? '<tied type="stop"/>' : ''}${tieOut ? '<tied type="start"/>' : ''}`;
  const write = (note, fallbackNoteIndex, chord) => {
    const [pitch, notehead] = percussion ? unpitchedXml(note.pitch) : [pitchXml(note.pitch, fifths), ''];
    const lyric = chord || piece.index > 0 ? '' : span.lyricMode === 'continue' ? '<lyric><extend type="continue"/></lyric>' : lyricXml(note.lyrics, span.lyricMode);
    return `<note id="${musicXmlNoteId(note, piece.index, measureIndex, partIndex, laneIndex, fallbackNoteIndex)}">${chord ? '<chord/>' : ''}${pitch}<duration>${piece.duration}</duration>${ties}<voice>${laneIndex + 1}</voice><type>${piece.type}</type>${'<dot/>'.repeat(piece.dots)}${notehead}${chord ? '' : (piece.beams ?? []).join('')}${notations ? `<notations>${notations}</notations>` : ''}${lyric}</note>`;
  };
  return [write(span.note, span.fallbackNoteIndex, false), ...span.chord.map(member => write(member.note, member.fallbackNoteIndex, true))].join('');
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

function lyricXml(lyrics, mode) {
  const silence = new Set(['', '+', '-', 'br', 'SP', 'sil']);
  if (mode === 'stop') return '<lyric><extend type="stop"/></lyric>';
  if (silence.has(lyrics)) return '';
  const boundary = /[-‐‑‒–—]/u;
  const starts = boundary.test(lyrics[0] || '');
  const ends = boundary.test(lyrics.at(-1) || '');
  const syllabic = starts && ends ? 'middle' : starts ? 'end' : ends ? 'begin' : boundary.test(lyrics) ? 'single' : null;
  const text = lyrics.replace(/^[-‐‑‒–—]+|[-‐‑‒–—]+$/gu, '');
  return `<lyric>${syllabic ? `<syllabic>${syllabic}</syllabic>` : ''}<text>${xml(text)}</text>${mode === 'start' ? '<extend type="start"/>' : ''}</lyric>`;
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

function mergeUnits(lanes) {
  const units = [];
  for (const lane of lanes) {
    for (let index = 0; index < lane.length;) {
      const note = lane[index];
      const marker = note.lyrics === '+' || note.lyrics === '-';
      if (note.lyricMode === 'start') {
        const notes = [note];
        let end = note.end;
        let nextIndex = index + 1;
        while (nextIndex < lane.length) {
          const next = lane[nextIndex];
          if (!(next.lyrics === '+' || next.lyrics === '-') || next.start > end) break;
          notes.push(next);
          end = Math.max(end, next.end);
          nextIndex += 1;
        }
        units.push({ notes, start: note.start, end, movable: true });
        index = nextIndex;
        continue;
      }
      if (marker) {
        let end = note.end;
        let nextIndex = index + 1;
        while (nextIndex < lane.length) {
          const next = lane[nextIndex];
          if (!(next.lyrics === '+' || next.lyrics === '-') || next.start > end) break;
          end = Math.max(end, next.end);
          nextIndex += 1;
        }
        units.push({ notes: lane.slice(index, nextIndex), start: note.start, end, movable: false });
        index = nextIndex;
        continue;
      }
      units.push({ notes: [note], start: note.start, end: note.end, movable: true });
      index += 1;
    }
  }
  return units.sort((a, b) => a.start - b.start || a.notes[0].sourceOrder - b.notes[0].sourceOrder);
}

function mergeDisjointNotes(tracks) {
  const outputs = tracks.map((track, sourceIndex) => ({
    ...track,
    sourceIndex,
    notes: track.lanes.flat().sort((a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder),
    units: mergeUnits(track.lanes)
  }));
  const movesByPair = new Map();
  let movedNoteCount = 0;
  for (let sourceIndex = 1; sourceIndex < outputs.length; sourceIndex += 1) {
    const source = outputs[sourceIndex];
    const targets = outputs.slice(0, sourceIndex).filter(track => track.notes.length);
    const indexes = targets.map(track => makeIntervalIndex(track.notes));
    const batchEnd = targets.map(() => -Infinity);
    const remaining = [];
    for (const unit of source.units) {
      if (!unit.movable) {
        remaining.push(...unit.notes);
        continue;
      }
      let targetIndex = -1;
      for (let index = 0; index < targets.length; index += 1) {
        if (batchEnd[index] > unit.start || overlapsInterval(indexes[index], unit)) continue;
        targetIndex = index;
        break;
      }
      if (targetIndex < 0) {
        remaining.push(...unit.notes);
        continue;
      }
      const target = targets[targetIndex];
      target.notes.push(...unit.notes);
      batchEnd[targetIndex] = unit.end;
      const key = `${sourceIndex}:${target.sourceIndex}`;
      const move = movesByPair.get(key) ?? {
        fromId: source.id,
        fromName: source.name,
        toId: target.id,
        toName: target.name,
        count: 0
      };
      move.count += unit.notes.length;
      movesByPair.set(key, move);
      movedNoteCount += unit.notes.length;
    }
    source.notes = remaining;
    delete source.units;
  }
  const outputTracks = outputs.filter(track => track.notes.length).map(track => {
    delete track.units;
    track.notes.sort((a, b) => a.start - b.start || a.sourceTrackIndex - b.sourceTrackIndex || a.sourceOrder - b.sourceOrder || a.pitch - b.pitch);
    return { ...track, lanes: partitionVoices(track.notes, 0) };
  });
  return { outputTracks, movedNoteCount, moves: [...movesByPair.values()] };
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

export function createScore(project, { trackIds, grid = 16, transpose = 0, fifths = 0, title, mergeContinuations = false, modulation = false, noteMerge = 'none', preserveOrder = false, pitchAdjustment = { enabled: true, thresholdCents: 50 } } = {}) {
  if (!project || !Array.isArray(project.tracks)) throw new TypeError('Project must contain parsed tracks.');
  if (![4, 8, 16, 32].includes(grid)) throw new RangeError('Grid must be 4, 8, 16, or 32.');
  if (trackIds !== undefined && !Array.isArray(trackIds)) throw new TypeError('Track IDs must be an array.');
  if (typeof mergeContinuations !== 'boolean') throw new TypeError('mergeContinuations must be a boolean.');
  if (noteMerge !== 'none' && !NOTE_MERGE[noteMerge]) throw new RangeError('noteMerge must be none, low, medium or high.');
  if (!pitchAdjustment || typeof pitchAdjustment !== 'object' || typeof pitchAdjustment.enabled !== 'boolean' || !finite(pitchAdjustment.thresholdCents) || Number(pitchAdjustment.thresholdCents) <= 0 || Number(pitchAdjustment.thresholdCents) > 1200) throw new RangeError('Pitch adjustment requires an enabled flag and threshold between 0 and 1200 cents.');
  if (!finite(transpose) || !Number.isInteger(Number(transpose)) || !finite(fifths) || !Number.isInteger(Number(fifths)) || Number(fifths) < -7 || Number(fifths) > 7) throw new RangeError('Invalid transposition or key signature.');
  const chosen = trackIds === undefined ? project.tracks : project.tracks.filter(track => trackIds.includes(track.id));
  if (!chosen.length) throw new Error('Select at least one vocal track.');
  // Instrumental sources are laid out in score order (woodwinds, brass, percussion, keyboards, voices, strings) and never merged.
  const instrumental = chosen.some(track => track.instrument);
  const selected = instrumental && !preserveOrder ? [...chosen].sort((a, b) => (a.instrument?.order ?? 80) - (b.instrument?.order ?? 80)) : chosen;
  const merging = mergeContinuations && !instrumental;
  const warnings = [...(project.warnings || [])];
  const divisions = grid;
  const step = QUARTER * 4 / grid;
  const meters = [...project.meters].sort((a, b) => a.index - b.index);
  const tempos = [...project.tempos].sort((a, b) => a.position - b.position);
  let mergedNoteCount = 0;
  const normalized = selected.map((track, sourceIndex) => {
    let shifted = 0;
    const notes = track.notes.map((note, sourceOrder) => {
      const start = quantize(note.onset, step);
      const originalEnd = Number(note.onset) + Number(note.duration);
      const end = Math.max(start + step, quantize(originalEnd, step));
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
        pitchControlCurveCount: Number(tuning.pitchControlCurveCount) || 0,
        expression: { ...(tuning.expression || {}) },
        systemExpression: { ...(tuning.systemExpression || {}) },
        referenceExpression: { ...(tuning.referenceExpression || {}) },
        referenceTranspose: { cents: tuning.referenceTranspose?.cents ?? null, semitones: tuning.referenceTranspose?.semitones ?? null },
        representativeCents,
        adjustmentSemitones,
        residualCents: representativeCents - adjustmentSemitones * 100
      };
      if (pitchAdjustment.enabled && normalizedTuning.curveApproximate && normalizedTuning.curvePointCount) warnings.push(`${track.name}: ${normalizedTuning.curveMode || 'unknown'} pitch curve uses a linear sampling approximation for note adjustment.`);
      else if (pitchAdjustment.enabled && normalizedTuning.curvePointCount) warnings.push(`${track.name}: pitch curve shape is reduced to one representative value per note for score display.`);
      if (pitchAdjustment.enabled && normalizedTuning.residualCents) warnings.push(`${track.name}: remaining ${normalizedTuning.residualCents} cent tuning deviation is preserved as metadata, not engraved.`);
      return { ...note, start, duration: end - start, pitch, end, sourceEnd: originalEnd, tuning: normalizedTuning, sourceOrder, sourceNoteIndex: note.sourceNoteIndex ?? sourceOrder, sourceTrackIndex: sourceIndex, sourceTrackId: track.id, sourceTrackName: track.name };
    }).sort((a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder);
    if (shifted) warnings.push(`${track.name}: ${shifted} note(s) shifted by grid quantization.`);
    const snapped = separateSnapped(notes);
    if (snapped.count) warnings.push(`${track.name}: ${snapped.count} very short note(s) merged into a neighbour at this rhythm grid.`);
    const merged = mergeConsecutive(snapped.notes, noteMerge, step);
    mergedNoteCount += merged.count;
    const lanes = partitionVoices(merged.notes, step).map(lane => lane.map((note, index) => {
      const next = lane[index + 1];
      let lyricMode = 'normal';
      const extender = note.lyrics === '+' || note.lyrics === '-';
      const nextExtender = (next?.lyrics === '+' || next?.lyrics === '-') && next.start <= note.end;
      if (extender) lyricMode = nextExtender ? 'continue' : 'stop';
      else if (note.lyrics && note.lyrics !== 'br' && note.lyrics !== 'SP' && note.lyrics !== 'sil' && nextExtender) lyricMode = 'start';
      return { ...note, lyricMode };
    }));
    return { ...track, sourceIndex, lanes };
  });
  const sourcePartCount = normalized.length;
  const mergeResult = merging ? mergeDisjointNotes(normalized) : {
    outputTracks: normalized,
    movedNoteCount: 0,
    moves: []
  };
  const outputTracks = merging ? mergeResult.outputTracks : normalized;
  if (merging && !outputTracks.length) throw new Error('Selected tracks contain no vocal notes.');
  for (const track of outputTracks) {
    if (track.lanes.length > 1) warnings.push(`${track.name}: overlapping notes are rendered as ${track.lanes.length} voices.`);
  }
  const leadTrack = normalized.find(track => track.lanes.some(lane => lane.length));
  const leadId = leadTrack?.id;
  const leadSignal = mergedIntervals(leadTrack?.lanes.flat() ?? []);
  const roles = outputTracks.map(track => {
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
  const finalTick = latestEnd / QUARTER * divisions;
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
  const tick = position => position / QUARTER * divisions;
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
  const parts = outputTracks.map((track, partIndex) => {
    const id = `P${partIndex + 1}`;
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
          const spelled = spellSpan(span.start, span.end, starts, values, span.rest);
          if (!spelled) throw new Error(`Cannot represent ${span.rest ? 'rest ' : ''}duration ${span.end - span.start} at the selected grid.`);
          return spelled.map((piece, index) => ({ ...piece, span, index, last: index === spelled.length - 1 }));
        });
        beamPieces(pieces, starts, measure.meter);
        if (laneIndex > 0) voiceXml.push(`<backup><duration>${Math.round(measureLength)}</duration></backup>`);
        voiceXml.push(pieces.map(piece => pieceXml(piece, measureFifths[measureIndex], measureIndex, partIndex, laneIndex, clefs[partIndex] === 'percussion')).join(''));
      });
      const barline = '<barline location="right"><bar-style>regular</bar-style></barline>';
      return `<measure number="${measureIndex + 1}">${attrs}${directionXml}${voiceXml.join('')}${barline}</measure>`;
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
    noteMerge: { level: noteMerge, mergedCount: mergedNoteCount },
    model,
    merging: { enabled: merging, movedNoteCount: mergeResult.movedNoteCount, sourcePartCount, outputPartCount: outputTracks.length, moves: mergeResult.moves, roles },
    pitchAdjustments: {
      enabled: pitchAdjustment.enabled,
      thresholdCents: Number(pitchAdjustment.thresholdCents),
      adjustedNoteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => note.tuning.adjustmentSemitones !== 0).length, 0),
      approximateNoteCount: normalized.reduce((count, track) => count + track.lanes.flat().filter(note => note.tuning.curvePointCount > 0).length, 0),
      notes: normalized.flatMap(track => track.lanes.flat().filter(note => note.tuning.adjustmentSemitones !== 0).map(note => ({
        sourceTrackId: note.sourceTrackId,
        sourceNoteIndex: note.sourceNoteIndex,
        fromPitch: note.pitch - note.tuning.adjustmentSemitones,
        toPitch: note.pitch,
        cents: note.tuning.representativeCents,
        residualCents: note.tuning.residualCents
      })))
    }
  };
}
