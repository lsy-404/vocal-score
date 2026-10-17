import './dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import musicxml from '../../src/lib/importers/musicxml.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);
const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

const note = (step, octave, duration, extra = '') => `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration>${extra}</note>`;
const lyric = (text, syllabic = 'single', extend = '') => `<lyric number="1"><syllabic>${syllabic}</syllabic><text>${text}</text>${extend}</lyric>`;
const score = (body, partList = '<score-part id="P1"><part-name>Voice</part-name></score-part>') => `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><part-list>${partList}</part-list>${body}</score-partwise>`;

const DUET = score(`
<part id="P1">
  <measure number="1">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>100</per-minute></metronome></direction-type><sound tempo="100"/></direction>
    ${note('C', 4, 2, `<voice>1</voice><type>quarter</type>${lyric('Hel', 'begin')}`)}
    ${note('D', 4, 2, '<voice>1</voice><type>quarter</type>')}
    ${note('E', 4, 2, `<voice>1</voice><type>quarter</type>${lyric('lo', 'end', '<extend type="start"/>')}`)}
    ${note('F', 4, 2, '<tie type="start"/><voice>1</voice><type>quarter</type><notations><tied type="start"/></notations>')}
  </measure>
  <measure number="2">
    ${note('F', 4, 4, '<tie type="stop"/><voice>1</voice><type>half</type><notations><tied type="stop"/></notations>')}
    <note><rest/><duration>4</duration><voice>1</voice><type>half</type></note>
  </measure>
  <measure number="3">
    <attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
    <direction><direction-type><words>rit.</words></direction-type><sound tempo="80"/></direction>
    ${note('G', 4, 2, `<voice>1</voice>${lyric('la')}`)}
    ${note('B', 4, 2, '<chord/><voice>1</voice>')}
    ${note('A', 4, 4, `<voice>1</voice>${lyric('di')}`)}
    <backup><duration>6</duration></backup>
    <forward><duration>2</duration><voice>2</voice></forward>
    ${note('C', 4, 4, '<voice>2</voice>')}
  </measure>
</part>
<part id="P2">
  <measure number="1">
    <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>
    ${note('C', 3, 4)}
  </measure>
  <measure number="2"><note><rest measure="yes"/><duration>4</duration></note></measure>
  <measure number="3">${note('E', 3, 3)}</measure>
</part>`, `<score-part id="P1"><part-name>Soprano</part-name></score-part>
<score-part id="P2"><part-name>Piano</part-name><score-instrument id="P2-I1"><instrument-name>Acoustic Grand Piano</instrument-name></score-instrument><midi-instrument id="P2-I1"><midi-channel>2</midi-channel><midi-program>1</midi-program></midi-instrument></score-part>`).replace('<part-list>', '<work><work-title>Test Song</work-title></work><part-list>');

test('MusicXML parts become tracks with ties, chords, voices, melismas and tempo/meter changes', () => {
  const project = musicxml.parse(encode(DUET), 'duet.musicxml');
  assert.equal(project.format, 'MusicXML');
  assert.equal(project.title, 'Test Song');
  assert.equal(project.version, '4.0');
  assert.deepEqual(project.tracks.map(track => track.name), ['Soprano', 'Piano']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'Hel' },
    { onset: Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 2 * Q, duration: Q, pitch: 64, lyrics: 'lo' },
    { onset: 3 * Q, duration: 3 * Q, pitch: 65, lyrics: EXTENSION_LYRIC },
    { onset: 8 * Q, duration: Q, pitch: 67, lyrics: 'la' },
    { onset: 8 * Q, duration: Q, pitch: 71, lyrics: 'la' },
    { onset: 9 * Q, duration: 2 * Q, pitch: 60, lyrics: '' },
    { onset: 9 * Q, duration: 2 * Q, pitch: 69, lyrics: 'di' }
  ]);
  assert.equal(project.tracks[0].instrument, undefined);
  assert.deepEqual(simple(project.tracks[1].notes), [
    { onset: 0, duration: 4 * Q, pitch: 48, lyrics: '' },
    { onset: 8 * Q, duration: 3 * Q, pitch: 52, lyrics: '' }
  ]);
  assert.equal(project.tracks[1].instrument.family, 'keyboard');
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 100 }, { position: 8 * Q, bpm: 80 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('pickup measures end on the first barline and extend lines stop where marked', () => {
  const text = score(`<part id="P1">
    <measure number="0" implicit="yes">
      <attributes><divisions>4</divisions><time><beats>3</beats><beat-type>4</beat-type></time><transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>60</per-minute></metronome></direction-type></direction>
      ${note('D', 4, 4, lyric('up'))}
    </measure>
    <measure number="1">
      ${note('E', 4, 4, lyric('go', 'single', '<extend type="start"/>'))}
      ${note('F', 4, 2)}
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><lyric number="1"><extend type="stop"/></lyric></note>
      ${note('G', 4, 4)}
    </measure>
  </part>`);
  const project = musicxml.parse(encode(text), 'pickup.xml');
  assert.equal(project.title, 'pickup');
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 2 * Q, duration: Q, pitch: 60, lyrics: 'up' },
    { onset: 3 * Q, duration: Q, pitch: 62, lyrics: 'go' },
    { onset: 4 * Q, duration: 0.5 * Q, pitch: 63, lyrics: EXTENSION_LYRIC },
    { onset: 4.5 * Q, duration: 0.5 * Q, pitch: 64, lyrics: EXTENSION_LYRIC },
    { onset: 5 * Q, duration: Q, pitch: 65, lyrics: '' }
  ]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 3, denominator: 4 }]);
});

test('compressed MXL archives are read through their container rootfile', () => {
  const container = '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score/song.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
  const archive = zipSync({
    mimetype: strToU8('application/vnd.recordare.musicxml'),
    'META-INF/container.xml': strToU8(container),
    'score/song.musicxml': strToU8(score(`<part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>${note('A', 4, 4, lyric('ah'))}</measure></part>`).replace('<part-list>', '<movement-title>Packed</movement-title><part-list>'))
  });
  assert.equal(musicxml.detect(archive, 'song.mxl'), true);
  const project = musicxml.parse(archive, 'song.mxl');
  assert.equal(project.title, 'Packed');
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: 4 * Q, pitch: 69, lyrics: 'ah' }]);
});

test('detect recognises MusicXML among .xml files', () => {
  assert.equal(musicxml.detect(encode(DUET), 'duet.xml'), true);
  assert.equal(musicxml.detect(encode('<?xml version="1.0"?><Scenario/>'), 'other.xml'), false);
});

test('timewise and malformed MusicXML files are rejected with a clear error', () => {
  assert.throws(() => musicxml.parse(encode('<score-timewise version="4.0"><part-list/></score-timewise>'), 'tw.musicxml'), /score-timewise documents are not supported/);
  assert.throws(() => musicxml.parse(encode('<score-partwise><part>'), 'bad.musicxml'), /Invalid MusicXML file/);
  assert.throws(() => musicxml.parse(encode('<opus/>'), 'bad.musicxml'), /expected a score-partwise root/);
  assert.throws(() => musicxml.parse(encode('<score-partwise><part-list/></score-partwise>'), 'empty.musicxml'), /no measures/);
  assert.throws(() => musicxml.parse(zipSync({ 'readme.txt': strToU8('x') }), 'bad.mxl'), /Invalid MXL file/);
});
