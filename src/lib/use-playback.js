// Playback state for the open document: the player, the playhead on the engraved pages, and the song it plays along
// with. Songs are kept in this browser apart from documents; a document names its song (settings.songId), so one song
// can serve several documents. The piano switch and the audio offset are saved with each document's settings.
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {createScorePlayer} from './player.js';
import {playbackRows, playheadAt, tickAtPoint} from './playback.js';

const editable = target => target instanceof Element && Boolean(target.closest('input, textarea, select, button, summary, a, [contenteditable]:not([contenteditable="false"])'));

/**
 * @param {object} options
 * @param {import('vue').Ref} options.document the open document (its id and settings)
 * @param {import('vue').Ref} options.songs songs kept in this browser
 * @param {(file: File) => Promise<object|null>} options.addSong keeps an opened audio file as a song
 * @param {import('vue').Ref} options.model the engraved score's model
 * @param {import('vue').Ref} options.marks bars on the pages, from collectPlaybackMarks
 * @param {(playhead: object) => void} options.reveal scrolls a playhead into view
 * @param {(key: string, params?: object) => string} options.translate
 */
export function usePlayback({document: doc, songs, addSong, model, marks, reveal, translate}) {
  const player = createScorePlayer({onEnd: () => { playing.value = false; position.value = 0; stopFrames(); }});
  const playing = ref(false), preparing = ref(false), active = ref(false), position = ref(0), duration = ref(0), scrub = ref(null);
  const error = ref('');
  let frame = 0, documentId = '', playToken = 0, decoded = {id: '', buffer: null};
  const failed = new Set();

  const pianoOn = computed(() => doc.value?.settings.piano !== false);
  const audioOn = computed(() => doc.value?.settings.playAudio !== false);
  const audioOffset = computed(() => Number(doc.value?.settings.audioOffset) || 0);
  const song = computed(() => songs.value.find(item => item.id === doc.value?.settings.songId) ?? null);
  const audio = computed(() => song.value && {id: song.value.id, name: song.value.name});
  const shown = computed(() => scrub.value ?? position.value);
  const rows = computed(() => playbackRows(marks.value));
  const playhead = computed(() => active.value && model.value ? playheadAt(rows.value, player.toTick(shown.value)) : null);

  // Brings the playhead into view when playback starts or jumps; while playing, a new bar row does the same.
  const showPlayhead = () => { if (playhead.value) reveal?.(playhead.value); };

  function frameLoop() {
    position.value = player.position();
    frame = requestAnimationFrame(frameLoop);
  }
  function stopFrames() { cancelAnimationFrame(frame); frame = 0; }
  const refreshDuration = () => { duration.value = player.duration(); };

  // The song decodes when it is attached or first played; until then only its stored file is held.
  async function readyAudio() {
    const item = song.value;
    if (!item || decoded.id === item.id || failed.has(item.id)) return;
    try {
      const buffer = await player.decode(item.blob);
      if (song.value?.id !== item.id) return;
      decoded = {id: item.id, buffer};
      player.setAudio(buffer, audioOffset.value);
      refreshDuration();
    } catch {
      failed.add(item.id);
      if (song.value?.id === item.id) error.value = translate('无法读取这个音频文件。');
    }
  }

  async function play(from) {
    if (!model.value) return;
    const token = ++playToken;
    error.value = '';
    active.value = true;
    preparing.value = true;
    try {
      player.unlock();
      await Promise.all([readyAudio(), player.prepare()]);
      if (token !== playToken) return;
      await player.play(from ?? player.position());
      if (token !== playToken) return;
      playing.value = player.playing;
      refreshDuration();
      position.value = player.position();
      showPlayhead();
      if (playing.value && !frame) frameLoop();
    } catch {
      if (token === playToken) { error.value = translate('此浏览器不支持音频播放。'); playing.value = false; }
    } finally {
      if (token === playToken) preparing.value = false;
    }
  }

  function pause() {
    playToken += 1;
    preparing.value = false;
    player.pause();
    playing.value = false;
    stopFrames();
    position.value = player.position();
  }

  const toggle = () => (playing.value || preparing.value ? pause() : play());

  const rewind = () => seek(0);

  function seek(seconds) {
    scrub.value = null;
    active.value = true;
    player.seek(seconds);
    position.value = player.position();
    showPlayhead();
  }

  // A click on the score moves the playhead there, once playback has been used.
  function seekToPoint({pageNumber, x, y}) {
    if (!active.value || !model.value) return;
    const tick = tickAtPoint(marks.value, pageNumber, x, y);
    if (tick !== null) seek(player.toSeconds(tick));
  }

  /** Plays this document along with a song kept in the browser. */
  function attach(id) {
    const item = doc.value;
    if (!item || !songs.value.some(entry => entry.id === id)) return;
    error.value = '';
    item.settings.songId = id;
    // The recording becomes what is heard; the piano stays available to check the written notes against it.
    if (item.settings.piano === undefined) item.settings.piano = false;
    readyAudio();
  }

  /** The document stops playing along; the song stays for other documents. */
  function detach() {
    const item = doc.value;
    if (!item) return;
    item.settings.songId = null;
    delete item.settings.piano;
  }

  async function openAudio(file) {
    if (!file || !doc.value) return;
    error.value = '';
    try {
      const added = await addSong(file);
      if (added) attach(added.id);
    } catch (cause) {
      error.value = String(cause?.message || cause);
    }
  }

  const setPiano = on => { if (doc.value) doc.value.settings.piano = Boolean(on); };
  const setAudioEnabled = on => { if (doc.value) doc.value.settings.playAudio = Boolean(on); };
  const setAudioOffset = value => {
    const seconds = Math.round(Math.min(600, Math.max(-600, Number(value) || 0)) * 1000) / 1000;
    if (doc.value) doc.value.settings.audioOffset = seconds;
  };

  watch(pianoOn, on => player.setPiano(on), {immediate: true});
  watch(audioOn, on => player.setAudioEnabled(on), {immediate: true});
  watch(audioOffset, offset => { player.setAudioOffset(offset); refreshDuration(); });
  watch(model, value => { if (value) { player.setScore(value); refreshDuration(); position.value = player.position(); } });

  // Another document: stop and start from its beginning.
  watch(() => doc.value?.id, id => {
    if (id === documentId) return;
    documentId = id || '';
    pause();
    player.seek(0);
    position.value = 0;
    active.value = false;
  }, {immediate: true});

  // Another song (or none): the decoded audio is let go, and a new one decodes in the background.
  watch(() => song.value?.id ?? '', id => {
    if (decoded.id === id) return;
    if (playing.value || preparing.value) pause();
    decoded = {id: '', buffer: null};
    player.setAudio(null, audioOffset.value);
    refreshDuration();
    error.value = '';
  });

  // Follow the playhead when it moves to a bar row that is not in view.
  watch(() => playhead.value && `${playhead.value.pageNumber}:${playhead.value.y}`, key => { if (key && playing.value) showPlayhead(); });

  function onKey(event) {
    if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || !model.value) return;
    if (editable(event.target) || doc.value === undefined) return;
    event.preventDefault();
    toggle();
  }
  onMounted(() => window.addEventListener('keydown', onKey));
  onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); stopFrames(); player.dispose(); });

  return {playing, preparing, active, position: shown, duration, playhead, audio, songs, error, pianoOn, audioOn, audioOffset, scrub, play, pause, toggle, rewind, seek, seekToPoint, openAudio, attach, detach, setPiano, setAudioEnabled, setAudioOffset};
}
