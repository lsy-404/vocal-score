import test from 'node:test';
import assert from 'node:assert/strict';
import {findLyricCandidates, isPinyinLyric} from '../src/lib/lyric-candidates.js';

const Q = 705600000;
const part = (id, name, lyrics, from = 0) => ({id, name, notes: lyrics.map((text, index) => ({onset: (from + index) * Q, duration: Q, lyrics: text}))});
const meters = [{index: 0, numerator: 4, denominator: 4}];
const forNote = (found, trackId, noteIndex) => found.find(entry => entry.trackId === trackId && entry.noteIndex === noteIndex);

test('lyrics typed as one pinyin syllable are recognized', () => {
  for (const text of ['yue', 'yue4', 'YE', 'nǚ', 'lve', 'zhuang']) assert.ok(isPinyinLyric(text), text);
  for (const text of ['乐', '-', '+', 'br', 'yinyue love', 'hello', '', '.iA N']) assert.ok(!isPinyinLyric(text), text);
});

test('another part singing the same words at the same time supplies the character', () => {
  const found = findLyricCandidates([part('a', 'Lead', ['我', '们', '一', '起', '唱']), part('b', 'Harmony', ['wo', 'men', 'yi', 'qi', 'chang'])], meters);
  const wo = forNote(found, 'b', 0);
  assert.equal(wo.candidates[0].text, '我');
  assert.deepEqual(wo.candidates[0].source, {kind: 'time', trackName: 'Lead'});
  assert.equal(found.filter(entry => entry.trackId === 'b' && entry.candidates[0]?.source.kind === 'time').length, 5, 'every syllable of the part');
});

test('the same words earlier or later in the song supply the character, closest context first', () => {
  const tracks = [part('a', 'Lead', ['我', '也', '试', '一', '次', '你', '画', 'ye', '是'])];
  const ye = forNote(findLyricCandidates(tracks, meters), 'a', 7);
  assert.equal(ye.candidates[0].text, '也');
  assert.equal(ye.candidates[0].source.kind, 'context');
  assert.equal(ye.candidates[0].source.bar, 1);
  assert.match(ye.candidates[0].source.snippet, /也/u);
});

test('a word with the neighbouring syllable supplies the character, whether it is written or typed as pinyin', () => {
  const written = forNote(findLyricCandidates([part('a', 'Lead', ['你', '写', '的', '音', 'yue'])], meters), 'a', 4);
  assert.equal(written.candidates[0].text, '乐');
  assert.deepEqual(written.candidates[0].source, {kind: 'word', word: '音乐'});
  const typed = findLyricCandidates([part('a', 'Lead', ['xie', 'de', 'yin', 'yue'])], meters);
  assert.equal(forNote(typed, 'a', 3).candidates[0].text, '乐', 'yue after yin');
  assert.equal(forNote(typed, 'a', 2).candidates[0].text, '音', 'yin before yue takes its own side of the word');
});

test('common characters of the reading are offered after the song\'s own, and pinyin sung alongside is found', () => {
  const found = findLyricCandidates([part('a', 'Lead', ['唱', 'ge']), part('b', 'Harmony', ['chang', 'ge'])], meters);
  const ge = forNote(found, 'a', 1);
  assert.ok(ge.homophones.includes('歌') && ge.homophones.includes('个'));
  assert.deepEqual(ge.together, [{trackId: 'b', noteIndex: 1}], 'the harmony\'s ge at the same time');
  assert.equal(forNote(found, 'b', 0).candidates[0].text, '唱');
  assert.ok(!forNote(found, 'b', 0).homophones.includes('唱'), 'a candidate is not repeated among the homophones');
});

test('bar numbers follow meter changes', () => {
  const tracks = [part('a', 'Lead', ['也'], 0), part('b', 'Late', ['ye'], 20)];
  const found = findLyricCandidates(tracks, [{index: 0, numerator: 4, denominator: 4}, {index: 2, numerator: 3, denominator: 4}]);
  assert.equal(forNote(found, 'b', 0).candidates[0].source.bar, 1);
  const late = findLyricCandidates([part('a', 'Lead', ['也'], 11), part('b', 'Early', ['ye'], 0)], [{index: 0, numerator: 4, denominator: 4}, {index: 2, numerator: 3, denominator: 4}]);
  assert.equal(forNote(late, 'b', 0).candidates[0].source.bar, 4, 'quarter 11 is in the fourth bar after two bars of 4/4 and one of 3/4');
});

test('candidates from the song itself are marked for self-check, with where the lyric sits', () => {
  const tracks = [
    part('a', 'Lead', ['我', '们', '一', '起', '唱', '或', '许', '那', '天'], 0),
    part('b', 'Harmony', ['wo', 'men', 'yi', 'qi', 'chang'], 0),
    part('c', 'Late', ['ni', 'shuo', 'huo', 'xu', 'na', 'tian'], 12),
  ];
  const found = findLyricCandidates(tracks, meters);
  const wo = forNote(found, 'b', 0);
  assert.equal(wo.candidates[0].confident, true, 'another part at the same time');
  assert.equal(wo.bar, 1);
  assert.deepEqual([wo.before, wo.after], [[], ['men', 'yi']]);
  const xu = forNote(found, 'c', 3);
  assert.equal(xu.candidates[0].text, '许');
  assert.equal(xu.candidates[0].confident, true, 'the same phrase elsewhere, neighbours matching');
  assert.ok(xu.candidates[0].source.matched > 1);
  assert.equal(xu.bar, 4);
  assert.deepEqual([xu.before, xu.after], [['ni', 'shuo', 'huo'], ['na', 'tian']]);
  const shuo = forNote(found, 'c', 1);
  assert.ok(!shuo || shuo.candidates.every(item => !item.confident), 'a reading found nowhere nearby is not offered for self-check');
  const lone = forNote(findLyricCandidates([part('a', 'Lead', ['也', '是', '你']), part('b', 'Later', ['wo', 'ye', 'shi'], 8)], meters), 'b', 1);
  assert.equal(lone.candidates[0].confident, true, 'ye next to shi matches 也是');
  const weak = forNote(findLyricCandidates([part('a', 'Lead', ['约', '定']), part('b', 'Later', ['sui', 'yue'], 8)], meters), 'b', 1);
  assert.equal(weak.candidates[0].text, '约');
  assert.equal(weak.candidates[0].confident, false, 'the same reading with nothing around it matching is only a suggestion');
});
