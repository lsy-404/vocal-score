// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { createProject, decodeText, ticksToBlicks, EXTENSION_LYRIC } from './model.js';

const TICKS_PER_QUARTER = 480;
const MAX_BPM = 10000;
const RESTS = new Set(['', 'R', 'r']);
const EXTENSIONS = new Set(['-', 'ー']);

const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const blicks = ticks => ticksToBlicks(ticks, TICKS_PER_QUARTER);
// VoiceDir is a folder, usually "%VOICE%name" under the UTAU voice directory; the voice bank is its last segment.
const voiceOf = dir => String(dir ?? '').replace(/^%VOICE%/i, '').replace(/[\\/]+$/, '').split(/[\\/]/).at(-1);

function readSections(text) {
  const sections = [];
  for (const line of text.split(/\r\n?|\n/)) {
    const header = /^\s*\[#([^\]]+)\]/.exec(line);
    const separator = line.indexOf('=');
    if (header) sections.push({ name: header[1].trim().toUpperCase(), values: {} });
    else if (sections.length && separator > 0) sections.at(-1).values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return sections;
}

// VCV lyrics such as "a か" or "- か" carry the previous vowel as a prefix; the score shows only the syllable.
function lyricOf(value) {
  const lyric = String(value ?? '').trim().replace(/^[aiueonN-] +(?=\S)/, '');
  return EXTENSIONS.has(lyric) || lyric.startsWith('+') ? EXTENSION_LYRIC : lyric;
}

export default {
  id: 'ust',
  name: 'UTAU',
  extensions: ['ust'],
  beta: true,
  detect(bytes) {
    return /^\s*\[#(?:VERSION|SETTING|\d+)\]/i.test(decodeText(bytes.subarray(0, 512)));
  },
  parse(bytes, fileName = '') {
    const text = decodeText(bytes);
    const sections = readSections(text);
    const noteSections = sections.filter(section => /^\d+$/.test(section.name));
    const setting = sections.find(section => section.name === 'SETTING')?.values;
    if (!setting && !noteSections.length) throw new Error('Invalid UTAU project: no [#SETTING] or note sections were found.');
    const warnings = [];
    const tempos = [];
    const addTempo = (tick, value) => {
      const bpm = Number(String(value).replace(',', '.'));
      if (!(bpm > 0)) return;
      if (bpm > MAX_BPM) {
        warnings.push(`Ignored an out-of-range tempo of ${bpm} BPM.`);
        return;
      }
      if (tempos.at(-1)?.tick === tick) tempos.pop();
      if (tempos.at(-1)?.bpm !== bpm) tempos.push({ tick, bpm });
    };
    if (setting?.Tempo) addTempo(0, setting.Tempo);
    const notes = [];
    let tick = 0;
    for (const { name, values } of noteSections) {
      const length = Math.round(Number(values.Length));
      if (!Number.isFinite(length) || length < 0) {
        warnings.push(`Skipped UTAU note #${name} without a valid length.`);
        continue;
      }
      if (values.Tempo) addTempo(tick, values.Tempo);
      const lyrics = lyricOf(values.Lyric);
      if (!RESTS.has(lyrics)) notes.push({ onset: blicks(tick), duration: blicks(length), pitch: Number(values.NoteNum), lyrics });
      tick += length;
    }
    const name = baseName(fileName);
    return createProject({
      format: 'UTAU',
      title: setting?.ProjectName || name,
      version: /UST Version\s*([\d.]+)/i.exec(text)?.[1] ?? null,
      tracks: [{ name: name || setting?.ProjectName || 'UTAU', singer: voiceOf(setting?.VoiceDir), notes }],
      tempos: tempos.map(item => ({ position: blicks(item.tick), bpm: item.bpm })),
      warnings
    });
  }
};
