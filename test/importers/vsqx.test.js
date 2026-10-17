import './dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vsqx from '../../src/lib/importers/vsqx.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);
const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

const VSQ4 = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<vsq4 xmlns="http://www.yamaha.co.jp/vocaloid/schema/vsq4/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <vender><![CDATA[Yamaha corporation]]></vender>
  <version><![CDATA[4.0.0.3]]></version>
  <vVoiceTable><vVoice><bs>0</bs><pc>0</pc><id><![CDATA[BCNFCY43LB2LZCD4]]></id><name><![CDATA[VY1V4]]></name></vVoice></vVoiceTable>
  <masterTrack>
    <seqName><![CDATA[Untitled0]]></seqName>
    <comment><![CDATA[New VSQ File]]></comment>
    <resolution>480</resolution>
    <preMeasure>1</preMeasure>
    <timeSig><m>0</m><nu>4</nu><de>4</de></timeSig>
    <timeSig><m>3</m><nu>3</nu><de>4</de></timeSig>
    <tempo><t>0</t><v>12000</v></tempo>
    <tempo><t>3840</t><v>15000</v></tempo>
  </masterTrack>
  <vsTrack>
    <tNo>0</tNo>
    <name><![CDATA[Lead]]></name>
    <comment><![CDATA[Track]]></comment>
    <vsPart>
      <t>1920</t>
      <playTime>3840</playTime>
      <name><![CDATA[NewPart]]></name>
      <singer><t>0</t><bs>0</bs><pc>0</pc></singer>
      <cc><t>0</t><v id="S">2</v></cc>
      <note><t>0</t><dur>480</dur><n>60</n><v>64</v><y><![CDATA[あ]]></y><p><![CDATA[a]]></p><nStyle><v id="accent">50</v></nStyle></note>
      <note><t>480</t><dur>480</dur><n>62</n><v>64</v><y><![CDATA[-]]></y><p><![CDATA[a]]></p></note>
      <note><t>3600</t><dur>960</dur><n>64</n><v>64</v><y><![CDATA[う]]></y></note>
      <note><t>3840</t><dur>480</dur><n>65</n><v>64</v><y><![CDATA[え]]></y></note>
    </vsPart>
    <vsPart>
      <t>9600</t>
      <playTime>1920</playTime>
      <note><t>0</t><dur>480</dur><n>67</n><v>64</v><y><![CDATA[お]]></y></note>
    </vsPart>
  </vsTrack>
  <vsTrack>
    <tNo>1</tNo>
    <name><![CDATA[Harmony]]></name>
    <vsPart><t>1920</t><playTime>1920</playTime><note><t>0</t><dur>960</dur><n>55</n><y><![CDATA[ら]]></y></note></vsPart>
  </vsTrack>
  <vsTrack><tNo>2</tNo><name><![CDATA[Empty]]></name></vsTrack>
  <monoTrack><wavPart><t>0</t><playTime>1920</playTime><filePath><![CDATA[a.wav]]></filePath></wavPart></monoTrack>
</vsq4>`;

const VSQ3 = `<?xml version="1.0" encoding="UTF-8"?>
<vsq3 xmlns="http://www.yamaha.co.jp/vocaloid/schema/vsq3/">
  <masterTrack>
    <seqName><![CDATA[Untitled0]]></seqName>
    <resolution>480</resolution>
    <preMeasure>2</preMeasure>
    <timeSig><posMes>0</posMes><nume>3</nume><denomi>4</denomi></timeSig>
    <timeSig><posMes>2</posMes><nume>6</nume><denomi>8</denomi></timeSig>
    <tempo><posTick>0</posTick><bpm>9000</bpm></tempo>
    <tempo><posTick>1440</posTick><bpm>10000</bpm></tempo>
    <tempo><posTick>4320</posTick><bpm>11000</bpm></tempo>
  </masterTrack>
  <vsTrack>
    <vsTrackNo>0</vsTrackNo>
    <trackName><![CDATA[Lead]]></trackName>
    <musicalPart>
      <posTick>2880</posTick>
      <playTime>7680</playTime>
      <partName><![CDATA[Part]]></partName>
      <note><posTick>0</posTick><durTick>480</durTick><noteNum>60</noteNum><velocity>64</velocity><lyric><![CDATA[ら]]></lyric><phnms><![CDATA[4 a]]></phnms></note>
      <note><posTick>720</posTick><durTick>360</durTick><noteNum>70</noteNum><velocity>64</velocity><lyric><![CDATA[la]]></lyric></note>
    </musicalPart>
  </vsTrack>
  <seTrack><wavPart><posTick>2880</posTick><playTime>1920</playTime></wavPart></seTrack>
</vsq3>`;

test('vsq4 projects keep notes, lyrics, extensions, part offsets and tracks', () => {
  const project = vsqx.parse(encode(VSQ4), 'songs/demo.vsqx');
  assert.equal(project.tracks[0].singer, 'VY1V4', 'a part names its singer by bank and program in the voice table');
  assert.equal(project.format, 'VOCALOID 3/4');
  assert.equal(project.title, 'demo');
  assert.equal(project.version, '4.0.0.3');
  assert.deepEqual(project.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'あ' },
    { onset: Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 7.5 * Q, duration: 0.5 * Q, pitch: 64, lyrics: 'う' },
    { onset: 16 * Q, duration: Q, pitch: 67, lyrics: 'お' }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 2 * Q, pitch: 55, lyrics: 'ら' }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 4 * Q, bpm: 150 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('vsq3 projects use the long element names and collapse the pre-measures', () => {
  const project = vsqx.parse(encode(VSQ3), 'old.vsqx');
  assert.equal(project.version, 'vsq3');
  assert.deepEqual(project.tracks.map(track => track.name), ['Lead']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'ら' },
    { onset: 1.5 * Q, duration: 0.75 * Q, pitch: 70, lyrics: 'la' }
  ]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 6, denominator: 8 }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 100 }, { position: 3 * Q, bpm: 110 }]);
});

test('malformed VSQX files are rejected with a clear error', () => {
  assert.throws(() => vsqx.parse(encode('<vsq4><masterTrack>'), 'bad.vsqx'), /Invalid VSQX project/);
  assert.throws(() => vsqx.parse(encode('<project/>'), 'bad.vsqx'), /Invalid VSQX project: expected a vsq3 or vsq4 root/);
  assert.throws(() => vsqx.parse(encode('<vsq4 xmlns="http://www.yamaha.co.jp/vocaloid/schema/vsq4/"/>'), 'bad.vsqx'), /masterTrack is missing/);
});
