// Builds Standard MIDI File bytes for the MIDI, VOCALOID MIDI and VSQ importer tests.
const ascii = text => [...text].map(char => char.charCodeAt(0));
const u32 = value => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

export function vlq(value) {
  const out = [value & 0x7f];
  while ((value >>>= 7)) out.unshift((value & 0x7f) | 0x80);
  return out;
}

export const event = (delta, ...data) => [...vlq(delta), ...data];
export const meta = (delta, type, data) => {
  const payload = typeof data === 'string' ? [...new TextEncoder().encode(data)] : [...data];
  return [...vlq(delta), 0xff, type, ...vlq(payload.length), ...payload];
};
export const trackName = (delta, name) => meta(delta, 0x03, name);
export const lyric = (delta, text) => meta(delta, 0x05, text);
export const text = (delta, value) => meta(delta, 0x01, value);
export const tempo = (delta, bpm) => {
  const micros = Math.round(60000000 / bpm);
  return meta(delta, 0x51, [(micros >> 16) & 255, (micros >> 8) & 255, micros & 255]);
};
export const timeSignature = (delta, numerator, denominator) => meta(delta, 0x58, [numerator, Math.log2(denominator), 24, 8]);

export function track(...events) {
  const body = [...events.flat(), ...meta(0, 0x2f, [])];
  return [...ascii('MTrk'), ...u32(body.length), ...body];
}

export function smf({ format = 1, division = 480 } = {}, ...tracks) {
  return Uint8Array.from([...ascii('MThd'), ...u32(6), 0, format, tracks.length >> 8, tracks.length & 255, division >> 8, division & 255, ...tracks.flat()]);
}

// Node has no Shift_JIS encoder; these are the only kana the VSQ fixtures use.
const SJIS = { 'あ': [0x82, 0xa0], 'い': [0x82, 0xa2], 'さ': [0x82, 0xb3] };
export const shiftJis = value => [...value].flatMap(char => SJIS[char] ?? [char.charCodeAt(0)]);

/** Text events "DM:nnnn:" carrying a VSQ text body; chunks are cut right after the first multi-byte lead byte. */
export function dmEvents(body) {
  const bytes = shiftJis(body), size = bytes.findIndex(byte => byte > 0x7f) + 1 || 100;
  const events = [];
  for (let at = 0; at < bytes.length; at += size) events.push(meta(0, 0x01, [...ascii(`DM:${String(events.length).padStart(4, '0')}:`), ...bytes.slice(at, at + size)]));
  return events;
}

const anote = (id, length, key) => `[ID#${id}]\nType=Anote\nLength=${length}\nNote#=${key}\nDynamics=64\nLyricHandle=h#${id}`;
const handle = (id, lyric) => `[h#${id}]\nL0="${lyric}","a",0.000000,64,0,0`;

/**
 * A two-track VSQ-style file with one pre-measure bar: "Voice" sings あ(60) - (62) さ(64) at bars 1-2 and い(65), plus a
 * note inside the pre-measure; "Chorus" sings la(55). Tempo 120 -> 130 inside the pre-measure, 150 at tick 3840;
 * 3/4 from tick 5760.
 */
export function vsqFile() {
  const voice = [
    '[Common]', 'Version=DSB301', 'Name=Voice', '[Master]', 'PreMeasure=1',
    '[EventList]', '0=ID#0000', '960=ID#0005', '1920=ID#0001', '2400=ID#0002', '2880=ID#0003', '3360=ID#0004', '3840=EOS',
    '[ID#0000]', 'Type=Singer', 'IconHandle=h#0000',
    anote('0001', 480, 60), anote('0002', 480, 62), anote('0003', 480, 64), anote('0004', 960, 65), anote('0005', 240, 50),
    '[h#0000]', 'IconID=$07010000', 'IDS=Miku',
    handle('0001', 'あ'), handle('0002', '-'), handle('0003', 'さ'), handle('0004', 'い'), handle('0005', 'x')
  ].join('\r\n');
  const chorus = ['[Common]', 'Name=Chorus', '[EventList]', '1920=ID#0001', '[ID#0001]', 'Type=Anote', 'Length=1920', 'Note#=55', 'LyricHandle=h#0001', handle('0001', 'la')].join('\n');
  return smf({ format: 1 },
    track(trackName(0, 'Master Track'), tempo(0, 120), timeSignature(0, 4, 4), tempo(960, 130), tempo(2880, 150), timeSignature(1920, 3, 4)),
    track(trackName(0, 'Voice'), ...dmEvents(voice)),
    track(trackName(0, 'Chorus'), ...dmEvents(chorus))
  );
}
