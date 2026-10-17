import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { QUARTER, createScore, parseSvp } from '../src/lib/converter.js';

function makeProject(overrides = {}) {
  return {
    version: 153,
    time: { tempo: [{ position: 0, bpm: 120 }], meter: [{ index: 0, numerator: 4, denominator: 4 }] },
    library: [{ uuid: 'lib-1', name: 'Library', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la' }] }],
    tracks: [{ name: 'Voice', mainGroup: { uuid: 'main-1', notes: [] }, groups: [{ groupID: 'lib-1', blickOffset: QUARTER, pitchOffset: 2, isInstrumental: false }] }],
    ...overrides
  };
}

function emptyTuning() {
  return {
    detuneCents: 0,
    curvePointCount: 0,
    curveMode: null,
    curveRepresentativeCents: 0,
    curveApproximate: false,
    autoCurvePointCount: 0,
    autoCurveRepresentativeCents: 0,
    pitchControlCurveCount: 0,
    expression: {},
    systemExpression: {},
    referenceExpression: {},
    referenceTranspose: { cents: null, semitones: null }
  };
}

function emptyModelTuning() {
  return { ...emptyTuning(), representativeCents: 0, adjustmentSemitones: 0, residualCents: 0 };
}

test('parses BOM and trailing NUL safely and resolves reference offsets without mutating source', () => {
  const source = makeProject();
  const before = structuredClone(source);
  const parsed = parseSvp(`\uFEFF${JSON.stringify(source)}\0`);
  assert.deepEqual(parsed.tracks[0].notes[0], { onset: QUARTER, duration: QUARTER, pitch: 62, lyrics: 'la', tuning: emptyTuning() });
  assert.deepEqual(source, before);
  assert.equal(parsed.tracks[0].name, 'Voice');
  assert.throws(() => parseSvp(JSON.stringify(source).replace('"Voice"', '"Vo\0ice"')), /Invalid SVP JSON/);
});

test('uses mainRef offsets and trims for mainGroup notes exactly once', () => {
  const source = makeProject({ library: [{ uuid: 'main', notes: [
    { onset: 0, duration: QUARTER, pitch: 50, lyrics: 'duplicate' }
  ] }], tracks: [{ name: 'Main', mainGroup: { uuid: 'main', notes: [
    { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la' }
  ] }, mainRef: { groupID: 'main', blickOffset: QUARTER, pitchOffset: 3, blickAbsoluteBegin: QUARTER + QUARTER / 4, blickAbsoluteEnd: QUARTER + QUARTER * 3 / 4, isInstrumental: false }, groups: [] }] });
  const parsed = parseSvp(JSON.stringify(source));
  assert.deepEqual(parsed.tracks[0].notes[0], { onset: QUARTER + QUARTER / 4, duration: QUARTER / 2, pitch: 63, lyrics: 'la', tuning: emptyTuning() });
  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.tracks[0].notes.length, 1);
  source.tracks[0].mainRef.isInstrumental = true;
  assert.equal(parseSvp(JSON.stringify(source)).tracks.length, 0);
});

test('ignores instrumental refs, preserves reference trims, and warns for missing groups', () => {
  const source = makeProject({ tracks: [{ name: 'Mixed', mainGroup: { uuid: 'm', notes: [] }, groups: [
    { groupID: 'lib-1', blickOffset: QUARTER, pitchOffset: 0, blickAbsoluteBegin: QUARTER + QUARTER / 4, blickAbsoluteEnd: QUARTER + QUARTER * 3 / 4 },
    { groupID: 'instrument', isInstrumental: true },
    { groupID: 'missing' }
  ] }] });
  const parsed = parseSvp(JSON.stringify(source));
  assert.equal(parsed.tracks[0].notes.length, 1);
  assert.equal(parsed.tracks[0].notes[0].onset, QUARTER + QUARTER / 4);
  assert.equal(parsed.tracks[0].notes[0].duration, QUARTER / 2);
  assert.equal(parsed.tracks[0].notes[0].pitch, 60);
  assert.equal(parsed.warnings.length, 1);
});

test('creates MusicXML 4.0 with measure rests, ties across bars, and corrected octave', () => {
  const project = { title: 'A', tracks: [{ id: 'v', name: 'V', notes: [{ onset: 0, duration: QUARTER * 5, pitch: 60, lyrics: 'hello' }] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 100 }], warnings: [] };
  const result = createScore(project, { grid: 16 });
  assert.match(result.xml, /version="4\.0"/);
  assert.equal(result.stats.measureCount, 2);
  assert.equal((result.xml.match(/<tie type="start"\/>/g) || []).length, 1);
  assert.equal((result.xml.match(/<tie type="stop"\/>/g) || []).length, 1);
  const noteIds = [...result.xml.matchAll(/<note id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(noteIds).size, noteIds.length, 'every MusicXML note id must be globally unique, including tied measure segments');
  assert(noteIds.some(id => id.includes('-m0-')) && noteIds.some(id => id.includes('-m1-')), 'split note segments must identify their measure');
  assert.match(result.xml, /<step>C<\/step><octave>4<\/octave>/);
  assert.match(result.xml, /<rest\/><duration>16<\/duration><voice>1<\/voice><type>quarter<\/type><\/note><note><rest\/><duration>32<\/duration><voice>1<\/voice><type>half<\/type>/, 'rests after beat 2 keep the middle of the bar visible');
  assert.match(result.xml, /<divisions>16<\/divisions><key><fifths>0<\/fifths><\/key><time><beats>4<\/beats><beat-type>4<\/beat-type><\/time><clef>/);
  assert.match(result.xml, /<duration>64<\/duration><tie type="start"\/><voice>1<\/voice>/);
});

test('writes meter changes and tempo marks inside a measure', () => {
  const project = { tracks: [{ id: 'v', name: 'V', notes: [{ onset: 0, duration: QUARTER * 7, pitch: 69, lyrics: 'a' }] }], meters: [{ index: 0, numerator: 4, denominator: 4 }, { index: 1, numerator: 3, denominator: 4 }], tempos: [{ position: 0, bpm: 90 }, { position: QUARTER * 2, bpm: 110 }], warnings: [] };
  const { xml: output, stats } = createScore(project);
  assert.equal(stats.measureCount, 2);
  assert.match(output, /<beats>3<\/beats><beat-type>4<\/beat-type>/);
  assert.match(output, /<offset>32<\/offset><sound tempo="110"\/>/);
  assert.match(output, /<per-minute>110<\/per-minute>/);
});

test('escapes XML labels and lyrics and handles continuation lyric markers', () => {
  const project = { title: 'A&B', tracks: [{ id: 'v', name: '<Lead>', notes: [
    { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'A&B <c>' },
    { onset: QUARTER, duration: QUARTER, pitch: 62, lyrics: '+' },
    { onset: QUARTER * 2, duration: QUARTER, pitch: 64, lyrics: '+' },
    { onset: QUARTER * 3, duration: QUARTER, pitch: 65, lyrics: 'br' }
  ] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [], warnings: [] };
  const { xml: output } = createScore(project);
  assert.match(output, /A&amp;B/);
  assert.match(output, /&lt;Lead&gt;/);
  assert.match(output, /A&amp;B &lt;c&gt;/);
  assert.match(output, /<extend type="continue"\/>/);
  assert.match(output, /<extend type="start"\/>/);
  assert.match(output, /<extend type="stop"\/>/);
  assert.doesNotMatch(output, /<text>br<\/text>/);
  assert.match(output, /<duration>16<\/duration><voice>1<\/voice><type>quarter<\/type>/);
  const escapedNul = parseSvp(JSON.stringify({ ...makeProject(), library: [{ uuid: 'lib-1', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'A\0&B' }] } ] }));
  const escapedNulXml = createScore(escapedNul).xml;
  assert.match(escapedNulXml, /<text>A&amp;B<\/text>/);
  assert.doesNotMatch(escapedNulXml, /\0/);
});

test('treats lone hyphens as multi-note lyric extenders and ends them before rests', () => {
  const project = { tracks: [{ id: 'v', name: 'Voice', notes: [
    { onset: QUARTER * 3, duration: QUARTER, pitch: 60, lyrics: 'ma' },
    { onset: QUARTER * 4, duration: QUARTER, pitch: 62, lyrics: '-' },
    { onset: QUARTER * 5, duration: QUARTER, pitch: 64, lyrics: '-' },
    { onset: QUARTER * 6, duration: QUARTER, pitch: 65, lyrics: 'br' },
    { onset: QUARTER * 7, duration: QUARTER, pitch: 67, lyrics: '-' }
  ] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [], warnings: [] };
  const output = createScore(project).xml;
  assert.match(output, /<text>ma<\/text><extend type="start"\/>/);
  assert.match(output, /<extend type="continue"\/>/);
  assert.match(output, /<extend type="stop"\/>/);
  assert.doesNotMatch(output, /<text>-<\/text>/);
  assert.doesNotMatch(output, /<text>br<\/text>/);
  const afterGap = createScore({ ...project, tracks: [{ ...project.tracks[0], notes: [
    { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la' },
    { onset: QUARTER, duration: QUARTER, pitch: 62, lyrics: '-' },
    { onset: QUARTER * 3, duration: QUARTER, pitch: 64, lyrics: '-' },
    { onset: QUARTER * 4, duration: QUARTER, pitch: 65, lyrics: 'br' }
  ] }] }).xml;
  assert.equal((afterGap.match(/<extend type="continue"\/>/g) || []).length, 0);
  assert.equal((afterGap.match(/<extend type="stop"\/>/g) || []).length, 2);
});

test('preserves detune, pitch curves, and explicit versus inherited pitch expression', () => {
  const source = makeProject({
    library: [{ uuid: 'lib-1', pitchControls: [{ position: 0, pitch: 60, points: [] }], parameters: { pitchDelta: { mode: 'linear', points: [[0, 25], [QUARTER * 2, 75]] } }, notes: [
      { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la', detune: 20,
        attributes: { dF0Left: 0.25, dF0Vbr: 0.4, dF0Right: null },
        systemAttributes: { dF0Left: 0.5, dF0Right: -0.2, fF0Vbr: 'not-finite' } }
    ] }],
    tracks: [{ name: 'Voice', mainGroup: { uuid: 'main-1', notes: [] }, groups: [
      { groupID: 'lib-1', blickOffset: 0, pitchOffset: 0, isInstrumental: false,
        voice: { dF0Right: 0.3, transposeCents: 15, transposeSemitones: 1 } }
    ] }]
  });
  const before = structuredClone(source);
  const parsed = parseSvp(JSON.stringify(source));
  assert.equal(parsed.tracks[0].notes[0].pitch, 60);
  assert.equal(parsed.tracks[0].notes[0].tuning.detuneCents, 20);
  assert.equal(parsed.tracks[0].notes[0].tuning.curvePointCount, 2);
  assert.equal(parsed.tracks[0].notes[0].tuning.curveMode, 'linear');
  assert.ok(parsed.tracks[0].notes[0].tuning.curveRepresentativeCents > 25);
  assert.deepEqual(parsed.tracks[0].notes[0].tuning.expression, { dF0Left: 0.25, dF0Vbr: 0.4 });
  assert.deepEqual(parsed.tracks[0].notes[0].tuning.systemExpression, { dF0Left: 0.5, dF0Right: -0.2 });
  assert.deepEqual(parsed.tracks[0].notes[0].tuning.referenceExpression, { dF0Right: 0.3 });
  assert.deepEqual(parsed.tracks[0].notes[0].tuning.referenceTranspose, { cents: 15, semitones: 1 });
  assert.equal(parsed.tuningSummary.pitchDeltaCurves, 1);
  assert.equal(parsed.tuningSummary.pitchDeltaPoints, 2);
  assert.equal(parsed.tuningSummary.pitchControlCurves, 1);
  assert.equal(parsed.tracks[0].notes[0].tuning.pitchControlCurveCount, 1);
  assert.ok(parsed.warnings.some(warning => warning.includes('pitch curves are not represented')));
  const score = createScore(parsed);
  assert.equal(score.model.tracks[0].notes[0].pitch, 61);
  assert.ok(score.model.tracks[0].notes[0].tuning.representativeCents > 50);
  score.model.tracks[0].notes[0].tuning.expression.dF0Left = 9;
  assert.deepEqual(source, before);
});

test('applies thresholded detune symmetrically and retains residual tuning without mutating notes', () => {
  const notes = [49, 50, 51, -49, -50, -51, 160, 'not-finite'].map((detune, index) => ({
    onset: QUARTER * index,
    duration: QUARTER,
    pitch: 60,
    lyrics: `n${index}`,
    ...(detune === 'not-finite' ? { detune: null } : { detune })
  }));
  const source = makeProject({
    library: [{ uuid: 'lib-1', notes }],
    tracks: [{ name: 'V', mainGroup: { uuid: 'main-1', notes: [] }, groups: [{ groupID: 'lib-1', blickOffset: 0, pitchOffset: 0, isInstrumental: false }] }]
  });
  const before = structuredClone(source);
  const parsed = parseSvp(JSON.stringify(source));
  const result = createScore(parsed);
  assert.deepEqual(result.model.tracks[0].notes.map(note => note.pitch), [60, 61, 61, 60, 59, 59, 62, 60]);
  assert.deepEqual(result.model.tracks[0].notes.map(note => note.tuning.residualCents), [49, -50, -49, -49, 50, 49, -40, 0]);
  assert.equal(result.pitchAdjustments.adjustedNoteCount, 5);
  assert.equal(result.model.tracks[0].notes[7].tuning.detuneCents, null);
  assert.deepEqual(result.model.tracks[0].notes.map(note => [note.start, note.end]), notes.map((note, index) => [16 * index, 16 * (index + 1)]));
  assert.equal(result.stats.noteCount, notes.length);
  assert.ok(parsed.warnings.some(warning => warning.includes('non-finite note detune')));
  assert.deepEqual(source, before);
  const higherThreshold = createScore(parsed, { pitchAdjustment: { enabled: true, thresholdCents: 75 } });
  assert.equal(higherThreshold.model.tracks[0].notes[2].pitch, 60);
  const disabled = createScore(parsed, { pitchAdjustment: { enabled: false, thresholdCents: 50 } });
  assert.equal(disabled.model.tracks[0].notes[2].pitch, 60);
});

test('uses a robust curve representative and reports cubic interpolation approximation', () => {
  const source = makeProject({
    library: [{ uuid: 'lib-1', parameters: { pitchDelta: { mode: 'cubic', points: [[0, -60], [QUARTER, 0], [QUARTER * 2, 60]] } },
      notes: [{ onset: 0, duration: QUARTER * 2, pitch: 60, lyrics: 'la', detune: 0 }] }],
    tracks: [{ name: 'Voice', mainGroup: { uuid: 'main-1', notes: [] }, groups: [{ groupID: 'lib-1', isInstrumental: false }] }]
  });
  const parsed = parseSvp(JSON.stringify(source));
  assert.ok(Math.abs(parsed.tracks[0].notes[0].tuning.curveRepresentativeCents) < 5);
  const result = createScore(parsed);
  assert.equal(result.model.tracks[0].notes[0].pitch, 60);
  assert.equal(result.pitchAdjustments.approximateNoteCount, 1);
  assert.ok(result.warnings.some(warning => warning.includes('linear sampling approximation')));
});

test('samples pitch deviation on the clipped reference note range only', () => {
  const source = makeProject({
    library: [{ uuid: 'lib-1', parameters: { pitchDelta: { mode: 'linear', points: [[0, 0], [QUARTER * 4, 200]] } },
      notes: [{ onset: 0, duration: QUARTER * 4, pitch: 60, lyrics: 'la', detune: 0 }] }],
    tracks: [{ name: 'Voice', mainGroup: { uuid: 'main-1', notes: [] }, groups: [{
      groupID: 'lib-1', blickOffset: QUARTER, pitchOffset: 0, blickAbsoluteBegin: QUARTER * 2,
      blickAbsoluteEnd: QUARTER * 4, isInstrumental: false
    }] }]
  });
  const before = structuredClone(source);
  const parsed = parseSvp(JSON.stringify(source));
  const score = createScore(parsed);
  assert.equal(parsed.tracks[0].notes[0].onset, QUARTER * 2);
  assert.equal(parsed.tracks[0].notes[0].duration, QUARTER * 2);
  assert.ok(Math.abs(parsed.tracks[0].notes[0].tuning.curveRepresentativeCents - 100) < 1);
  assert.equal(score.model.tracks[0].notes[0].pitch, 61);
  assert.equal(score.model.tracks[0].notes[0].start, 32);
  assert.equal(score.model.tracks[0].notes[0].end, 64);
  assert.deepEqual(source, before);
});

test('quantizes notes, accounts for transposition, and keeps overlapping notes as voices', () => {
  const project = { tracks: [{ id: 'v', name: 'V', notes: [
    { onset: 1, duration: QUARTER, pitch: 60, lyrics: 'a' },
    { onset: QUARTER / 2, duration: QUARTER, pitch: 64, lyrics: 'b' }
  ] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [], warnings: [] };
  const result = createScore(project, { transpose: 1 });
  assert.equal(result.stats.noteCount, 2);
  assert.ok(result.warnings.some(warning => warning.includes('overlapping')));
  assert.match(result.xml, /<backup><duration>64<\/duration><\/backup>/);
  assert.match(result.xml, /<step>C<\/step><alter>1<\/alter>/);
});

test('rejects malformed project input, invalid grid, and empty track selections', () => {
  assert.throws(() => parseSvp('{broken'), /Invalid SVP JSON/);
  assert.throws(() => parseSvp('{"time":{}}'), /tracks array/);
  assert.throws(() => parseSvp(`${JSON.stringify(makeProject())}unexpected`), /Invalid SVP JSON/);
  const project = { tracks: [], meters: [], tempos: [], warnings: [] };
  assert.throws(() => createScore(project), /Select at least one/);
  assert.throws(() => createScore({ ...project, tracks: [{ id: 'v', notes: [] }] }, { trackIds: [] }), /Select at least one/);
  assert.throws(() => createScore({ ...project, tracks: [{ id: 'v', notes: [] }] }, { grid: 12 }), /Grid must/);
  assert.throws(() => createScore({ ...project, tracks: [{ id: 'v', name: 'V', notes: [{ onset: 0, duration: QUARTER, pitch: 127, lyrics: '' }] }] }, { transpose: 1 }), /MIDI range/);
  assert.throws(() => createScore({ ...project, meters: [{ index: 0, numerator: 4, denominator: 4 }], tracks: [{ id: 'v', name: 'V', notes: [{ onset: 0, duration: QUARTER, pitch: 127, lyrics: '', tuning: { detuneCents: 100 } }] }] }), /MIDI range/);
  assert.throws(() => createScore({ ...project, tracks: [{ id: 'v', name: 'V', notes: [] }] }, { pitchAdjustment: { enabled: true, thresholdCents: 0 } }), /threshold/);
});

test('warns when grid quantization shifts source note boundaries', () => {
  const project = { tracks: [{ id: 'v', name: 'V', notes: [{ onset: 1, duration: QUARTER - 2, pitch: 60, lyrics: 'a' }] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [], warnings: [] };
  const result = createScore(project, { grid: 16 });
  assert.ok(result.warnings.some(warning => warning.includes('shifted by grid quantization')));
});

test('returns a fresh canonical model aligned to quantized MusicXML timing', () => {
  const source = {
    tracks: [
      { id: 'voice', name: 'Lead', notes: [
        { onset: QUARTER / 2, duration: QUARTER, pitch: 60, lyrics: 'a' },
        { onset: QUARTER / 2, duration: QUARTER / 2, pitch: 67, lyrics: 'b' }
      ] },
      { id: 'other', name: 'Other', notes: [{ onset: 0, duration: QUARTER, pitch: 48, lyrics: 'x' }] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [{ position: QUARTER * 2, bpm: 110 }],
    warnings: []
  };
  const before = structuredClone(source);
  const result = createScore(source, { trackIds: ['voice'], transpose: 2 });
  const { tuning: firstTuning, ...firstNote } = result.model.tracks[0].notes[0];
  const { tuning: secondTuning, ...secondNote } = result.model.tracks[0].notes[1];
  assert.deepEqual(result.model, {
    divisions: 16,
    measures: [{ index: 0, start: 0, end: 64, meter: { numerator: 4, denominator: 4 } }],
    tracks: [{ id: 'voice', name: 'Lead', clef: 'treble', percussion: false, singer: '', singerChanges: [], notes: [
      { ...firstNote, tuning: emptyModelTuning() },
      { ...secondNote, tuning: emptyModelTuning() }
    ] }],
    tempos: [{ position: 32, bpm: 110 }]
  });
  assert.equal(firstTuning.representativeCents, 0);
  assert.equal(secondTuning.adjustmentSemitones, 0);
  assert.match(result.xml, /<rest\/><duration>8<\/duration>/);
  assert.match(result.xml, /<duration>16<\/duration>/);
  assert.match(result.xml, /<backup><duration>64<\/duration><\/backup>/);
  assert.deepEqual(source, before);
  result.model.measures[0].meter.numerator = 9;
  assert.equal(source.meters[0].numerator, 4);
});

test('merges disjoint lower-track notes upward and retains their provenance', () => {
  const source = {
    tracks: [
      { id: 'upper', name: 'Voice A', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'first' }] },
      { id: 'lower', name: 'Voice B', notes: [{ onset: QUARTER, duration: QUARTER, pitch: 60, lyrics: 'second' }] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const before = structuredClone(source);
  const result = createScore(source, { mergeContinuations: true });
  assert.equal(result.stats.noteCount, 2);
  assert.equal(result.stats.partCount, 1);
  assert.deepEqual(result.merging, {
    enabled: true,
    movedNoteCount: 1,
    sourcePartCount: 2,
    outputPartCount: 1,
    moves: [{ fromId: 'lower', fromName: 'Voice B', toId: 'upper', toName: 'Voice A', count: 1, kept: 0 }],
    roles: [{ id: 'upper', name: 'Voice A', role: 'mixed', overlapRatio: 0 }]
  });
  assert.deepEqual(result.model.tracks[0].notes.map(note => [note.start, note.end, note.sourceTrackId]), [
    [0, 16, 'upper'], [16, 32, 'lower']
  ]);
  assert.deepEqual(source, before);
});

test('moves a lyric extender chain as a single disjoint unit', () => {
  const project = {
    tracks: [
      { id: 'lead', name: 'Lead', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'lead' }] },
      { id: 'back', name: 'Back', notes: [
        { onset: QUARTER, duration: QUARTER, pitch: 48, lyrics: 'back' },
        { onset: QUARTER * 2, duration: QUARTER, pitch: 48, lyrics: '-' }
      ] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const result = createScore(project, { mergeContinuations: true });
  assert.equal(result.merging.movedNoteCount, 2);
  assert.equal(result.merging.moves[0].count, 2);
  assert.equal(result.stats.noteCount, 3);
  assert.equal(result.stats.partCount, 1);
  assert.match(result.xml, /<text>back<\/text><extend type="start"\/>/);
  assert.match(result.xml, /<extend type="stop"\/>/);
});

test('keeps an entire lyric extender chain when any part overlaps the target', () => {
  const project = {
    tracks: [
      { id: 'lead', name: 'Lead', notes: [{ onset: QUARTER * 2, duration: QUARTER, pitch: 60, lyrics: 'lead' }] },
      { id: 'back', name: 'Back', notes: [
        { onset: QUARTER, duration: QUARTER, pitch: 48, lyrics: 'back' },
        { onset: QUARTER * 2, duration: QUARTER, pitch: 48, lyrics: '-' }
      ] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const result = createScore(project, { mergeContinuations: true });
  assert.equal(result.merging.movedNoteCount, 0);
  assert.equal(result.stats.noteCount, 3);
  assert.equal(result.stats.partCount, 2);
  assert.deepEqual(result.model.tracks.map(track => track.notes.map(note => note.sourceTrackId)), [['lead'], ['back', 'back']]);
});

test('does not move an orphan extender across a rest in its source lane', () => {
  const project = {
    tracks: [
      { id: 'lead', name: 'Lead', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'lead' }] },
      { id: 'back', name: 'Back', notes: [
        { onset: QUARTER, duration: QUARTER, pitch: 48, lyrics: 'back' },
        { onset: QUARTER * 3, duration: QUARTER, pitch: 48, lyrics: '-' }
      ] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const result = createScore(project, { mergeContinuations: true });
  assert.equal(result.merging.movedNoteCount, 1);
  assert.equal(result.stats.noteCount, 3);
  assert.equal(result.stats.partCount, 2);
  assert.deepEqual(result.model.tracks.map(track => track.notes.map(note => note.sourceTrackId)), [['lead', 'back'], ['back']]);
  assert.doesNotMatch(result.xml, /<text>back<\/text><extend type="start"\/>/);
});

test('sorts moved early and late fragments before assigning voices', () => {
  const project = {
    tracks: [
      { id: 'upper', name: 'Upper', notes: [
        { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'a' },
        { onset: QUARTER * 2, duration: QUARTER, pitch: 62, lyrics: 'c' }
      ] },
      { id: 'lower', name: 'Lower', notes: [
        { onset: QUARTER, duration: QUARTER, pitch: 61, lyrics: 'b' },
        { onset: QUARTER * 3, duration: QUARTER, pitch: 63, lyrics: 'd' }
      ] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const before = structuredClone(project);
  const merged = createScore(project, { mergeContinuations: true });
  assert.equal(merged.stats.partCount, 1);
  assert.equal(merged.stats.noteCount, 4);
  assert.deepEqual(merged.model.tracks[0].notes.map(note => [note.start, note.voice]), [
    [0, 1], [16, 1], [32, 1], [48, 1]
  ]);
  assert.equal(merged.warnings.some(warning => warning.includes('overlapping notes')), false);
  assert.deepEqual(project, before);
});

test('keeps any note with partial or simultaneous overlap whole in its original part', () => {
  const project = {
    tracks: [
      { id: 'one', name: 'One', notes: [{ onset: 0, duration: QUARTER * 2, pitch: 60, lyrics: 'x' }] },
      { id: 'two', name: 'Two', notes: [{ onset: QUARTER, duration: QUARTER * 2, pitch: 60, lyrics: 'y' }] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const result = createScore(project, { mergeContinuations: true });
  assert.equal(result.merging.movedNoteCount, 0);
  assert.equal(result.stats.partCount, 2);
  assert.equal(result.stats.noteCount, 2);
  assert.deepEqual(result.model.tracks.map(track => track.notes.map(note => [note.start, note.end, note.pitch])), [
    [[0, 32, 60]], [[16, 48, 60]]
  ]);
  assert.equal(result.merging.roles[1].role, 'harmony');
  assert.equal(result.merging.roles[1].overlapRatio, 0.5);
});

test('skips empty upper tracks, respects selection order, and moves a chord with its phrase', () => {
  const project = {
    tracks: [
      { id: 'empty', name: 'Empty', notes: [] },
      { id: 'solo', name: 'Solo', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'a' }] },
      { id: 'split', name: 'Split', notes: [
        { onset: QUARTER * 2, duration: QUARTER, pitch: 62, lyrics: 'b' },
        { onset: QUARTER * 2, duration: QUARTER, pitch: 67, lyrics: 'c' }
      ] },
      { id: 'unselected', name: 'Ignored', notes: [{ onset: 0, duration: QUARTER, pitch: 48, lyrics: 'z' }] }
    ],
    meters: [{ index: 0, numerator: 4, denominator: 4 }],
    tempos: [],
    warnings: []
  };
  const result = createScore(project, { trackIds: ['split', 'solo', 'empty'], mergeContinuations: true });
  assert.deepEqual(result.model.tracks.map(track => track.id), ['solo']);
  assert.equal(result.merging.sourcePartCount, 3);
  assert.equal(result.merging.outputPartCount, 1);
  assert.equal(result.merging.movedNoteCount, 2, 'the two-note chord moves as one phrase instead of being split across staves');
  assert.deepEqual(result.model.tracks.flatMap(track => track.notes).map(note => note.pitch).sort((a, b) => a - b), [60, 62, 67]);
  assert.equal(result.stats.noteCount, 3);
});

// Three la's per bar on beats 1–3 in each listed bar, so every bar is one phrase.
function sungBars(id, name, bars, pitch, extra = {}) {
  return { id, name, ...extra, notes: bars.flatMap(bar => [0, 1, 2].map(beat => ({ onset: QUARTER * (bar * 4 + beat), duration: QUARTER, pitch, lyrics: 'la', ...(extra.singer ? { singer: extra.singer } : {}) }))) };
}
const barProject = tracks => ({ title: 'Sections', tracks, meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] });

test('merges a part that sings while an earlier one rests and keeps a harmony part whole', () => {
  // Verse sings bars 1–2 and Chorus bars 3–4 (one singer split over two tracks); Harmony sings through all four bars.
  const project = barProject([sungBars('verse', 'Verse', [0, 1], 64), sungBars('harmony', 'Harmony', [0, 1, 2, 3], 57), sungBars('chorus', 'Chorus', [2, 3], 65)]);
  const result = createScore(project, { mergeContinuations: true });
  assert.deepEqual(result.model.tracks.map(track => track.id), ['verse', 'harmony']);
  assert.deepEqual(result.merging.moves, [{ fromId: 'chorus', fromName: 'Chorus', toId: 'verse', toName: 'Verse', count: 6, kept: 0 }]);
  assert.ok(result.model.tracks[1].notes.every(note => note.sourceTrackId === 'harmony'), 'the harmony is not split into the verse rests');
  assert.ok(result.model.tracks.every(track => track.notes.every(note => note.voice === 1)));
});

test('lets a tunable share of overlap through and leaves the overlapping phrase in its own part', () => {
  // Chorus sings bars 5–14 and also echoes bar 1 under the verse: 3 of its 33 beats overlap (9%).
  const project = barProject([sungBars('verse', 'Verse', [0, 1, 2, 3], 64), sungBars('chorus', 'Chorus', [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 65)]);
  assert.equal(createScore(project, { mergeContinuations: true, mergeOverlap: 0 }).merging.movedNoteCount, 0, 'no overlap allowed');
  assert.equal(createScore(project, { mergeContinuations: true }).merging.movedNoteCount, 0, 'the default 5% is below 9%');
  const tolerant = createScore(project, { mergeContinuations: true, mergeOverlap: 0.1 });
  assert.deepEqual(tolerant.merging.moves, [{ fromId: 'chorus', fromName: 'Chorus', toId: 'verse', toName: 'Verse', count: 30, kept: 3 }]);
  assert.deepEqual(tolerant.model.tracks.map(track => track.notes.length), [42, 3]);
  assert.throws(() => createScore(project, { mergeOverlap: 0.8 }), /mergeOverlap/);
});

test('merges only vocal parts and leaves instrumental parts as they are', () => {
  const piano = { ...sungBars('piano', 'Piano', [2, 3], 48), instrument: { name: 'Piano', family: 'keyboard', order: 40, clef: 'bass', percussion: false } };
  const project = barProject([sungBars('verse', 'Verse', [0, 1], 64), piano, sungBars('chorus', 'Chorus', [2, 3], 65)]);
  const result = createScore(project, { mergeContinuations: true, preserveOrder: true });
  assert.equal(result.merging.enabled, true);
  assert.deepEqual(result.model.tracks.map(track => track.id), ['verse', 'piano']);
  assert.deepEqual(result.merging.moves.map(move => [move.fromId, move.toId]), [['chorus', 'verse']]);
  assert.ok(result.model.tracks[1].notes.every(note => note.sourceTrackId === 'piano'));
  assert.deepEqual(result.merging.roles.map(role => role.id), ['verse'], 'only vocal parts get a merge role');
});

test('keeps different voice banks apart unless merging across them is allowed, and marks where the voice bank changes', () => {
  const project = barProject([sungBars('a', 'A', [0, 1], 64, { singer: 'Mai' }), sungBars('b', 'B', [2, 3], 64, { singer: 'Saki' })]);
  const apart = createScore(project, { mergeContinuations: true });
  assert.equal(apart.stats.partCount, 2);
  assert.deepEqual(apart.model.tracks.map(track => [track.singer, track.singerChanges]), [['Mai', []], ['Saki', []]]);
  const merged = createScore(project, { mergeContinuations: true, mergeAcrossSingers: true });
  assert.equal(merged.stats.partCount, 1);
  assert.deepEqual(merged.model.tracks[0].singerChanges, [{ measureIndex: 2, offset: 0, singer: 'Saki' }]);
  const same = createScore(barProject([sungBars('a', 'A', [0, 1], 64, { singer: 'Mai' }), sungBars('b', 'B', [2, 3], 64, { singer: 'Mai' })]), { mergeContinuations: true });
  assert.equal(same.stats.partCount, 1, 'the same voice bank merges by default');
  assert.deepEqual(same.model.tracks[0].singerChanges, []);
  assert.throws(() => createScore(project, { mergeAcrossSingers: 'yes' }), /mergeAcrossSingers/);
});

test('reads voice banks per note group, with groups without one singing with the track', () => {
  const source = makeProject({
    library: [
      { uuid: 'own', notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'a' }] },
      { uuid: 'inherit', notes: [{ onset: 0, duration: QUARTER, pitch: 62, lyrics: 'b' }] }
    ],
    tracks: [{ name: 'Voice', mainRef: { database: { name: 'Mai' } }, mainGroup: { uuid: 'main', notes: [{ onset: 0, duration: QUARTER, pitch: 64, lyrics: 'c' }] }, groups: [
      { groupID: 'own', blickOffset: QUARTER, database: { name: 'Saki' } },
      { groupID: 'inherit', blickOffset: QUARTER * 2, database: { name: '' } }
    ] }]
  });
  const parsed = parseSvp(JSON.stringify(source));
  assert.deepEqual(parsed.tracks[0].notes.map(note => [note.lyrics, note.singer]), [['c', 'Mai'], ['a', 'Saki'], ['b', 'Mai']]);
  assert.equal(parsed.tracks[0].singer, 'Mai');
  const result = createScore(parsed);
  assert.deepEqual(result.model.tracks[0].singerChanges, [{ measureIndex: 0, offset: 16, singer: 'Saki' }, { measureIndex: 0, offset: 32, singer: 'Mai' }], 'offsets are in divisions, 16 per quarter');
});

test('reads flat Synthesizer V curve points and reports the automatic pitch without applying it', () => {
  const source = makeProject({
    library: [],
    tracks: [{ name: 'Lead', mainRef: { systemPitchDelta: { mode: 'linear', points: [0, -300, QUARTER * 2, -300] } }, mainGroup: {
      uuid: 'main', parameters: { pitchDelta: { mode: 'linear', points: [0, 120, QUARTER * 2, 120] } }, notes: [{ onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la' }]
    } }]
  });
  const parsed = parseSvp(JSON.stringify(source));
  const { tuning } = parsed.tracks[0].notes[0];
  assert.deepEqual([tuning.curvePointCount, tuning.curveRepresentativeCents, tuning.autoCurvePointCount, tuning.autoCurveRepresentativeCents], [2, 120, 2, -300]);
  assert.deepEqual([parsed.tuningSummary.pitchDeltaPoints, parsed.tuningSummary.autoPitchCurves, parsed.tuningSummary.autoPitchPoints], [2, 1, 2]);
  const result = createScore(parsed, { pitchAdjustment: { enabled: true, thresholdCents: 50 } });
  assert.equal(result.model.tracks[0].notes[0].pitch, 61, 'the manual +120 cents raises the note; the automatic −300 cents does not');
  assert.deepEqual(result.pitchAdjustments.auto, { noteCount: 1, offsetNoteCount: 1 });
  assert.equal(result.pitchAdjustments.notes[0].autoCents, -300);
});

test('sums the remaining-cents notice into one line per part', () => {
  const notes = [20, 30, 40, 60].map((detuneCents, index) => ({ onset: QUARTER * index, duration: QUARTER, pitch: 60, lyrics: 'la', tuning: { detuneCents } }));
  const result = createScore(barProject([{ id: 'v', name: 'V', notes }]), { pitchAdjustment: { enabled: true, thresholdCents: 50 } });
  assert.deepEqual(result.warnings.filter(warning => warning.includes('remaining')), ['V: 4 note(s) keep a remaining tuning deviation as metadata, not engraved.']);
});

// Notes from [onset, duration, pitch, lyrics] in quarters, as one voice in 4/4.
const quarterNotes = rows => ({ title: 'Style', tracks: [{ id: 'v', name: 'V', notes: rows.map(([onset, duration, pitch, lyrics = 'la']) => ({ onset: Math.round(QUARTER * onset), duration: Math.round(QUARTER * duration), pitch, lyrics })) }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] });
const count = (text, pattern) => (text.match(pattern) || []).length;

test('ends the last bar with a final barline', () => {
  const result = createScore(quarterNotes([[0, 1, 60], [5, 1, 62]]));
  assert.equal((result.xml.match(/<bar-style>regular<\/bar-style>/g) || []).length, 1, 'bar 1 ends with a regular barline');
  assert.match(result.xml, /<measure number="2">.*<barline location="right"><bar-style>light-heavy<\/bar-style><\/barline><\/measure><\/part>/);
});

test('writes melismas with an extender line, a slur or both, and closes a slur across a barline', () => {
  // "la" sung over three pitches, the last crossing into bar 2, then "li".
  const project = quarterNotes([[0, 2, 60, 'la'], [2, 1, 62, '-'], [3, 2, 64, '-'], [5, 1, 65, 'li']]);
  const extender = createScore(project);
  assert.doesNotMatch(extender.xml, /<slur/);
  assert.match(extender.xml, /<text>la<\/text><extend type="start"\/>/);
  const slur = createScore(project, { melisma: 'slur' });
  assert.equal(count(slur.xml, /<slur number="1" type="start" placement="above"\/>/g), 1, 'vocal slurs sit above the staff');
  assert.equal(count(slur.xml, /<slur number="1" type="stop"\/>/g), 1);
  assert.doesNotMatch(slur.xml, /<extend/, 'a slur alone draws no extender line');
  assert.match(slur.xml, /<measure number="2">.*?<tied type="stop"\/><slur number="1" type="stop"\/>/, 'the slur ends on the tied half after the barline');
  const both = createScore(project, { melisma: 'both' });
  assert.match(both.xml, /<slur number="1" type="start" placement="above"\/>.*?<extend type="start"\/>/);
  assert.throws(() => createScore(project, { melisma: 'dots' }), /melisma/);
});

test('marks triplets with a bracket, the number alone, or only until the rhythm repeats', () => {
  // Five long-short triplet beats (♩♪³) in a row, across the barline.
  const project = quarterNotes(Array.from({ length: 5 }, (_, beat) => [[beat, 2 / 3, 60], [beat + 2 / 3, 1 / 3, 62]]).flat());
  assert.equal(count(createScore(project, { triplets: true }).xml, /<tuplet type="start" bracket="yes"\/>/g), 5);
  assert.equal(count(createScore(project, { triplets: true, tupletMarks: 'number' }).xml, /<tuplet type="start" bracket="no"\/>/g), 5);
  const simile = createScore(project, { triplets: true, tupletMarks: 'simile' });
  assert.equal(count(simile.xml, /<tuplet type="start" bracket="no"\/>/g), 2, 'the first two repeats keep their number');
  assert.equal(count(simile.xml, /<tuplet type="start" bracket="no" show-number="none"\/>/g), 3, 'later repeats, also after the barline, leave it out');
  assert.throws(() => createScore(project, { tupletMarks: 'stars' }), /tupletMarks/);
});

test('writes long-short triplets as straight eighths under a Swing marking and warns about straight eighths', () => {
  // Five swung beats, then one beat of straight eighths.
  const project = quarterNotes([...Array.from({ length: 5 }, (_, beat) => [[beat, 2 / 3, 60], [beat + 2 / 3, 1 / 3, 62]]).flat(), [5, 0.5, 64], [5.5, 0.5, 65]]);
  const swung = createScore(project, { swing: true });
  assert.equal(swung.swing.beatCount, 5);
  assert.doesNotMatch(swung.xml, /<tuplet/);
  assert.equal(count(swung.xml, /<type>eighth<\/type>/g), 12, 'every beat is two straight eighths');
  assert.match(swung.xml, /<measure number="1"><attributes>.*?<\/attributes><direction placement="above"><direction-type><words font-weight="bold">Swing \(♫ = ♩♪³\)<\/words><\/direction-type><sound><swing><first>2<\/first><second>1<\/second><swing-type>eighth<\/swing-type><\/swing><\/sound><\/direction>/);
  assert.deepEqual(swung.warnings.filter(warning => warning.startsWith('Swing')), ['Swing notation: 1 beat(s) with straight eighths will read as swung.']);
  const plain = createScore(project, { triplets: true });
  assert.equal(plain.swing.beatCount, 0);
  assert.doesNotMatch(plain.xml, /Swing/);
  assert.throws(() => createScore(project, { swing: 'yes' }), /swing/);
});

test('merges automatically note by note: held notes join, short endings are glides or ornaments, longer notes stay', () => {
  // la (C4) with a 32nd glide up to D4 before "li" on D4; lu (E4) with a 32nd turn down before "le" on F4;
  // le held as "-" at the same pitch; wo with an eighth "-" at another pitch, a real melisma.
  const project = quarterNotes([[0, 7 / 8, 60, 'la'], [7 / 8, 1 / 8, 62, '-'], [1, 1, 62, 'li'], [2, 7 / 8, 64, 'lu'], [2 + 7 / 8, 1 / 8, 63, '-'], [3, 0.5, 65, 'le'], [3.5, 0.5, 65, '-'], [4, 0.5, 67, 'wo'], [4.5, 0.5, 69, '-']]);
  const style = glides => createScore(project, { grid: 32, noteMerge: 'auto', glides });
  const line = style('line');
  assert.deepEqual([line.noteMerge.mergedCount, line.noteMerge.glideCount, line.noteMerge.ornamentCount, line.stats.noteCount], [3, 1, 1, 6]);
  assert.match(line.xml, /<slide number="1" type="start" line-type="solid"\/><\/notations><lyric><text>la<\/text>/, 'a slide leaves the glide\'s syllable');
  assert.match(line.xml, /<slide number="1" type="stop"\/><\/notations><lyric><text>li<\/text>/, 'and lands on the next syllable');
  assert.equal(count(line.xml, /<slide number="1" type="start"/g), 1, 'an ornament gets no slide');
  const grace = style('grace');
  assert.equal(count(grace.xml, /<grace slash="yes"\/>/g), 2);
  assert.match(grace.xml, /<grace slash="yes"\/><pitch><step>D<\/step><octave>4<\/octave><\/pitch>.*?<text>li<\/text>/);
  const absorb = style('absorb');
  assert.equal(count(absorb.xml, /<slide|<grace/g), 0);
  assert.equal(absorb.stats.noteCount, 6);
  const keep = style('keep');
  assert.deepEqual([keep.noteMerge.glideCount, keep.noteMerge.ornamentCount, keep.stats.noteCount], [0, 0, 8], 'only the held note joins');
  assert.equal(line.model.tracks[0].notes.at(-1).lyrics, '-', 'the eighth at another pitch stays a melisma note');
  assert.throws(() => createScore(project, { glides: 'blur' }), /glides/);
});

function rhythmProject(notes, meter = { index: 0, numerator: 4, denominator: 4 }, tempos = [{ position: 0, bpm: 120 }]) {
  let onset = 0;
  return { title: 'Rhythm', tracks: [{ id: 'v', name: 'V', notes: notes.map(([duration, pitch = 60]) => {
    const note = { onset, duration: QUARTER * duration, pitch, lyrics: 'la' };
    onset += QUARTER * duration;
    return note;
  }).filter(note => note.pitch !== null) }], meters: [meter], tempos, warnings: [] };
}
const noteTags = xml => [...xml.matchAll(/<note(?: id="[^"]*")?>(.*?)<\/note>/g)].map(match => match[1]);
const beamsOf = note => [...note.matchAll(/<beam number="(\d)">([^<]+)<\/beam>/g)].map(match => `${match[1]}:${match[2]}`).join(' ');

test('beams eighths and sixteenths by beat, joining plain eighths across a half bar', () => {
  const { xml } = createScore(rhythmProject([[0.5], [0.5], [0.5], [0.5], [0.25], [0.25], [0.25], [0.25], [0.5], [0.5]]));
  const notes = noteTags(xml);
  assert.deepEqual(notes.slice(0, 4).map(beamsOf), ['1:begin', '1:continue', '1:continue', '1:end']);
  assert.deepEqual(notes.slice(4, 8).map(beamsOf), ['1:begin 2:begin', '1:continue 2:continue', '1:continue 2:continue', '1:end 2:end']);
  assert.deepEqual(notes.slice(8, 10).map(beamsOf), ['1:begin', '1:end']);
});

test('writes dotted rhythms with hooks and splits off-beat notes at the beat', () => {
  const dotted = noteTags(createScore(rhythmProject([[0.75], [0.25], [0.25], [0.75], [2]])).xml);
  assert.match(dotted[0], /<type>eighth<\/type><dot\/><beam number="1">begin<\/beam>/);
  assert.equal(beamsOf(dotted[1]), '1:end 2:backward hook');
  assert.equal(beamsOf(dotted[2]), '1:begin 2:forward hook');
  assert.match(dotted[3], /<type>eighth<\/type><dot\/><beam number="1">end<\/beam>/);
  const typeOf = note => note.match(/<type>([^<]+)<\/type>/)[1];
  const syncopated = noteTags(createScore(rhythmProject([[0.5], [1], [1], [1], [0.5]])).xml);
  assert.deepEqual(syncopated.map(typeOf), ['eighth', 'quarter', 'eighth', 'eighth', 'quarter', 'eighth'], 'off-beat quarters stay whole within a half bar and are tied across its middle');
  assert.match(syncopated[2], /<tie type="start"\/>/);
  assert.match(syncopated[3], /<tie type="stop"\/>/);
  const sixteenths = noteTags(createScore(rhythmProject([[0.75], [0.5], [0.75], [2]])).xml);
  assert.deepEqual(sixteenths.slice(0, 4).map(typeOf), ['eighth', '16th', '16th', 'eighth'], 'notes crossing a beat at sixteenth offsets are split at the beat');
  const dottedQuarter = noteTags(createScore(rhythmProject([[1.5], [0.5], [2]])).xml);
  assert.match(dottedQuarter[0], /<type>quarter<\/type><dot\/>/, 'a dotted quarter starting on a beat stays one value');
});

test('groups compound meters by dotted quarter', () => {
  const { xml } = createScore(rhythmProject([[0.5], [0.5], [0.5], [0.5], [0.5], [0.5]], { index: 0, numerator: 6, denominator: 8 }));
  assert.deepEqual(noteTags(xml).map(beamsOf), ['1:begin', '1:continue', '1:end', '1:begin', '1:continue', '1:end']);
});

test('reduces tempo ramps and step pairs to readable marks', () => {
  const ramp = Array.from({ length: 30 }, (_, index) => ({ position: QUARTER * 8 + index * QUARTER / 8, bpm: 133 - index * 0.5 }));
  const tempos = [{ position: 0, bpm: 133 }, ...ramp, { position: QUARTER * 16 - 1000, bpm: 150.4 }, { position: QUARTER * 16, bpm: 150 }];
  const { xml } = createScore(rhythmProject([[20]], undefined, tempos));
  assert.deepEqual([...xml.matchAll(/<per-minute>([^<]+)<\/per-minute>/g)].map(match => match[1]), ['133', '119', '150']);
  assert.equal((xml.match(/<words font-style="italic">rit\.<\/words>/g) || []).length, 1);
  assert.doesNotMatch(xml, /<per-minute>\d+\.\d+/);
});

test('detects a sustained modulation and writes the new key signature', () => {
  const cMajor = [60, 62, 64, 65, 67, 69, 71, 72];
  const notes = [...Array.from({ length: 64 }, (_, index) => [0.5 * 2, cMajor[index % 8]]), ...Array.from({ length: 32 }, (_, index) => [1, cMajor[index % 8] + 1])];
  const project = rhythmProject(notes);
  const plain = createScore(project);
  assert.equal(plain.keyChanges.length, 0, 'modulation detection is opt-in');
  const detected = createScore(project, { modulation: true });
  assert.deepEqual(detected.keyChanges, [{ measureIndex: 16, fifths: -5 }]);
  assert.match(detected.xml, /<measure number="17"><attributes><key><fifths>-5<\/fifths><\/key><\/attributes>/);
  assert.match(detected.xml, /<measure number="17">.*?<step>D<\/step><alter>-1<\/alter>/, 'notes after the change are spelled in the new key');
  const passing = createScore(rhythmProject([...Array.from({ length: 60 }, (_, index) => [1, cMajor[index % 8]]), [1, 66], [1, 67], [1, 68], [1, 69]]), { modulation: true });
  assert.equal(passing.keyChanges.length, 0, 'a few chromatic notes do not change the key');
});

test('lays out instrumental tracks as a score with chords, clefs and unpitched percussion', () => {
  const track = (id, name, instrument, notes) => ({ id, name, instrument, notes: notes.map(([onset, duration, pitch]) => ({ onset: QUARTER * onset, duration: QUARTER * duration, pitch, lyrics: '' })) });
  const project = { title: 'Ensemble', meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 90 }], warnings: [], tracks: [
    track('vc', 'Cello', { name: 'Cello', family: 'strings', order: 62, clef: 'bass', percussion: false }, [[0, 4, 36]]),
    track('drums', 'Kit', { name: 'Kit', family: 'percussion', order: 36, clef: 'percussion', percussion: true }, [[0, 1, 36], [0, 1, 42], [1, 1, 38]]),
    track('fl', 'Flute', { name: 'Flute', family: 'woodwind', order: 11, clef: 'treble', percussion: false }, [[0, 2, 72], [0, 2, 76], [0, 2, 79], [2, 2, 74]]),
  ] };
  const result = createScore(project, { mergeContinuations: true, fifths: 3 });
  assert.deepEqual(result.parts.map(part => part.name), ['Flute', 'Kit', 'Cello'], 'parts follow score order');
  assert.equal(result.merging.enabled, false, 'instrumental parts are never merged');
  assert.equal(result.warnings.some(warning => warning.includes('voices')), false, 'simultaneous notes form chords, not extra voices');
  const parts = [...result.xml.matchAll(/<part id="P\d">(.*?)<\/part>/g)].map(match => match[1]);
  assert.equal((parts[0].match(/<chord\/>/g) || []).length, 2, 'a three-note flute chord');
  assert.match(parts[1], /<clef><sign>percussion<\/sign><\/clef>/);
  assert.match(parts[1], /<key><fifths>0<\/fifths><\/key>/, 'drum staves have no key signature');
  assert.match(parts[0], /<key><fifths>3<\/fifths><\/key>/);
  assert.match(parts[1], /<unpitched><display-step>F<\/display-step><display-octave>4<\/display-octave><\/unpitched>/, 'kick drum below the staff middle');
  assert.match(parts[1], /<notehead>x<\/notehead>/, 'cymbals use x noteheads');
  assert.match(parts[2], /<clef><sign>F<\/sign><line>4<\/line><\/clef>/, 'cello uses the bass clef');
  assert.deepEqual(result.model.tracks.map(item => item.clef), ['treble', 'percussion', 'bass']);
});

test('folds continuation notes into the previous syllable according to the merge level', () => {
  // la, "-" at the same pitch, the vowel "a" sung again lower then held, a sixteenth "-" flick, then the next syllable.
  const notes = [[0, 1, 60, 'la'], [1, 1, 60, '-'], [2, 1, 62, 'a'], [3, 1, 62, 'a'], [4, 0.25, 67, '-'], [4.25, 0.75, 65, 'lo']];
  const project = { title: 'Merge', tracks: [{ id: 'v', name: 'V', notes: notes.map(([onset, duration, pitch, lyrics]) => ({ onset: QUARTER * onset, duration: QUARTER * duration, pitch, lyrics })) }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] };
  const results = Object.fromEntries(['none', 'low', 'medium', 'high'].map(level => [level, createScore(project, { noteMerge: level })]));
  assert.deepEqual(Object.values(results).map(result => result.noteMerge.mergedCount), [0, 1, 3, 4]);
  assert.deepEqual(Object.values(results).map(result => result.stats.noteCount), [6, 5, 4, 3]);
  assert.match(results.low.xml, /<duration>32<\/duration><voice>1<\/voice><type>half<\/type>.*?<text>la<\/text>/, 'la and its same-pitch extension become one half note');
  assert.match(results.low.xml, /<text>a<\/text>/, 'low keeps a repeated vowel as written');
  assert.doesNotMatch(results.medium.xml, /<text>a<\/text>/, 'medium sings the repeated vowel as a melisma of la');
  assert.throws(() => createScore(project, { noteMerge: 'max' }), /noteMerge/);
});

test('keeps a monophonic line in one voice when short notes snap onto their neighbours', () => {
  const twelfth = QUARTER / 12;
  const notes = [
    { onset: 0, duration: twelfth, pitch: 60, lyrics: 'xi' }, { onset: twelfth, duration: QUARTER - twelfth, pitch: 62, lyrics: '.iA N' },
    { onset: QUARTER, duration: twelfth, pitch: 64, lyrics: '-' }, { onset: QUARTER + twelfth, duration: QUARTER * 2, pitch: 65, lyrics: 'chun' }
  ];
  const project = { title: 'Snap', tracks: [{ id: 'v', name: 'V', notes }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] };
  const result = createScore(project);
  assert.equal(result.warnings.some(warning => warning.includes('voices')), false, 'snapped notes stay in one voice');
  assert(result.warnings.includes('V: 2 very short note(s) merged into a neighbour at this rhythm grid.'));
  assert.deepEqual(result.model.tracks[0].notes.map(note => [note.lyrics, note.pitch]), [['xi', 62], ['chun', 65]], 'the syllable comes from the earlier note, the pitch from the longer one');
});

test('ignores tuning parameters when pitch adjustment is off and keeps a given part order', () => {
  const tuned = { onset: 0, duration: QUARTER, pitch: 60, lyrics: 'la', tuning: { detuneCents: 70, curvePointCount: 4, curveMode: 'cubic', curveRepresentativeCents: 0, curveApproximate: true } };
  const project = { title: 'Tuning', tracks: [{ id: 'v', name: 'V', notes: [tuned] }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] };
  const off = createScore(project, { pitchAdjustment: { enabled: false, thresholdCents: 50 } });
  assert.equal(off.model.tracks[0].notes[0].pitch, 60);
  assert.equal(off.warnings.some(warning => /pitch curve|cent tuning/.test(warning)), false, 'no tuning warnings when parameters are ignored');
  assert.equal(createScore(project).model.tracks[0].notes[0].pitch, 61, 'parameters move the note when considered');
  const ensemble = { ...project, tracks: [
    { id: 'vc', name: 'Cello', instrument: { order: 62, clef: 'bass' }, notes: [{ onset: 0, duration: QUARTER, pitch: 40, lyrics: '' }] },
    { id: 'fl', name: 'Flute', instrument: { order: 11, clef: 'treble' }, notes: [{ onset: 0, duration: QUARTER, pitch: 72, lyrics: '' }] }
  ] };
  assert.deepEqual(createScore(ensemble).parts.map(part => part.name), ['Flute', 'Cello']);
  assert.deepEqual(createScore(ensemble, { preserveOrder: true }).parts.map(part => part.name), ['Cello', 'Flute']);
});

test('writes triplet beats under a 3:2 bracket and leaves straight rhythms alone', () => {
  const third = QUARTER / 3;
  const project = timeline => ({ title: 'Triplets', tracks: [{ id: 'v', name: 'V', notes: timeline.map(([onset, duration], index) => ({ onset, duration, pitch: 60 + index, lyrics: 'la' })) }], meters: [{ index: 0, numerator: 4, denominator: 4 }], tempos: [{ position: 0, bpm: 120 }], warnings: [] });
  // A swung quarter–eighth triplet, three triplet eighths, two straight eighths and a quarter.
  const swung = project([[0, 2 * third], [2 * third, third], [QUARTER, third], [QUARTER + third, third], [QUARTER + 2 * third, third], [QUARTER * 2, QUARTER / 2], [QUARTER * 2.5, QUARTER / 2], [QUARTER * 3, QUARTER]]);
  assert(createScore(swung).warnings.includes('V: 5 note(s) shifted by grid quantization.'), 'triplets are opt-in');
  const result = createScore(swung, { triplets: true });
  assert.equal(result.warnings.some(warning => warning.includes('shifted')), false);
  assert.deepEqual(result.triplets, { enabled: true, beatCount: 2 });
  assert.equal(result.model.divisions, 48);
  const notes = noteTags(result.xml);
  const valueOf = note => `${note.match(/<type>([^<]+)<\/type>/)[1]}${note.includes('<time-modification>') ? '/3' : ''}`;
  assert.deepEqual(notes.map(valueOf), ['quarter/3', 'eighth/3', 'eighth/3', 'eighth/3', 'eighth/3', 'eighth', 'eighth', 'quarter']);
  assert.match(notes[0], /<duration>32<\/duration>.*<time-modification><actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes><\/time-modification>.*<tuplet type="start" bracket="yes"\/>/);
  assert.match(notes[1], /<tuplet type="stop"\/>/);
  assert.deepEqual(notes.slice(2, 5).map(beamsOf), ['1:begin', '1:continue', '1:end'], 'triplet eighths share one beam');
  assert.deepEqual(notes.slice(5, 7).map(beamsOf), ['1:begin', '1:end']);
  // A note crossing into the next triplet beat is tied, and rests inside triplet beats are triplet values too.
  const crossing = noteTags(createScore(project([[0, third], [2 * third, 2 * third], [QUARTER * 2, QUARTER * 2]]), { triplets: true }).xml);
  assert.deepEqual(crossing.map(note => `${note.includes('<rest/>') ? 'rest ' : ''}${valueOf(note)}`), ['eighth/3', 'rest eighth/3', 'eighth/3', 'eighth/3', 'rest quarter/3', 'half']);
  assert.match(crossing[2], /<tie type="start"\/>.*<tuplet type="stop"\/>/);
  assert.match(crossing[3], /<tie type="stop"\/>.*<tuplet type="start" bracket="yes"\/>/);
  assert.match(crossing[4], /<tuplet type="stop"\/>/);
  const straight = rhythmProject([[0.5], [0.5], [0.25], [0.25], [0.5], [0.75], [0.25], [1]]);
  assert.equal(createScore(straight, { triplets: true }).xml, createScore(straight).xml, 'straight rhythms are written exactly as without triplets');
  const late = QUARTER / 4 + QUARTER / 24;
  const slightlyLate = project([[0, late], [late, QUARTER - late], [QUARTER, QUARTER * 3]]);
  assert.equal(createScore(slightlyLate, { triplets: true }).triplets.beatCount, 0, 'a slightly late sixteenth does not become a triplet');
  assert.throws(() => createScore(swung, { triplets: 'yes' }), /triplets/);
});

const sampleFiles = (process.env.SVP_SAMPLE_FILES || '').split(';').filter(Boolean);
if (!sampleFiles.length) {
  test('converts configured local SVP files when present', t => t.skip('Set SVP_SAMPLE_FILES to semicolon-separated local input paths.'));
}
for (const file of sampleFiles) {
  test(`converts local ${file.split('\\').at(-1)} when present`, async t => {
    let text;
    try { text = await readFile(file, 'utf8'); } catch { t.skip('Local source file is unavailable.'); return; }
    const project = parseSvp(text, file);
    assert.ok(project.tracks.length > 0);
    const output = createScore(project, { trackIds: [project.tracks[0].id] });
    assert.ok(output.stats.noteCount > 0);
    assert.match(output.xml, /score-partwise/);
    const signatures = score => score.model.tracks.flatMap(track => track.notes.map(note => `${note.start}:${note.end}:${note.pitch}:${note.lyrics}:${note.sourceTrackId}`)).sort();
    const overlaps = notes => { let end = -Infinity; return [...notes].sort((a, b) => a.onset - b.onset).some(note => { const hit = note.onset < end; end = Math.max(end, note.onset + note.duration); return hit; }); };
    const monophonic = new Set(project.tracks.filter(track => !overlaps(track.notes)).map(track => track.id));
    assert.ok(monophonic.size > 0);
    for (const triplets of [false, true]) {
      const original = createScore(project, { triplets });
      const merged = createScore(project, { triplets, mergeContinuations: true });
      assert.equal(merged.stats.noteCount, original.stats.noteCount);
      assert.equal(merged.stats.measureCount, original.stats.measureCount);
      assert.deepEqual(signatures(merged), signatures(original));
      // A source track whose notes never overlap must stay in one voice after grid snapping; real chords may not.
      assert.ok(original.model.tracks.filter(track => monophonic.has(track.id)).every(track => track.notes.every(note => note.voice === 1)));
      assert.equal(original.warnings.some(warning => project.tracks.some(track => monophonic.has(track.id) && warning.startsWith(`${track.name}: overlapping notes`))), false);
    }
  });
}
