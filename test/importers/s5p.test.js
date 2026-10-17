import test from 'node:test';
import assert from 'node:assert/strict';
import s5p from '../../src/lib/importers/s5p.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);

const source = {
  instrumental: { filename: '', offset: 0 },
  meter: [{ measure: 0, beatPerMeasure: 4, beatGranularity: 4 }, { measure: 1, beatPerMeasure: 6, beatGranularity: 8 }],
  mixer: { gainInstrumentalDecibel: 0, gainVocalMasterDecibel: 0 },
  tempo: [{ position: 0, beatPerMinute: 120 }, { position: 4 * Q, beatPerMinute: 96.5 }],
  tracks: [
    {
      name: 'Harmony', displayOrder: 1, dbName: 'Eleanor', mixer: { mute: false },
      notes: [{ onset: 2 * Q, duration: Q, pitch: 57, lyric: 'oo' }]
    },
    {
      name: 'Lead', displayOrder: 0, dbName: 'Eleanor', mixer: { mute: false },
      notes: [
        { onset: 0, duration: Q, pitch: 60, lyric: 'la', comment: '' },
        null,
        { onset: Q, duration: Q / 2, pitch: 62, lyric: '-' },
        { onset: 4 * Q + Q / 2, duration: 3 * Q / 2, pitch: 64, lyric: 'li' }
      ],
      parameters: { interval: 5512500, pitchDelta: [0, 0, 10, 50] }
    },
    { name: 'Empty', displayOrder: 2, notes: [] }
  ],
  version: 7
};

test('parses an S5P project in blicks with tempo and meter changes and trailing NULs', () => {
  const project = s5p.parse(encode(`${JSON.stringify(source)}\0\0\0`), 'old-song.s5p');
  assert.deepEqual(project.tracks.map(track => track.singer), ['Eleanor', 'Eleanor'], 'dbName is the voice bank');
  assert.equal(project.format, 'Synthesizer V');
  assert.equal(project.title, 'old-song');
  assert.equal(project.version, 7);
  assert.deepEqual(project.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(project.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'la' },
    { onset: Q, duration: Q / 2, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 4.5 * Q, duration: 1.5 * Q, pitch: 64, lyrics: 'li' }
  ]);
  assert.deepEqual(project.tracks[1].notes.map(note => [note.onset, note.pitch, note.lyrics]), [[2 * Q, 57, 'oo']]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 4 * Q, bpm: 96.5 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 1, numerator: 6, denominator: 8 }]);
});

test('defaults tempo and meter when an S5P project omits them', () => {
  const project = s5p.parse(encode(JSON.stringify({ tracks: [{ notes: [{ onset: 0, duration: Q, pitch: 60, lyric: 'a' }] }] })), 'bare.s5p');
  assert.equal(project.tracks[0].name, 'Track 1');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
});

test('rejects malformed S5P files', () => {
  assert.throws(() => s5p.parse(encode('not json'), 'bad.s5p'), /Invalid Synthesizer V \(S5P\) project/);
  assert.throws(() => s5p.parse(encode('{"version": 1}'), 'bad.s5p'), /expected a tracks array/);
});
