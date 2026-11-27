export function projectProgress(report){const m=new Map();for(const s of report.pages.flat()){const activity=s.activity?.trim(), location=s.place?.trim();const hasProgress=s.progress!=null&&String(s.progress).trim()!==''&&Number.isFinite(Number(s.progress));if(!activity&&!hasProgress)continue;const name=activity||(location?'Sem atividade · '+location:'Sem atividade identificada');const k=(activity?"activity:":"unassigned:")+name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');const item=m.get(k)||{name,value:null,date:'',updated:0,count:0};if(s.image)item.count++;const valid=s.progress!=null&&String(s.progress).trim()!==''&&Number.isFinite(Number(s.progress));const updated=s.progressUpdated||0;if(valid&& (item.value===null||updated>item.updated||updated===item.updated&&(s.date||'')>=item.date)){item.value=Math.max(0,Math.min(100,Number(s.progress)));item.date=s.date||'';item.updated=updated;}m.set(k,item);}return [...m.values()];}
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
  const total = report.pages.length+1;
  return Promise.all([null,...report.pages].map(async (slots,pageIndex) => {
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
    text('BRAVA',L+12,118,62,{bold:true,italic:true,color:navy});
    text('energia',L+167,140,17,{color:'#6B6F86'});
    text('REGISTRO DE EVIDÊNCIA',555,98,23,{bold:true,align:'center'});
    ctx.fillStyle=navy; ctx.fillRect(885,30,2,140);
    text('FORM-CORP-SMS-030',1025,70,18,{bold:true,align:'center'});
    text('GS2 – USO INTERNO',1025,106,18,{bold:true,align:'center'});
    text('Rev.: 00',1025,142,18,{bold:true,align:'center'});
    

    rounded(L,22,R-L,158,18);ctx.strokeStyle=navy;ctx.lineWidth=3;ctx.stroke();
    let top=200;
    if (pageIndex === 0) {
      text('FORMULÁRIO',W/2,228,21,{bold:true,align:'center'});
      const formTop=250, formRadius=16;
      const rowHeights=[50,56,48,64,48];
      const formHeight=rowHeights.reduce((total,height)=>total+height,0);
      const c=[0,.27,.45,.63,1].map(fraction=>L+Math.round((R-L)*fraction));
      ctx.save();
      rounded(L,formTop,R-L,formHeight,formRadius);
      ctx.clip();
      let y=formTop;
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
      pair('department','origin',rowHeights[0]);
      pair('reference','type',rowHeights[1]);
      pair('owner','reportDate',rowHeights[2]);
      box(c[0],y,c[1]-c[0],rowHeights[3]); text(labels.evidence,c[0]+8,y+38,17,{bold:true});
      box(c[1],y,c[4]-c[1],rowHeights[3]); font(17); ctx.fillStyle=ink; wrap(ctx,evidenceText(d.evidence),c[1]+8,y+27,c[4]-c[1]-16,22,2);
      y+=rowHeights[3];
      const summaryBoundary=c[2];
      box(c[0],y,summaryBoundary-c[0],rowHeights[4]);
      const w=text(labels.summary+' ',c[0]+8,y+30,17,{bold:true});
      text(d.summary ?? '',c[0]+8+w,y+30,17,{max:summaryBoundary-c[0]-24-w});
      box(summaryBoundary,y,c[4]-summaryBoundary,rowHeights[4]);
      const pw=text('Período: ',summaryBoundary+10,y+30,17,{bold:true});
      text('de '+period.replace(' a ',' a '),summaryBoundary+10+pw,y+30,17,{max:c[4]-summaryBoundary-20-pw});
      ctx.restore();
      rounded(L,formTop,R-L,formHeight,formRadius);
      ctx.strokeStyle=ink;
      ctx.lineWidth=1.5;
      ctx.stroke();
      top=formTop+formHeight+28;const projects=projectProgress(report);const cols=Math.max(1,Math.ceil(projects.length/12)),rows=Math.ceil(projects.length/cols),cw=(R-L-40)/cols,rh=Math.min(78,900/Math.max(1,rows));const chartH=140+Math.max(1,rows)*rh;rounded(L,top,R-L,chartH,18);ctx.fillStyle='#f7f7fa';ctx.fill();ctx.strokeStyle=navyBlue;ctx.lineWidth=2;ctx.stroke();text('AVANÇO FÍSICO DOS PROJETOS',W/2,top+35,22,{bold:true,color:navyBlue,align:'center'});if(!projects.length)text('Nenhuma atividade registrada.',W/2,top+85,20,{align:'center'});projects.forEach((item,i)=>{const x=L+20+Math.floor(i/rows)*cw,y=top+65+(i%rows)*rh;const label=item.value===null?'Não informado':item.value+'%';text(item.name,x,y,17,{bold:true,color:navyBlue,max:cw-135});text(label,x+cw-12,y,16,{bold:true,color:navyBlue,align:'right'});if(item.value!==null){const bw=cw-25;rounded(x,y+8,bw,12,5);ctx.fillStyle='#dedbea';ctx.fill();ctx.save();ctx.clip();const g=ctx.createLinearGradient(x,0,x+bw,0);g.addColorStop(0,'#ff574d');g.addColorStop(.5,'#ffbc32');g.addColorStop(1,'#ceff00');ctx.fillStyle=g;ctx.fillRect(x,y+8,bw*item.value/100,12);ctx.restore();}text(item.count+' registros fotográficos',x,y+35,13,{color:'#77758a'});});const totals=[['Atividades',projects.length],['Fotografias',report.pages.flat().filter(s=>s.image).length],['Concluídas',projects.filter(s=>s.value===100).length]];totals.forEach(([label,n],i)=>{const x=L+(R-L)*(i+.5)/3;text(String(n),x,top+chartH-45,28,{bold:true,color:navyBlue,align:'center'});text(label,x,top+chartH-20,16,{color:navyBlue,align:'center'});});
    }

    const bottom=1605;
    const blockH=(bottom-top)/2;
    let contentEnd=top;
    const hasContent = slot => slot && (slot.image || [slot.date,slot.company,slot.place,slot.description,slot.activity,slot.progress,slot.serviceProgress].some(v => v?.trim()));
    function rounded(x,y,w,h,r) {
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    }
    async function drawRow(pair,y0) {
      if (!pair.some(hasContent)) return;
      const gap=16, w=(R-L-gap)/2, radius=14;
      const hasProgress=s=>s.progress!==undefined && s.progress!==null && s.progress!=='' && Number.isFinite(Number(s.progress));
      const hasActivity=pair.some(s=>s.activity?.trim());
      const showProgress=pair.some(hasProgress);
      const metaH=50, band=40+(hasActivity?18:0)+(showProgress?16:0), desc=76;
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
        if(slot.activity?.trim()) text('Atividade: '+slot.activity,x+14,ty+47,14,{bold:true,color:'#ffffff',max:w-28});
        if(hasProgress(slot)){
          const p=Math.max(0,Math.min(100,Number(slot.progress)));
          const py=ty+40+(hasActivity?18:0);
          text('Avanço '+p+'%',x+14,py+12,13,{bold:true,color:'#ffffff'});
          const bx=x+135,bw=w-149,bh=7,by=py+4;
          ctx.fillStyle='#51488a';ctx.fillRect(bx,by,bw,bh);
          if(p>0){const g=ctx.createLinearGradient(bx,by,bx+bw,by);g.addColorStop(0,'#ff6955');g.addColorStop(.45,'#ffd84a');g.addColorStop(1,'#ceff00');ctx.fillStyle=g;ctx.fillRect(bx,by,bw*p/100,bh);}
        }
        font(17,true); ctx.fillStyle=navyBlue;
        const sp=slot.serviceProgress!=null&&slot.serviceProgress!=='';wrap(ctx,slot.description ?? '',x+14,ty+band+ph+20,w-28,17,sp?2:3);if(sp){const n=Number(slot.serviceProgress),yy=ty+band+ph+58;text('Serviço '+n+'%',x+14,yy,13,{bold:true,color:navyBlue});ctx.fillStyle='#a4cb00';ctx.fillRect(x+125,yy-9,w-139,7);ctx.fillStyle=navyBlue;ctx.fillRect(x+125,yy-9,(w-139)*n/100,7);}
      }
      contentEnd=ty+band+ph+desc;
    }
    if(slots){await drawRow([slots[0],slots[1]],top);
    await drawRow([slots[2],slots[3]],top+blockH);
    rounded(L-10,top-14,R-L+20,Math.max(contentEnd,top+40)-top+28,18);
    ctx.strokeStyle=ink; ctx.lineWidth=1.5; ctx.stroke();}

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
  const width=7450000;
  const height=Math.round(width*sheet.height/sheet.width);
  return '<w:p><w:pPr>'+(index ? '<w:pageBreakBefore/>' : '')+
    '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'+
    wordDrawing(id,width,height)+'</w:p>';
}
function wordDrawing(id,width,height) {
  const size='cx="'+width+'" cy="'+height+'"';
  return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent '+size+'/>'+
    '<wp:docPr id="'+id+'" name="Imagem '+id+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="Imagem '+id+'"/><pic:cNvPicPr/></pic:nvPicPr>'+
    '<pic:blipFill><a:blip r:embed="rId'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext '+size+'/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+
    '</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}
export function makeWord(sheets,pageImages,name) {
  const files = {}, links=[];
  const body=sheets.map((sheet,index)=>{
    const path='media/pagina-'+(index+1)+'.png';
    files['word/'+path]=jpeg(pageImages[index]);
    links.push(relationship('rId'+(index+1),'image',path));
    return wordPage(sheet,index);
  }).join('');
  return packageWord(files,links,body,name,'0');
}

// ---------- Word editável com o mesmo desenho do app ----------
// Placas arredondadas (formas do Word atrás do texto) + tabelas sem bordas com texto e fotos editáveis.
// Medidas em pixels da página do app (1240 x 1754 = A4); 1 px = 9,6 twips = 6096 EMU.
export async function makeEditableWord(report,period,dateFormat,name) {
  const tw = px => Math.round(px*9.6), emu = px => Math.round(px*6096), hp = px => Math.max(2,Math.round(px*0.96));
  const hex = color => color.replace('#','').toUpperCase();
  const esc = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/[&<>"]/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const files = {}, links = [];
  let rid = 10, shapeId = 1, z = 1000;
  function addMedia(data,ext) {
    const id = 'rId'+(++rid), path = 'media/img'+rid+'.'+ext;
    files['word/'+path] = data;
    links.push(relationship(id,'image',path));
    return id;
  }
  // Texto
  function run(text,{bold=false,italic=false,color=ink,size=17,spacing=0}={}) {
    return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+(bold?'<w:b/><w:bCs/>':'')+(italic?'<w:i/><w:iCs/>':'')+
      '<w:color w:val="'+hex(color)+'"/>'+(spacing?'<w:spacing w:val="'+spacing+'"/>':'')+'<w:sz w:val="'+hp(size)+'"/><w:szCs w:val="'+hp(size)+'"/></w:rPr>'+
      '<w:t xml:space="preserve">'+esc(text)+'</w:t></w:r>';
  }
  const tab = '<w:r><w:tab/></w:r>';
  function para(content='',{align='left',line=0,before=0,tabs=[],indL=0,indR=0,top=null,pageBreak=false}={}) {
    return '<w:p><w:pPr>'+(pageBreak?'<w:pageBreakBefore/>':'')+
      (top?'<w:pBdr><w:top w:val="single" w:sz="'+top.sz+'" w:space="4" w:color="'+hex(top.color)+'"/></w:pBdr>':'')+
      (tabs.length?'<w:tabs>'+tabs.map(t => '<w:tab w:val="'+t.align+'" w:pos="'+tw(t.pos)+'"/>').join('')+'</w:tabs>':'')+
      '<w:spacing w:before="'+tw(before)+'" w:after="0" '+(line?'w:line="'+tw(line)+'" w:lineRule="exact"':'w:line="240" w:lineRule="auto"')+'/>'+
      (indL||indR?'<w:ind w:left="'+tw(indL)+'" w:right="'+tw(indR)+'"/>':'')+
      '<w:jc w:val="'+align+'"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>'+content+'</w:p>';
  }
  // Placa arredondada fixa na página, atrás do texto
  function plate({x,y,w,h,radius=0,fill=null,line=null,lineW=1.5,shape='roundRect',flipV=false}) {
    const id = shapeId++;
    const ratio = Math.min(.5,radius/Math.max(1,Math.min(w,h)));
    const adj = shape === 'roundRect' ? '<a:gd name="adj" fmla="val '+Math.round(ratio*100000)+'"/>' :
      shape === 'round2SameRect' ? '<a:gd name="adj1" fmla="val '+Math.round(ratio*100000)+'"/><a:gd name="adj2" fmla="val 0"/>' : '';
    // Mesmo formato que o próprio Word grava (forma moderna dentro de AlternateContent).
    return '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="'+(z++)+'" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">'+
      '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>'+emu(x)+'</wp:posOffset></wp:positionH>'+
      '<wp:positionV relativeFrom="page"><wp:posOffset>'+emu(y)+'</wp:posOffset></wp:positionV>'+
      '<wp:extent cx="'+emu(w)+'" cy="'+emu(h)+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'+
      '<wp:docPr id="'+(5000+id)+'" name="Placa '+id+'"/><wp:cNvGraphicFramePr/>'+
      '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/>'+
      '<wps:spPr><a:xfrm'+(flipV?' flipV="1"':'')+'><a:off x="0" y="0"/><a:ext cx="'+emu(w)+'" cy="'+emu(h)+'"/></a:xfrm>'+
      '<a:prstGeom prst="'+shape+'"><a:avLst>'+adj+'</a:avLst></a:prstGeom>'+
      (fill?'<a:solidFill><a:srgbClr val="'+hex(fill)+'"/></a:solidFill>':'<a:noFill/>')+
      (line?'<a:ln w="'+emu(lineW)+'"><a:solidFill><a:srgbClr val="'+hex(line)+'"/></a:solidFill></a:ln>':'<a:ln><a:noFill/></a:ln>')+
      '</wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r>';
  }
  function picture(id,w,h,label) {
    const n = shapeId++;
    const size = 'cx="'+emu(w)+'" cy="'+emu(h)+'"';
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent '+size+'/><wp:effectExtent l="0" t="0" r="0" b="0"/>'+
      '<wp:docPr id="'+(5000+n)+'" name="'+esc(label)+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'+
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'+
      '<pic:nvPicPr><pic:cNvPr id="'+(5000+n)+'" name="'+esc(label)+'"/><pic:cNvPicPr/></pic:nvPicPr>'+
      '<pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext '+size+'/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'+
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  // Barras de avanço desenhadas como imagem (mesmas cores e degradê do app)
  function bar(w,h,percent,style) {
    const scale = 4, canvas = document.createElement('canvas');
    canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
    const ctx = canvas.getContext('2d');
    const p = Math.max(0,Math.min(100,Number(percent) || 0))/100;
    const r = style === 'project' ? canvas.height/2 : 0;
    const round = (x,width) => { ctx.beginPath(); if (ctx.roundRect && r) ctx.roundRect(x,0,width,canvas.height,r); else ctx.rect(x,0,width,canvas.height); };
    const colors = {project:['#dedbea',['#ff574d','#ffbc32','#ceff00']],band:['#51488a',['#ff6955','#ffd84a','#ceff00']],service:['#a4cb00',null]}[style];
    round(0,canvas.width); ctx.fillStyle = colors[0]; ctx.fill();
    if (p > 0) {
      ctx.save(); round(0,canvas.width); ctx.clip();
      if (colors[1]) {
        const g = ctx.createLinearGradient(0,0,canvas.width,0);
        g.addColorStop(0,colors[1][0]); g.addColorStop(style === 'band' ? .45 : .5,colors[1][1]); g.addColorStop(1,colors[1][2]);
        ctx.fillStyle = g;
      } else ctx.fillStyle = navyBlue;
      ctx.fillRect(0,0,canvas.width*p,canvas.height);
      ctx.restore();
    }
    const data = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c => c.charCodeAt(0));
    return picture(addMedia(data,'png'),w,h,'Barra de avanço');
  }
  // Tabela com grade calculada a partir das larguras de cada linha
  function table(rows,{inside=null}={}) {
    const edges = new Set([0]);
    for (const row of rows) { let x = 0; for (const c of row.cells) { x += c.w; edges.add(tw(x)); } }
    const grid = [...edges].sort((a,b) => a-b);
    const total = grid[grid.length-1];
    const border = inside ? '<w:insideH w:val="single" w:sz="'+inside.sz+'" w:color="'+hex(inside.color)+'"/><w:insideV w:val="single" w:sz="'+inside.sz+'" w:color="'+hex(inside.color)+'"/>' :
      '<w:insideH w:val="nil"/><w:insideV w:val="nil"/>';
    let y = 0;
    const body = rows.map(row => {
      const height = tw(y+row.h)-tw(y); y += row.h;
      let x = 0;
      const cells = row.cells.map(c => {
        const start = tw(x); x += c.w; const end = tw(x);
        const span = grid.indexOf(end)-grid.indexOf(start);
        const m = c.mar || [0,0,0,0];
        const b = c.borders ? '<w:tcBorders>'+Object.entries(c.borders).map(([side,v]) => '<w:'+side+' w:val="single" w:sz="'+v.sz+'" w:color="'+hex(v.color)+'"/>').join('')+'</w:tcBorders>' : '';
        return '<w:tc><w:tcPr><w:tcW w:w="'+(end-start)+'" w:type="dxa"/>'+(span > 1 ? '<w:gridSpan w:val="'+span+'"/>' : '')+b+
          (c.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+hex(c.fill)+'"/>':'')+
          '<w:tcMar><w:top w:w="'+tw(m[0])+'" w:type="dxa"/><w:right w:w="'+tw(m[1])+'" w:type="dxa"/><w:bottom w:w="'+tw(m[2])+'" w:type="dxa"/><w:left w:w="'+tw(m[3])+'" w:type="dxa"/></w:tcMar>'+
          '<w:vAlign w:val="'+(c.v || 'top')+'"/></w:tcPr>'+(c.content || para())+'</w:tc>';
      }).join('');
      return '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="'+height+'" w:hRule="'+(row.rule || 'exact')+'"/></w:trPr>'+cells+'</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/>'+
      '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>'+border+'</w:tblBorders>'+
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'+
      '<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>'+grid.slice(1).map((g,i) => '<w:gridCol w:w="'+(g-grid[i])+'"/>').join('')+'</w:tblGrid>'+body+'</w:tbl>';
  }
  const blank = h => ({h,cells:[{w:R-L}]});

  // Cantos arredondados feitos com pequenas imagens nos cantos de cada quadro:
  // só tabelas, cores de célula e imagens em linha, que abrem iguais no Word, no iPhone e no Android.
  const R0 = 10, LINE = 2, sz = 8;
  const cornerCache = new Map();
  function corner(pos,fill,line) {
    const key = pos+fill+line;
    if (!cornerCache.has(key)) {
      const scale = 6, size = R0*scale, canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const cx = pos.includes('L') ? size : 0, cy = pos.includes('T') ? size : 0;
      ctx.beginPath(); ctx.arc(cx,cy,size,0,Math.PI*2); ctx.fillStyle = fill; ctx.fill();
      if (line) { ctx.beginPath(); ctx.arc(cx,cy,size-LINE*scale/2,0,Math.PI*2); ctx.lineWidth = LINE*scale; ctx.strokeStyle = line; ctx.stroke(); }
      const data = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c => c.charCodeAt(0));
      cornerCache.set(key,addMedia(data,'png'));
    }
    return para(picture(cornerCache.get(key),R0,R0,'Canto'),{align:pos.includes('L') ? 'left' : 'right'});
  }
  const edge = (line,sides) => line ? Object.fromEntries(sides.map(side => [side,{sz,color:line}])) : undefined;
  // Monta um quadro arredondado: linhas internas [{fill, cells:[{w,content,v,mar,borders}], h, rule, divider}]
  function card(rows,{line=null}={}) {
    const first = rows[0].fill || '#ffffff', last = rows[rows.length-1].fill || '#ffffff';
    const inner = rows[0].cells.reduce((t,c) => t+c.w,0);
    const cap = (pos,fill) => ({h:R0,rule:'exact',cells:[
      {w:R0,content:corner(pos+'L',fill,line)},
      {w:inner,fill,borders:edge(line,[pos === 'T' ? 'top' : 'bottom'])},
      {w:R0,content:corner(pos+'R',fill,line)}]});
    const out = [cap('T',first)];
    for (const row of rows) {
      const fill = row.fill || '#ffffff';
      const divider = row.divider && line ? {top:{sz,color:line}} : {};
      out.push({h:row.h || 10,rule:row.rule || 'atLeast',cells:[
        {w:R0,fill,borders:{...edge(line,['left']),...divider}},
        ...row.cells.map(c => ({...c,fill:c.fill || fill,borders:{...(c.borders || {}),...divider}})),
        {w:R0,fill,borders:{...edge(line,['right']),...divider}}]});
    }
    out.push(cap('B',last));
    return out;
  }
  // Coloca dois quadros lado a lado, linha a linha
  const side = (left,right,gap) => left.map((row,i) => ({h:Math.max(row.h,right[i].h),rule:row.rule === 'exact' && right[i].rule === 'exact' ? 'exact' : 'atLeast',
    cells:[...row.cells,{w:gap},...right[i].cells]}));
  const spacer = h => para('',{line:h});
  const pageBreak = '<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  const FULL = R-L, INNER = FULL-2*R0;

  // Cabeçalho BRAVA no corpo de cada página (mais fiel em todos os leitores do que o cabeçalho do Word)
  const pageHead = () => table(card([{h:136,rule:'exact',cells:[
    {w:300,v:'center',mar:[0,0,0,6],content:para(run('BRAVA',{bold:true,italic:true,size:60,color:navy}),{line:60})+para(run('energia',{size:17,color:'#6B6F86'}),{line:20,indL:158})},
    {w:INNER-300-270,v:'center',content:para(run('REGISTRO DE EVIDÊNCIA',{bold:true,size:23}),{align:'center',line:28})},
    {w:270,v:'center',borders:{left:{sz:12,color:navy}},content:
      para(run('FORM-CORP-SMS-030',{bold:true,size:18}),{align:'center',line:34})+
      para(run('GS2 – USO INTERNO',{bold:true,size:18}),{align:'center',line:34})+
      para(run('Rev.: 00',{bold:true,size:18}),{align:'center',line:34})}]}],{line:navy}));

  // ---- Página 1: formulário + avanço físico ----
  const d = report.details;
  const show = key => key === 'reportDate' ? dateFormat(d[key]) : (d[key] ?? '');
  const c = [0,.27,.45,.63,1].map(f => Math.round(INNER*f));
  const cw = i => c[i+1]-c[i];
  const label = t => para(run(t,{bold:true,size:17}),{line:20});
  const valueP = t => para(run(t,{bold:true,size:17,color:value}),{line:20});
  const grid = {sz:6,color:ink};
  const fc = (w,content,{right=true,bottom=true}={}) => ({w,content,v:'center',mar:[0,8,0,8],borders:{...(right?{right:grid}:{}),...(bottom?{bottom:grid}:{})}});
  const formRows = card([
    {h:46,rule:'exact',cells:[fc(cw(0),label(labels.department)),fc(cw(1),valueP(show('department'))),fc(cw(2),label(labels.origin)),fc(cw(3),valueP(show('origin')),{right:false})]},
    {h:56,rule:'exact',cells:[fc(cw(0),label(labels.reference)),fc(cw(1),valueP(show('reference'))),fc(cw(2),label(labels.type)),fc(cw(3),valueP(show('type')),{right:false})]},
    {h:48,rule:'exact',cells:[fc(cw(0),label(labels.owner)),fc(cw(1),valueP(show('owner'))),fc(cw(2),label(labels.reportDate)),fc(cw(3),valueP(show('reportDate')),{right:false})]},
    {h:64,rule:'exact',cells:[fc(cw(0),label(labels.evidence)),fc(c[4]-c[1],para(run(evidenceText(d.evidence),{size:17}),{line:21}),{right:false})]},
    {h:44,rule:'exact',cells:[fc(c[2],para(run(labels.summary+' ',{bold:true,size:17})+run(d.summary ?? '',{size:17}),{line:20}),{bottom:false}),
      fc(c[4]-c[2],para(run('Período: ',{bold:true,size:17})+run('de '+period,{size:17}),{line:20}),{right:false,bottom:false})]}
  ],{line:ink});
  const projects = projectProgress(report);
  const cols = Math.max(1,Math.ceil(projects.length/12)), rowsN = Math.ceil(projects.length/cols);
  const colW = (INNER-20)/cols, rh = Math.min(74,880/Math.max(1,rowsN));
  const chart = [{fill:'#f7f7fa',h:50,rule:'exact',cells:[{w:INNER,v:'center',content:para(run('AVANÇO FÍSICO DOS PROJETOS',{bold:true,size:22,color:navyBlue}),{align:'center',line:28})}]}];
  if (!projects.length) chart.push({fill:'#f7f7fa',h:60,cells:[{w:INNER,v:'center',content:para(run('Nenhuma atividade registrada.',{size:20}),{align:'center',line:24})}]});
  for (let r=0; r<rowsN; r++) {
    const cells = [{w:10}];
    for (let k=0; k<cols; k++) {
      const item = projects[k*rowsN+r];
      if (!item) { cells.push({w:colW}); continue; }
      const pct = item.value === null ? 'Não informado' : item.value+'%';
      cells.push({w:colW,content:
        para(run(item.name,{bold:true,size:17,color:navyBlue})+tab+run(pct,{bold:true,size:16,color:navyBlue}),{line:22,tabs:[{align:'right',pos:colW-12}]})+
        (item.value === null ? para('',{line:14}) : para(bar(colW-25,12,item.value,'project'),{line:14,before:2}))+
        para(run(item.count+' registros fotográficos',{size:13,color:'#77758a'}),{line:18,before:2})});
    }
    cells.push({w:10});
    chart.push({fill:'#f7f7fa',h:rh,rule:'exact',cells});
  }
  const totals = [['Atividades',projects.length],['Fotografias',report.pages.flat().filter(s => s.image).length],['Concluídas',projects.filter(s => s.value === 100).length]];
  chart.push({fill:'#f7f7fa',h:66,rule:'exact',cells:totals.map(([t,n],i) => ({w:i < 2 ? Math.round(INNER/3) : INNER-2*Math.round(INNER/3),v:'center',
    content:para(run(String(n),{bold:true,size:28,color:navyBlue}),{align:'center',line:32})+para(run(t,{size:16,color:navyBlue}),{align:'center',line:22})}))});
  const firstPage = pageHead()+spacer(14)+para(run('FORMULÁRIO',{bold:true,size:21}),{align:'center',line:34})+
    table(formRows)+spacer(24)+table(card(chart,{line:navyBlue}));

  // ---- Páginas de fotos: 4 por página ----
  const gapX = 16, w = (FULL-gapX)/2, wi = w-2*R0, PH = 400;
  const hasProgress = s => s && s.progress !== undefined && s.progress !== null && s.progress !== '' && Number.isFinite(Number(s.progress));
  const hasContent = s => s && (s.image || [s.date,s.company,s.place,s.description,s.activity,s.progress,s.serviceProgress].some(v => String(v ?? '').trim()));
  async function photoContent(slot,boxW,boxH,labelText) {
    if (!slot.image?.url) return para('',{align:'center',line:boxH});
    const img = new Image();
    img.src = slot.image.url;
    await img.decode();
    const k = Math.min(boxW/img.width,boxH/img.height);
    const png = /^data:image\/png/.test(slot.image.url);
    const id = addMedia(Uint8Array.from(atob(slot.image.url.split(',')[1]),ch => ch.charCodeAt(0)),png ? 'png' : 'jpeg');
    return para(picture(id,img.width*k,img.height*k,labelText),{align:'center'});
  }
  const pages = [];
  for (const [pageIndex,slots] of report.pages.entries()) {
    let html = pageHead()+spacer(18);
    for (const [blockIndex,pair] of [[slots[0],slots[1]],[slots[2],slots[3]]].entries()) {
      if (!pair.some(hasContent)) continue;
      const hasActivity = pair.some(s => s?.activity?.trim());
      const showProgress = pair.some(hasProgress);
      const metas = pair.map(s => card([{fill:navyBlue,h:42,rule:'exact',cells:[{w:wi,v:'center',mar:[0,4,0,4],content:
        para(run('Dia ',{bold:true,size:18,color:neonGreen})+run(dateFormat(s.date),{bold:true,size:18,color:neonGreen}),{line:21})+
        para(run('Empresa: ',{size:16,color:'#ffffff'})+run(s.company ?? '',{bold:true,size:16,color:'#ffffff'}),{line:20})}]}]));
      const cards = [];
      for (const [i,s] of pair.entries()) {
        let band = para(run('Local: ',{bold:true,size:21,color:neonGreen})+run(s.place ?? '',{bold:true,size:21,color:neonGreen}),{line:28});
        if (hasActivity) band += para(s.activity?.trim() ? run('Atividade: '+s.activity,{bold:true,size:14,color:'#ffffff'}) : '',{line:18});
        if (showProgress) {
          const p = hasProgress(s) ? Math.max(0,Math.min(100,Number(s.progress))) : null;
          band += para(p === null ? '' : run('Avanço '+p+'%',{bold:true,size:13,color:'#ffffff'})+tab+bar(wi-135,7,p,'band'),{line:18,tabs:[{align:'left',pos:111}]});
        }
        const service = s.serviceProgress != null && String(s.serviceProgress) !== '';
        const n = service ? Math.max(0,Math.min(100,Number(s.serviceProgress) || 0)) : 0;
        let desc = para(run(s.description ?? '',{bold:true,size:17,color:navyBlue}),{line:19,before:4});
        if (service) desc += para(run('Serviço '+n+'%',{bold:true,size:13,color:navyBlue})+tab+bar(wi-125,7,n,'service'),{line:20,before:4,tabs:[{align:'left',pos:101}]});
        cards.push(card([
          {fill:navyBlue,h:28+(hasActivity?18:0)+(showProgress?18:0),rule:'exact',cells:[{w:wi,content:band}]},
          {fill:'#ffffff',h:PH,rule:'exact',cells:[{w:wi,v:'center',content:await photoContent(s,wi-4,PH-12,'Foto '+(pageIndex*4+blockIndex*2+i+1))}]},
          {fill:neonGreen,h:66,rule:'exact',divider:true,cells:[{w:wi,content:desc}]}
        ],{line:navyBlue}));
      }
      html += table(side(metas[0],metas[1],gapX))+spacer(6)+table(side(cards[0],cards[1],gapX))+spacer(18);
    }
    pages.push(pageBreak+html);
  }

  // ---- Rodapé simples do Word (se repete em todas as páginas) ----
  const field = instr => '<w:fldSimple w:instr=" '+instr+' ">'+run('1',{bold:true,size:18,color:navy})+'</w:fldSimple>';
  const footer = '<w:ftr '+wordNamespaces+'>'+
    para(run('BRAVA ENERGIA',{bold:true,size:18,color:navy})+tab+run('Pág. ',{bold:true,size:18,color:navy})+field('PAGE')+run(' de ',{bold:true,size:18,color:navy})+field('NUMPAGES'),
      {line:30,indL:65,indR:65,top:{sz:12,color:navy},tabs:[{align:'right',pos:R-L-130}]})+
    para(run('DOCUMENTOS IMPRESSOS SÃO CONSIDERADOS CÓPIAS NÃO CONTROLADAS',{size:14,color:'#8C8C99',spacing:29}),{align:'center',line:28,before:6})+'</w:ftr>';
  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/>'+
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="'+tw(26)+'" w:right="'+(11906-tw(L)-tw(R-L))+'" w:bottom="'+tw(120)+'" w:left="'+tw(L)+'" w:header="'+tw(20)+'" w:footer="'+tw(36)+'" w:gutter="0"/></w:sectPr>';
  const header = '<w:hdr '+wordNamespaces+'>'+para('',{line:1})+'</w:hdr>';
  files['word/document.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+wordNamespaces+'><w:body>'+
    firstPage+pages.join('')+para('',{line:1})+sect+'</w:body></w:document>';
  files['word/header1.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+header;
  files['word/footer1.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+footer;
  files['word/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="17"/><w:szCs w:val="17"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>'+
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'+
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'+
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
  files['word/settings.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
    '<w:defaultTabStop w:val="708"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
  files['word/_rels/document.xml.rels'] = relationships(
    relationship('rId1','styles','styles.xml')+relationship('rId2','header','header1.xml')+relationship('rId3','footer','footer1.xml')+
    relationship('rId4','settings','settings.xml')+links.join(''));
  files['_rels/.rels'] = relationships(relationship('rId1','officeDocument','word/document.xml'));
  files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'+
    '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'+
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>';
  return new File(zip(files),name+'.docx',{type:wordMime});
}
const wordNamespaces = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '+
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '+
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '+
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';

function packageWord(files,links,body,name,margin) {
  files['word/document.xml']='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="'+margin+'" w:right="'+margin+'" w:bottom="'+margin+'" w:left="'+margin+'" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>';
  files['word/_rels/document.xml.rels']=relationships(links.join(''));
  files['_rels/.rels']=relationships(relationship('rId1','officeDocument','word/document.xml'));
  files['[Content_Types].xml']='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
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
