import test from 'node:test';
import assert from 'node:assert/strict';
import {getLanguage, setLanguage} from '../src/i18n.js';
import {translateError, translateWarning} from '../src/ui-messages.js';

test('translates converter warnings and primary errors with their parameters', tcase => {
  const previous = getLanguage();
  tcase.after(() => setLanguage(previous));

  setLanguage('en');
  assert.equal(translateWarning('Track Alto: group missing-1 was not found.'), 'Alto: note group missing-1 was not found.');
  assert.equal(translateWarning('Lead: 12 note(s) keep a remaining tuning deviation as metadata, not engraved.'), 'Lead: 12 notes keep their remaining cents as metadata, not engraved.');
  assert.equal(translateWarning('Swing notation: 3 beat(s) with straight eighths will read as swung.'), 'Swing notation: 3 beats have straight eighths that will read as swung.');
  assert.equal(translateWarning('Lead: 4 note(s) shifted by grid quantization.'), '4 note(s) in Lead were shifted to the rhythm grid.');
  assert.equal(translateWarning('Lead: pitch curve uses a linear sampling approximation for note adjustment.'), 'Lead: a linear sampling approximation was used to adjust notes from the pitch curve.');
  assert.equal(translateWarning('Lead: pitch 130 is outside the supported MIDI range 0–127 or uses fractional semitones.'), 'Lead: pitch 130 is outside MIDI range 0–127 or is not an integer semitone.');
  assert.equal(translateError(new RangeError('Grid must be 4, 8, 16, or 32.')), 'Grid must be 4, 8, 16, or 32.');

  setLanguage('ja');
  assert.match(translateWarning('Lead: 3 note(s) keep a remaining tuning deviation as metadata, not engraved.'), /3 音符の残りのセント差/u);
  setLanguage('ko');
  assert.match(translateWarning('Lead: 2 note(s) shifted by grid quantization.'), /음표 2개/u);
  assert.equal(translateError(new Error('An unknown renderer failure')), 'An unknown renderer failure');
});

test('translates pitch-curve approximation and overlapping-voice warnings', tcase => {
  const previous = getLanguage();
  tcase.after(() => setLanguage(previous));
  setLanguage('zh-CN');
  assert.equal(translateWarning('Lead: cubic pitch curve uses a linear sampling approximation for note adjustment.'), 'Lead：音高曲线使用线性采样近似来调整音符。');
  assert.equal(translateWarning('Lead: overlapping notes are rendered as 2 voices.'), 'Lead：重叠音符以 2 个声部呈现。');
  assert.equal(translateError(new Error('Cannot represent rest duration 1.25 at the selected grid')), '无法用所选节奏网格表示休止时值 1.25。');
  assert.equal(translateWarning('Unrecognized warning from a future converter version.'), 'Unrecognized warning from a future converter version.');
});
