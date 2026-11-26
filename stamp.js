import Tesseract from './ocr/tesseract.esm.min.js';

let engine;
let queue = Promise.resolve();
const asset = name => new URL('./ocr/'+name,import.meta.url).href;

const months = {jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12};
export const normalize = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const tokens = value => normalize(value).split(' ').filter(token => token.length >= 2);
const pad = value => String(value).padStart(2,'0');

export function dateFromText(text) {
  const valid = (y,m,d) => y >= 2020 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  // O ano lido pode vir com o primeiro dígito trocado (ex.: 9826); valem os dois últimos.
  const written = /(\d{1,2})\D{1,6}?(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\.?\D{1,6}?\d{2}(\d{2})\b/i.exec(text);
  if (written) {
    const [d,m,y] = [+written[1],months[written[2].toLowerCase()],2000+(+written[3])];
    if (valid(y,m,d)) return y+'-'+pad(m)+'-'+pad(d);
  }
  const numeric = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/.exec(text);
  if (numeric && valid(+numeric[3],+numeric[2],+numeric[1])) return numeric[3]+'-'+pad(numeric[2])+'-'+pad(numeric[1]);
  const isoDate = /\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/.exec(text);
  if (isoDate && valid(+isoDate[1],+isoDate[2],+isoDate[3])) return isoDate[1]+'-'+pad(isoDate[2])+'-'+pad(isoDate[3]);
  return '';
}

const isMetadata = line =>
  /\d{1,2}\s*[:h]\s*\d{2}/i.test(line) ||                         // hora
  /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(de\s*)?20\d{2}/i.test(line) ||
  /\d+\s*[°º'"]|\d+[.,]\d{3,}|\b\d{1,3}[.,]\d+\s*[NSWEO]\b/i.test(line) || // coordenadas
  /\b\d{5}-?\d{3}\b/.test(line) ||                                   // CEP
  /^(brasil|brazil|timemark|gps|altitude|precis[ãa]o)\b/i.test(line) ||
  /\b(rua|avenida|av\.|rodovia|bairro|munic[íi]pio)\b/i.test(line) ||
  /,\s*\p{L}[\p{L} ]+\s(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/u.test(line); // cidade, UF

function cleanLines(text) {
  return text.split('\n')
    .map(line => line.replace(/[|_~=*«»“”"`´^]+/g,' ').replace(/\s+/g,' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.)]+$/gu,'').trim())
    .filter(line => {
      const letters = (line.match(/\p{L}/gu) || []).length;
      const useful = (line.match(/[\p{L}\p{N}\s\-–.,/()]/gu) || []).length;
      return letters >= 2 && useful/line.length >= .8;
    });
}

// Tolera um caractere trocado pela leitura (ex.: ET-E no lugar de ET-B) em palavras com 4+ letras.
const near = (a,b) => a === b || (a.length >= 4 && a.length === b.length && [...a].filter((c,i) => c !== b[i]).length <= 1);
function bestKnown(text,known) {
  const present = tokens(text);
  let best = '', score = 0;
  for (const name of known) {
    const wanted = tokens(name);
    if (!wanted.length || !wanted.every(token => present.some(found => near(token,found)))) continue;
    const value = wanted.join('').length;
    if (value > score) { best = name; score = value; }
  }
  return best;
}

// Lê o texto do carimbo e devolve {date, place, company}. Valores vazios quando não há confiança.
export function parseStamp(text,{places=[],companies=[]}={}) {
  const date = dateFromText(text);
  const company = bestKnown(text,companies);
  let place = bestKnown(text,places);
  if (!place) {
    const candidates = cleanLines(text).filter(line => {
      if (isMetadata(line) || (company && normalize(line) === normalize(company))) return false;
      const letters = line.match(/\p{L}/gu) || [];
      const upper = letters.filter(letter => letter === letter.toLocaleUpperCase('pt-BR')).length;
      const acronym = /\b[A-Z]{3,}\b/.test(line) && line.split(' ').length >= 3;
      return letters.length >= 3 && (upper/letters.length >= .7 || acronym) && /\p{L}{3,}|[A-Z]{2,}-[A-Z0-9]/u.test(line);
    });
    const long = candidates.filter(line => line.split(' ').length >= 2);
    if (long.length) place = long.sort((a,b) => b.length-a.length)[0];
    else if (candidates.length >= 2) place = candidates.slice(0,3).reverse().join(' – ');
    else if (candidates.length === 1) place = candidates[0];
  }
  return {date,place,company};
}

function enhanceLightText(ctx,width,height) {
  const pixels = ctx.getImageData(0,0,width,height);
  const data = pixels.data;
  for (let i=0; i<data.length; i+=4) {
    const light = Math.min(data[i],data[i+1],data[i+2]);
    const gray = 255-Math.max(0,Math.min(255,(light-150)*3));
    data[i]=data[i+1]=data[i+2]=gray;
  }
  ctx.putImageData(pixels,0,0);
}

async function readStamp(image,known,debug) {
  engine ??= Tesseract.createWorker('por',1,{
    workerPath:asset('worker.min.js'),
    corePath:asset('tesseract-core-lstm.wasm.js'),
    langPath:asset('').replace(/\/$/,''),
    workerBlobURL:false,
    cacheMethod:'none'
  }).catch(error => { engine=undefined; throw error; });
  const worker = await engine;
  const picture = new Image();
  picture.src = image.stamp || image.url;
  await picture.decode();
  // A faixa salva em image.stamp já é o terço inferior da foto original.
  const top = image.stamp ? 0 : Math.floor(picture.height*.67);
  const height = picture.height-top;
  const crop = document.createElement('canvas');
  const texts = [];
  let found = {date:'',place:'',company:''};
  // O Timemark costuma ficar no canto inferior direito; depois tenta o esquerdo e a largura toda.
  const attempts = [[.4,1,true],[0,.6,true],[0,1,false]];
  for (const [left,right,enhance] of attempts) {
    const x=Math.floor(picture.width*left);
    const width=Math.ceil(picture.width*right)-x;
    const scale=Math.max(1,Math.min(3,2000/width));
    crop.width=Math.max(1,Math.round(width*scale));
    crop.height=Math.max(1,Math.round(height*scale));
    const ctx=crop.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(picture,x,top,width,height,0,0,crop.width,crop.height);
    if (enhance) enhanceLightText(ctx,crop.width,crop.height);
    await worker.setParameters({tessedit_pageseg_mode:'11'});
    const {data}=await worker.recognize(crop.toDataURL('image/png'));
    const text=data.text.trim();
    if (!text) continue;
    texts.push(text);
    const parsed=parseStamp(text,known);
    // Só aproveita o local de um recorte em que a data também apareceu (o carimbo está nele),
    // a menos que o nome já seja conhecido neste aparelho.
    const stampHere = Boolean(parsed.date) || /\d[.,][\dIlO]{3,}\s*[SN]|\bBrasi/.test(text);
    const knownPlace = parsed.place && known.places?.includes(parsed.place) && tokens(parsed.place).length >= 2;
    found.date ||= parsed.date;
    found.company ||= parsed.company;
    if (!found.place && (stampHere || knownPlace)) found.place = parsed.place;
    if (debug) debug.push({left,right,text,parsed});
    if (found.date && found.place) break;
  }
  return {...found,text:texts.join('\n').trim()};
}

export function readStampInfo(image,known={},debug) {
  const result = queue.then(async () => {
    let timer;
    try {
      return await Promise.race([readStamp(image,known,debug), new Promise((_,reject) => {
        timer = setTimeout(() => reject(new Error('Tempo de leitura excedido')),45000);
      })]);
    } finally {
      clearTimeout(timer);
    }
  });
  queue = result.catch(() => {});
  return result;
}
