import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { zstdCompressSync } from 'node:zlib';
import acep from '../../src/lib/importers/acep.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const SAMPLE = 'F:/OneDrive/Download/完美友人.acep';
const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));
const encode = value => new TextEncoder().encode(JSON.stringify(value));
const pack = (project, envelope = {}) => encode({ compressMethod: 'zstd', content: zstdCompressSync(Buffer.from(JSON.stringify(project))).toString('base64'), salt: '', version: 1000, debugInfo: {}, ...envelope });

function makeProject() {
  return {
    version: 10,
    tempos: [{ position: 0, bpm: 120, isLerp: false }, { position: 3840, bpm: 90, isLerp: false }],
    timeSignatures: [{ barPos: 0, numerator: 4, denominator: 4 }, { barPos: 2, numerator: 3, denominator: 4 }],
    tracks: [
      {
        type: 'sing', name: '', patterns: [{
          // Placed at tick 1920; only pattern ticks 480..2400 are visible.
          pos: 1920, dur: 3840, clipPos: 480, clipDur: 1920, enabled: true, notes: [
            { pos: 0, dur: 480, pitch: 59, lyric: 'hidden' },
            { pos: 480, dur: 480, pitch: 62, lyric: '啦' },
            { pos: 960, dur: 480, pitch: 64, lyric: '-' },
            { pos: 1440, dur: 480, pitch: 65, lyric: 'hello#1' },
            { pos: 1920, dur: 960, pitch: 67, lyric: 'hello#2' },
            { pos: 2400, dur: 480, pitch: 69, lyric: 'after' }
          ]
        }]
      },
      { type: 'audio', name: 'Backing', patterns: [{ pos: 0, dur: 1920 }] },
      {
        type: 'sing', name: 'Harmony', patterns: [
          { pos: 0, dur: 1920, clipPos: 0, clipDur: 1920, notes: [{ pos: 0, dur: 960, pitch: 57, lyric: 'la' }] },
          { pos: 1920, dur: 1920, clipPos: 0, clipDur: 1920, enabled: false, notes: [{ pos: 0, dur: 960, pitch: 57, lyric: 'muted' }] }
        ]
      }
    ]
  };
}

test('reads vocal tracks, applying pattern offsets and clip windows', () => {
  const project = acep.parse(pack(makeProject()), 'demo.acep');
  assert.equal(project.format, 'ACE Studio');
  assert.equal(project.title, 'demo');
  assert.deepEqual(project.tracks.map(track => track.name), ['Track 1', 'Harmony']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 5 * Q, duration: Q, pitch: 62, lyrics: '啦' },
    { onset: 6 * Q, duration: Q, pitch: 64, lyrics: EXTENSION_LYRIC },
    { onset: 7 * Q, duration: Q, pitch: 65, lyrics: 'hello' },
    { onset: 8 * Q, duration: Q, pitch: 67, lyrics: EXTENSION_LYRIC }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 2 * Q, pitch: 57, lyrics: 'la' }]);
  assert.match(project.warnings.join(' '), /Harmony: skipped a disabled pattern/);
});

test('reads tempo changes and treats barPos as a measure index', () => {
  const source = makeProject();
  source.tempos[1].isLerp = true;
  const project = acep.parse(pack(source), 'demo.acep');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 8 * Q, bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
  assert.match(project.warnings.join(' '), /Gradual tempo changes/);
});

test('accepts uncompressed content', () => {
  const source = makeProject();
  for (const envelope of [{ content: JSON.stringify(source) }, { content: source }]) {
    const project = acep.parse(encode(envelope), 'plain.acep');
    assert.equal(project.tracks.length, 2);
    assert.equal(project.tracks[0].notes.length, 4);
  }
});

test('rejects malformed and unsupported files with clear errors', () => {
  assert.throws(() => acep.parse(new TextEncoder().encode('{not json'), 'bad.acep'), /^Error: Invalid ACE Studio project: the file is not valid JSON\.$/);
  assert.throws(() => acep.parse(encode({ compressMethod: 'zstd', content: 'AAAAAAAA' }), 'bad.acep'), /Invalid ACE Studio project: content could not be decompressed/);
  assert.throws(() => acep.parse(pack({ tracks: 'none' }), 'bad.acep'), /Invalid ACE Studio project: expected a tracks array/);
  assert.throws(() => acep.parse(encode({ version: 1000 }), 'bad.acep'), /Invalid ACE Studio project: missing content/);
  assert.throws(() => acep.parse(new TextEncoder().encode('ACEP2\x01'), 'new.acep'), /Unsupported ACE Studio project: binary ACEP2/);
});

test('parses the local ACE Studio sample when it is available', { skip: !existsSync(SAMPLE) && 'sample file not present' }, () => {
  const project = acep.parse(new Uint8Array(readFileSync(SAMPLE)), '完美友人.acep');
  assert.equal(project.title, '完美友人');
  assert.equal(project.tracks.length, 7);
  const counts = project.tracks.map(track => track.notes.length);
  assert.ok(counts.every(count => count >= 10), `note counts ${counts}`);
  assert.ok(counts.reduce((sum, count) => sum + count, 0) > 1000, `note counts ${counts}`);
  assert.ok(project.tracks.every(track => track.notes.every(note => note.onset % (Q / 4) === 0)), 'notes stay on the 480-tick grid');
  assert.deepEqual(project.meters[0], { index: 0, numerator: 4, denominator: 4 });
});
