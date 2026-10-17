import test from 'node:test';
import assert from 'node:assert/strict';
import {firstNoteFrom, formatTime, playbackNotes, playbackRows, playheadAt, tempoMap, tickAtPoint} from '../src/lib/playback.js';
import {PIANO_SAMPLE_RATE, pianoToneSeconds, renderPianoTone} from '../src/lib/piano.js';
import {createScore, QUARTER} from '../src/lib/converter.js';

const model = (tempos, notes = [], measures = [{start: 0, end: 64}, {start: 64, end: 128}]) => ({divisions: 16, tempos, measures, tracks: [{notes}]});

test('the tempo map turns divisions into seconds across tempo changes and back', () => {
  const map = tempoMap(model([{position: 0, bpm: 120}, {position: 64, bpm: 60}]));
  assert.equal(map.toSeconds(16), 0.5, 'a quarter at 120 bpm');
  assert.equal(map.toSeconds(64), 2, 'a bar of 4/4 at 120 bpm');
  assert.equal(map.toSeconds(80), 3, 'a quarter at 60 bpm after the change');
  assert.equal(map.duration, 6, 'ends where the last bar ends');
  for (const tick of [0, 10, 64, 100]) assert.ok(Math.abs(map.toTick(map.toSeconds(tick)) - tick) < 1e-9);
});

test('the tempo map starts at 120 bpm or the first tempo when the score gives none at its start', () => {
  assert.equal(tempoMap(model([])).toSeconds(16), 0.5);
  assert.equal(tempoMap(model([{position: 32, bpm: 60}])).toSeconds(16), 1, 'the first tempo holds from the start');
  assert.equal(tempoMap(model([{position: 0, bpm: 90}, {position: 0, bpm: 60}])).toSeconds(16), 1, 'the later of two tempos at one place wins');
});

test('playback notes are the pitched notes in seconds, by start; percussion is left out', () => {
  const score = {divisions: 16, tempos: [{position: 0, bpm: 120}], measures: [{start: 0, end: 64}], tracks: [
    {notes: [{start: 16, end: 32, pitch: 64}, {start: 0, end: 16, pitch: 60}, {start: 8, end: 8, pitch: 61}]},
    {percussion: true, notes: [{start: 0, end: 4, pitch: 38}]},
  ]};
  assert.deepEqual(playbackNotes(score), [{start: 0, end: 0.5, pitch: 60, part: 0}, {start: 0.5, end: 1, pitch: 64, part: 0}]);
});

test('playback starts with notes still sounding at the start time', () => {
  const notes = [{start: 0, end: 4}, {start: 1, end: 1.5}, {start: 2, end: 2.5}, {start: 3, end: 3.5}];
  assert.equal(firstNoteFrom(notes, 0), 0);
  assert.equal(firstNoteFrom(notes, 2.2), 0, 'the long first note is still sounding');
  assert.equal(firstNoteFrom(notes.slice(1), 2.2), 1, 'the note at 2 s is still sounding');
  assert.equal(firstNoteFrom(notes.slice(1), 2.6), 2);
});

// Two bars on a row of page 1 and one on page 2; points are [tick, fraction across the bar].
const marks = [
  {pageNumber: 1, start: 0, end: 64, x: 0.1, y: 0.2, width: 0.4, height: 0.1, points: [[0, 0.1], [32, 0.5], [64, 1]]},
  {pageNumber: 1, start: 64, end: 128, x: 0.5, y: 0.2, width: 0.4, height: 0.1, points: [[64, 0.2], [128, 1]]},
  {pageNumber: 2, start: 128, end: 192, x: 0.1, y: 0.1, width: 0.8, height: 0.1, points: [[128, 0], [192, 1]]},
];

test('the playhead passes each note on time and runs on across barlines', () => {
  const rows = playbackRows(marks);
  assert.equal(rows.length, 2, 'the two bars of page 1 share a row');
  const at = tick => playheadAt(rows, tick);
  assert.ok(Math.abs(at(0).x - 0.14) < 1e-9, 'on the first note');
  assert.ok(Math.abs(at(32).x - 0.3) < 1e-9, 'on the second onset');
  assert.ok(Math.abs(at(64).x - 0.58) < 1e-9, "on the next bar's first note when it sounds");
  assert.equal(at(150).pageNumber, 2);
  assert.ok(Math.abs(at(500).x - 0.9) < 1e-9, 'past the end it stays on the last barline');
  assert.equal(playheadAt([], 0), null);
});

test('the playhead moves smoothly: never back, no jump at a barline, speed changing gradually', () => {
  const rows = playbackRows(marks);
  const heads = Array.from({length: 1921}, (_, index) => playheadAt(rows, index / 10));
  for (let index = 1; index < heads.length; index += 1) {
    if (heads[index].pageNumber !== heads[index - 1].pageNumber || heads[index].y !== heads[index - 1].y) continue;
    assert.ok(heads[index].x >= heads[index - 1].x - 1e-12, `no step back within a row at ${index / 10}`);
  }
  assert.ok(Math.abs(playheadAt(rows, 63.999).x - playheadAt(rows, 64).x) < 1e-4, 'continuous through the barline');
  // Speed just before and after an onset is about the same: no corner where the note spacing changes.
  const speed = tick => (playheadAt(rows, tick + 0.01).x - playheadAt(rows, tick - 0.01).x) / 0.02;
  assert.ok(Math.abs(speed(31.9) - speed(32.1)) < speed(32) * 0.05, 'no sudden change of speed at a note');
  assert.ok(playheadAt(rows, 16).x > 0.14 && playheadAt(rows, 16).x < 0.3);
});

test('a click on the score finds the time under it', () => {
  assert.ok(Math.abs(tickAtPoint(marks, 1, 0.3, 0.25) - 32) < 1e-9, 'on the second onset');
  assert.equal(tickAtPoint(marks, 1, 0.12, 0.25), 0, 'before the first note is the bar start');
  assert.ok(Math.abs(tickAtPoint(marks, 1, 0.7, 0.22) - 64 - 64 * (0.3 / 0.8)) < 1e-9, 'across the second bar');
  assert.equal(tickAtPoint(marks, 2, 0.5, 0.15), 160);
  assert.equal(tickAtPoint(marks, 1, 0.5, 0.9), null, 'far from any bar row');
  assert.equal(tickAtPoint(marks, 3, 0.5, 0.5), null, 'a page without bars');
});

test('a converted score plays at its own tempo', () => {
  const project = {title: 'T', tracks: [{id: 'a', name: 'A', notes: [{onset: 0, duration: QUARTER, pitch: 60, lyrics: 'a'}, {onset: QUARTER * 4, duration: QUARTER * 2, pitch: 62, lyrics: 'b'}]}], meters: [{index: 0, numerator: 4, denominator: 4}], tempos: [{position: 0, bpm: 100}], warnings: []};
  const {model: score} = createScore(project);
  const notes = playbackNotes(score);
  assert.deepEqual(notes.map(note => [note.pitch, Number(note.start.toFixed(6)), Number(note.end.toFixed(6))]), [[60, 0, 0.6], [62, 2.4, 3.6]]);
  assert.equal(Number(tempoMap(score).duration.toFixed(6)), 4.8, 'two bars of 4/4 at 100 bpm');
});

test('the piano renders a struck, decaying tone the same way every time', () => {
  const tone = renderPianoTone(60);
  assert.equal(tone.length, Math.round(pianoToneSeconds(60) * PIANO_SAMPLE_RATE));
  const peak = tone.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
  assert.ok(Math.abs(peak - 0.5) < 1e-6, 'peak normalized');
  assert.equal(Math.abs(tone[0]), 0, 'no click at the onset');
  const energy = (from, to) => { let sum = 0; for (let i = Math.round(from * PIANO_SAMPLE_RATE); i < Math.round(to * PIANO_SAMPLE_RATE); i += 1) sum += tone[i] ** 2; return sum; };
  assert.ok(energy(0, 0.2) > energy(1, 1.2) * 10, 'the sound dies away');
  assert.deepEqual(renderPianoTone(60).slice(0, 64), tone.slice(0, 64), 'deterministic');
  assert.ok(pianoToneSeconds(36) > pianoToneSeconds(84), 'bass strings ring longer');
  assert.ok(renderPianoTone(108).every(Number.isFinite), 'the top of the keyboard renders');
});

test('times show as minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65.9), '1:05');
  assert.equal(formatTime(-3), '0:00');
  assert.equal(formatTime(NaN), '0:00');
});
