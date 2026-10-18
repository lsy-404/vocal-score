import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readHomeUrl } from '../src/lib/home-url.js';

const page = (content) => ({ querySelector: (selector) => (selector === 'meta[name="home-url"]' && content !== undefined ? { content } : null) });

test('reads the home URL the hosting site writes into the page', () => {
  assert.equal(readHomeUrl(page('/')), '/');
  assert.equal(readHomeUrl(page(' https://tiny.leisiyu.dev/ ')), 'https://tiny.leisiyu.dev/');
  assert.equal(readHomeUrl(page(undefined)), '');
  assert.equal(readHomeUrl(page('  ')), '');
  assert.equal(readHomeUrl(undefined), '');
});

test('both return links render only with a home URL and point to it', async () => {
  for (const file of ['../src/App.vue', '../src/components/StartupScreen.vue']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /<a v-if="homeUrl" class="[^"]*" :href="homeUrl" /, file);
    assert.doesNotMatch(source, /href="\/"/, file);
  }
});
