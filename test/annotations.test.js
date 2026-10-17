import './importers/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {XMLSerializer} from '@xmldom/xmldom';
import {annotateSingers, singerPartLabels} from '../src/lib/annotations.js';
import {QUARTER, createScore} from '../src/lib/converter.js';

globalThis.XMLSerializer ??= XMLSerializer;

const sung = (id, name, bars, singer) => ({id, name, singer, notes: bars.flatMap(bar => [0, 1, 2].map(beat => ({onset: QUARTER * (bar * 4 + beat), duration: QUARTER, pitch: 64, lyrics: 'la', singer})))});
const project = {title: 'Duet', tracks: [sung('a', 'A', [0, 1], 'Mai'), sung('b', 'B', [2, 3], 'Saki')], meters: [{index: 0, numerator: 4, denominator: 4}], tempos: [{position: 0, bpm: 120}], warnings: []};

test('writes the voice bank after each part name and above the staff where it changes', () => {
  const result = createScore(project, {mergeContinuations: true, mergeAcrossSingers: true});
  const labels = singerPartLabels(result.model, (part, singer) => `${part}（${singer}）`);
  assert.deepEqual(labels, ['A（Mai）']);
  const xml = annotateSingers(result.xml, result.model, labels);
  assert.match(xml, /<part-name>A（Mai）<\/part-name>/);
  assert.match(xml, /<measure number="3"><direction placement="above"><direction-type><words font-size="10">Saki<\/words><\/direction-type><\/direction><note/);
  assert.equal((xml.match(/<words/g) || []).length, 1, 'only the change is marked; the opening voice bank is in the part name');
});

test('leaves parts without a known voice bank under their own name', () => {
  const unnamed = {...project, tracks: project.tracks.map(({singer, notes, ...track}) => ({...track, notes: notes.map(({singer: _, ...note}) => note)}))};
  const result = createScore(unnamed);
  assert.deepEqual(singerPartLabels(result.model), ['A', 'B']);
  assert.doesNotMatch(annotateSingers(result.xml, result.model, singerPartLabels(result.model)), /<words/);
});
