function wordsDirection(doc, text, offset = 0) {
  const direction = doc.createElement('direction'); direction.setAttribute('placement', 'above');
  const type = doc.createElement('direction-type');
  const words = doc.createElement('words'); words.textContent = text; words.setAttribute('font-size', '10');
  type.appendChild(words); direction.appendChild(type);
  if (offset) {const node = doc.createElement('offset'); node.textContent = String(offset); direction.appendChild(node);}
  return direction;
}

export function annotateScore(xml, analysis, {showChords = false, showRepeats = true, choices = new Map(), translate = text => text} = {}) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Unable to annotate invalid MusicXML.');
  const part = [...doc.documentElement.children].find(node => node.localName === 'part');
  if (!part) return xml;
  const measures = [...part.children].filter(node => node.localName === 'measure');
  const insert = (index, text, offset = 0) => {
    const measure = measures[index]; if (!measure) return;
    const firstNote = [...measure.children].find(node => ['note','backup','forward'].includes(node.localName));
    measure.insertBefore(wordsDirection(doc, text, offset), firstNote || null);
  };
  if (showRepeats) for (const repeat of analysis.repeats) {
    for (const [index, occurrence] of repeat.occurrences.entries()) {
      insert(occurrence.startMeasure - 1, `${repeat.label}${index + 1}${index && repeat.lyricsDiffer ? translate('（异词）') : ''}`);
    }
  }
  let annotated = false;
  if (showChords) for (const chord of analysis.chords) {
    const key = `${chord.measureIndex}:${chord.offset}`;
    const chosen = choices.has(key) ? choices.get(key) : chord.candidates[0]?.symbol;
    if (!chosen || !chord.candidates.some(candidate => candidate.symbol === chosen)) continue;
    insert(chord.measureIndex, `${chosen} ?`, chord.offset || 0); annotated = true;
  }
  if (annotated) insert(0, translate('和弦为自动推测（?）'));
  return new XMLSerializer().serializeToString(doc);
}

/** Display names for the model's parts: a part that knows its voice bank shows it through label(name, singer). */
export function singerPartLabels(model, label = (name, singer) => `${name} (${singer})`) {
  return (model?.tracks ?? []).map(track => track.singer ? label(track.name, track.singer) : track.name);
}

const childElements = (node, ...names) => Array.from(node?.childNodes ?? []).filter(item => item.nodeType === 1 && names.includes(item.localName));

// Writes the given part names and marks each voice bank change above the staff where the new voice bank starts.
// Uses DOM Level 2 calls only, like the importers, so that it also runs under the test DOM.
export function annotateSingers(xml, model, labels) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Unable to annotate invalid MusicXML.');
  const root = doc.documentElement;
  const names = childElements(childElements(root, 'part-list')[0], 'score-part').map(part => childElements(part, 'part-name')[0]);
  const parts = childElements(root, 'part');
  (model?.tracks ?? []).forEach((track, index) => {
    if (names[index] && labels[index]) names[index].textContent = labels[index];
    const measures = childElements(parts[index], 'measure');
    for (const change of track.singerChanges ?? []) {
      const measure = measures[change.measureIndex];
      if (!measure) continue;
      measure.insertBefore(wordsDirection(doc, change.singer, change.offset), childElements(measure, 'note', 'backup', 'forward')[0] || null);
    }
  });
  return new XMLSerializer().serializeToString(doc);
}

export function scoreMetadata(xml, {title,by='',fontFamily,lyricFontSize=14}={}) {
  const doc=new DOMParser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(typeof title==='string')root.querySelector('work-title').textContent=title;
  const identification=root.querySelector(':scope > identification');
  if(by&&identification){const creator=doc.createElement('creator');creator.textContent=by;identification.insertBefore(creator,identification.firstChild);}
  if(fontFamily){const defaults=doc.createElement('defaults');for(const name of ['word-font','lyric-font']){const font=doc.createElement(name);font.setAttribute('font-family',fontFamily);font.setAttribute('font-size',String(lyricFontSize));defaults.append(font);}root.insertBefore(defaults,root.querySelector(':scope > part-list'));}
  return new XMLSerializer().serializeToString(doc);
}
