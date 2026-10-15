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

function decomposeDuration(ticks, divisions) {
  const values = [];
  let rest = ticks;
  const types = [
    ['whole', divisions * 4], ['half', divisions * 2], ['quarter', divisions], ['eighth', divisions / 2],
    ['16th', divisions / 4], ['32nd', divisions / 8], ['64th', divisions / 16]
  ].filter(([, duration]) => Number.isInteger(duration) && duration > 0);
  const candidates = types.flatMap(([type, duration]) => [
    { type, dots: 0, duration },
    { type, dots: 1, duration: duration * 1.5 },
    { type, dots: 2, duration: duration * 1.75 }
  ]).filter(item => Number.isInteger(item.duration)).sort((a, b) => b.duration - a.duration);
  while (rest > 0) {
    const selected = candidates.find(item => item.duration <= rest);
    if (!selected) return null;
    values.push(selected);
    rest -= selected.duration;
  }
  return values;
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

function musicXmlNoteId(note, segmentIndex = 0) {
  return `svp-n${note.sourceTrackIndex}-${note.sourceNoteIndex}-s${segmentIndex}`;
}

function noteXml(note, duration, divisions, fifths, tieStart = false, tieStop = false, lyricMode = 'normal') {
  const parts = [`<note id="${musicXmlNoteId(note)}">`];
  parts.push(pitchXml(note.pitch, fifths));
  parts.push(`<duration>${duration}</duration>`);
  const decoded = decomposeDuration(duration, divisions);
  if (!decoded) throw new Error(`Cannot represent duration ${duration} at the selected grid.`);
  const selected = decoded[0];
  if (selected.dots || decoded.length > 1) {
    return decoded.map((item, index) => {
      const tieIn = tieStop || index > 0;
      const tieOut = tieStart || index < decoded.length - 1;
      const ties = `${tieIn ? '<tie type="stop"/>' : ''}${tieOut ? '<tie type="start"/>' : ''}`;
      const notations = `${tieIn ? '<tied type="stop"/>' : ''}${tieOut ? '<tied type="start"/>' : ''}`;
      return `<note id="${musicXmlNoteId(note, index)}">${pitchXml(note.pitch, fifths)}<duration>${item.duration}</duration>${ties}<voice>${note.voice}</voice><type>${item.type}</type>${'<dot/>'.repeat(item.dots)}${notations ? `<notations>${notations}</notations>` : ''}${index === 0 && lyricMode !== 'continue' ? lyricXml(note.lyrics, lyricMode) : index === 0 && lyricMode === 'continue' ? '<lyric><extend type="continue"/></lyric>' : ''}</note>`;
    }).join('');
  }
  if (tieStop) parts.push('<tie type="stop"/>');
  if (tieStart) parts.push('<tie type="start"/>');
  parts.push(`<voice>${note.voice}</voice>`);
  parts.push(`<type>${selected.type}</type>`);
  const notations = `${tieStop ? '<tied type="stop"/>' : ''}${tieStart ? '<tied type="start"/>' : ''}`;
  if (notations) parts.push(`<notations>${notations}</notations>`);
  parts.push(lyricMode === 'continue' ? '<lyric><extend type="continue"/></lyric>' : lyricXml(note.lyrics, lyricMode));
  parts.push('</note>');
  return parts.join('');
}

function restXml(duration, divisions, voice) {
  const decoded = decomposeDuration(duration, divisions);
  if (!decoded) throw new Error(`Cannot represent rest duration ${duration} at the selected grid.`);
  return decoded.map(item => `<note><rest/><duration>${item.duration}</duration><voice>${voice}</voice><type>${item.type}</type>${'<dot/>'.repeat(item.dots)}</note>`).join('');
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

function partitionVoices(notes, step) {
  const lanes = [];
  for (const note of notes) {
    let lane = lanes.find(items => items.at(-1).end <= note.start);
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

export function createScore(project, { trackIds, grid = 16, transpose = 0, fifths = 0, title, mergeContinuations = false, pitchAdjustment = { enabled: true, thresholdCents: 50 } } = {}) {
  if (!project || !Array.isArray(project.tracks)) throw new TypeError('Project must contain parsed tracks.');
  if (![4, 8, 16, 32].includes(grid)) throw new RangeError('Grid must be 4, 8, 16, or 32.');
  if (trackIds !== undefined && !Array.isArray(trackIds)) throw new TypeError('Track IDs must be an array.');
  if (typeof mergeContinuations !== 'boolean') throw new TypeError('mergeContinuations must be a boolean.');
  if (!pitchAdjustment || typeof pitchAdjustment !== 'object' || typeof pitchAdjustment.enabled !== 'boolean' || !finite(pitchAdjustment.thresholdCents) || Number(pitchAdjustment.thresholdCents) <= 0 || Number(pitchAdjustment.thresholdCents) > 1200) throw new RangeError('Pitch adjustment requires an enabled flag and threshold between 0 and 1200 cents.');
  if (!finite(transpose) || !Number.isInteger(Number(transpose)) || !finite(fifths) || !Number.isInteger(Number(fifths)) || Number(fifths) < -7 || Number(fifths) > 7) throw new RangeError('Invalid transposition or key signature.');
  const selected = trackIds === undefined ? project.tracks : project.tracks.filter(track => trackIds.includes(track.id));
  if (!selected.length) throw new Error('Select at least one vocal track.');
  const warnings = [...(project.warnings || [])];
  const divisions = grid;
  const step = QUARTER * 4 / grid;
  const meters = [...project.meters].sort((a, b) => a.index - b.index);
  const tempos = [...project.tempos].sort((a, b) => a.position - b.position);
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
      if (normalizedTuning.curveApproximate && normalizedTuning.curvePointCount) warnings.push(`${track.name}: ${normalizedTuning.curveMode || 'unknown'} pitch curve uses a linear sampling approximation for note adjustment.`);
      else if (normalizedTuning.curvePointCount) warnings.push(`${track.name}: pitch curve shape is reduced to one representative value per note for score display.`);
      if (normalizedTuning.residualCents) warnings.push(`${track.name}: remaining ${normalizedTuning.residualCents} cent tuning deviation is preserved as metadata, not engraved.`);
      return { ...note, start, duration: end - start, pitch, end, tuning: normalizedTuning, sourceOrder, sourceNoteIndex: note.sourceNoteIndex ?? sourceOrder, sourceTrackIndex: sourceIndex, sourceTrackId: track.id, sourceTrackName: track.name };
    }).sort((a, b) => a.start - b.start || a.sourceOrder - b.sourceOrder);
    if (shifted) warnings.push(`${track.name}: ${shifted} note(s) shifted by grid quantization.`);
    const lanes = partitionVoices(notes, step).map(lane => lane.map((note, index) => {
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
  const mergeResult = mergeContinuations ? mergeDisjointNotes(normalized) : {
    outputTracks: normalized,
    movedNoteCount: 0,
    moves: []
  };
  const outputTracks = mergeContinuations ? mergeResult.outputTracks : normalized;
  if (mergeContinuations && !outputTracks.length) throw new Error('Selected tracks contain no vocal notes.');
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
  const parts = outputTracks.map((track, partIndex) => {
    const id = `P${partIndex + 1}`;
    const body = measures.map((measure, measureIndex) => {
      const changingMeter = measureIndex === 0 || measure.meter !== measures[measureIndex - 1].meter;
      const attrs = measureIndex === 0 || changingMeter
        ? `<attributes><divisions>${divisions}</divisions>${measureIndex === 0 ? `<key><fifths>${Math.trunc(fifths)}</fifths></key>` : ''}${changingMeter ? `<time><beats>${measure.meter.numerator}</beats><beat-type>${measure.meter.denominator}</beat-type></time>` : ''}${measureIndex === 0 ? '<clef><sign>G</sign><line>2</line></clef>' : ''}</attributes>` : '';
      const directions = tempos.filter(tempo => tempo.position >= measure.start / divisions * QUARTER && tempo.position < measure.end / divisions * QUARTER);
      const directionXml = directions.map(tempo => {
        const offset = quantize(tempo.position, step) / QUARTER * divisions - measure.start;
        return `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${xml(tempo.bpm)}</per-minute></metronome></direction-type>${offset ? `<offset>${offset}</offset>` : ''}<sound tempo="${xml(tempo.bpm)}"/></direction>`;
      }).join('');
      const voiceXml = [];
      track.lanes.forEach((lane, laneIndex) => {
        let local = 0;
        const events = [];
        lane.forEach(note => {
          const start = Math.max(measure.start, note.start / QUARTER * divisions);
          const end = Math.min(measure.end, note.end / QUARTER * divisions);
          if (end <= start || start >= measure.end || end <= measure.start) return;
          const onset = Math.round(start - measure.start);
          const duration = Math.round(end - start);
          if (onset > local) events.push({ at: local, xml: restXml(Math.round(onset - local), divisions, laneIndex + 1) });
          const before = note.start / QUARTER * divisions < measure.start;
          const after = note.end / QUARTER * divisions > measure.end;
          const lyricMode = before ? (after || note.lyricMode !== 'stop' ? 'continue' : 'stop') : after && note.lyricMode === 'stop' ? 'continue' : note.lyricMode;
          const item = { ...note, voice: laneIndex + 1 };
          events.push({ at: onset, xml: noteXml(item, duration, divisions, Math.trunc(fifths), after, before, lyricMode) });
          local = Math.max(local, onset + duration);
        });
        const measureLength = measure.end - measure.start;
        if (local < measureLength) events.push({ at: local, xml: restXml(Math.round(measureLength - local), divisions, laneIndex + 1) });
        if (laneIndex > 0) voiceXml.push(`<backup><duration>${Math.round(measureLength)}</duration></backup>`);
        voiceXml.push(events.map(event => event.xml).join(''));
      });
      const barline = '<barline location="right"><bar-style>regular</bar-style></barline>';
      return `<measure number="${measureIndex + 1}">${attrs}${directionXml}${voiceXml.join('')}${barline}</measure>`;
    }).join('');
    return { id, name: track.name, xml: `<part id="${id}">${body}</part>`, track };
  });
  const partList = parts.map(part => `<score-part id="${part.id}"><part-name>${xml(part.name)}</part-name></score-part>`).join('');
  const xmlDoc = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><work><work-title>${xml(title || project.title || 'Untitled score')}</work-title></work><identification><encoding><software>SVP Vocal Score</software></encoding></identification><part-list>${partList}</part-list>${parts.map(part => part.xml).join('')}</score-partwise>`;
  const model = {
    divisions,
    measures: measures.map(measure => ({
      index: measure.index,
      start: measure.start,
      end: measure.end,
      meter: { numerator: measure.meter.numerator, denominator: measure.meter.denominator }
    })),
    tracks: outputTracks.map(track => ({
      id: track.id,
      name: track.name,
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
    model,
    merging: { enabled: Boolean(mergeContinuations), movedNoteCount: mergeResult.movedNoteCount, sourcePartCount, outputPartCount: outputTracks.length, moves: mergeResult.moves, roles },
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
