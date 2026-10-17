import test from 'node:test';
import assert from 'node:assert/strict';
import vocaloidMid from '../../src/lib/importers/vocaloid-mid.js';
import { importProject } from '../../src/lib/importers/index.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';
import { event, smf, text, track, trackName, vsqFile } from './midi-builder.js';

const plainMidi = () => smf({}, track(trackName(0, 'Lead'), text(0, 'hello'), event(0, 0x90, 60, 100), event(480, 0x80, 60, 0)));

test('detects MIDI files that carry VOCALOID text data', () => {
  assert.equal(vocaloidMid.detect(vsqFile(), 'song.mid'), true);
  assert.equal(vocaloidMid.detect(plainMidi(), 'plain.mid'), false);
  assert.equal(vocaloidMid.detect(Uint8Array.from([0x4d, 0x54]), 'bad.mid'), false);
});

test('parses VOCALOID MIDI tracks with the shared VSQ text reader', () => {
  const project = vocaloidMid.parse(vsqFile(), 'v1.mid');
  assert.equal(project.format, 'VOCALOID MIDI');
  assert.equal(project.title, 'v1');
  assert.deepEqual(project.tracks.map(track => [track.name, track.notes.length]), [['Voice', 4], ['Chorus', 1]]);
  assert.equal(project.tracks[0].notes[1].lyrics, EXTENSION_LYRIC);
  assert.deepEqual(project.tempos.at(-1), { position: 4 * Q, bpm: 150 });
});

test('the registry picks VOCALOID MIDI or standard MIDI for .mid files', async () => {
  assert.equal((await importProject(vsqFile(), 'song.mid')).formatId, 'vocaloid-mid');
  const plain = await importProject(plainMidi(), 'plain.mid');
  assert.equal(plain.formatId, 'midi');
  assert.equal(plain.tracks[0].notes[0].lyrics, 'hello');
});

test('rejects malformed VOCALOID MIDI files', () => {
  assert.throws(() => vocaloidMid.parse(Uint8Array.from([1, 2, 3]), 'bad.mid'), /^Error: Invalid VOCALOID MIDI file: missing MThd header\.$/);
  assert.throws(() => vocaloidMid.parse(plainMidi(), 'plain.mid'), /no VOCALOID track data found/);
});
