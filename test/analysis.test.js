import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScore, estimateKeys, recommendTranspose } from '../src/lib/analysis.js';

function modelFromBars(bars, trackNotes, divisions = 4) {
  const measures = bars.map((_, index) => ({
    index,
    start: index * 16,
    end: (index + 1) * 16,
    meter: { numerator: 4, denominator: 4 }
  }));
  return {
    divisions,
    measures,
    tracks: trackNotes.map((notes, index) => ({ id: `track-${index}`, name: `Track ${index}`, notes }))
  };
}

function notesForBars(patterns, lyrics = []) {
  return patterns.flatMap((pitches, barIndex) => pitches.map((pitch, noteIndex) => ({
    start: barIndex * 16 + noteIndex * 4,
    end: barIndex * 16 + noteIndex * 4 + 4,
    pitch,
    lyrics: lyrics[barIndex]?.[noteIndex] || '',
    voice: '1'
  })));
}

test('finds exact nonconsecutive patterns across tracks while flagging lyric differences', () => {
  const pattern = [
    [60, 62, 64, 65],
    [67, 69, 71, 72],
    [61, 63, 66, 68],
    [58, 60, 63, 65],
    [60, 62, 64, 65],
    [67, 69, 71, 72]
  ];
  const secondTrack = pattern.map(bar => bar.map(pitch => pitch - 12));
  const melodyLyrics = pattern.map((_, index) => Array(4).fill(index < 2 ? 'la' : index >= 4 ? 'na' : 'x'));
  const score = modelFromBars(pattern, [notesForBars(pattern, melodyLyrics), notesForBars(secondTrack)]);
  const before = structuredClone(score);

  const { repeats } = analyzeScore(score);
  const repeated = repeats.find(item => item.length === 2 && item.occurrences.length === 2 && item.occurrences[0].startMeasure === 1);
  assert.ok(repeated, 'expected the opening two bars to recur later');
  assert.deepEqual(repeated.occurrences, [
    { startMeasure: 1, endMeasure: 2 },
    { startMeasure: 5, endMeasure: 6 }
  ]);
  assert.equal(repeated.exact, true);
  assert.equal(repeated.consecutive, false);
  assert.equal(repeated.lyricsDiffer, true);
  assert.deepEqual(score, before);
});

test('detects simultaneous chords and preserves alternate Tonal interpretations', () => {
  const score = modelFromBars([[]], [
    { start: 0, end: 8, pitch: 64 },
    { start: 0, end: 8, pitch: 68 },
    { start: 0, end: 8, pitch: 71 },
    { start: 0, end: 8, pitch: 73 }
  ].map(note => [note]));

  const chord = analyzeScore(score).chords[0];
  assert.equal(chord.evidence, 'simultaneous');
  assert.deepEqual(chord.pitchClasses, [1, 4, 8, 11]);
  assert.deepEqual(chord.candidates.map(candidate => candidate.symbol), ['E6', 'C#m7/E']);
  assert.ok(chord.candidates.every(candidate => candidate.match === 1));
  assert.equal(chord.ambiguous, true);
});

test('uses within-beat aggregate evidence for arpeggiated chords', () => {
  const score = modelFromBars([[]], [[
    { start: 0, end: 1, pitch: 60 },
    { start: 1, end: 2, pitch: 64 },
    { start: 2, end: 4, pitch: 67 }
  ]]);

  const chord = analyzeScore(score).chords[0];
  assert.equal(chord.evidence, 'aggregate');
  assert.equal(chord.offset, 0);
  assert.ok(chord.candidates.some(candidate => candidate.symbol === 'CM'));
  assert.ok(chord.candidates.every(candidate => candidate.match === 0.75));
});

test('ignores rests and reports invalid grid divisions', () => {
  const score = modelFromBars([[], []], [[]], 0);
  const result = analyzeScore(score);
  assert.deepEqual(result.repeats, []);
  assert.deepEqual(result.chords, []);
  assert.equal(result.warnings.length, 1);
});

function keyModel(pitches) {
  return {
    divisions: 4,
    measures: [{ index: 0, start: 0, end: Math.max(16, pitches.length * 4), meter: { numerator: 4, denominator: 4 } }],
    tracks: [{ id: 'lead', notes: pitches.map((pitch, index) => ({ start: index * 4, end: (index + 1) * 4, pitch })) }]
  };
}

function pc(name) {
  return ({ C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 })[name];
}

function signatureTonic(fifths, mode) {
  const major = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const minor = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
  return (mode === 'major' ? major : minor)[fifths + 7];
}

test('estimates duration-weighted major and minor key candidates without claiming certainty', () => {
  const candidates = estimateKeys(keyModel([60, 62, 64, 65, 67, 69, 71]));
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every(candidate => Number.isFinite(candidate.match) && candidate.match >= -1 && candidate.match <= 1));
  assert.ok(candidates.some(candidate => candidate.tonic === 'C' && candidate.mode === 'major'));
  assert.ok(candidates.some(candidate => candidate.tonic === 'A' && candidate.mode === 'minor'));
});

test('returns no key estimate for silence or a single pitch class', () => {
  assert.deepEqual(estimateKeys(keyModel([])), []);
  assert.deepEqual(estimateKeys(keyModel([60, 72, 48, 60])), []);
});

test('returns no key estimate for a uniform chromatic pitch-class distribution', () => {
  assert.deepEqual(estimateKeys(keyModel(Array.from({ length: 12 }, (_, pitchClass) => 60 + pitchClass))), []);
});

test('recommends upward and downward global shifts while preserving intervals', () => {
  const lowNotes = [48, 52, 55, 60];
  const upward = recommendTranspose(keyModel(lowNotes));
  assert.ok(upward.semitones > 0);
  assert.equal(upward.outsideNoteCount, 0);
  assert.deepEqual(lowNotes.map(pitch => pitch + upward.semitones).slice(1).map((pitch, index) => pitch - (lowNotes[index] + upward.semitones)), [4, 3, 5]);

  const highNotes = [78, 82, 85, 88];
  const downward = recommendTranspose(keyModel(highNotes));
  assert.ok(downward.semitones < 0);
  assert.equal(downward.outsideNoteCount, 0);
  assert.deepEqual(downward.resultRange, { low: 69, high: 79 });
});

test('prefers no change when a weighted median and every note already fit', () => {
  const result = recommendTranspose(keyModel([60, 64, 67]));
  assert.equal(result.semitones, 0);
  assert.equal(result.outsideNoteCount, 0);
});

test('reports notes outside the target when the source span cannot fit in two octaves', () => {
  const result = recommendTranspose(keyModel([40, 52, 80, 92]));
  assert.ok(result.outsideNoteCount > 0);
  assert.equal(result.resultRange.high - result.resultRange.low, 52);
});

test('balances extreme pitches before long low notes can push high notes farther away', () => {
  const model = keyModel([48,96]);
  model.tracks[0].notes[0].end = model.tracks[0].notes[0].start + 1000;
  const result = recommendTranspose(model, {low:60,high:84});
  assert.equal(result.semitones,0);
  assert.equal(result.outsideNoteCount,2);
});

test('transposes the detected tonic and chooses a signature consistent with the shifted key', () => {
  const result = recommendTranspose(keyModel([48, 50, 52, 53, 55, 57, 59]));
  assert.ok(result.keyBefore);
  assert.ok(result.keyAfter);
  assert.equal(result.keyAfter.mode, result.keyBefore.mode);
  assert.equal(pc(result.keyAfter.tonic), (pc(result.keyBefore.tonic) + result.semitones + 120) % 12);
  assert.ok(result.keyAfter.fifths >= -7 && result.keyAfter.fifths <= 7);
  assert.equal(result.keyAfter.tonic, signatureTonic(result.keyAfter.fifths, result.keyAfter.mode));
});

test('validates MIDI targets and pitches and returns an empty no-op for silence', () => {
  assert.throws(() => recommendTranspose(keyModel([60]), { low: 80, high: 55 }), /Target range/);
  assert.throws(() => recommendTranspose(keyModel([128])), /integer MIDI pitches/);
  assert.deepEqual(recommendTranspose(keyModel([])), {
    semitones: 0,
    sourceRange: null,
    targetRange: { low: 55, high: 79 },
    resultRange: null,
    outsideNoteCount: 0,
    keyBefore: null,
    keyAfter: null
  });
});
