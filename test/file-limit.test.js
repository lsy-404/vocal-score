import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('projects of every format and songs share one 2 GB limit', async () => {
  const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  assert.match(source, /const FILE_LIMIT_MB=2048,/);
  assert.match(source, /if\(file\.size>FILE_LIMIT_MB\*1024\*1024\)throw new Error\(t\('音频文件超过 \{size\} MB。',\{size:FILE_LIMIT_MB\}\)\);/);
  assert.match(source, /if\(file\.size>FILE_LIMIT_MB\*1024\*1024\)throw new Error\(t\('文件超过 \{size\} MB，请缩小工程后再导入。',\{size:FILE_LIMIT_MB\}\)\);/);
  assert.equal(source.match(/file\.size>/g).length, 2, 'no other size check');
});
