import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfTextRectangle,applyScoreTextEdit} from '../src/lib/score-text.js';

test('maps SVG text into the same printable PDF rectangle including centered side margins',()=>{
  const result=pdfTextRectangle({left:150,top:200,width:50,height:20},{left:100,top:100,width:500,height:700},{width:210,height:297});
  assert(Math.abs(result.x-29/210)<1e-10);
  assert(Math.abs(result.y-48/297)<1e-10);
  assert(Math.abs(result.width-19/210)<1e-10);
  assert.equal(pdfTextRectangle({width:0,height:10},{width:100,height:100},{width:210,height:297}),null);
});

test('edits the precise source note when tracks repeat the same lyric',()=>{
  const document={title:'Title',settings:{header:'Header',by:'Credit'},project:{tracks:[{id:'a',name:'A',notes:[{lyrics:'la'},{lyrics:'la'}]},{id:'b',name:'B',notes:[{lyrics:'la'}]}]}};
  assert.equal(applyScoreTextEdit(document,{kind:'lyric',trackId:'a',noteIndex:1},'字'),true);
  assert.deepEqual(document.project.tracks.map(track=>track.notes.map(note=>note.lyrics)),[['la','字'],['la']]);
  assert.equal(applyScoreTextEdit(document,{kind:'lyric',trackId:'missing',noteIndex:0},'x'),false);
  assert.equal(applyScoreTextEdit(document,{kind:'lyric',trackId:'a',noteIndex:-1},'x'),false);
  assert(applyScoreTextEdit(document,{kind:'title'},''));assert.equal(document.title,'');
  assert(applyScoreTextEdit(document,{kind:'header'},'New'));assert.equal(document.settings.header,'New');
  assert(applyScoreTextEdit(document,{kind:'by'},'New by'));assert.equal(document.settings.by,'New by');
  assert(applyScoreTextEdit(document,{kind:'track-name',trackId:'b'},'Voice'));assert.equal(document.project.tracks[1].name,'Voice');
  assert.equal(applyScoreTextEdit(document,{kind:'title',documentId:'different'},'Wrong file'),false);
  assert.equal(document.title,'');
});
