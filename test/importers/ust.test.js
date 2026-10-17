import test from 'node:test';
import assert from 'node:assert/strict';
import ust from '../../src/lib/importers/ust.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);
const at = ticks => ticks * Q / 480;

// Builds Shift_JIS bytes from ASCII strings and hand-encoded byte arrays.
function sjis(...parts) {
  return Uint8Array.from(parts.flatMap(part => typeof part === 'string' ? [...encode(part)] : part));
}
const A = [0x82, 0xa0]; // あ
const KA = [0x82, 0xa9]; // か
const LONG = [0x81, 0x5b]; // ー

test('parses a UTF-8 UST 2.0 project with rests, extensions and tempo changes', () => {
  const text = [
    '[#VERSION]', 'UST Version2.0', 'Charset=UTF-8',
    '[#SETTING]', 'Tempo=120.00', 'ProjectName=さくら', 'VoiceDir=%VOICE%uta',
    '[#0000]', 'Length=480', 'Lyric=さ', 'NoteNum=60',
    '[#0001]', 'Length=240', 'Lyric=R', 'NoteNum=60',
    '[#0002]', 'Length=240', 'Lyric=', 'NoteNum=60',
    '[#0003]', 'Tempo=150', 'Length=480', 'Lyric=a く', 'NoteNum=62',
    '[#0004]', 'Length=480', 'Lyric=-', 'NoteNum=64',
    '[#0005]', 'Length=960', 'Lyric=ら', 'NoteNum=65', 'Tempo=90,5',
    '[#0006]', 'Length=480', 'Lyric=+~', 'NoteNum=67',
    '[#TRACKEND]'
  ].join('\r\n');
  const project = ust.parse(encode(text), 'C:\\songs\\sakura.ust');
  assert.equal(project.tracks[0].singer, 'uta', 'the voice bank is the last segment of VoiceDir');
  assert.equal(project.format, 'UTAU');
  assert.equal(project.title, 'さくら');
  assert.equal(project.version, '2.0');
  assert.equal(project.tracks.length, 1);
  assert.equal(project.tracks[0].name, 'sakura');
  assert.deepEqual(project.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: at(480), pitch: 60, lyrics: 'さ' },
    { onset: at(960), duration: at(480), pitch: 62, lyrics: 'く' },
    { onset: at(1440), duration: at(480), pitch: 64, lyrics: EXTENSION_LYRIC },
    { onset: at(1920), duration: at(960), pitch: 65, lyrics: 'ら' },
    { onset: at(2880), duration: at(480), pitch: 67, lyrics: EXTENSION_LYRIC }
  ]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: at(960), bpm: 150 }, { position: at(1920), bpm: 90.5 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
  assert.ok(ust.detect(encode(text)));
});

test('decodes Shift_JIS lyrics and falls back to the file name as title', () => {
  const bytes = sjis(
    '[#SETTING]\r\nTempo=100\r\n',
    '[#0000]\r\nLength=960\r\nLyric=', A, '\r\nNoteNum=69\r\n',
    '[#0001]\r\nLength=480\r\nLyric=', LONG, '\r\nNoteNum=71\r\n',
    '[#0002]\r\nLength=480\r\nLyric=r\r\nNoteNum=60\r\n',
    '[#0003]\r\nLength=480\r\nLyric=', KA, '\r\nNoteNum=72\r\n',
    '[#TRACKEND]\r\n'
  );
  const project = ust.parse(bytes, 'melody.ust');
  assert.equal(project.title, 'melody');
  assert.deepEqual(project.tracks[0].notes.map(note => [note.onset, note.pitch, note.lyrics]), [
    [0, 69, 'あ'],
    [at(960), 71, EXTENSION_LYRIC],
    [at(1920), 72, 'か']
  ]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 100 }]);
});

test('skips notes without a length and ignores absurd tempos', () => {
  const text = '[#SETTING]\nTempo=99999\n[#0000]\nLyric=la\nNoteNum=60\n[#0001]\nLength=480\nLyric=li\nNoteNum=62\n';
  const project = ust.parse(encode(text), 'x.ust');
  assert.deepEqual(project.tracks[0].notes.map(note => [note.onset, note.lyrics]), [[0, 'li']]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }]);
  assert.equal(project.warnings.length, 2);
});

test('rejects files that are not UTAU projects', () => {
  assert.throws(() => ust.parse(encode('hello world'), 'bad.ust'), /Invalid UTAU project/);
  assert.equal(ust.detect(encode('{"tracks": []}')), false);
});
