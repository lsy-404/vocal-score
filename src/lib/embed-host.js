// A desktop host such as Synthesizer V Toolbox can show this app in a frame, hand it projects and its language, and take
// the exports into its own save dialog. The host names its origins in <meta name="embed-host-origins">; without that meta,
// or outside a frame, nothing here runs and the app behaves as it does on its own site.
export const EMBED_PROTOCOL = 'vocal-score-embed';
export const EMBED_VERSION = 1;

export function readEmbedHostOrigins(doc = globalThis.document) {
  const content = doc?.querySelector('meta[name="embed-host-origins"]')?.content ?? '';
  // A wildcard or an opaque origin would let any page that frames this app talk to it.
  return [...new Set(content.split(/\s+/u).filter(origin => origin && origin !== '*' && origin !== 'null'))];
}

// The message the framing host sent in this protocol, or null for anything else that reaches the window.
// The version is not compared: hosts and the app evolve the protocol by adding, and unknown types or fields are ignored.
export function acceptHostMessage(event, {parent, origins}) {
  // The parent window alone is not enough: it may have navigated to another site since it framed the app.
  if (!parent || event?.source !== parent || !origins.includes(event.origin)) return null;
  const data = event.data;
  if (!data || typeof data !== 'object' || data.protocol !== EMBED_PROTOCOL || typeof data.type !== 'string') return null;
  return data;
}

const envelope = (type, payload) => ({protocol: EMBED_PROTOCOL, version: EMBED_VERSION, type, ...payload});
const isFile = value => value instanceof Blob && typeof value.name === 'string';

export function connectEmbedHost({view = globalThis.window, formats = [], onOpenFiles, onLanguage} = {}) {
  const origins = readEmbedHostOrigins(view?.document);
  const parent = view?.parent;
  const capabilities = new Set();
  let hostOrigin = '';
  const connection = {
    get connected() { return Boolean(hostOrigin); },
    // Hands an export to the host's save dialog; false means the page downloads it itself.
    saveFile(name, blob) {
      if (!hostOrigin || !capabilities.has('save-file')) return false;
      parent.postMessage(envelope('save-file', {name, mime: blob.type, data: blob}), hostOrigin);
      return true;
    },
    // Hands a link to the host, which opens it outside the frame; false means the page opens it itself.
    openLink(url) {
      if (!hostOrigin || !capabilities.has('open-link')) return false;
      parent.postMessage(envelope('open-link', {url: String(new URL(url, view.document.baseURI))}), hostOrigin);
      return true;
    },
    disconnect() {}
  };
  if (!origins.length || !parent || parent === view) return connection;

  function receive(event) {
    const message = acceptHostMessage(event, {parent, origins});
    if (!message) return;
    if (message.type === 'hello') {
      hostOrigin = event.origin;
      capabilities.clear();
      for (const capability of Array.isArray(message.capabilities) ? message.capabilities : []) if (typeof capability === 'string') capabilities.add(capability);
      if (typeof message.language === 'string') onLanguage?.(message.language);
    } else if (message.type === 'set-language' && typeof message.language === 'string') {
      onLanguage?.(message.language);
    } else if (message.type === 'open-files' && Array.isArray(message.files)) {
      const files = message.files.filter(isFile);
      if (files.length) onOpenFiles?.(files);
    }
  }
  // Links that would open a new browser window go to the host instead, which opens them in the system browser.
  function click(event) {
    const anchor = event.target?.closest?.('a[target="_blank"][href]');
    if (anchor && connection.openLink(anchor.href)) event.preventDefault();
  }
  view.addEventListener('message', receive);
  view.document.addEventListener('click', click, true);
  // The host may be on any of its origins; the browser drops a message whose target origin is not the parent's.
  for (const origin of origins) parent.postMessage(envelope('ready', {formats}), origin);
  connection.disconnect = () => {
    view.removeEventListener('message', receive);
    view.document.removeEventListener('click', click, true);
    hostOrigin = '';
  };
  return connection;
}
