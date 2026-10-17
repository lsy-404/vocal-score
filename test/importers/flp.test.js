import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import flp from '../../src/lib/importers/flp.js';
import { BLICKS_PER_QUARTER as Q } from '../../src/lib/importers/model.js';

// Synthetic FLP writer: FLhd + FLdt chunks around an event stream (see flp.js for the event layout).
const PPQ = 96;
const T = ticks => ticks * Q / PPQ;
const ascii = text => [...text].map(char => char.charCodeAt(0));
const u16 = value => [value & 255, (value >>> 8) & 255];
const u32 = value => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
const utf16 = text => [...Array.from(text, char => char.charCodeAt(0)).flatMap(u16), 0, 0];
const varint = size => size < 0x80 ? [size] : [(size & 0x7f) | 0x80, ...varint(size >>> 7)];
const ev = (id, value) => id < 64 ? [id, value] : id < 128 ? [id, ...u16(value)] : id < 192 ? [id, ...u32(value)] : [id, ...varint(value.length), ...value];
const text = (id, value) => ev(id, utf16(value));

function file(events, { ppq = PPQ, format = 0, channels } = {}) {
  const data = events.flat();
  const count = channels ?? events.filter(item => item[0] === 64).length;
  return Uint8Array.from([...ascii('FLhd'), ...u32(6), ...u16(format & 0xffff), ...u16(count), ...u16(ppq), ...ascii('FLdt'), ...u32(data.length), ...data]);
}

const header = ({ version = '21.2.3.4004', tempo = 128500, numerator = 4, denominator = 4 } = {}) => [
  ev(199, [...ascii(version), 0]), text(194, 'Synthetic Song'), ev(156, tempo), ev(17, numerator), ev(18, denominator)
];
const channel = (iid, { name, plugin = 'Fruity Wrapper', enabled = 1 } = {}) => [
  ev(64, iid), ev(21, 2), text(201, plugin), ...(name ? [text(203, name)] : []), ev(0, enabled)
];
const note = (position, rack, length, key, flags = 0x4000) => [...u32(position), ...u16(flags), ...u16(rack), ...u32(length), ...u16(key), ...u16(0), 120, 0, 64, 0, 64, 100, 128, 128];
const pattern = (iid, notes, name) => [ev(65, iid), ...(name ? [text(193, name)] : []), ev(224, notes.flat())];
// A pattern clip: 16-byte head, constant bytes, the int32 cut window (-1 = uncut), then zero padding up to the FL era's stride.
const clip = (stride, { position, pattern: number, length, track = 1, window = [-1, -1], flags = 0x40 }) => [
  ...u32(position), ...u16(20480), ...u16(20480 + number), ...u32(length), ...u16(500 - track), ...u16(0),
  120, 0, ...u16(flags), 64, 100, 128, 128, ...u32(window[0]), ...u32(window[1]), ...new Array(stride - 32).fill(0)
];
const automationClip = stride => [...u32(0), ...u16(20480), ...u16(3), ...u32(3456), ...u16(499), ...u16(0), 120, 0, 64, 0, 64, 100, 128, 128, 0, 0, 0, 0, 0, 0, 16, 66, ...new Array(stride - 32).fill(0)];
const trackData = (iid, enabled = 1) => ev(238, [...u32(iid), 52, 56, 58, 0, 0, 0, 0, 0, enabled, 0, 0, 128, 63]);
const arrangement = (stride, clips, tracks = []) => [ev(99, 0), text(241, 'Arrangement'), ev(233, clips.map(item => clip(stride, item)).flat()), ...tracks];

// Pattern 1 (Violin I): two notes, 288 ticks of content, so it loops every bar (384 ticks in 4/4).
// Pattern 2 (FPC and Infiniti Player #3): a step note, a short note and a note in its second bar; loops every 2 bars.
function songEvents(stride, { clips, tracks } = {}) {
  return [
    ...header(),
    ...pattern(1, [note(0, 0, 96, 60), note(192, 0, 96, 62)], 'Melody'),
    ...pattern(2, [note(0, 1, 0, 36), note(96, 1, 48, 38), note(384, 2, 96, 40)]),
    ...channel(0, { name: 'Violin I' }),
    ...channel(1, { plugin: 'FPC' }),
    ...channel(2, { name: 'Infiniti Player #3' }),
    ...channel(3, { name: 'Unused Piano' }),
    // A mixer insert's effect names must not rename the last channel.
    ev(236, new Array(12).fill(0)), text(201, 'Fruity Limiter'), text(203, 'Limiter'), ev(98, 0),
    ...arrangement(stride, clips ?? [
      { position: 0, pattern: 1, length: 384 },
      { position: 768, pattern: 1, length: 768 },
      { position: 1536, pattern: 2, length: 384, window: [96, 480], track: 2 },
      { position: 2304, pattern: 1, length: 240 }
    ], tracks ?? [trackData(1), text(239, 'Strings'), trackData(2), text(239, 'Cello')])
  ];
}

const simple = notes => notes.map(({ onset, duration, pitch }) => ({ onset, duration, pitch }));

for (const [stride, era] of [[32, 'FL 12-20'], [60, 'FL 21-24'], [80, 'FL 25']]) {
  test(`places pattern notes from ${stride}-byte (${era}) playlist records with offsets, loops and clip ends`, () => {
    const project = flp.parse(file(songEvents(stride)), 'song.flp');
    assert.equal(project.format, 'FL Studio');
    assert.equal(project.title, 'Synthetic Song');
    assert.equal(project.version, '21.2.3.4004');
    assert.deepEqual(project.tracks.map(track => track.name), ['Violin I', 'FPC', 'Cello'], 'a plugin-named channel takes its playlist track name');
    assert.deepEqual(simple(project.tracks[0].notes), [
      { onset: 0, duration: T(96), pitch: 60 }, { onset: T(192), duration: T(96), pitch: 62 },
      // The 768-tick clip plays the one-bar pattern twice.
      { onset: T(768), duration: T(96), pitch: 60 }, { onset: T(960), duration: T(96), pitch: 62 },
      { onset: T(1152), duration: T(96), pitch: 60 }, { onset: T(1344), duration: T(96), pitch: 62 },
      // The 240-tick clip cuts the second note short.
      { onset: T(2304), duration: T(96), pitch: 60 }, { onset: T(2496), duration: T(48), pitch: 62 }
    ]);
    // The clip window starts at tick 96, so the step note at 0 is cut and the rest move 96 ticks earlier.
    assert.deepEqual(simple(project.tracks[1].notes), [{ onset: T(1536), duration: T(48), pitch: 38 }]);
    assert.deepEqual(simple(project.tracks[2].notes), [{ onset: T(1824), duration: T(96), pitch: 40 }]);
    assert.deepEqual(project.tempos, [{ position: 0, bpm: 128.5 }]);
    assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }]);
    assert.deepEqual(project.warnings, []);
  });
}

test('classifies channels by display name, then playlist track name, then plugin name', () => {
  const [violin, fpc, synth] = flp.parse(file(songEvents(60)), 'song.flp').tracks;
  assert.deepEqual(violin.instrument, { name: 'Violin I', family: 'strings', order: 60, clef: 'treble', percussion: false });
  assert.equal(fpc.instrument.family, 'percussion');
  assert.equal(fpc.instrument.percussion, true);
  assert.equal(fpc.instrument.clef, 'percussion');
  // "Infiniti Player #3" names nothing, but its notes sit on the playlist track called "Cello".
  assert.deepEqual(synth.instrument, { name: 'Cello', family: 'strings', order: 62, clef: 'bass', percussion: false });
});

test('reads PPQ, legacy tempo events, the time signature and playlist time-signature markers', () => {
  const ppq = 192;
  const events = [
    ev(199, [...ascii('12.5.1.165'), 0]), ev(66, 98), ev(93, 250), ev(17, 3), ev(18, 4),
    ...pattern(1, [note(0, 0, 192, 67), note(576, 0, 192, 69)]),
    ...channel(0, { name: 'Flute' }),
    ev(99, 0), ev(233, clip(32, { position: 0, pattern: 1, length: 1152 })),
    // Markers: a plain one, then 6/8 from tick 1152 (bar 3 of 3/4 at 192 PPQ).
    ev(148, 384), text(205, 'Verse'),
    ev(148, 0x08000000 + 1152), text(205, '6/8'), ev(33, 6), ev(34, 8)
  ];
  const project = flp.parse(file(events, { ppq }), 'legacy.flp');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 98.25 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 3, denominator: 4 }, { index: 2, numerator: 6, denominator: 8 }]);
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: Q, pitch: 67 }, { onset: 3 * Q, duration: Q, pitch: 69 }]);
  assert.equal(project.tracks[0].instrument.family, 'woodwind');
  assert.equal(project.title, 'legacy');
});

test('places patterns one after another when the playlist has no pattern clips', () => {
  const events = songEvents(32).filter(item => item[0] !== 99 && item[0] !== 233);
  const project = flp.parse(file(events), 'song.flp');
  assert.ok(project.warnings.some(warning => /no pattern clips/u.test(warning)));
  // Pattern 1 fills bar 1 (384 ticks), pattern 2 then starts at tick 384 and keeps its step note.
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: T(96), pitch: 60 }, { onset: T(192), duration: T(96), pitch: 62 }]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: T(384), duration: T(24), pitch: 36 }, { onset: T(480), duration: T(48), pitch: 38 }]);
  assert.deepEqual(simple(project.tracks[2].notes), [{ onset: T(768), duration: T(96), pitch: 40 }]);
});

test('ignores audio and automation clips and warns about mutes, slides, extra arrangements and unplaced patterns', () => {
  const events = [
    ...header({ version: '24.2.2.4597' }),
    ...pattern(1, [note(0, 0, 96, 60), note(96, 0, 96, 64, 0x4008)]),
    ...pattern(2, [note(0, 0, 96, 72)], 'Bridge'),
    ...channel(0, { name: 'Oboe', enabled: 0 }),
    ev(99, 0), text(241, 'Main'),
    ev(233, [...automationClip(60), ...clip(60, { position: 384, pattern: 1, length: 384, flags: 0x2040, track: 2 })]),
    trackData(1), trackData(2, 0), text(239, 'Lead'),
    ev(99, 1), text(241, 'Alt'), ev(233, clip(60, { position: 0, pattern: 2, length: 384 }))
  ];
  const project = flp.parse(file(events), 'song.flp');
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: T(384), duration: T(96), pitch: 60 }]);
  assert.deepEqual(project.warnings, [
    'Skipped 1 slide note(s); FL Studio slide notes bend other notes rather than play.',
    'The project has 2 arrangements; only the first (Main) was imported.',
    'Skipped pattern(s) not placed in the playlist: Bridge.',
    '1 playlist clip(s) are muted in FL Studio; their notes were imported anyway.',
    'Playlist track(s) Lead are muted in FL Studio; their notes were imported anyway.',
    'Channel Oboe is muted in FL Studio; its notes were imported anyway.'
  ]);
});

test('reads FL 2026 streams whose event 172 has a one-byte payload', () => {
  const events = songEvents(88);
  // Read as a classic four-byte event, 172 would swallow the next channel's start event.
  events.splice(events.findIndex(item => item[0] === 64 && item[1] === 1), 0, [172, 1]);
  const project = flp.parse(file(events), 'song.flp');
  assert.deepEqual(project.tracks.map(track => [track.name, track.notes.length]), [['Violin I', 8], ['FPC', 1], ['Cello', 1]]);
});

test('accepts an ArrayBuffer and decodes UTF-16 names', () => {
  const events = [...header(), ...pattern(1, [note(0, 0, 96, 48)]), ...channel(0, { name: '大提琴' }), ...arrangement(60, [{ position: 0, pattern: 1, length: 384 }])];
  const bytes = file(events);
  const project = flp.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'cello.flp');
  assert.equal(project.tracks[0].name, '大提琴');
  assert.equal(project.tracks[0].instrument.clef, 'bass');
});

test('rejects truncated, malformed and unsupported files with clear errors', () => {
  const good = file(songEvents(60));
  const invalid = /^Invalid FL Studio project: /u;
  const cases = [
    [new Uint8Array(0), /missing the FLhd header/u],
    [Uint8Array.from(ascii('RIFF0000WAVE')), /missing the FLhd header/u],
    [good.slice(0, 12), /FLhd header is truncated/u],
    [Uint8Array.from([...ascii('FLhd'), ...u32(2), 0, 0, 0, 0, 0, 0]), /FLhd header is truncated or invalid/u],
    [good.slice(0, 14), /missing the FLdt data chunk/u],
    [good.slice(0, good.length - 10), /data chunk is truncated/u],
    [file([...header(), [224, 0x85]]), /truncated or invalid length/u],
    [file([...header(), [233, 40, 1, 2]]), /runs past the end/u],
    [file([...header(), ev(65, 1), ev(224, new Array(25).fill(0))]), /note data has 25 bytes/u],
    [file([...header(), ev(99, 0), ev(233, new Array(64).fill(7))]), /does not match any known FL Studio layout/u],
    [file([...header({ version: '11.1.0.46' })]), /FL Studio 11\.1\.0\.46 projects are not supported/u],
    [file([ev(156, 120000)]), /version is missing/u],
    [file(header(), { format: 0x10 }), /file format 16 is an FL Studio preset or score/u],
    [file(header(), { ppq: 0 }), /PPQ\) is zero/u]
  ];
  for (const [bytes, message] of cases) {
    assert.throws(() => flp.parse(bytes, 'bad.flp'), error => invalid.test(error.message) && message.test(error.message), String(message));
  }
});

// Real projects from the user's machine; never copied into the repo. FLP_SAMPLE_DIR overrides the folder.
const sampleDir = process.env.FLP_SAMPLE_DIR ?? 'F:/OneDrive/Download';
for (const name of ['25.1.3.flp', '暂歇的钟.flp', '烟花2025.flp', '当我拾起枯叶.flp', '机巧少女.flp', '在我们成为朋友之前.flp']) {
  const path = join(sampleDir, name);
  test(`parses the local sample project ${name}`, { skip: !existsSync(path) && 'sample not on this machine' }, () => {
    const project = flp.parse(new Uint8Array(readFileSync(path)), name);
    assert.ok(project.tracks.length > 0);
    assert.ok(project.tracks.every(track => track.notes.length > 0 && track.instrument?.family));
    assert.ok(project.tracks.flatMap(track => track.notes).every(note => Number.isFinite(note.onset) && note.duration > 0));
    assert.ok(project.tempos.every(tempo => Number.isFinite(tempo.bpm) && tempo.bpm > 0));
    assert.ok(project.meters[0].numerator > 0 && project.meters[0].denominator > 0);
  });
}
