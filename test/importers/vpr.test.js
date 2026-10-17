import './dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import vpr from '../../src/lib/importers/vpr.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));
const pack = (sequence, path = 'Project/sequence.json') => zipSync({ [path]: strToU8(JSON.stringify(sequence)), 'Project/Audio/a.wav': new Uint8Array(4) });

const sequence = () => ({
  version: { major: 5, minor: 0, revision: 2 },
  vender: 'Yamaha Corporation',
  title: 'Demo Song',
  masterTrack: {
    samplingRate: 44100,
    loop: { isEnabled: false, begin: 0, end: 7680 },
    tempo: { isFolded: false, height: 0, global: { isEnabled: false, value: 12000 }, events: [{ pos: 0, value: 12000 }, { pos: 1920, value: 9000 }] },
    timeSig: { isFolded: false, events: [{ bar: 0, numer: 4, denom: 4 }, { bar: 2, numer: 6, denom: 8 }] }
  },
  voices: [{ compID: 'BCNFCY43LB2LZCD4', name: 'VY1V5' }],
  tracks: [
    {
      type: 0, name: 'Vocal', color: 0, busNo: 0,
      parts: [
        {
          pos: 1920, duration: 1920, styleName: 'No Effect',
          notes: [
            { lyric: 'a', phoneme: 'a', isProtected: false, pos: 0, duration: 480, number: 60, velocity: 64 },
            { lyric: '-', phoneme: 'a', pos: 480, duration: 480, number: 62, velocity: 64 },
            { lyric: 'i', phoneme: 'i', pos: 1680, duration: 480, number: 64, velocity: 64 },
            { lyric: 'e', phoneme: 'e', pos: 1920, duration: 480, number: 65, velocity: 64 }
          ]
        },
        { pos: 7680, duration: 960, notes: [{ lyric: 'u', pos: 0, duration: 240, number: 67 }] }
      ]
    },
    { type: 1, name: 'Audio', parts: [{ pos: 0, duration: 1920, name: 'wav', wav: { name: 'a.wav', originalName: 'a.wav' } }] },
    { type: 0, name: 'Harmony', parts: [{ pos: 0, duration: 1920, notes: [{ lyric: 'o', pos: 0, duration: 960, number: 55 }] }] }
  ]
});

test('VPR projects keep singing tracks, part offsets, lyrics and extensions', () => {
  const project = vpr.parse(pack(sequence()), 'demo.vpr');
  assert.deepEqual(project.tracks.map(track => track.singer), ['VY1V5', 'VY1V5'], 'parts without a voice use the only voice of the project');
  assert.equal(project.format, 'VOCALOID 5/6');
  assert.equal(project.title, 'Demo Song');
  assert.equal(project.version, '5.0.2');
  assert.deepEqual(project.tracks.map(track => track.name), ['Vocal', 'Harmony']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 4 * Q, duration: Q, pitch: 60, lyrics: 'a' },
    { onset: 5 * Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 7.5 * Q, duration: 0.5 * Q, pitch: 64, lyrics: 'i' },
    { onset: 16 * Q, duration: 0.5 * Q, pitch: 67, lyrics: 'u' }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 2 * Q, pitch: 55, lyrics: 'o' }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 4 * Q, bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 6, denominator: 8 }]);
});

test('VPR global tempo and Windows-style entry paths are honoured', () => {
  const source = sequence();
  source.masterTrack.tempo.global = { isEnabled: true, value: 13000 };
  delete source.title;
  const project = vpr.parse(pack(source, 'Project\\sequence.json'), 'folder/fallback.vpr');
  assert.equal(project.title, 'fallback');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 130 }]);
  assert.equal(project.tracks.length, 2);
});

test('malformed VPR files are rejected with a clear error', () => {
  assert.throws(() => vpr.parse(strToU8('{"tracks": []}'), 'bad.vpr'), /Invalid VPR project: the file is not a zip archive/);
  assert.throws(() => vpr.parse(zipSync({ 'readme.txt': strToU8('x') }), 'bad.vpr'), /Project\/sequence.json is missing/);
  assert.throws(() => vpr.parse(zipSync({ 'Project/sequence.json': strToU8('{oops') }), 'bad.vpr'), /Invalid VPR project/);
  assert.throws(() => vpr.parse(pack({ title: 'x' }), 'bad.vpr'), /expected a tracks array/);
});
