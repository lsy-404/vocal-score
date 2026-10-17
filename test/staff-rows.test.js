import './importers/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {XMLSerializer} from '@xmldom/xmldom';
import {keepLyricRows} from '../src/lib/staff.js';
import {QUARTER, createScore} from '../src/lib/converter.js';

globalThis.XMLSerializer ??= XMLSerializer;

test('keeps a lyric row in bars that open by continuing a melisma, for the engraved copy only', () => {
  // "a" is held over bars 2 and 3; bar 1 opens with a syllable and bar 4 with a rest.
  const notes = [[0, 4, 60, 'la'], [4, 1, 62, 'a'], ...[5, 6, 7, 8, 9, 10, 11].map(beat => [beat, 1, 60 + (beat % 3), '-']), [13, 1, 64, 'li']];
  const project = {title: 'Rows', tracks: [{id: 'v', name: 'V', notes: notes.map(([onset, duration, pitch, lyrics]) => ({onset: QUARTER * onset, duration: QUARTER * duration, pitch, lyrics}))}], meters: [{index: 0, numerator: 4, denominator: 4}], tempos: [{position: 0, bpm: 120}], warnings: []};
  const {xml} = createScore(project, {melisma: 'both'});
  const engraved = keepLyricRows(xml);
  assert.equal((engraved.match(/<lyric><text>\u00a0<\/text><extend type="continue"\/><\/lyric>/g) || []).length, 1, 'bar 3 opens with a continuation');
  assert.match(engraved, /<measure number="3">.*?<lyric><text>\u00a0<\/text><extend type="continue"\/>/);
  assert.doesNotMatch(xml, /\u00a0/, 'the exported MusicXML keeps standard lyrics');
  assert.equal(keepLyricRows('<not-xml'), '<not-xml');
});
