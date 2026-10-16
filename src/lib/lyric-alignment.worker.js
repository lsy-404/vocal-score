import {alignLyricsToTracks} from './lyric-alignment.js';

// Aligns pasted lyrics off the page. 'warm' loads the pinyin dictionary with a tiny alignment, so the first real paste
// does not pay for it.
self.onmessage = ({data}) => {
  try {
    if (data.type === 'warm') {
      alignLyricsToTracks('你好', [{id: 'warm', name: '', notes: [{lyrics: 'ni'}, {lyrics: 'hao'}]}]);
      self.postMessage({type: 'ready'});
      return;
    }
    self.postMessage({type: 'result', id: data.id, result: alignLyricsToTracks(data.text, data.tracks, {write: data.write})});
  } catch (error) {
    self.postMessage({type: 'error', id: data.id, error: String(error?.message || error)});
  }
};
