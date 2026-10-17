import assert from 'node:assert/strict';
import test from 'node:test';
import {alignLyricsToTracks, normalizePinyin} from '../src/lib/lyric-alignment.js';
import {alignLyrics, applyAlignedLyrics, warmLyricAlignment} from '../src/lib/lyric-worker.js';

const note = lyrics => ({lyrics, onset: 0, duration: 100, pitch: 60});
const track = (id, lyrics) => ({id, name: id, notes: lyrics.split(' ').map(note)});
// The corrected lyric of each note, or the old one in brackets where nothing changes.
const after = (result, tracks, trackIndex) => tracks[trackIndex].notes.map((item, noteIndex) => result.changes.find(change => change.trackIndex === trackIndex && change.noteIndex === noteIndex)?.to ?? `[${item.lyrics}]`).join('');
const marked = (result, text) => result.tokens.filter(token => token.status === 'none').map(token => text.slice(token.start, token.end)).join('');

test('normalizes tone marks, tone digits, ü, and v spellings', () => {
  assert.equal(normalizePinyin('lǚ3'), 'lv');
  assert.equal(normalizePinyin('lü4'), 'lv');
  assert.equal(normalizePinyin('NǏ3'), 'ni');
  assert.equal(normalizePinyin('ni2'), 'ni');
  assert.equal(normalizePinyin('lue'), 'lve');
  assert.equal(normalizePinyin('jv'), 'ju');
});

test('corrects every voice from one lyric pasted in any order, paragraphs and line breaks', () => {
  // A made-up song: the lead sings two verses and the chorus twice; a second voice sings one line and the chorus.
  const tracks = [
    track('lead', 'chun feng chui guo shan gang hua kai man di xiang ye se wei lan xing guang can lan wo men yi qi chang ge wo men yi qi chang ge'),
    track('second', 'yue liang sheng qi lai wo men yi qi chang ge')
  ];
  // Verses swapped, lines broken differently, punctuation, a line no voice sings, and the chorus written once.
  const text = '夜色微澜，星光灿烂——\n\n春风吹过\n山岗花开满地香！\n月亮升起来\n这一句谁也没唱\n我们一起唱歌';
  const result = alignLyricsToTracks(text, tracks);
  assert.equal(after(result, tracks, 0), '春风吹过山岗花开满地香夜色微澜星光灿烂我们一起唱歌我们一起唱歌', 'a chorus written once covers each time it is sung');
  assert.equal(after(result, tracks, 1), '月亮升起来我们一起唱歌');
  assert.equal(marked(result, text), '这一句谁也没唱', 'only what no voice sings is marked as missing');
  assert.equal(result.tokens.some(token => /[，——！\n]/u.test(token.value)), false, 'punctuation and line breaks are not syllables');
  assert.deepEqual(result.voices.map(voice => [voice.name, voice.matched, voice.syllables, voice.uncovered]), [['lead', 31, 31, 0], ['second', 11, 11, 0]]);
  assert.equal(applyAlignedLyrics(tracks, result.changes), 42);
  assert.equal(tracks[1].notes[0].lyrics, '月');
  assert.deepEqual(alignLyricsToTracks(text, tracks).changes, [], 'once corrected, the same lyric changes nothing');
  assert.equal(alignLyricsToTracks(text, tracks).tokens.find(token => token.value === '月').status, 'same');
});

test('tells apart the characters a reading cannot, such as 她, 他, 祂 and TA', () => {
  const tracks = [track('v', 'ta ru bing mian ta chun bian xiao er ta wei ceng du wan')];
  const result = alignLyricsToTracks('她 如冰面\n他 唇边笑\n而TA 未曾读完', tracks);
  assert.equal(after(result, tracks, 0), '她如冰面他唇边笑而TA未曾读完');
});

test('keeps paired spellings, re-sung vowels, breaths, phoneme notes and spelling variants in step', () => {
  const tracks = [track('v', 'jiang xin sheng juan ke na jiao ao br zou ou dao tian ya .l_y_E lue guo')];
  tracks[0].notes[14].lyrics = '.l y E';
  // 心声/新生 offers two spellings of the same syllables; 骄傲 is sung "jiao ao", 走 is "zou" held on "ou".
  const text = '将心声/新生镌刻 那骄傲 走到天涯 掠过';
  const result = alignLyricsToTracks(text, tracks);
  assert.equal(after(result, tracks, 0), '将心声镌刻那骄傲[br]走[ou]到天涯[.l y E]掠过');
  const statusOf = character => result.tokens.find(token => token.value === character).status;
  assert.equal(statusOf('新'), statusOf('心'), 'the second spelling is marked like the first');
  assert.equal(result.voices[0].uncovered, 0, 'breaths, re-sung vowels and phoneme notes need no pasted syllable');
});

test('writes pinyin readings on request and marks a syllable aligned to a different one', () => {
  const tracks = [track('v', 'wo men zai yi qi chang')];
  assert.equal(after(alignLyricsToTracks('我们在一起唱', tracks, {write: 'pinyin'}), tracks, 0), '[wo][men][zai][yi][qi][chang]', 'the same pinyin needs no change');
  const typo = alignLyricsToTracks('我们再一起唱', tracks);
  assert.equal(typo.tokens.find(token => token.value === '再').status, 'change', '再 and 在 read alike');
  const different = alignLyricsToTracks('我们都一起唱', tracks);
  assert.equal(different.tokens.find(token => token.value === '都').status, 'low', 'a syllable sung differently is aligned but flagged');
  assert.equal(alignLyricsToTracks('', tracks).tokens.length, 0);
  assert.equal(alignLyricsToTracks('火星', tracks).changes.length, 0, 'two syllables are too few to place');
});

test('aligns through the worker client, falling back to the page where workers are unavailable', async () => {
  assert.equal(typeof Worker, 'undefined', 'Node has no Web Worker, so this exercises the fallback path');
  assert.equal(await warmLyricAlignment(), false);
  const tracks = [track('lead', 'wo men yi qi chang ge'), track('echo', 'yi qi chang')];
  const text = '我们一起唱歌';
  const viaClient = await alignLyrics(text, tracks, {write: 'typed'});
  assert.deepEqual(viaClient, alignLyricsToTracks(text, tracks.map(({id, name, notes}) => ({id, name, notes: notes.map(({lyrics}) => ({lyrics}))}))));
  assert.equal(applyAlignedLyrics(tracks, viaClient.changes), 9);
  assert.equal(tracks.map(item => item.notes.map(note => note.lyrics).join('')).join('|'), '我们一起唱歌|一起唱');
});
