function projectProgress(report){const m=new Map();for(const s of report.pages.flat()){const name=s.activity?.trim();if(!name)continue;const k=name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');const item=m.get(k)||{name,value:null,date:'',updated:0,count:0};if(s.image)item.count++;const valid=s.progress!=null&&String(s.progress).trim()!==''&&Number.isFinite(Number(s.progress));const updated=s.progressUpdated||0;if(valid&& (item.value===null||updated>item.updated||updated===item.updated&&(s.date||'')>=item.date)){item.value=Math.max(0,Math.min(100,Number(s.progress)));item.date=s.date||'';item.updated=updated;}m.set(k,item);}return [...m.values()];}
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

export async function makeEditableWord(report,period,dateFormat,name) {
  const files={}, links=[];
  const escape = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  function paragraph(value,{bold=false,color='190A60',size=20,page=false,center=false,italic=false}={}) {
    const content=String(value ?? '').split('\n').map(line=>'<w:t xml:space="preserve">'+escape(line)+'</w:t>').join('<w:br/>');
    return '<w:p><w:pPr>'+(page?'<w:pageBreakBefore/>':'')+'<w:spacing w:after="55" w:line="240" w:lineRule="auto"/>'+(center?'<w:jc w:val="center"/>':'')+'</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'+(bold?'<w:b/>':'')+(italic?'<w:i/>':'')+'<w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/></w:rPr>'+content+'</w:r></w:p>';
  }
  const sides=['top','left','bottom','right','insideH','insideV'];
  const border=side=>'<w:'+side+' w:val="single" w:sz="6" w:color="190A60"/>';
  const blankBorder=side=>'<w:'+side+' w:val="nil"/>';
  const frameWidth=10000, gutterWidth=180, photoWidth=(frameWidth-gutterWidth)/2;
  function cell(content,fill='FFFFFF',width=photoWidth,gutter=false) {
    const borders=gutter?'<w:tcBorders>'+sides.map(blankBorder).join('')+'</w:tcBorders>':'';
    return '<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="'+width+'"/>'+borders+
      '<w:shd w:val="clear" w:color="auto" w:fill="'+fill+'"/><w:vAlign w:val="center"/></w:tcPr>'+content+'</w:tc>';
  }
  function table(rows,widths,innerLines=true) {
    const borders=sides.map(side=>!innerLines&&side.startsWith('inside')?blankBorder(side):border(side)).join('');
    return '<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="'+frameWidth+'"/><w:jc w:val="center"/><w:tblBorders>'+
      borders+'</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:left w:w="95" w:type="dxa"/>'+
      '<w:bottom w:w="45" w:type="dxa"/><w:right w:w="95" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+
      widths.map(width=>'<w:gridCol w:w="'+width+'"/>').join('')+'</w:tblGrid>'+
      rows.map(row=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+row+'</w:tr>').join('')+'</w:tbl>';
  }
  const gap=()=>'<w:p><w:pPr><w:spacing w:line="160" w:lineRule="exact"/></w:pPr></w:p>';
  const gutter=()=>cell(gap(),'FFFFFF',gutterWidth,true);
  async function photo(image) {
    const canvas=document.createElement('canvas');
    canvas.width=900;
    canvas.height=550;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if (image?.url) {
      const source=new Image();
      source.src=image.url;
      await source.decode();
      const scale=Math.min(884/source.width,534/source.height);
      const width=source.width*scale, height=source.height*scale;
      ctx.drawImage(source,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    } else {
      ctx.fillStyle='#696579';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font='24px Arial, sans-serif';
      ctx.fillText('Espaço para foto',450,275);
    }
    const id=links.length+1;
    const path='media/'+(image?.url?'foto-':'quadro-')+id+'.jpg';
    files['word/'+path]=jpeg(canvas.toDataURL('image/jpeg',.94));
    links.push(relationship('rId'+id,'image',path));
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'+wordDrawing(id,3000000,1833333)+'</w:p>';
  }
  const progress = (label,value) => value == null || value === '' ? '' : label+': '+value+'%';
  async function evidencePair(left,right) {
    const metadata = slot => paragraph('Dia '+dateFormat(slot.date),{bold:true,color:'CEFF00'})+
      paragraph('Empresa: '+(slot.company??''),{color:'FFFFFF',size:17})+
      paragraph('Local: '+(slot.place??''),{bold:true,color:'CEFF00'})+
      (slot.activity?paragraph('Atividade: '+slot.activity,{color:'FFFFFF',size:17}):'')+
      (progress('Avanço',slot.progress)?paragraph(progress('Avanço',slot.progress),{color:'FFFFFF',size:17}):'');
    const description = slot => paragraph(slot.description)+
      (progress('Serviço',slot.serviceProgress)?paragraph(progress('Serviço',slot.serviceProgress),{size:17}):'');
    const [leftPhoto,rightPhoto]=await Promise.all([photo(left.image),photo(right.image)]);
    return [cell(metadata(left),'190A60')+gutter()+cell(metadata(right),'190A60'),
      cell(leftPhoto)+gutter()+cell(rightPhoto),
      cell(description(left),'CEFF00')+gutter()+cell(description(right),'CEFF00')];
  }
  const heading=()=>table([
    cell(paragraph('BRAVA',{bold:true,italic:true,size:48})+paragraph('energia',{size:17}),'FFFFFF',2500)+
    cell(paragraph('REGISTRO DE EVIDÊNCIA',{bold:true,size:24,center:true}),'FFFFFF',4700)+
    cell(paragraph('FORM-CORP-SMS-030',{bold:true,size:16,center:true})+
      paragraph('GS2 – USO INTERNO',{size:16,center:true})+paragraph('Rev.: 00',{size:16,center:true}),'FFFFFF',2800)
  ],[2500,4700,2800],false)+gap();
  const footer = () => paragraph('BRAVA ENERGIA',{bold:true,size:16})+
    paragraph('DOCUMENTOS IMPRESSOS SÃO CONSIDERADOS CÓPIAS NÃO CONTROLADAS',{size:15});
  const formWidths=[2700,1800,1800,3700];
  const formRowHeights=[680,680,680,1000,800];
  const details=report.details;
  const field=key=>details[key]??'';
  const pair=(left,right)=>[
    {text:labels[left],bold:true},{text:field(left)},
    {text:labels[right],bold:true},{text:right==='reportDate'?dateFormat(field(right)):field(right)}
  ];
  const formRows=[
    pair('department','origin'),pair('reference','type'),pair('owner','reportDate'),
    [{text:labels.evidence,bold:true},{text:evidenceText(field('evidence')),span:3}],
    [{text:labels.summary+' '+field('summary'),span:2},{text:'Período: '+period,span:2}]
  ];
  const formTitle=paragraph('FORMULÁRIO',{bold:true});
  const formBorders=['top','left','bottom','right','insideH','insideV'].map(side=>
    '<w:'+side+' w:val="single" w:sz="6" w:color="190A60"/>'
  ).join('');
  const formGrid='<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="10000"/><w:jc w:val="center"/><w:tblBorders>'+formBorders+
    '</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+
    formWidths.map(width=>'<w:gridCol w:w="'+width+'"/>').join('')+'</w:tblGrid>'+
    formRows.map((row,index)=>{
      let column=0;
      return '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="'+formRowHeights[index]+'" w:hRule="atLeast"/></w:trPr>'+
        row.map(entry=>{
          const span=entry.span||1;
          const width=formWidths.slice(column,column+span).reduce((sum,value)=>sum+value,0);
          column+=span;
          return '<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="'+width+'"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+
            '<w:vAlign w:val="center"/></w:tcPr>'+paragraph(entry.text,{bold:entry.bold,size:18})+'</w:tc>';
        }).join('')+'</w:tr>';
    }).join('')+'</w:tbl>';
  const projects=projectProgress(report);
  const projectRows=projects.map(item=>{
    const percent=item.value===null?'Não informado':item.value+'%';
    const count=Math.max(0,Math.min(20,Math.round((item.value??0)/5)));
    const bar=item.value===null?'':paragraph('■'.repeat(count),{color:'507200',size:15});
    return paragraph(item.name+' · '+percent,{bold:true})+bar+
      paragraph(item.count+' registros fotográficos',{size:17,color:'595568'});
  }).join('')||paragraph('Nenhuma atividade registrada.',{center:true});
  const totals=projects.length+' atividades   ·   '+report.pages.flat().filter(slot=>slot.image).length+
    ' fotografias   ·   '+projects.filter(item=>item.value===100).length+' concluídas';
  const summary=table([
    cell(paragraph('AVANÇO FÍSICO DOS PROJETOS',{bold:true,center:true})+projectRows+
      paragraph(totals,{bold:true,center:true}),'F7F7FA',frameWidth)
  ],[frameWidth],false);
  const pageBreak='<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  const evidencePages=await Promise.all(report.pages.map(async slots=>{
    const [top,bottom]=await Promise.all([evidencePair(slots[0],slots[1]),evidencePair(slots[2],slots[3])]);
    const columns=[photoWidth,gutterWidth,photoWidth];
    return pageBreak+heading()+table(top,columns)+gap()+table(bottom,columns)+gap()+footer();
  }));
  const body=heading()+formTitle+formGrid+gap()+summary+gap()+footer()+evidencePages.join('');
  return packageWord(files,links,body,name,'700');
}

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
