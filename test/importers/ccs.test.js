import './dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import ccs from '../../src/lib/importers/ccs.js';
import { BLICKS_PER_QUARTER as Q, EXTENSION_LYRIC } from '../../src/lib/importers/model.js';

const encode = text => new TextEncoder().encode(text);
const simple = notes => notes.map(({ onset, duration, pitch, lyrics }) => ({ onset, duration, pitch, lyrics }));

const song = (tempo, beat, notes) => `<Song Version="1.07"><Tempo>${tempo}</Tempo><Beat>${beat}</Beat><Score><Key Clock="0" Fifths="0" Mode="0" /><Dynamics Clock="0" Value="5" />${notes}</Score></Song>`;
const CCS = `<?xml version="1.0" encoding="utf-8"?>
<Scenario Code="7251BC4B6168E7B2992FA620BD3E1E77">
  <Generation><Author Version="8.1.17.0" /><SVSS Version="3.0.5"><SoundSources><SoundSource Version="1.0" Id="A" Name="IA" /></SoundSources></SVSS></Generation>
  <Sequence Id="">
    <Scene Id="">
      <Units>
        <Unit Version="1.0" Id="" Category="SingerSong" Group="g1" StartTime="00:00:00" Duration="00:00:10" CastId="A" Language="Japanese">
          ${song('<Sound Clock="0" Tempo="120" /><Sound Clock="7680" Tempo="90" />', '<Time Clock="0" Beats="4" BeatType="4" /><Time Clock="11520" Beats="3" BeatType="4" />',
    '<Note Clock="3840" PitchStep="0" PitchOctave="4" Duration="960" Lyric="あ" Phonetic="a" /><Note Clock="4800" PitchStep="2" PitchOctave="4" Duration="960" Lyric="ー" /><Note Clock="5760" PitchStep="11" PitchOctave="3" Duration="1920" Lyric="い" />')}
        </Unit>
        <Unit Version="1.0" Id="" Category="SingerSong" Group="g2" StartTime="00:00:00" Duration="00:00:10" CastId="A" Language="Japanese">
          ${song('<Sound Clock="0" Tempo="200" />', '<Time Clock="0" Beats="4" BeatType="4" />', '<Note Clock="3840" PitchStep="7" PitchOctave="4" Duration="480" Lyric="la" />')}
        </Unit>
        <Unit Version="1.0" Id="" Category="SingerSong" Group="g1" StartTime="00:00:00" Duration="00:00:10" CastId="A" Language="Japanese">
          ${song('<Sound Clock="0" Tempo="120" />', '<Time Clock="0" Beats="4" BeatType="4" />', '<Note Clock="19200" PitchStep="9" PitchOctave="4" Duration="960" Lyric="う" />')}
        </Unit>
        <Unit Version="1.0" Id="" Category="TextVocal" Group="g3" StartTime="00:00:01" Duration="00:00:02" CastId="B" Language="Japanese"><Text>こんにちは</Text></Unit>
        <Unit Version="1.0" Id="" Category="OuterAudio" Group="g4" StartTime="00:00:00" Duration="00:00:05" FilePath="a.wav" />
      </Units>
      <Groups>
        <Group Version="1.0" Id="g1" Category="SingerSong" Name="Lead" Color="#FFAF1F" Volume="0" Pan="0" IsSolo="false" IsMuted="false" CastId="A" Language="Japanese" />
        <Group Version="1.0" Id="g2" Category="SingerSong" Name="Harmony" />
        <Group Version="1.0" Id="g3" Category="TextVocal" Name="Talk" />
        <Group Version="1.0" Id="g4" Category="OuterAudio" Name="Audio" />
      </Groups>
      <SoundSetting Rhythm="4/4" Tempo="120" MasterVolume="0" />
    </Scene>
  </Sequence>
</Scenario>`;

test('CeVIO projects drop the lead-in measure and keep song tracks only', () => {
  const project = ccs.parse(encode(CCS), 'demo.ccs');
  assert.equal(project.format, 'CeVIO');
  assert.equal(project.title, 'demo');
  assert.equal(project.version, '8.1.17.0');
  assert.deepEqual(project.tracks.map(track => track.name), ['Lead', 'Harmony']);
  assert.deepEqual(simple(project.tracks[0].notes), [
    { onset: 0, duration: Q, pitch: 60, lyrics: 'あ' },
    { onset: Q, duration: Q, pitch: 62, lyrics: EXTENSION_LYRIC },
    { onset: 2 * Q, duration: 2 * Q, pitch: 59, lyrics: 'い' },
    { onset: 16 * Q, duration: Q, pitch: 69, lyrics: 'う' }
  ]);
  assert.deepEqual(simple(project.tracks[1].notes), [{ onset: 0, duration: 0.5 * Q, pitch: 67, lyrics: 'la' }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 120 }, { position: 4 * Q, bpm: 90 }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 4, denominator: 4 }, { index: 2, numerator: 3, denominator: 4 }]);
});

test('the CeVIO lead-in follows the first time signature', () => {
  const text = `<Scenario><Sequence><Scene><Units><Unit Category="SingerSong" Group="g">
    ${song('<Sound Clock="0" Tempo="100" /><Sound Clock="1440" Tempo="140" />', '<Time Clock="0" Beats="3" BeatType="4" /><Time Clock="2880" Beats="2" BeatType="4" />', '<Note Clock="2880" PitchStep="1" PitchOctave="5" Duration="480" Lyric="ka" />')}
    </Unit></Units><Groups /></Scene></Sequence></Scenario>`;
  const project = ccs.parse(encode(text), 'lead-in.ccs');
  assert.deepEqual(project.tracks.map(track => track.name), ['Track 1']);
  assert.deepEqual(simple(project.tracks[0].notes), [{ onset: 0, duration: 0.5 * Q, pitch: 73, lyrics: 'ka' }]);
  assert.deepEqual(project.meters, [{ index: 0, numerator: 2, denominator: 4 }]);
  assert.deepEqual(project.tempos, [{ position: 0, bpm: 140 }]);
});

test('malformed CeVIO files are rejected with a clear error', () => {
  assert.throws(() => ccs.parse(encode('<Scenario><Sequence>'), 'bad.ccs'), /Invalid CeVIO project/);
  assert.throws(() => ccs.parse(encode('<Scenario><Sequence /></Scenario>'), 'bad.ccs'), /Invalid CeVIO project: Scenario\/Sequence\/Scene is missing/);
});
