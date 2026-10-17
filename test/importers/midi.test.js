import test from 'node:test';
import assert from 'node:assert/strict';
import midi from '../../src/lib/importers/midi.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';
import { dmEvents, event, lyric, smf, tempo, text, timeSignature, track, trackName } from './midi-builder.js';

const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

function songFile() {
  return smf({ format: 1 },
    track(trackName(0, 'My Song'), tempo(0, 120), timeSignature(0, 4, 4), tempo(1920, 90), timeSignature(1920, 3, 4)),
    track(
      trackName(0, 'Vocal'),
      lyric(0, 'la'), event(0, 0x90, 60, 100),
      event(480, 60, 0), // running status, velocity 0 ends the note
      lyric(0, '-'), event(0, 0x90, 62, 100),
      event(480, 0x80, 62, 64),
      text(0, 'comment'), lyric(0, 'lo'), event(0, 0x90, 64, 90),
      event(960, 0x80, 64, 0)
    ),
    track(
      trackName(0, 'Band'),
      event(0, 0xc1, 40), event(0, 0x91, 67, 80), event(0, 0x99, 36, 100),
      event(240, 0x89, 36, 0), event(1680, 0x81, 67, 0)
    )
  );
}

test('reads notes, lyrics, extensions, tempo and meter changes from a format 1 file', () => {
  const project = midi.parse(songFile(), 'song.mid');
  assert.equal(project.format, 'MIDI');
  assert.equal(project.title, 'My Song');
  assert.deepEqual(project.tracks.map(track => track.name), ['Vocal', 'Band (Channel 2)', 'Band (Channel 10)']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'la' },
    { onset: Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 2 * Q, duration: 2 * Q, pitch: 64, lyrics: 'lo' }
  ]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 4 * Q, bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('splits tracks by channel and classifies instruments by name, program and percussion channel', () => {
  const [vocal, violin, drums] = midi.parse(songFile(), 'song.mid').tracks;
  assert.equal(vocal.instrument.family, 'voice');
  assert.deepEqual([violin.instrument.family, violin.instrument.order, violin.instrument.percussion], ['strings', 60, false]);
  assert.deepEqual(simple(violin.notes), [{ onset: 0, duration: 4 * Q, pitch: 67, lyrics: '' }]);
  assert.equal(drums.instrument.percussion, true);
  assert.deepEqual(simple(drums.notes), [{ onset: 0, duration: Q / 2, pitch: 36, lyrics: '' }]);
});

test('splits format 0 files by channel, uses the track name as title and text events as lyrics', () => {
  const bytes = smf({ format: 0, division: 96 }, track(
    trackName(0, 'Duet'), tempo(0, 100),
    text(0, 'a'), event(0, 0x90, 60, 100), event(0, 0x91, 48, 100),
    event(96, 0x80, 60, 0), text(0, 'i'), event(0, 0x90, 62, 100),
    event(96, 0x80, 62, 0), event(0, 0x81, 48, 0)
  ));
  const project = midi.parse(bytes, 'duet.mid');
  assert.equal(project.title, 'Duet');
  assert.deepEqual(project.tracks.map(track => track.name), ['Channel 1', 'Channel 2']);
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: Q, pitch: 60, lyrics: 'a' }, { onset: Q, duration: Q, pitch: 62, lyrics: 'i' }]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 2 * Q, pitch: 48, lyrics: '' }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 100 }]);
});

test('pairs overlapping notes of the same key first-in first-out and falls back to the file name as title', () => {
  const bytes = smf({ format: 1 }, track(event(0, 0x90, 60, 100), event(240, 0x90, 60, 100), event(240, 0x80, 60, 0), event(480, 0x80, 60, 0)));
  const project = midi.parse(bytes, 'folder/overlap.mid');
  assert.equal(project.title, 'overlap');
  assert.deepEqual(project.tracks[0].name, 'Track 1');
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: Q, pitch: 60, lyrics: '' }, { onset: Q / 2, duration: 3 * Q / 2, pitch: 60, lyrics: '' }]);
});

test('ignores a lone text event in an instrumental track', () => {
  const notes = [60, 62, 64].flatMap(key => [event(0, 0x90, key, 100), event(480, 0x80, key, 0)]);
  const project = midi.parse(smf({ format: 1 }, track(trackName(0, 'Piano'), text(0, 'Created with a sequencer'), ...notes)), 'piano.mid');
  assert.deepEqual(project.tracks[0].notes.map(note => note.lyrics), ['', '', '']);
  assert.equal(project.tracks[0].instrument.family, 'keyboard');
});

test('detects standard MIDI and leaves VOCALOID MIDI to its own importer', () => {
  assert.equal(midi.detect(songFile(), 'song.mid'), true);
  assert.equal(midi.detect(smf({}, track(), track(...dmEvents('[Common]\nName=Voice\n'))), 'v.mid'), false);
  assert.equal(midi.detect(Uint8Array.from([1, 2, 3]), 'bad.mid'), false);
});

test('rejects malformed files with a clear error and warns about truncated tracks', () => {
  assert.throws(() => midi.parse(new TextEncoder().encode('not a midi file'), 'bad.mid'), /^Error: Invalid MIDI file: missing MThd header\.$/);
  assert.throws(() => midi.parse(smf({}, track(event(0, 60, 100))), 'bad.mid'), /Invalid MIDI file: data byte without a running status/);
  assert.throws(() => midi.parse(smf({ division: 0xe728 }, track()), 'bad.mid'), /SMPTE/);
  const truncated = songFile().slice(0, -12);
  assert.match(midi.parse(truncated, 'cut.mid').warnings.join(' '), /truncated/);
});
