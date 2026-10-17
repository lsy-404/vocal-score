import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeSettings} from '../src/lib/storage.js';

test('moves projects saved with the old default merge level to automatic merging', () => {
  assert.deepEqual(upgradeSettings({noteMerge: 'low', grid: 16}), {noteMerge: 'auto', grid: 16});
  assert.equal(upgradeSettings({noteMerge: 'low', glides: 'line'}).noteMerge, 'low', 'a level chosen once notation styles exist stays');
  assert.equal(upgradeSettings({noteMerge: 'high'}).noteMerge, 'high', 'other levels were chosen on purpose');
  assert.deepEqual(upgradeSettings(undefined), {});
});

test('moves projects saved with the old pop lead sheet to slurs over melismas, once', () => {
  const leadSheet = {noteMerge: 'auto', glides: 'line', melisma: 'extender', tupletMarks: 'bracket', swing: false};
  assert.equal(upgradeSettings(leadSheet).melisma, 'both');
  assert.equal(upgradeSettings({...leadSheet, styleVersion: 2}).melisma, 'extender', 'an extender chosen with style version 2 stays');
  assert.equal(upgradeSettings({...leadSheet, tupletMarks: 'simile'}).melisma, 'extender', 'a custom style stays as it was');
});
