import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EMBED_PROTOCOL, EMBED_VERSION, acceptHostMessage, connectEmbedHost, readEmbedHostOrigins } from '../src/lib/embed-host.js';

const HOST = 'http://tauri.localhost';
const page = (content) => ({ querySelector: (selector) => (selector === 'meta[name="embed-host-origins"]' && content !== undefined ? { content } : null) });
const message = (type, payload = {}) => ({ protocol: EMBED_PROTOCOL, version: EMBED_VERSION, type, ...payload });

// A frame window whose parent records what it was sent, with the listeners the module adds.
function framedWindow(origins) {
  const posted = [];
  const listeners = { message: new Set(), click: new Set() };
  const parent = { postMessage: (data, origin) => posted.push({ data, origin }) };
  const document = {
    ...page(origins),
    baseURI: 'http://toolbox-score.localhost/index.html',
    addEventListener: (type, listener) => listeners[type].add(listener),
    removeEventListener: (type, listener) => listeners[type].delete(listener),
  };
  const view = {
    parent,
    document,
    addEventListener: (type, listener) => listeners[type].add(listener),
    removeEventListener: (type, listener) => listeners[type].delete(listener),
  };
  const deliver = (data, { origin = HOST, source = parent } = {}) => { for (const listener of listeners.message) listener({ data, origin, source }); };
  const click = (anchor) => {
    const event = { target: { closest: (selector) => (selector === 'a[target="_blank"][href]' ? anchor : null) }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of listeners.click) listener(event);
    return event;
  };
  return { view, parent, posted, listeners, deliver, click };
}

test('reads the host origins and refuses wildcard or opaque ones', () => {
  assert.deepEqual(readEmbedHostOrigins(page(' tauri://localhost  http://tauri.localhost ')), ['tauri://localhost', 'http://tauri.localhost']);
  assert.deepEqual(readEmbedHostOrigins(page('* null')), []);
  assert.deepEqual(readEmbedHostOrigins(page(undefined)), []);
  assert.deepEqual(readEmbedHostOrigins(undefined), []);
});

test('accepts only protocol messages from the framing host', () => {
  const parent = {};
  const origins = [HOST];
  const hello = message('hello');
  assert.deepEqual(acceptHostMessage({ data: hello, origin: HOST, source: parent }, { parent, origins }), hello);
  assert.equal(acceptHostMessage({ data: hello, origin: 'https://evil.example', source: parent }, { parent, origins }), null, 'another origin');
  assert.equal(acceptHostMessage({ data: hello, origin: HOST, source: {} }, { parent, origins }), null, 'another window, such as a worker or a nested frame');
  assert.equal(acceptHostMessage({ data: { ...hello, protocol: 'plugin-ui' }, origin: HOST, source: parent }, { parent, origins }), null, 'another protocol');
  for (const version of [EMBED_VERSION + 1, 0, undefined]) {
    const other = { ...hello, version };
    assert.deepEqual(acceptHostMessage({ data: other, origin: HOST, source: parent }, { parent, origins }), other, `version ${version} is not compared`);
  }
  assert.equal(acceptHostMessage({ data: { ...hello, type: 42 }, origin: HOST, source: parent }, { parent, origins }), null, 'a type that is not a string');
  for (const data of [null, undefined, 'hello', 7]) assert.equal(acceptHostMessage({ data, origin: HOST, source: parent }, { parent, origins }), null, String(data));
});

test('stays out of the way without host origins or outside a frame', () => {
  const unframed = framedWindow(undefined);
  const connection = connectEmbedHost({ view: unframed.view });
  assert.equal(unframed.posted.length, 0);
  assert.equal(connection.saveFile('a.pdf', new Blob(['x'])), false);
  assert.equal(connection.openLink('https://example.com/'), false);

  const top = framedWindow(HOST);
  top.view.parent = top.view;
  connectEmbedHost({ view: top.view });
  assert.equal(top.posted.length, 0);
});

test('announces itself, then delegates saving and links only after the host says hello', () => {
  const frame = framedWindow(`tauri://localhost ${HOST}`);
  const languages = [];
  const opened = [];
  const connection = connectEmbedHost({ view: frame.view, formats: ['svp', 'mid'], onLanguage: (language) => languages.push(language), onOpenFiles: (files) => opened.push(files) });
  assert.deepEqual(frame.posted.map((item) => [item.origin, item.data.type, item.data.formats]), [['tauri://localhost', 'ready', ['svp', 'mid']], [HOST, 'ready', ['svp', 'mid']]]);

  const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
  assert.equal(connection.saveFile('song.pdf', pdf), false, 'no host yet');
  frame.deliver(message('hello', { capabilities: ['save-file', 'open-link', 7], language: 'en' }));
  assert.equal(connection.connected, true);
  assert.deepEqual(languages, ['en']);

  frame.posted.length = 0;
  assert.equal(connection.saveFile('song.pdf', pdf), true);
  assert.deepEqual(frame.posted.map((item) => [item.origin, item.data.type, item.data.name, item.data.mime, item.data.data]), [[HOST, 'save-file', 'song.pdf', 'application/pdf', pdf]]);

  const event = frame.click({ href: 'https://github.com/lsy-404/vocal-score' });
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(frame.posted.at(-1).data, message('open-link', { url: 'https://github.com/lsy-404/vocal-score' }));
  assert.equal(connection.openLink('vendor/THIRD-PARTY.txt'), true);
  assert.equal(frame.posted.at(-1).data.url, 'http://toolbox-score.localhost/vendor/THIRD-PARTY.txt');

  const svp = new File(['{}'], 'song.svp');
  frame.deliver(message('open-files', { files: [svp, 'not a file', { name: 'fake.svp' }] }));
  assert.deepEqual(opened, [[svp]]);
  frame.deliver(message('set-language', { language: 'ja' }));
  assert.deepEqual(languages, ['en', 'ja']);
});

test('keeps capabilities the host did not offer in the page', () => {
  const frame = framedWindow(HOST);
  const connection = connectEmbedHost({ view: frame.view });
  frame.deliver(message('hello', { capabilities: ['open-link'] }));
  assert.equal(connection.saveFile('song.pdf', new Blob(['x'])), false);
  assert.equal(connection.openLink('https://example.com/'), true);
});

test('ignores messages from other origins and stops listening after disconnecting', () => {
  const frame = framedWindow(HOST);
  const opened = [];
  const connection = connectEmbedHost({ view: frame.view, onOpenFiles: (files) => opened.push(files) });
  frame.deliver(message('hello', { capabilities: ['save-file'] }), { origin: 'https://evil.example' });
  assert.equal(connection.connected, false);
  frame.deliver(message('open-files', { files: [new File(['{}'], 'a.svp')] }), { origin: 'https://evil.example' });
  assert.deepEqual(opened, []);

  frame.deliver(message('hello', { capabilities: ['save-file'] }));
  connection.disconnect();
  assert.equal(connection.connected, false);
  assert.equal(frame.listeners.message.size, 0);
  assert.equal(frame.listeners.click.size, 0);
});

test('the app connects after saved projects are restored and routes downloads through the host first', async () => {
  const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  assert.match(source, /await restoreDocuments\(\);\s*\/\/[^\n]*\n\s*embedHost=connectEmbedHost\(/);
  assert.match(source, /if\(embedHost\?\.saveFile\(name\+suffix,blob\)\)return;const url=URL\.createObjectURL\(blob\)/);
  assert.match(source, /onBeforeUnmount\(\(\)=>\{embedHost\?\.disconnect\(\);/);
  // A language the host sets after the page started must show in the picker too.
  const picker = await readFile(new URL('../src/components/LanguagePicker.vue', import.meta.url), 'utf8');
  assert.match(picker, /const selected = computed\(\{get: getLanguage, set: setLanguage\}\);/);
});
