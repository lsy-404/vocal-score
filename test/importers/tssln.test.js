import test from 'node:test';
import assert from 'node:assert/strict';
import tssln from '../../src/lib/importers/tssln.js';
import { BLICKS_PER_QUARTER, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const Q = BLICKS_PER_QUARTER;
// VoiSona clocks: 960 per quarter note.
const C = 960;

// Minimal JUCE ValueTree writer mirroring ValueTree::writeToStream.
const bytes = (...parts) => {
  const arrays = parts.flat(Infinity).map(part => part instanceof Uint8Array ? part : Uint8Array.from([part]));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.length, 0));
  arrays.reduce((offset, part) => (out.set(part, offset), offset + part.length), 0);
  return out;
};
const text = value => bytes(new TextEncoder().encode(value), 0);
const compressed = value => {
  const digits = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) digits.push(rest % 256);
  return bytes(digits.length, digits);
};
const variant = (marker, payload = []) => {
  const body = bytes(marker, payload);
  return bytes(compressed(body.length), body);
};
const number = (size, write) => {
  const out = new Uint8Array(size);
  write(new DataView(out.buffer));
  return out;
};
const v = {
  int: value => variant(1, number(4, view => view.setInt32(0, value, true))),
  bool: value => variant(value ? 2 : 3),
  double: value => variant(4, number(8, view => view.setFloat64(0, value, true))),
  string: value => variant(5, text(value)),
  binary: value => variant(8, value)
};
const tree = (type, attributes = {}, children = []) => bytes(
  text(type), compressed(Object.keys(attributes).length), Object.entries(attributes).map(([key, value]) => [text(key), value]),
  compressed(children.length), children
);

const note = (clock, duration, step, octave, lyric) => tree('Note', {
  Clock: v.int(clock), Syllabic: v.int(0), PitchStep: v.int(step), PitchOctave: v.int(octave), Duration: v.int(duration), Lyric: v.string(lyric), Phoneme: v.string('')
});
const state = ({ tempos = [[0, 120]], beats = [[0, 4, 4]], notes = [] }) => tree('StateInformation', { TempoSync: v.bool(false) }, [
  tree('SongEditor', { EditorWidth: v.int(1920) }),
  tree('Song', { Version: v.int(1) }, [
    tree('Tempo', {}, tempos.map(([clock, bpm]) => tree('Sound', { Clock: v.int(clock), Tempo: v.double(bpm) }))),
    tree('Beat', {}, beats.map(([clock, beats, beatType]) => tree('Time', { Clock: v.int(clock), Beats: v.int(beats), BeatType: v.int(beatType) }))),
    tree('Score', {}, [tree('Key', { Clock: v.int(0), Fifths: v.int(0), Mode: v.int(0) }), ...notes])
  ])
]);
const voiceTrack = (name, plugin) => tree('Track', { Name: v.string(name), State: v.int(0), Type: v.int(0), PluginData: v.binary(plugin) });
const audioTrack = name => tree('Track', { Name: v.string(name), Type: v.int(2) }, [tree('AudioEvent', { Path: v.string('C:/a.wav'), Offset: v.double(0) })]);
const solution = tracks => tree('TSSolution', { VersionOfAppFileSaved: v.string('1.9.0.1') }, [
  tree('PlayControl', { Loop: v.bool(false), PlayPosition: v.double(0) }),
  tree('Tracks', {}, tracks)
]);

const simple = () => solution([voiceTrack('Voice', state({ notes: [
  note(0, C, 0, 4, 'ら'),
  note(C, C, 0, 4, 'ー'),
  note(2 * C, C, 2, 4, ''),
  note(3 * C, 2 * C, 2, 4, 'か[k,a]'),
  note(5 * C, C / 2, 11, 3, 'R')
] }))]);

test('reads VoiSona notes, lyrics and pitches and drops rests', () => {
  const result = tssln.parse(simple(), 'D:\\voisona\\demo.tssln');
  assert.equal(result.format, 'VoiSona');
  assert.equal(result.title, 'demo');
  assert.equal(result.version, '1.9.0.1');
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].name, 'Voice');
  assert.deepEqual(result.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'ら' },
    { onset: Q, duration: Q, pitch: 60, lyrics: EXTENSION_LYRIC },
    { onset: 3 * Q, duration: 2 * Q, pitch: 62, lyrics: 'か' }
  ]);
  assert.deepEqual(result.tempos, [{ position: 0, bpm: 120 }]);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
});

test('converts VoiSona tempo and beat changes', () => {
  const result = tssln.parse(solution([voiceTrack('Voice', state({
    tempos: [[0, 128], [8 * C, 96.5]],
    beats: [[0, 4, 4], [8 * C, 3, 4], [14 * C, 6, 8]],
    notes: [note(8 * C, C, 9, 4, 'あ')]
  }))]), 'tempo.tssln');
  assert.deepEqual(result.tempos, [{ position: 0, bpm: 128 }, { position: 8 * Q, bpm: 96.5 }]);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }, { index: 4, numerator: 6, denominator: 8 }]);
  assert.deepEqual(result.tracks[0].notes.map(item => [item.onset, item.pitch]), [[8 * Q, 69]]);
});

test('keeps every voice track, skips audio tracks and reads VST-wrapped plugin data', () => {
  const vstHeader = bytes(new TextEncoder().encode('VST3'), new Uint8Array(44));
  const result = tssln.parse(solution([
    voiceTrack('Lead', state({ tempos: [[0, 150]], notes: [note(0, C, 4, 4, 'は')] })),
    audioTrack('Backing'),
    voiceTrack('Harmony', bytes(vstHeader, state({ tempos: [[0, 60]], beats: [[0, 3, 4]], notes: [note(4 * C, C, 0, 5, 'る')] })))
  ]), 'tracks.tssln');
  assert.deepEqual(result.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(result.tracks[1].notes.map(item => [item.onset, item.pitch, item.lyrics]), [[4 * Q, 72, 'る']]);
  assert.notEqual(result.tracks[0].id, result.tracks[1].id);
  // Tempo and beat come from the first voice track.
  assert.deepEqual(result.tempos, [{ position: 0, bpm: 150 }]);
  assert.deepEqual(result.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
});

test('rejects truncated and malformed VoiSona files with clear errors', () => {
  const valid = simple();
  for (let length = 0; length < valid.length; length += 1) {
    assert.throws(() => tssln.parse(valid.subarray(0, length), 'cut.tssln'), /^Error: Invalid VoiSona project: /, `cut at ${length}`);
  }
  assert.throws(() => tssln.parse(new TextEncoder().encode('{"tracks": []}'), 'x.tssln'), /missing the TSSolution header/);
  assert.throws(() => tssln.parse(tree('TSSolution', {}, [tree('PlayControl')]), 'x.tssln'), /the Tracks section is missing/);
  assert.throws(() => tssln.parse(solution([voiceTrack('Voice', tree('Song'))]), 'x.tssln'), /track "Voice" has unrecognised plugin data/);
  assert.throws(() => tssln.parse(solution([voiceTrack('Voice', state({}).subarray(0, 20))]), 'x.tssln'), /plugin data of track "Voice" is truncated/);
  assert.throws(() => tssln.parse(bytes(text('TSSolution'), 0x05, 1, 2, 3, 4, 5), 'x.tssln'), /invalid number/);
  assert.throws(() => tssln.parse(bytes(text('TSSolution'), 0x01, 0xff), 'x.tssln'), /invalid item count/);
  let nested = tree('Leaf');
  for (let depth = 0; depth < 100; depth += 1) nested = tree('Node', {}, [nested]);
  assert.throws(() => tssln.parse(tree('TSSolution', {}, [nested]), 'x.tssln'), /nested too deeply/);
});
