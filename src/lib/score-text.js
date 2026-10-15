import {getPaperDimensions} from './pdf.js';

export function pdfTextRectangle(bounds,svgBounds,paper,margin=10){
  if(![bounds.width,bounds.height,svgBounds.width,svgBounds.height,paper.width,paper.height].every(value=>Number.isFinite(value)&&value>0))return null;
  const scale=Math.min((paper.width-margin*2)/svgBounds.width,(paper.height-margin*2)/svgBounds.height);
  const imageWidth=svgBounds.width*scale;
  return {
    x:(margin+(paper.width-margin*2-imageWidth)/2+(bounds.left-svgBounds.left)*scale)/paper.width,
    y:(margin+(bounds.top-svgBounds.top)*scale)/paper.height,
    width:bounds.width*scale/paper.width,
    height:bounds.height*scale/paper.height,
  };
}

export function collectScoreTextTargets(pages,{id,project,title,settings},margin=10){
  const dimensions=getPaperDimensions(settings.paperSize,settings.orientation);
  return Array.from(pages).flatMap((svg,pageIndex)=>{
    const svgBounds=svg.getBoundingClientRect();
    return Array.from(svg.querySelectorAll('[data-edit-kind]')).flatMap(node=>{
      const kind=node.dataset.editKind;
      const track=project.tracks.find(item=>String(item.id)===node.dataset.trackId);
      const noteIndex=Number(node.dataset.noteIndex);
      const text=kind==='title'?title:kind==='header'?settings.header:kind==='by'?settings.by:kind==='track-name'?track?.name:kind==='lyric'?track?.notes[noteIndex]?.lyrics:undefined;
      if(typeof text!=='string')return [];
      const rectangle=pdfTextRectangle(node.getBoundingClientRect(),svgBounds,dimensions,margin);
      if(!rectangle)return [];
      return [{id:`${pageIndex}:${kind}:${node.dataset.trackId||''}:${node.dataset.noteIndex||''}`,documentId:id,pageNumber:pageIndex+1,kind,text,trackId:track?.id,noteIndex,...rectangle}];
    });
  });
}

export function applyScoreTextEdit(document,target,value){
  if(!document||typeof value!=='string'||!target||target.documentId!==document.id)return false;
  const text=value.slice(0,target.kind==='lyric'?300:160);
  if(target.kind==='title'){document.title=text;return true;}
  if(target.kind==='header'||target.kind==='by'){document.settings[target.kind]=text;return true;}
  const track=document.project.tracks.find(item=>String(item.id)===String(target.trackId));
  if(!track)return false;
  if(target.kind==='track-name'){track.name=text;return true;}
  if(target.kind==='lyric'&&Number.isInteger(target.noteIndex)&&track.notes[target.noteIndex]){track.notes[target.noteIndex].lyrics=text;return true;}
  return false;
}
