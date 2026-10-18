// The hosting site passes its main menu as <meta name="home-url">. Without it there is nothing to return to.
export function readHomeUrl(doc = globalThis.document) {
  return doc?.querySelector('meta[name="home-url"]')?.content?.trim() || '';
}
