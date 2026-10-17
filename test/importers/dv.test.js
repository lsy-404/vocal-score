import test from 'node:test';
import assert from 'node:assert/strict';
import dv from '../../src/lib/importers/dv.js';
import { BLICKS_PER_QUARTER, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const Q = BLICKS_PER_QUARTER;
const ALL_FEATURES = [1, 2, 3, 4, 5, 6, 7];
// Four 4/4 lead-in measures of 480-tick quarters precede the song start.
const LEAD_IN = 4 * 4 * 480;

// Minimal writer mirroring the DeepVocal layout: little-endian int32s, length-prefixed strings and blocks.
const bytes = (...parts) => {
  const arrays = parts.flat(Infinity).map(part => part instanceof Uint8Array ? part : Uint8Array.from([part]));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.length, 0));
  arrays.reduce((offset, part) => (out.set(part, offset), offset + part.length), 0);
  return out;
};
const int = value => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return out;
};
const ascii = text => new TextEncoder().encode(text);
const block = (...parts) => {
  const body = bytes(...parts);
  return bytes(int(body.length), body);
};
const str = text => block(new TextEncoder().encode(text));
const list = items => block(int(items.length), ...items);
const curve = (points = []) => list(points.map(([x, y]) => bytes(int(x), int(y))));

function note({ start, length = 480, key = 115 - 60, phoneme = 'la', word = '啦' }, features) {
  return bytes(
    int(start), int(length), int(key), int(50), str(phoneme), str(word), 0,
    block(curve([[-1, 0], [100001, 0]]), curve([[-1, 0], [100001, 0]]), curve([[0, 0], [1124, 0]])),
    list([]),
    features.includes(1) ? new Uint8Array(18) : [],
    features.includes(2) ? bytes(int(8), int(5), int(16), int(16)) : [],
    features.includes(4) ? int(-1) : [],
    features.includes(7) ? bytes(str(''), int(-1)) : []
  );
}

function segment({ start = LEAD_IN, notes }, features) {
  const extraCurves = [3, 5, 6, 7].filter(n => features.includes(n)).map(() => curve());
  return bytes(int(start), int(1920), str('segment'), str('voice bank'), list(notes.map(item => note(item, features))), curve(), curve([[0, 6000]]), curve(), extraCurves);
}

const singingTrack = (name, segments, features) => bytes(int(0), str(name), 0, 0, int(30), int(0), list(segments.map(item => segment(item, features))));
const audioTrack = name => bytes(int(1), str(name), 0, 0, int(30), int(0), list([bytes(int(0), int(1920), str('clip'), str('C:/audio/clip.wav'))]));

function project({ features = ALL_FEATURES, tempos = [[0, 120]], meters = [[-3, 4, 4]], tracks }) {
  const body = bytes(
    ascii(features.map(n => `ext${n}`).join('')),
    list(tempos.map(([tick, bpm]) => bytes(int(tick), int(Math.round(bpm * 100))))),
    list(meters.map(([measure, numerator, denominator]) => bytes(int(measure), int(numerator), int(denominator)))),
    int(tracks.length),
    tracks.map(track => typeof track === 'function' ? track(features) : track)
  );
  return bytes(ascii('SHARPKEY'), int(5), block(body));
}

const simple = features => singingTrack('Vocal', [{ notes: [
  { start: 0, word: '你', phoneme: 'ni' },
  { start: 480, word: '-', phoneme: '-' },
  { start: 960, word: '', phoneme: 'R' },
  { start: 1440, word: '', phoneme: 'hao', key: 115 - 62, length: 960 }
] }], features);

test('reads DeepVocal notes, lyrics and pitches and drops rests', () => {
  const result = dv.parse(project({ tracks: [simple] }), 'C:/songs/demo.dv');
  assert.equal(result.tracks[0].singer, 'voice bank', 'each segment names its voice bank');
  assert.equal(result.format, 'DeepVocal');
  assert.equal(result.title, 'demo');
  assert.equal(result.version, 5);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].name, 'Vocal');
  assert.deepEqual(result.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: Q, pitch: 60, lyrics: '你' },
    { onset: Q, duration: Q, pitch: 60, lyrics: EXTENSION_LYRIC },
    { onset: 3 * Q, duration: 2 * Q, pitch: 62, lyrics: 'hao' }
  ]);
  assert.deepEqual(result.tempos, [{ position: 0, bpm: 120 }]);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
  assert.deepEqual(result.warnings, []);
});

test('reads files that only use some of the optional feature fields', () => {
  for (const features of [[], [1, 2], [3, 5, 6], [4, 7]]) {
    const result = dv.parse(project({ features, tracks: [simple] }), 'partial.dv');
    assert.deepEqual(result.tracks[0].notes.map(item => item.lyrics), ['你', EXTENSION_LYRIC, 'hao'], `features ${features}`);
  }
});

test('converts tempo and time signature changes and drops the lead-in measures', () => {
  const result = dv.parse(project({
    tempos: [[0, 100], [960, 110], [LEAD_IN + 1920, 90.5]],
    meters: [[-3, 4, 4], [3, 3, 4], [5, 6, 8]],
    tracks: [features => singingTrack('Vocal', [{ notes: [{ start: 0 }] }], features)]
  }), 'meters.dv');
  assert.deepEqual(result.tempos, [{ position: 0, bpm: 110 }, { position: 4 * Q, bpm: 90.5 }]);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }, { index: 4, numerator: 6, denominator: 8 }]);
  assert.match(result.warnings.join('\n'), /Ignored 1 tempo change/);
});

test('uses time signatures inside the lead-in to find the song start', () => {
  const result = dv.parse(project({
    meters: [[-3, 3, 4], [-1, 2, 4]],
    tracks: [features => singingTrack('Vocal', [{ start: 2 * 1440 + 2 * 960, notes: [{ start: 0 }] }], features)]
  }), 'lead-in.dv');
  assert.equal(result.tracks[0].notes[0].onset, 0);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 2, denominator: 4 }]);
  assert.match(result.warnings.join('\n'), /Ignored 1 time signature/);
});

test('applies segment offsets, keeps every singing track and skips audio tracks', () => {
  const result = dv.parse(project({ tracks: [
    features => singingTrack('Lead', [{ start: LEAD_IN, notes: [{ start: 0 }] }, { start: LEAD_IN + 1920, notes: [{ start: 480, word: '好' }] }], features),
    audioTrack('Backing'),
    features => singingTrack('Harmony', [{ start: LEAD_IN + 960, notes: [{ start: 0, key: 115 - 55 }] }], features)
  ] }), 'tracks.dv');
  assert.deepEqual(result.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(result.tracks[0].notes.map(item => [item.onset, item.lyrics]), [[0, '啦'], [5 * Q, '好']]);
  assert.deepEqual(result.tracks[1].notes.map(item => [item.onset, item.pitch]), [[2 * Q, 55]]);
  assert.notEqual(result.tracks[0].id, result.tracks[1].id);
});

test('rejects truncated and malformed DeepVocal files with clear errors', () => {
  const valid = project({ tracks: [simple, audioTrack('Backing')] });
  for (let length = 0; length < valid.length; length += 1) {
    assert.throws(() => dv.parse(valid.subarray(0, length), 'cut.dv'), /^Error: Invalid DeepVocal project: /, `cut at ${length}`);
  }
  assert.throws(() => dv.parse(ascii('NOTADEEPVOCALFILE'), 'x.dv'), /missing the SHARPKEY signature/);

  const hugeCount = project({ tracks: [simple] });
  const view = new DataView(hugeCount.buffer);
  const trackCountOffset = hugeCount.length - simple(ALL_FEATURES).length - 4;
  view.setInt32(trackCountOffset, 0x7fffffff, true);
  assert.throws(() => dv.parse(hugeCount, 'x.dv'), /the track count 2147483647 is out of range/);
  view.setInt32(trackCountOffset, -1, true);
  assert.throws(() => dv.parse(hugeCount, 'x.dv'), /the track count -1 is out of range/);

  // Notes written with every feature field but a header that announces none no longer line up.
  const mismatched = project({ tracks: [simple] });
  mismatched.set(ascii('xxxx'), 16);
  assert.throws(() => dv.parse(mismatched, 'x.dv'), /Invalid DeepVocal project: /);
  const noFeatures = bytes(ascii('SHARPKEY'), int(5), block(list([]), list([]), int(1), simple(ALL_FEATURES)));
  assert.throws(() => dv.parse(noFeatures, 'x.dv'), /Invalid DeepVocal project: /);
});
