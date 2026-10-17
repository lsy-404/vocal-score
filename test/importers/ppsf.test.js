import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import ppsf from '../../src/lib/importers/ppsf.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const at = ticks => ticks * Q / 480;
const event = (pos, length, noteNumber, lyric, extra = {}) => ({ pos, length, note_number: noteNumber, lyric, symbols: '', protected: false, ...extra });
const archive = (json, name = 'ppsf.json') => zipSync({ [name]: strToU8(JSON.stringify(json)) });

const source = {
  ppsf: {
    app_ver: '1.0.4.0',
    ppsf_ver: '1.0',
    gui_settings: { 'track-editor': { 'event-tracks': [] } },
    project: {
      name: '初音のうた',
      sampling_rate: 48000,
      tempo: { const: 1200000, use_sequence: true, sequence: [{ tick: 0, value: 1300000, curve_type: 0 }, { tick: 1920, value: 905000, curve_type: 0 }] },
      meter: { const: { nume: 4, denomi: 4 }, use_sequence: true, sequence: [{ measure: 2, nume: 3, denomi: 4 }] },
      audio_track: [{ name: 'Audio', events: [{ tick_pos: 0, file_audio_data: { file_path: 'a.wav' } }] }],
      dvl_track: [
        {
          name: 'Miku',
          enabled: true,
          events: [
            event(0, 480, 60, 'あ', { enabled: true }),
            event(480, 480, 62, 'ー'),
            event(960, 480, 63, 'muted', { enable: false }),
            event(1440, 960, 64, 'か', { enabled: true })
          ]
        },
        { name: 'Miku 2', events: [event(3840, 240, 67, 'さ'), event(4080, 240, 69, '-')] },
        { name: 'Empty', events: [] }
      ]
    }
  }
};

test('parses a Piapro Studio NT project with tempo and meter sequences', () => {
  const bytes = archive(source);
  const project = ppsf.parse(bytes, 'miku.ppsf');
  assert.equal(project.format, 'Piapro Studio NT');
  assert.equal(project.title, '初音のうた');
  assert.equal(project.version, '1.0');
  assert.deepEqual(project.tracks.map(track => track.name), ['Miku', 'Miku 2']);
  assert.deepEqual(project.tracks[0].notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics })), [
    { onset: 0, duration: at(480), pitch: 60, lyrics: 'あ' },
    { onset: at(480), duration: at(480), pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: at(1440), duration: at(960), pitch: 64, lyrics: 'か' }
  ]);
  assert.deepEqual(project.tracks[1].notes.map(note => [note.onset, note.pitch, note.lyrics]), [[at(3840), 67, 'さ'], [at(4080), 69, EXTENSION_LYRIC]]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 130 }, { position: at(1920), bpm: 90.5 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
  assert.ok(ppsf.detect(bytes));
});

test('uses constant tempo and meter when sequences are disabled', () => {
  const json = structuredClone(source);
  Object.assign(json.ppsf.project, { name: '', tempo: { const: 1450000, use_sequence: false, sequence: [{ tick: 0, value: 600000 }] }, meter: { const: { nume: 6, denomi: 8 }, use_sequence: false } });
  const project = ppsf.parse(archive(json), 'C:/projects/constant.ppsf');
  assert.equal(project.title, 'constant');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 145 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 6, denominator: 8 }]);
});

test('rejects legacy, non-archive and incomplete Piapro Studio files', () => {
  const legacy = Uint8Array.from([...strToU8('PPSF'), 0, 0, 0, 1, 2, 3]);
  assert.ok(ppsf.detect(legacy));
  assert.throws(() => ppsf.parse(legacy, 'old.ppsf'), /legacy/);
  assert.throws(() => ppsf.parse(strToU8('{"ppsf": {}}'), 'bad.ppsf'), /Invalid Piapro Studio project/);
  assert.throws(() => ppsf.parse(archive(source, 'other.json'), 'bad.ppsf'), /ppsf\.json is missing/);
  assert.throws(() => ppsf.parse(archive({ ppsf: { app_ver: '1' } }), 'bad.ppsf'), /missing ppsf\.project/);
});
