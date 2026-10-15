import {jsPDF} from 'jspdf';

let pdf,dimensions,orientation;
self.onmessage=({data})=>{
  try{
    if(data.type==='start'){
      dimensions=data.dimensions;orientation=data.orientation;
      pdf=new jsPDF({orientation,unit:'mm',format:[dimensions.width,dimensions.height],compress:true});
      if(data.title)pdf.setProperties({title:String(data.title)});
    }else if(data.type==='page'){
      if(data.index>0)pdf.addPage([dimensions.width,dimensions.height],orientation);
      pdf.addImage(new Uint8Array(data.bytes),'PNG',data.margin,data.margin,dimensions.width-data.margin*2,dimensions.height-data.margin*2,undefined,'FAST');
    }else if(data.type==='finish'){
      const bytes=pdf.output('arraybuffer');self.postMessage({bytes},[bytes]);
    }
  }catch(error){self.postMessage({error:String(error?.message||error)});}
};
