// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { EXTENSION_LYRIC, createProject, decodeText, parseXml, ticksToBlicks } from './model.js';

const FORMAT = 'VOCALOID 3/4';

const nameOf = node => node.localName || String(node.nodeName).replace(/^.*:/, '');
const elements = (node, name) => Array.from(node?.childNodes ?? []).filter(item => item.nodeType === 1 && (!name || nameOf(item) === name));
// vsq4 renamed most elements; each read tries the vsq4 name first and then the vsq3 one.
function value(node, ...names) {
  for (const name of names) {
    const element = elements(node, name)[0];
    if (element) return element.textContent.trim();
  }
  return undefined;
}
const number = (node, ...names) => { const raw = value(node, ...names); return raw ? Number(raw) : NaN; };
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');

const measureLength = (signature, ticksPerQuarter) => signature.numerator * 4 / signature.denominator * ticksPerQuarter;

function measureTick(signatures, measure, ticksPerQuarter) {
  let tick = 0, at = 0, current = { numerator: 4, denominator: 4 };
  for (const signature of signatures) {
    if (signature.measure > measure) break;
    tick += (signature.measure - at) * measureLength(current, ticksPerQuarter);
    at = signature.measure;
    current = signature;
  }
  return tick + (measure - at) * measureLength(current, ticksPerQuarter);
}

// Events inside the pre-measure area collapse onto the start: the last of them applies from position 0.
function fromStart(items, key) {
  const sorted = items.filter(item => Number.isFinite(item[key])).sort((a, b) => a[key] - b[key]);
  const before = sorted.filter(item => item[key] <= 0).at(-1);
  return [...(before ? [{ ...before, [key]: 0 }] : []), ...sorted.filter(item => item[key] > 0)];
}

export default {
  id: 'vsqx',
  name: FORMAT,
  extensions: ['vsqx'],
  beta: true,
  parse(bytes, fileName = '') {
    let doc;
    try { doc = parseXml(decodeText(bytes)); } catch { throw new Error('Invalid VSQX project: the file is not valid XML.'); }
    const root = doc.documentElement;
    const schema = root ? nameOf(root) : '';
    if (schema !== 'vsq3' && schema !== 'vsq4') throw new Error('Invalid VSQX project: expected a vsq3 or vsq4 root element.');
    const master = elements(root, 'masterTrack')[0];
    if (!master) throw new Error('Invalid VSQX project: masterTrack is missing.');
    const resolution = number(master, 'resolution') > 0 ? number(master, 'resolution') : 480;
    const preMeasure = Math.max(0, Math.trunc(number(master, 'preMeasure')) || 0);

    const signatures = elements(master, 'timeSig')
      .map(node => ({ measure: number(node, 'm', 'posMes'), numerator: number(node, 'nu', 'nume'), denominator: number(node, 'de', 'denomi') }))
      .filter(item => Number.isInteger(item.measure) && item.numerator > 0 && item.denominator > 0)
      .sort((a, b) => a.measure - b.measure);
    const tickPrefix = measureTick(signatures, preMeasure, resolution);
    const meters = fromStart(signatures.map(item => ({ ...item, measure: item.measure - preMeasure })), 'measure')
      .map(item => ({ index: item.measure, numerator: item.numerator, denominator: item.denominator }));
    const tempos = fromStart(elements(master, 'tempo').map(node => ({ tick: (number(node, 't', 'posTick') || 0) - tickPrefix, bpm: number(node, 'v', 'bpm') / 100 })), 'tick')
      .map(item => ({ position: ticksToBlicks(item.tick, resolution), bpm: item.bpm }));

    const tracks = elements(root, 'vsTrack').map((track, index) => {
      const notes = [];
      for (const part of [...elements(track, 'vsPart'), ...elements(track, 'musicalPart')]) {
        const offset = (number(part, 't', 'posTick') || 0) - tickPrefix;
        const playTime = number(part, 'playTime');
        for (const note of elements(part, 'note')) {
          const start = number(note, 't', 'posTick');
          let length = number(note, 'dur', 'durTick');
          // Notes past the end of a part are muted by the editor.
          if (playTime >= 0) {
            if (start >= playTime) continue;
            length = Math.min(length, playTime - start);
          }
          const lyric = value(note, 'y', 'lyric') ?? '';
          notes.push({ onset: ticksToBlicks(offset + start, resolution), duration: ticksToBlicks(length, resolution), pitch: number(note, 'n', 'noteNum'), lyrics: lyric === '-' ? EXTENSION_LYRIC : lyric });
        }
      }
      return { id: `vsqx-track-${index + 1}`, name: value(track, 'name', 'trackName') || `Track ${index + 1}`, notes };
    });

    return createProject({ format: FORMAT, title: baseName(fileName), version: value(root, 'version') || schema, tracks, tempos, meters });
  }
};
