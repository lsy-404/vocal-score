import test from 'node:test';
import assert from 'node:assert/strict';
import vsq from '../../src/lib/importers/vsq.js';
import { parseSections } from '../../src/lib/importers/vsq-text.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';
import { event, smf, tempo, track, vsqFile } from './midi-builder.js';

const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

test('reads VSQ tracks, Shift_JIS lyrics split across DM chunks and extension markers', () => {
  const project = vsq.parse(vsqFile(), 'song.vsq');
  assert.equal(project.format, 'VOCALOID 2');
  assert.equal(project.title, 'song');
  assert.deepEqual(project.tracks.map(track => track.name), ['Voice', 'Chorus']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'あ' },
    { onset: Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 2 * Q, duration: Q, pitch: 64, lyrics: 'さ' },
    { onset: 3 * Q, duration: 2 * Q, pitch: 65, lyrics: 'い' }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 4 * Q, pitch: 55, lyrics: 'la' }]);
  assert.match(project.warnings.join(' '), /Voice: skipped 1 note\(s\) inside the pre-measure/);
});

test('removes the pre-measure from tempo and meter changes', () => {
  const project = vsq.parse(vsqFile(), 'song.vsq');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 130 }, { position: 4 * Q, bpm: 150 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('splits the VSQ text into ordered sections', () => {
  const sections = parseSections('[Common]\r\nName=A=B\r\n[EventList]\r\n0=ID#0000\r\n480=ID#0001,ID#0002\r\n');
  assert.deepEqual(sections.get('Common'), [['Name', 'A=B']]);
  assert.deepEqual(sections.get('EventList'), [['0', 'ID#0000'], ['480', 'ID#0001,ID#0002']]);
});

test('rejects malformed files and plain MIDI files without VOCALOID data', () => {
  assert.throws(() => vsq.parse(Uint8Array.from([0, 1, 2, 3]), 'bad.vsq'), /^Error: Invalid VSQ file: missing MThd header\.$/);
  const plain = smf({}, track(tempo(0, 120)), track(event(0, 0x90, 60, 100), event(480, 0x80, 60, 0)));
  assert.throws(() => vsq.parse(plain, 'plain.vsq'), /Invalid VSQ file: no VOCALOID track data found/);
});
