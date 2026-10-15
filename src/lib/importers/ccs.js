// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { EXTENSION_LYRIC, createProject, decodeText, metersFromTicks, parseXml, ticksToBlicks } from './model.js';

const FORMAT = 'CeVIO';
const CLOCKS_PER_QUARTER = 960;
// CeVIO always starts the song with one empty lead-in measure.
const MEASURE_PREFIX = 1;
const PROLONGED_SOUND_MARK = 'ー';

const nameOf = node => node.localName || String(node.nodeName).replace(/^.*:/, '');
const elements = (node, name) => Array.from(node?.childNodes ?? []).filter(item => item.nodeType === 1 && (!name || nameOf(item) === name));
const child = (node, ...path) => path.reduce((current, name) => elements(current, name)[0], node);
const attribute = (node, name) => { const raw = node.getAttribute(name); return raw ? Number(raw) : NaN; };
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');

function fromStart(items, key) {
  const sorted = items.filter(item => Number.isFinite(item[key])).sort((a, b) => a[key] - b[key]);
  const before = sorted.filter(item => item[key] <= 0).at(-1);
  return [...(before ? [{ ...before, [key]: 0 }] : []), ...sorted.filter(item => item[key] > 0)];
}

export default {
  id: 'ccs',
  name: FORMAT,
  extensions: ['ccs'],
  beta: true,
  parse(bytes, fileName = '') {
    let doc;
    try { doc = parseXml(decodeText(bytes)); } catch { throw new Error('Invalid CeVIO project: the file is not valid XML.'); }
    const root = doc.documentElement;
    const scene = root && nameOf(root) === 'Scenario' ? child(root, 'Sequence', 'Scene') : null;
    if (!scene) throw new Error('Invalid CeVIO project: Scenario/Sequence/Scene is missing.');
    const units = elements(child(scene, 'Units'), 'Unit').filter(unit => unit.getAttribute('Category') === 'SingerSong');
    const groups = new Map(elements(child(scene, 'Groups'), 'Group').map(group => [group.getAttribute('Id'), group]));

    // Every song unit repeats the project tempo and beat; the first one that has them is used.
    const firstList = (path, name) => units.map(unit => elements(child(unit, 'Song', path), name)).find(items => items.length) ?? [];
    const measures = metersFromTicks(firstList('Beat', 'Time').map(node => ({ tick: attribute(node, 'Clock') || 0, numerator: attribute(node, 'Beats'), denominator: attribute(node, 'BeatType') })), CLOCKS_PER_QUARTER);
    const prefix = measures[0].numerator * 4 / measures[0].denominator * CLOCKS_PER_QUARTER * MEASURE_PREFIX;
    const meters = fromStart(measures.map(meter => ({ ...meter, index: meter.index - MEASURE_PREFIX })), 'index');
    const tempos = fromStart(firstList('Tempo', 'Sound').map(node => ({ clock: (attribute(node, 'Clock') || 0) - prefix, bpm: attribute(node, 'Tempo') })), 'clock')
      .map(item => ({ position: ticksToBlicks(item.clock, CLOCKS_PER_QUARTER), bpm: item.bpm }));

    // Units of the same group form one track.
    const tracks = new Map();
    for (const unit of units) {
      const groupId = unit.getAttribute('Group') || `unit-${tracks.size + 1}`;
      if (!tracks.has(groupId)) tracks.set(groupId, { id: `ccs-${groupId}`, name: groups.get(groupId)?.getAttribute('Name') || `Track ${tracks.size + 1}`, notes: [] });
      for (const note of elements(child(unit, 'Song', 'Score'), 'Note')) {
        const lyric = note.getAttribute('Lyric') ?? '';
        tracks.get(groupId).notes.push({
          onset: ticksToBlicks(attribute(note, 'Clock') - prefix, CLOCKS_PER_QUARTER),
          duration: ticksToBlicks(attribute(note, 'Duration'), CLOCKS_PER_QUARTER),
          pitch: attribute(note, 'PitchStep') + (attribute(note, 'PitchOctave') + 1) * 12,
          lyrics: lyric === PROLONGED_SOUND_MARK ? EXTENSION_LYRIC : lyric
        });
      }
    }

    const version = child(root, 'Generation', 'Author')?.getAttribute('Version') || null;
    return createProject({ format: FORMAT, title: baseName(fileName), version, tracks: [...tracks.values()], tempos, meters });
  }
};
