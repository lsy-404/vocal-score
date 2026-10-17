import test from 'node:test';
import assert from 'node:assert/strict';
import ustx from '../../src/lib/importers/ustx.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);
const at = ticks => ticks * Q / 480;
const note = (position, duration, tone, lyric) => `  - position: ${position}\n    duration: ${duration}\n    tone: ${tone}\n    lyric: ${lyric}\n    pitch:\n      data: []\n      snap_first: true\n`;

const modern = `name: Spring Song
comment: ''
output_dir: Vocal
cache_dir: UCache
ustx_version: 0.6
resolution: 480
bpm: 120
beat_per_bar: 4
beat_unit: 4
expressions: {}
time_signatures:
- bar_position: 0
  beat_per_bar: 4
  beat_unit: 4
- bar_position: 2
  beat_per_bar: 3
  beat_unit: 4
tempos:
- position: 0
  bpm: 120
- position: 1920
  bpm: 90
tracks:
- singer: Teto
  phonemizer: OpenUtau.Core.DefaultPhonemizer
  track_name: Lead
- singer: Teto
  phonemizer: OpenUtau.Core.DefaultPhonemizer
  track_name: Harmony
- singer: ''
  track_name: Backing
voice_parts:
- name: Verse
  comment: ''
  track_no: 0
  position: 0
  notes:
${note(0, 480, 60, 'a')}${note(480, 480, 62, '+')}${note(960, 480, 64, 'R')}${note(1440, 480, 65, "'+~'")}
- name: Chorus
  comment: ''
  track_no: 0
  position: 3840
  notes:
${note(0, 240, 67, 'read [r iy d]')}${note(240, 240, 69, '[k a]')}${note(480, 480, 71, 'SP')}${note(960, 480, 72, "'-'")}
- name: Harmony
  comment: ''
  track_no: 1
  position: 480
  notes:
${note(0, 960, 55, 'la')}
wave_parts:
- name: Backing.wav
  track_no: 2
  position: 0
  relative_path: Backing.wav
`;

test('parses an OpenUtau project with parts, extensions, rests, tempo and meter changes', () => {
  const project = ustx.parse(encode(modern), 'spring.ustx');
  assert.deepEqual(project.tracks.map(track => track.singer ?? ''), project.tracks.map(track => track.name === 'Backing' ? '' : 'Teto'), 'each track keeps its singer; an empty singer names none');
  assert.equal(project.format, 'OpenUtau');
  assert.equal(project.title, 'Spring Song');
  assert.equal(project.version, '0.6');
  assert.deepEqual(project.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(project.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: at(480), pitch: 60, lyrics: 'a' },
    { onset: at(480), duration: at(480), pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: at(1440), duration: at(480), pitch: 65, lyrics: EXTENSION_LYRIC },
    { onset: at(3840), duration: at(240), pitch: 67, lyrics: 'read' },
    { onset: at(4080), duration: at(240), pitch: 69, lyrics: 'k a' },
    { onset: at(4800), duration: at(480), pitch: 72, lyrics: EXTENSION_LYRIC }
  ]);
  assert.deepEqual(project.tracks[1].notes.map(item => [item.onset, item.duration, item.pitch, item.lyrics]), [[at(480), at(960), 55, 'la']]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: at(1920), bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
  assert.ok(ustx.detect(encode(modern)));
});

test('reads tempo and meter from older projects and uses the file name for default project names', () => {
  const legacy = `name: New Project
ustx_version: 0.4
resolution: 960
bpm: 140
beat_per_bar: 6
beat_unit: 8
tracks:
- singer: Teto
voice_parts:
- name: Part
  track_no: 0
  position: 1920
  notes:
${note(0, 960, 60, 'ka')}${note(960, 960, 62, 'ki')}
`;
  const project = ustx.parse(encode(legacy), 'old.ustx');
  assert.equal(project.title, 'old');
  assert.deepEqual(project.tracks[0].notes.map(item => [item.onset, item.duration, item.lyrics]), [[at(960), at(480), 'ka'], [at(1440), at(480), 'ki']]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 140 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 6, denominator: 8 }]);
});

test('rejects malformed OpenUtau files', () => {
  assert.throws(() => ustx.parse(encode('name: [unclosed'), 'bad.ustx'), /Invalid OpenUtau project/);
  assert.throws(() => ustx.parse(encode('just some text'), 'bad.ustx'), /Invalid OpenUtau project/);
  assert.equal(ustx.detect(encode('[#SETTING]\nTempo=120\n')), false);
});
