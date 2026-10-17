import './dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import ufdata from '../../src/lib/importers/ufdata.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

const document = (formatVersion = 1) => ({
  formatVersion,
  project: {
    name: 'project name',
    tracks: [
      {
        name: 'track 1',
        notes: [
          { key: 60, tickOn: 1920, tickOff: 2400, lyric: 'あ', phoneme: 'a' },
          { key: 61, tickOn: 2400, tickOff: 2880, lyric: '-', phoneme: null },
          { key: 63, tickOn: 4800, tickOff: 5040, lyric: 'い' }
        ],
        pitch: { ticks: [1920, 1925], values: [62.8, null], isAbsolute: true }
      },
      { name: 'track 2', notes: [{ key: 55, tickOn: 0, tickOff: 960, lyric: 'la' }] },
      { name: 'empty', notes: [] }
    ],
    timeSignatures: [{ measurePosition: 0, numerator: 4, denominator: 4 }, { measurePosition: 2, numerator: 3, denominator: 4 }],
    tempos: [{ tickPosition: 0, bpm: 118 }, { tickPosition: 3840, bpm: 140.5 }],
    measurePrefix: 1
  }
});

test('ufdata projects keep tracks, notes, extensions, tempos and time signatures', () => {
  const project = ufdata.parse(encode(document()), 'demo.ufdata');
  assert.equal(project.format, 'UtaFormatix');
  assert.equal(project.title, 'project name');
  assert.equal(project.version, 1);
  assert.deepEqual(project.warnings, []);
  assert.deepEqual(project.tracks.map(track => track.name), ['track 1', 'track 2']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 4 * Q, duration: Q, pitch: 60, lyrics: 'あ' },
    { onset: 5 * Q, duration: Q, pitch: 61, lyrics: EXTENSION_LYRIC },
    { onset: 10 * Q, duration: 0.5 * Q, pitch: 63, lyrics: 'い' }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 2 * Q, pitch: 55, lyrics: 'la' }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 118 }, { position: 8 * Q, bpm: 140.5 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('newer ufdata versions import with a warning and the file name as fallback title', () => {
  const source = document(2);
  source.project.name = '';
  const project = ufdata.parse(encode(source), 'dir/fallback.ufdata');
  assert.equal(project.title, 'fallback');
  assert.match(project.warnings[0], /version 2 is newer/);
  assert.equal(project.tracks.length, 2);
});

test('malformed ufdata files are rejected with a clear error', () => {
  assert.throws(() => ufdata.parse(encode('{not json'), 'bad.ufdata'), /Invalid UtaFormatix data/);
  assert.throws(() => ufdata.parse(encode({ formatVersion: 1 }), 'bad.ufdata'), /expected a project with a tracks array/);
  assert.throws(() => ufdata.parse(encode({ formatVersion: 1, project: { tracks: {} } }), 'bad.ufdata'), /expected a project with a tracks array/);
});
