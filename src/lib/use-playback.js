// Playback state for the open document: the player, the playhead on the engraved pages, and the play-along audio kept
// in this browser. The piano switch and the audio offset are saved with the document's settings.
import {computed, onBeforeUnmount, onMounted, ref, shallowRef, watch} from 'vue';
import {createScorePlayer} from './player.js';
import {playheadAt, tickAtPoint} from './playback.js';
import {deleteAudio, loadAudio, saveAudio} from './storage.js';

export const AUDIO_LIMIT_MB = 300;

const editable = target => target instanceof Element && Boolean(target.closest('input, textarea, select, button, summary, a, [contenteditable]:not([contenteditable="false"])'));

/**
 * @param {object} options
 * @param {import('vue').Ref} options.document the open document (its id and settings)
 * @param {import('vue').Ref} options.model the engraved score's model
 * @param {import('vue').Ref} options.marks bars on the pages, from collectPlaybackMarks
 * @param {(playhead: object) => void} options.reveal scrolls a playhead into view
 * @param {(key: string, params?: object) => string} options.translate
 */
export function usePlayback({document: doc, model, marks, reveal, translate}) {
  const player = createScorePlayer({onEnd: () => { playing.value = false; position.value = 0; stopFrames(); }});
  const playing = ref(false), preparing = ref(false), active = ref(false), position = ref(0), duration = ref(0), scrub = ref(null);
  const audio = shallowRef(null), error = ref('');
  let frame = 0, documentId = '', loadToken = 0, playToken = 0;

  const pianoOn = computed(() => doc.value?.settings.piano !== false);
  const audioOn = computed(() => doc.value?.settings.playAudio !== false);
  const audioOffset = computed(() => Number(doc.value?.settings.audioOffset) || 0);
  const shown = computed(() => scrub.value ?? position.value);
  const playhead = computed(() => active.value && model.value ? playheadAt(marks.value, player.toTick(shown.value)) : null);

  // Brings the playhead into view when playback starts or jumps; while playing, a new bar row does the same.
  const showPlayhead = () => { if (playhead.value) reveal?.(playhead.value); };

  function frameLoop() {
    position.value = player.position();
    frame = requestAnimationFrame(frameLoop);
  }
  function stopFrames() { cancelAnimationFrame(frame); frame = 0; }
  const refreshDuration = () => { duration.value = player.duration(); };

  // The opened audio decodes on first play; until then only its stored file is held.
  async function readyAudio() {
    const item = audio.value;
    if (!item || item.buffer || item.failed) return;
    try {
      const buffer = await player.decode(item.blob);
      if (audio.value !== item) return;
      audio.value = {...item, buffer};
      player.setAudio(buffer, audioOffset.value);
      refreshDuration();
    } catch {
      if (audio.value === item) audio.value = {...item, failed: true};
      error.value = translate('无法读取这个音频文件。');
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

  async function openAudio(file) {
    const item = doc.value;
    if (!file || !item) return;
    error.value = '';
    if (file.size > AUDIO_LIMIT_MB * 1024 * 1024) { error.value = translate('音频文件超过 {size} MB。', {size: AUDIO_LIMIT_MB}); return; }
    const blob = new Blob([file], {type: file.type || 'application/octet-stream'});
    const wasPlaying = playing.value;
    if (wasPlaying) pause();
    audio.value = {name: file.name, blob, buffer: null};
    player.setAudio(null);
    // The recording becomes what is heard; the piano stays available to check the written notes against it.
    if (item.settings.piano === undefined) item.settings.piano = false;
    await readyAudio();
    saveAudio(item.id, {name: file.name, blob}).catch(() => { error.value = translate('无法保存音频，刷新后需重新打开。'); });
    if (wasPlaying) play();
  }

  function removeAudio() {
    const item = doc.value;
    audio.value = null;
    player.setAudio(null);
    refreshDuration();
    if (item) {
      deleteAudio(item.id).catch(() => {});
      delete item.settings.piano;
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

  // Another document: stop, start from its beginning, and find the audio kept for it.
  watch(() => doc.value?.id, async id => {
    if (id === documentId) return;
    documentId = id || '';
    pause();
    player.seek(0);
    position.value = 0;
    active.value = false;
    audio.value = null;
    player.setAudio(null);
    const token = ++loadToken;
    if (!id) return;
    try {
      const record = await loadAudio(id);
      if (token === loadToken && record?.blob) audio.value = {name: record.name, blob: record.blob, buffer: null};
    } catch { /* storage unavailable: the audio can be opened again */ }
  }, {immediate: true});

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

  return {playing, preparing, active, position: shown, duration, playhead, audio, error, pianoOn, audioOn, audioOffset, scrub, play, pause, toggle, rewind, seek, seekToPoint, openAudio, removeAudio, setPiano, setAudioEnabled, setAudioOffset};
}
