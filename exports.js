const encoder = new TextEncoder();
const bytes = value => encoder.encode(value);
const jpeg = url => Uint8Array.from(atob(url.split(',')[1]), character => character.charCodeAt(0));
const wordMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ink = '#000000', value = '#2E74B5', yellow = '#FFFF00', navy = '#1B2A8C';
// Cores dos quadros de foto: cabeçalho azul com texto verde; rodapé verde com texto azul.
const navyBlue = '#190A60', neonGreen = '#CEFF00';
const W = 1240, H = 1754, L = 85, R = 1155, MID = 620;
const labels = {
  department:'Gerência:', origin:'Origem da Ação:', reference:'Código de Referência da Ação:', type:'Tipo da ação:',
  owner:'Responsável da ação:', reportDate:'Data:', evidence:'Tipo de Evidência:', summary:'Descrição da ação:'
};
const evidenceOptions = ['Captura de Tela do Sistema','Documento Oficial','Foto / Imagem','Relatório Técnico'];

function lines(ctx, text, width) {
  const result = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/[ \t]+/)) {
      if (line && ctx.measureText(line+' '+word).width > width) { result.push(line); line = ''; }
      line += (line ? ' ' : '')+word;
    }
    result.push(line);
  }
  return result;
}
function wrap(ctx, text, x, y, width, lineHeight, maximum) {
  const all = lines(ctx,text,width);
  for (let index=0; index<Math.min(all.length,maximum); index++) {
    const ellipsis = index === maximum-1 && all.length > maximum ? '…' : '';
    ctx.fillText(all[index]+ellipsis,x,y+index*lineHeight,width);
  }
}
function evidenceText(selected) {
  const chosen = String(selected ?? '').trim().toLocaleLowerCase('pt-BR');
  const known = evidenceOptions.some(option => option.toLocaleLowerCase('pt-BR') === chosen);
  // Espaços não separáveis mantêm cada "( X ) opção" na mesma linha.
  const mark = on => '(\u00A0'+(on ? 'X' : '\u00A0\u00A0')+'\u00A0)\u00A0';
  return evidenceOptions.map(option => mark(option.toLocaleLowerCase('pt-BR') === chosen)+option.replace(/ /g,'\u00A0')+';').join(' ')+
    ' '+mark(!known && chosen)+'Outro:'+(known || !chosen ? '' : ' '+selected);
}

export async function renderSheets(report, fields, period, dateFormat) {
  // Mantém 4 fotos por página, em duas linhas de duas fotos, como no FORM-CORP-SMS-030.
  const total = report.pages.length;
  return Promise.all(report.pages.map(async (slots,pageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    ctx.textBaseline='alphabetic';
    const font = (size,bold=false,italic=false) => { ctx.font=(italic?'italic ':'')+(bold?'bold ':'')+size+'px Arial, Helvetica, sans-serif'; };
    function text(content,x,y,size=18,{bold=false,color=ink,align='left',max,italic=false}={}) {
      font(size,bold,italic); ctx.fillStyle=color; ctx.textAlign=align;
      ctx.fillText(content,x,y,max); ctx.textAlign='left';
      return ctx.measureText(content).width;
    }
    function box(x,y,w,h,fill) {
      if (fill) { ctx.fillStyle=fill; ctx.fillRect(x,y,w,h); }
      ctx.strokeStyle=ink; ctx.lineWidth=1.5; ctx.strokeRect(x,y,w,h);
    }
    function spaced(content,cx,y,size,color,gap) {
      font(size); ctx.fillStyle=color;
      const widths=[...content].map(c => ctx.measureText(c).width+gap);
      let x=cx-widths.reduce((a,b) => a+b,0)/2;
      [...content].forEach((c,i) => { ctx.fillText(c,x,y); x+=widths[i]; });
    }

    // Cabeçalho de página
    text('BRAVA',L-5,118,62,{bold:true,italic:true,color:navy});
    text('energia',L+150,140,17,{color:'#6B6F86'});
    text('REGISTRO DE EVIDÊNCIA',555,98,23,{bold:true,align:'center'});
    ctx.fillStyle=navy; ctx.fillRect(885,30,2,140);
    text('FORM-CORP-SMS-030',1025,70,18,{bold:true,align:'center'});
    text('GS2 – USO INTERNO',1025,106,18,{bold:true,align:'center'});
    text('Rev.: 00',1025,142,18,{bold:true,align:'center'});
    ctx.fillRect(L-10,168,R-L+20,3);

    let top=200;
    if (pageIndex === 0) {
      text('FORMULÁRIO',W/2,228,21,{bold:true,align:'center'});
      const c=[L,400,615,825,R];
      let y=250;
      const d=report.details;
      const cell=(label,content,x1,x2,h,{valueColor=value,boldValue=true}={}) => {
        box(x1,y,x2-x1,h);
        font(17,true);
        const labelLines=lines(ctx,label,x2-x1-16);
        if (content === undefined) {
          labelLines.forEach((line,i) => text(line,x1+8,y+h/2+6-(labelLines.length-1)*10+i*20,17,{bold:true}));
        } else {
          font(17,boldValue);
          const valueLines=lines(ctx,content,x2-x1-16).slice(0,3);
          valueLines.forEach((line,i) => text(line,x1+8,y+h/2+6-(valueLines.length-1)*10+i*20,17,{bold:boldValue,color:valueColor}));
        }
      };
      const row=(h,items) => { for (const item of items) cell(...item,h); y+=h; };
      const show=key => key === 'reportDate' ? dateFormat(d[key]) : (d[key] ?? '');
      const pair=(a,b,h) => row(h,[[labels[a],undefined,c[0],c[1]],['',show(a),c[1],c[2]],[labels[b],undefined,c[2],c[3]],['',show(b),c[3],c[4]]]);
      pair('department','origin',50);
      pair('reference','type',56);
      pair('owner','reportDate',48);
      box(c[0],y,c[1]-c[0],64); text(labels.evidence,c[0]+8,y+38,17,{bold:true});
      box(c[1],y,c[4]-c[1],64); font(17); ctx.fillStyle=ink; wrap(ctx,evidenceText(d.evidence),c[1]+8,y+27,c[4]-c[1]-16,22,2);
      y+=64;
      box(c[0],y,670-c[0],48);
      const w=text(labels.summary+' ',c[0]+8,y+30,17,{bold:true});
      text(d.summary ?? '',c[0]+8+w,y+30,17,{max:670-c[0]-24-w});
      box(670,y,c[4]-670,48);
      const pw=text('Período: ',680,y+30,17,{bold:true});
      text('de '+period.replace(' a ',' a '),680+pw,y+30,17,{max:c[4]-690-pw});
      top=y+48+28;
    }

    const bottom=1605;
    const blockH=(bottom-top)/2;
    let contentEnd=top;
    const hasContent = slot => slot && (slot.image || [slot.date,slot.company,slot.place,slot.description].some(v => v?.trim()));
    function rounded(x,y,w,h,r) {
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    }
    async function drawRow(pair,y0) {
      if (!pair.some(hasContent)) return;
      const gap=16, w=(R-L-gap)/2, radius=14;
      const metaH=50, band=40, desc=76;
      const ty=y0+metaH+8;
      const ph=Math.min(blockH-metaH-8-band-desc-28,450);
      for (const [index,slot] of pair.entries()) {
        const x=index ? L+w+gap : L;
        // Dia e Empresa: etiqueta azul, data em verde e empresa em branco.
        rounded(x,y0,w,metaH,12); ctx.fillStyle=navyBlue; ctx.fill();
        const wd=text('Dia ',x+14,y0+21,18,{bold:true,color:neonGreen});
        text(dateFormat(slot.date),x+14+wd,y0+21,18,{bold:true,color:neonGreen});
        const we=text('Empresa: ',x+14,y0+42,16,{color:'#ffffff'});
        text(slot.company ?? '',x+14+we,y0+42,16,{bold:true,color:'#ffffff',max:w-28-we});
        // Quadro da foto com cantos arredondados: faixa azul, foto e rodapé verde.
        const h=band+ph+desc;
        ctx.save();
        rounded(x,ty,w,h,radius); ctx.clip();
        ctx.fillStyle='#ffffff'; ctx.fillRect(x,ty,w,h);
        ctx.fillStyle=navyBlue; ctx.fillRect(x,ty,w,band);
        ctx.fillStyle=neonGreen; ctx.fillRect(x,ty+band+ph,w,desc);
        if (slot.image) {
          const img=new Image();
          img.src=slot.image.url;
          await img.decode();
          const ratio=Math.min((w-16)/img.width,(ph-16)/img.height);
          const iw=img.width*ratio, ih=img.height*ratio;
          ctx.drawImage(img,x+(w-iw)/2,ty+band+(ph-ih)/2,iw,ih);
        }
        ctx.restore();
        rounded(x,ty,w,h,radius); ctx.strokeStyle=navyBlue; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle=navyBlue; ctx.fillRect(x,ty+band+ph-1,w,2);
        const wl=text('Local: ',x+14,ty+28,21,{bold:true,color:neonGreen});
        text(slot.place ?? '',x+14+wl,ty+28,21,{bold:true,color:neonGreen,max:w-28-wl});
        font(17,true); ctx.fillStyle=navyBlue;
        wrap(ctx,slot.description ?? '',x+14,ty+band+ph+26,w-28,21,3);
      }
      contentEnd=ty+band+ph+desc;
    }
    await drawRow([slots[0],slots[1]],top);
    await drawRow([slots[2],slots[3]],top+blockH);
    rounded(L-10,top-14,R-L+20,Math.max(contentEnd,top+40)-top+28,18);
    ctx.strokeStyle=ink; ctx.lineWidth=1.5; ctx.stroke();

    // Rodapé
    ctx.fillStyle=navy; ctx.fillRect(150,1648,940,2);
    text('BRAVA ENERGIA',150,1682,18,{bold:true,color:navy});
    text('Pág. '+(pageIndex+1)+' de '+total,1090,1682,18,{bold:true,color:navy,align:'right'});
    spaced('DOCUMENTOS IMPRESSOS SÃO CONSIDERADOS CÓPIAS NÃO CONTROLADAS',W/2,1730,14,'#8C8C99',3);
    return canvas;
  }));
}

export async function makePDF(sheets,name) {
  const chunks=[], offsets=[0];
  let size=0;
  const add=value=>{const data=typeof value==='string'?bytes(value):value; chunks.push(data); size+=data.length;};
  const object=(id,body,data)=>{
    offsets[id]=size; add(id+' 0 obj\n'+body);
    if (data) {add('\nstream\n');add(data);add('\nendstream');}
    add('\nendobj\n');
  };
  add('%PDF-1.4\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Count '+sheets.length+' /Kids ['+sheets.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');
  for (let i=0;i<sheets.length;i++) {
    const id=3+i*3, sheet=sheets[i], image=jpeg(sheet.toDataURL('image/jpeg',.93));
    const commands=bytes('q 595.28 0 0 841.89 0 0 cm /Photo Do Q\n');
    object(id,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Photo '+(id+1)+' 0 R >> >> /Contents '+(id+2)+' 0 R >>');
    object(id+1,'<< /Type /XObject /Subtype /Image /Width '+sheet.width+' /Height '+sheet.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.length+' >>',image);
    object(id+2,'<< /Length '+commands.length+' >>',commands);
  }
  const xref=size;
  add('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join(''));
  add('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new File(chunks,name+'.pdf',{type:'application/pdf'});
}

const relationship = (id,type,target) => '<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>';
const relationships = content => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+content+'</Relationships>';
function wordPage(sheet,index) {
  const id=index+1;
  const width=7500000;
  const height=Math.round(width*sheet.height/sheet.width);
  const size='cx="'+width+'" cy="'+height+'"';
  return '<w:p><w:pPr>'+(index ? '<w:pageBreakBefore/>' : '')+
    '<w:spacing w:before="0" w:after="0" w:line="16780" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr>'+
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent '+size+'/>'+
    '<wp:docPr id="'+id+'" name="Página '+id+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="Página '+id+'"/><pic:cNvPicPr/></pic:nvPicPr>'+
    '<pic:blipFill><a:blip r:embed="rId'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext '+size+'/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+
    '</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
export function makeWord(sheets,name) {
  const files = {}, links=[];
  const body=sheets.map((sheet,index)=>{
    const path='media/pagina-'+(index+1)+'.jpg';
    files['word/'+path]=jpeg(sheet.toDataURL('image/jpeg',.94));
    links.push(relationship('rId'+(index+1),'image',path));
    return wordPage(sheet,index);
  }).join('');
  files['word/document.xml']='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>';
  files['word/_rels/document.xml.rels']=relationships(links.join(''));
  files['_rels/.rels']=relationships(relationship('rId1','officeDocument','word/document.xml'));
  files['[Content_Types].xml']='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  return new File(zip(files),name+'.docx',{type:wordMime});
}
function zip(files) {
  const local=[], central=[];
  let position=0, centralSize=0;
  const header=(size,values)=>{
    const data=new Uint8Array(size), view=new DataView(data.buffer);
    for (const [offset,value,length] of values) {
      if (length===4) view.setUint32(offset,value,true);
      else view.setUint16(offset,value,true);
    }
    return data;
  };
  const crcTable=Array.from({length:256},(_,n)=>{
    for (let i=0;i<8;i++) n=(n>>>1)^((n&1)?0xedb88320:0);
    return n;
  });
  for (const [path,content] of Object.entries(files)) {
    const name=bytes(path), data=typeof content==='string'?bytes(content):content;
    let crc=0xffffffff;
    for (const byte of data) crc=(crc>>>8)^crcTable[(crc^byte)&255];
    crc^=0xffffffff;
    local.push(header(30,[[0,0x04034b50,4],[4,20,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]),name,data);
    central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,position,4]]),name);
    position+=30+name.length+data.length;
    centralSize+=46+name.length;
  }
  const count=Object.keys(files).length;
  return [...local,...central,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralSize,4],[16,position,4]])];
}
