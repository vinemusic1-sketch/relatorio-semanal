import { renderSheets, makePDF, makeWord } from './exports.js';
const $ = id => document.getElementById(id);
const create = (tag, text) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
};
const fields = [
  ['department','Gerência','E&O'], ['origin','Origem da ação','Resumo Semanal de Atividades'],
  ['reference','Código de referência da ação','N/A'], ['type','Tipo da ação','Informativo Semanal'],
  ['owner','Responsável pela ação',''], ['reportDate','Data',''], ['evidence','Tipo de evidência','Foto / Imagem'],
  ['summary','Descrição da ação','Registro Semanal de Atividades']
];
const emptyPage = () => Array.from({length:4}, () => ({date:'', company:'', place:'', description:'', image:null}));
const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const parse = d => new Date(d+'T12:00:00');
const fmt = d => d ? d.split('-').reverse().join('/') : '';
function shift(date, days) {
  const d = parse(date);
  d.setDate(d.getDate()+days);
  return iso(d);
}
const friday = d => shift(d, -((parse(d).getDay()+2)%7));
const period = d => fmt(d)+' a '+fmt(shift(d,6));
const reports = new Map();
const companyKey = 'rl-companies';
const placeKey = 'rl-places';
function loadList(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) return saved.filter(name => typeof name === 'string');
  } catch {}
  return [];
}
const history = {company:loadList(companyKey), place:loadList(placeKey)};
const historyKey = {company:companyKey, place:placeKey};
const cleanName = name => name.trim().replace(/\s+/g,' ');
function savedOptions(key) {
  const names = new Map();
  function include(name) {
    const clean = cleanName(name);
    if (clean) names.set(clean.toLocaleLowerCase('pt-BR'),clean);
  }
  history[key].forEach(include);
  for (const report of reports.values()) {
    for (const slot of report.pages.flat()) include(slot[key] || '');
  }
  return [...names.values()].sort((a,b) => a.localeCompare(b,'pt-BR'));
}
function remember(key) {
  history[key] = savedOptions(key);
  try { localStorage.setItem(historyKey[key],JSON.stringify(history[key])); } catch {}
}
// Último valor usado antes desta foto: primeiro na semana atual, depois nas semanas anteriores.
function lastValue(key,report,slot) {
  const own = report.pages.flat();
  const before = own.slice(0,own.indexOf(slot)).reverse();
  for (const item of before) if (item[key]?.trim()) return item[key];
  const older = [...reports.values()].filter(item => item !== report).sort((a,b) => b.start.localeCompare(a.start));
  for (const item of older) {
    for (const previous of item.pages.flat().reverse()) if (previous[key]?.trim()) return previous[key];
  }
  for (const item of own.slice(own.indexOf(slot)+1)) if (item[key]?.trim()) return item[key];
  return '';
}
// Data da foto gravada pela câmera (EXIF DateTimeOriginal), quando existir.
async function exifDate(file) {
  try {
    const view = new DataView(await file.slice(0,262144).arrayBuffer());
    if (view.getUint16(0) !== 0xFFD8) return '';
    let offset = 2;
    while (offset < view.byteLength-10) {
      const marker = view.getUint16(offset);
      if ((marker & 0xFF00) !== 0xFF00) break;
      const length = view.getUint16(offset+2);
      if (marker === 0xFFE1 && view.getUint32(offset+4) === 0x45786966) {
        const tiff = offset+10, little = view.getUint16(tiff) === 0x4949;
        const u16 = at => view.getUint16(tiff+at,little), u32 = at => view.getUint32(tiff+at,little);
        const read = ifd => {
          const entries = {};
          for (let i=0, count=u16(ifd); i<count; i++) {
            const entry = ifd+2+i*12;
            entries[u16(entry)] = {count:u32(entry+4), at:entry+8};
          }
          return entries;
        };
        const ascii = entry => {
          if (!entry) return '';
          const start = entry.count > 4 ? u32(entry.at) : entry.at;
          let text = '';
          for (let i=0; i<entry.count-1; i++) text += String.fromCharCode(view.getUint8(tiff+start+i));
          return text;
        };
        const main = read(u32(4));
        let value = '';
        if (main[0x8769]) {
          const exif = read(u32(main[0x8769].at));
          value = ascii(exif[0x9003]) || ascii(exif[0x9004]);
        }
        value ||= ascii(main[0x0132]);
        const match = /^(20\d{2}):(\d{2}):(\d{2})/.exec(value);
        return match ? match[1]+'-'+match[2]+'-'+match[3] : '';
      }
      offset += 2+length;
    }
  } catch {}
  return '';
}

const headerKey = 'rl-default-header';
let headerDefaults = {};
try {
  headerDefaults = JSON.parse(localStorage.getItem(headerKey) || '{}') || {};
} catch {
  // Existing weekly reports remain available if browser preferences cannot be read.
}

let db, current, sheets = [], wordFile, pdfFile, eligible = false;
const pending = new Set();
const setStatus = value => { $('status').textContent = value; };
function requestResult(request) {
  return new Promise((resolve,reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function save(report) {
  try {
    const tx = db.transaction('reports','readwrite');
    tx.objectStore('reports').put(report);
    setStatus('Salvando neste dispositivo…');
    tx.oncomplete = () => setStatus('Salvo neste dispositivo');
    tx.onerror = tx.onabort = () => setStatus('Falha ao salvar. Confira o espaço disponível neste dispositivo.');
    refreshWeeks();
  } catch {
    setStatus('Armazenamento local indisponível neste navegador.');
  }
}
function refreshWeeks() {
  const dates = [...new Set([current.start,...reports.keys()])].sort().reverse();
  $('weeks').replaceChildren(...dates.map(date => new Option(period(date),date)));
  $('weeks').value = current.start;
}
function openWeek(date) {
  const start = friday(date);
  const previous = [...reports.values()].sort((a,b) => b.start.localeCompare(a.start));
  const defaults = Object.fromEntries(fields.map(([key,,value]) => {
    if (key === 'reportDate') return [key,shift(start,-1)];
    const saved = previous.find(report => report.details[key]?.trim());
    return [key,headerDefaults[key]?.trim() || saved?.details[key] || value];
  }));
  current = reports.get(start) ?? {start, details:defaults, pages:[emptyPage()]};
  for (const [key,value] of Object.entries(defaults)) {
    if (!current.details[key]?.trim()) current.details[key] = value;
  }

  $('date').value = date;
  $('period').textContent = period(start)+' · sexta-feira a quinta-feira';
  refreshWeeks();
  renderEditor();
}
function editField(label, value, type, onChange) {
  const wrapper = create('label',label);
  const input = create(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  wrapper.append(input);
  return wrapper;
}
function persist(report) {
  reports.set(report.start,report);
  save(report);
}
function photoButton(title, camera, onFile) {
  const input = create('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (camera) input.setAttribute('capture','environment');
  input.hidden = true;
  input.onchange = () => {
    const file = input.files[0];
    input.value = '';
    if (file) onFile(file);
  };
  const button = create('button',title);
  button.onclick = () => input.click();
  return [button,input];
}
async function resizePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1,1400/Math.max(image.width,image.height));
    const canvas = create('canvas');
    canvas.width = Math.max(1,Math.round(image.width*scale));
    canvas.height = Math.max(1,Math.round(image.height*scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const stampHeight = Math.ceil(image.height*.33);
    const stampScale = Math.min(1,2400/image.width);
    const stamp = create('canvas');
    stamp.width = Math.max(1,Math.round(image.width*stampScale));
    stamp.height = Math.max(1,Math.round(stampHeight*stampScale));
    stamp.getContext('2d').drawImage(image,0,image.height-stampHeight,image.width,stampHeight,0,0,stamp.width,stamp.height);
    return {url:canvas.toDataURL('image/jpeg',.85),width:canvas.width,height:canvas.height,stamp:stamp.toDataURL('image/jpeg',.93)};
  } finally {
    URL.revokeObjectURL(url);
  }
}
// ---- Estado de cada foto (não é salvo) ----
const slotState = new WeakMap();
const stateOf = slot => {
  if (!slotState.has(slot)) slotState.set(slot,{version:0,text:'',message:'',reading:false});
  return slotState.get(slot);
};
const cellUpdaters = new WeakMap();
let formUpdater = () => {};
const canReplace = (slot,key) => !slot[key]?.trim() || Boolean(slot.auto?.[key]);
function setAuto(slot,key,value,source) {
  slot[key] = value;
  slot.auto ??= {};
  slot.auto[key] = source;
}
function refreshSlot(slot) {
  cellUpdaters.get(slot)?.();
  if (sheet.slot === slot) sheet.sync();
}
// Campos preenchidos automaticamente podem ser trocados por uma leitura melhor; os digitados, nunca.
function userChange(slot,report,key,value) {
  slot[key] = value;
  slot.auto ??= {};
  slot.auto[key] = false;
  if (key !== 'date' && !slot.date) setAuto(slot,'date',iso(new Date()),'today');
  persist(report);
  cellUpdaters.get(slot)?.();
}
async function readStamp(slot,report,photo,version,manual=false) {
  const state = stateOf(slot);
  state.reading = true;
  state.message = 'Lendo o carimbo da foto…';
  refreshSlot(slot);
  try {
    const {readStampInfo} = await import('./stamp.js');
    const result = await readStampInfo(photo,{places:savedOptions('place'),companies:savedOptions('company')});
    if (version !== state.version || slot.image !== photo) return;
    state.text = result.text;
    const filled = [];
    if (result.date && ((canReplace(slot,'date') && slot.auto?.date !== 'exif') || (manual && slot.auto?.date))) {
      setAuto(slot,'date',result.date,'stamp'); filled.push('Dia');
    }
    if (result.place && canReplace(slot,'place')) { setAuto(slot,'place',result.place,'stamp'); filled.push('Local'); }
    if (result.company && canReplace(slot,'company')) { setAuto(slot,'company',result.company,'stamp'); filled.push('Empresa'); }
    if (filled.length) {
      persist(report);
      state.message = filled.join(', ')+' lido'+(filled.length > 1 ? 's' : '')+' do carimbo. Confira e ajuste se precisar.';
    } else if (state.text) {
      state.message = 'Texto reconhecido, mas sem dados novos. Use Copiar texto do carimbo para reutilizá-lo.';
    } else {
      state.message = 'Não foi possível identificar texto legível no carimbo.';
    }
  } catch {
    if (version === state.version) state.message = 'Não foi possível ler o carimbo. Ajuste Dia, Empresa e Local se precisar.';
  } finally {
    if (version === state.version) state.reading = false;
    refreshSlot(slot);
  }
}
function addPhoto(slot,report,file) {
  const state = stateOf(slot);
  const version = ++state.version;
  state.text = '';
  state.message = 'Preparando a foto…';
  state.reading = true;
  refreshSlot(slot);
  const task = Promise.all([resizePhoto(file),exifDate(file)]).then(async ([photo,taken]) => {
    if (version !== state.version) return;
    slot.image = photo;
    if (canReplace(slot,'date')) setAuto(slot,'date',taken || iso(new Date()),taken ? 'exif' : 'today');
    for (const key of ['company','place']) {
      if (!slot[key]?.trim()) {
        const previous = lastValue(key,report,slot);
        if (previous) setAuto(slot,key,previous,'last');
      }
    }
    persist(report);
    refreshSlot(slot);
    await readStamp(slot,report,photo,version);
  }).catch(() => {
    state.reading = false;
    state.message = 'Não foi possível abrir essa imagem. Tente outra foto.';
    refreshSlot(slot);
  }).finally(() => pending.delete(task));
  pending.add(task);
}
function removePhoto(slot,report) {
  const state = stateOf(slot);
  state.version++;
  state.text = state.message = '';
  state.reading = false;
  slot.image = null;
  persist(report);
  refreshSlot(slot);
}

// ---- Seletores de foto: o quadro abre o menu do sistema; Câmera abre a câmera direto ----
let photoTarget = null;
const [,pickerInput] = photoButton('Foto',false,file => photoTarget && choosePhoto(file));
const [,cameraInput] = photoButton('Câmera',true,file => photoTarget && choosePhoto(file));
document.body.append(pickerInput,cameraInput);
function choosePhoto(file) {
  const {slot,report,label} = photoTarget;
  addPhoto(slot,report,file);
  sheet.open(slot,report,label);
}
function askPhoto(slot,report,label,camera=false) {
  photoTarget = {slot,report,label};
  (camera ? cameraInput : pickerInput).click();
}

// ---- Folha de edição de uma foto ----
const sheet = (() => {
  const dialog = create('dialog');
  dialog.className = 'slot-sheet';
  const title = create('h3');
  const close = create('button','Concluir');
  close.className = 'primary';
  const head = create('div');
  head.className = 'sheet-head';
  head.append(title,close);
  const preview = create('img');
  preview.alt = '';
  const status = create('p');
  status.className = 'stamp-status';
  status.setAttribute('role','status');
  const inputs = {};
  const field = (label,key,type,picker) => {
    const wrapper = create('label',label);
    const line = create('div');
    line.className = 'pick-line';
    const input = create(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    if (type === 'text') input.autocomplete = 'off';
    input.addEventListener('input',() => api.slot && userChange(api.slot,api.report,key,input.value));
    line.append(input);
    if (picker) {
      const chooser = create('select');
      chooser.className = 'pick';
      chooser.setAttribute('aria-label','Escolher '+label.toLocaleLowerCase('pt-BR')+' já usado');
      const fill = () => chooser.replaceChildren(new Option('▾',''),...savedOptions(key).map(name => new Option(name,name)));
      chooser.onfocus = chooser.onpointerdown = fill;
      chooser.onchange = () => {
        if (!chooser.value) return;
        input.value = chooser.value;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('change'));
        chooser.value = '';
      };
      input.addEventListener('change',() => { if (cleanName(input.value)) { remember(key); fill(); } });
      fill();
      line.append(chooser);
    }
    wrapper.append(line);
    inputs[key] = input;
    return wrapper;
  };
  const description = field('Descrição da atividade','description','textarea');
  const grid = create('div');
  grid.className = 'sheet-grid';
  grid.append(field('Dia','date','date'),field('Empresa','company','text',true));
  const place = field('Local','place','text',true);
  place.classList.add('sheet-place');
  const tools = create('div');
  tools.className = 'actions tools';
  const change = create('button','Trocar foto');
  const camera = create('button','Câmera');
  const read = create('button','Ler carimbo');
  const copy = create('button','Copiar texto do carimbo');
  const remove = create('button','Remover foto');
  tools.append(change,camera,read,copy,remove);
  dialog.append(head,preview,status,description,grid,place,tools);
  document.body.append(dialog);
  const api = {
    slot:null, report:null,
    open(slot,report,label) {
      api.slot = slot; api.report = report;
      title.textContent = label;
      api.sync(true);
      if (!dialog.open) dialog.showModal();
    },
    sync(all=false) {
      const slot = api.slot;
      if (!slot) return;
      const state = stateOf(slot);
      for (const key of ['date','company','place','description']) {
        if (all || document.activeElement !== inputs[key]) inputs[key].value = slot[key] || (key === 'date' ? iso(new Date()) : '');
      }
      preview.hidden = !slot.image;
      if (slot.image) preview.src = slot.image.url; else preview.removeAttribute('src');
      status.textContent = state.message;
      status.hidden = !state.message;
      read.hidden = remove.hidden = !slot.image;
      read.disabled = state.reading;
      copy.hidden = !state.text;
      change.textContent = slot.image ? 'Trocar foto' : 'Escolher foto';
    }
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('close',() => { api.slot = null; });
  dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });
  change.onclick = () => askPhoto(api.slot,api.report,title.textContent);
  camera.onclick = () => askPhoto(api.slot,api.report,title.textContent,true);
  read.onclick = () => {
    const slot = api.slot;
    if (!slot?.image) return;
    const task = readStamp(slot,api.report,slot.image,stateOf(slot).version,true).finally(() => pending.delete(task));
    pending.add(task);
  };
  copy.onclick = async () => {
    const state = stateOf(api.slot);
    try { await navigator.clipboard.writeText(state.text); state.message = 'Texto do carimbo copiado.'; }
    catch { state.message = state.text; }
    api.sync();
  };
  remove.onclick = () => removePhoto(api.slot,api.report);
  return api;
})();

// ---- Página do relatório na tela, no mesmo desenho do Word ----
function pageHeader() {
  const head = create('div');
  head.className = 'lp-head';
  const logo = create('div');
  logo.className = 'lp-logo';
  logo.append(create('b','BRAVA'),create('small','energia'));
  const title = create('div','REGISTRO DE EVIDÊNCIA');
  title.className = 'lp-title';
  const code = create('div');
  code.className = 'lp-code';
  code.append(create('span','FORM-CORP-SMS-030'),create('span','GS2 – USO INTERNO'),create('span','Rev.: 00'));
  head.append(logo,title,code);
  return head;
}
function formBlock(report) {
  const wrap = create('button');
  wrap.type = 'button';
  wrap.className = 'lp-form';
  wrap.setAttribute('aria-label','Editar cabeçalho do relatório');
  wrap.onclick = () => { $('header').open = true; $('header').scrollIntoView({block:'start',behavior:'smooth'}); };
  const update = () => {
    const d = report.details;
    const cell = (text,cls) => { const el = create('span',text); if (cls) el.className = cls; return el; };
    wrap.replaceChildren(create('b','FORMULÁRIO'),Object.assign(create('div'),{className:'lp-table'}));
    wrap.lastChild.append(
      cell('Gerência:','l'),cell(d.department,'v'),cell('Origem da Ação:','l'),cell(d.origin,'v'),
      cell('Código de Referência da Ação:','l'),cell(d.reference,'v'),cell('Tipo da ação:','l'),cell(d.type,'v'),
      cell('Responsável da ação:','l'),cell(d.owner || 'Toque para preencher','v'+(d.owner ? '' : ' empty')),cell('Data:','l'),cell(fmt(d.reportDate),'v'),
      cell('Tipo de Evidência:','l'),cell('( X ) '+(d.evidence || 'Foto / Imagem'),'span3'),
      cell('Descrição da ação: '+(d.summary || ''),'span2'),cell('Período: de '+period(report.start),'span2'));
  };
  formUpdater = update;
  update();
  return wrap;
}
function liveCell(slot,index,pageIndex,report) {
  const label = 'Foto '+(index+1)+' · Página '+(pageIndex+1);
  const cell = create('div');
  cell.className = 'lp-cell';
  const meta = create('button');
  meta.type = 'button';
  meta.className = 'lp-meta';
  const band = create('button');
  band.type = 'button';
  band.className = 'lp-band';
  const photo = create('button');
  photo.type = 'button';
  photo.className = 'lp-photo';
  photo.setAttribute('aria-label','Adicionar ou editar '+label);
  const img = create('img');
  img.alt = label;
  const prompt = create('span');
  prompt.className = 'lp-prompt';
  prompt.append(create('b','+'),create('span','Toque para a foto'));
  const badge = create('span');
  badge.className = 'lp-badge';
  photo.append(img,prompt,badge);
  const desc = create('button');
  desc.type = 'button';
  desc.className = 'lp-desc';
  const spare = create('div');
  spare.className = 'lp-spare';
  const edit = () => sheet.open(slot,report,label);
  meta.onclick = band.onclick = desc.onclick = edit;
  photo.onclick = () => slot.image ? edit() : askPhoto(slot,report,label);
  const update = () => {
    const state = stateOf(slot);
    const day = create('span');
    day.className = 'hl';
    day.append(create('b','Dia '),document.createTextNode(fmt(slot.date) || '—'));
    const company = create('span');
    company.append('Empresa: ',create('b',slot.company || '—'));
    meta.replaceChildren(day,company);
    band.replaceChildren(create('b','Local: '),document.createTextNode(slot.place || ''));
    img.hidden = !slot.image;
    prompt.hidden = Boolean(slot.image);
    if (slot.image) { if (img.src !== slot.image.url) img.src = slot.image.url; } else img.removeAttribute('src');
    badge.textContent = state.reading ? 'Lendo carimbo…' : '';
    badge.hidden = !state.reading;
    desc.textContent = slot.description || '';
    desc.classList.toggle('empty',!slot.description?.trim());
    if (!slot.description?.trim()) desc.textContent = slot.image ? 'Toque para descrever' : '';
  };
  cellUpdaters.set(slot,update);
  update();
  cell.append(meta,band,photo,desc,spare);
  return cell;
}
function livePage(page,pageIndex,report) {
  const sheetEl = create('article');
  sheetEl.className = 'live-page';
  sheetEl.append(pageHeader());
  if (pageIndex === 0) sheetEl.append(formBlock(report));
  const frame = create('div');
  frame.className = 'lp-frame';
  for (const row of [0,1]) {
    const line = create('div');
    line.className = 'lp-row';
    line.append(liveCell(page[row*2],row*2,pageIndex,report),liveCell(page[row*2+1],row*2+1,pageIndex,report));
    frame.append(line);
  }
  const foot = create('div');
  foot.className = 'lp-foot';
  foot.append(create('b','BRAVA ENERGIA'),create('b','Pág. '+(pageIndex+1)+' de '+report.pages.length));
  const note = create('div','DOCUMENTOS IMPRESSOS SÃO CONSIDERADOS CÓPIAS NÃO CONTROLADAS');
  note.className = 'lp-note';
  sheetEl.append(frame,foot,note);
  return sheetEl;
}
function renderEditor() {
  const report = current;
  $('ownerSummary').textContent = report.details.owner?.trim() ? ' · '+report.details.owner.trim() : '';
  if (!report.details.owner?.trim()) $('header').open = true;
  $('fields').replaceChildren(...fields.map(([key,label]) => editField(label,report.details[key],key === 'reportDate' ? 'date' : 'text',value => {
    report.details[key] = value;
    if (key !== 'reportDate') {
      headerDefaults[key] = value;
      try { localStorage.setItem(headerKey, JSON.stringify(headerDefaults)); } catch {}
    }
    $('ownerSummary').textContent = report.details.owner?.trim() ? ' · '+report.details.owner.trim() : '';
    persist(report);
    formUpdater();
  })));
  $('pages').replaceChildren(...report.pages.map((page,index) => livePage(page,index,report)));
}
$('date').onchange = () => { if (eligible && $('date').value) openWeek($('date').value); };
$('weeks').onchange = () => { if (eligible) openWeek($('weeks').value); };
$('add').onclick = () => {
  if (!eligible) return;
  current.pages.push(emptyPage());
  persist(current);
  renderEditor();
  $('pages').lastElementChild.scrollIntoView({block:'start',behavior:'smooth'});
};
$('view').onclick = async () => {
  if (!eligible) return;
  $('view').disabled = true;
  try {
    await Promise.all(pending);
    const report = structuredClone(current);
    while (report.pages.length > 1 && report.pages.at(-1).every(slot =>
      !slot.image && ![slot.date,slot.company,slot.place,slot.description].some(value => value?.trim()))) {
      report.pages.pop();
    }
    const name = 'Relatorio-Semanal-'+report.start;
    sheets = await renderSheets(report, fields, period(report.start), fmt);
    [pdfFile,wordFile] = await Promise.all([makePDF(sheets,name),Promise.resolve(makeWord(sheets,name))]);
    $('report').replaceChildren(...sheets.map((sheet,index) => {
      const page = create('article');
      page.className = 'sheet';
      const img = create('img');
      img.alt = 'Página '+(index+1)+' do registro semanal';
      img.src = sheet.toDataURL('image/jpeg',.92);
      page.append(img);
      return page;
    }));
    $('exportStatus').textContent = '';
    $('editor').hidden = true;
    $('preview').hidden = false;
    scrollTo(0,0);
  } catch (error) {
    setStatus('Erro ao gerar o relatório: '+error.message);
  } finally {
    $('view').disabled = false;
  }
};
$('back').onclick = () => { $('preview').hidden = true; $('editor').hidden = false; };
$('print').onclick = () => window.print();
function download(file) {
  const link = create('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.append(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); },30000);
}
async function share(file) {
  if (navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file],title:file.name}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  download(file);
  $('exportStatus').textContent = 'Arquivo baixado para compartilhar pelo gerenciador de arquivos.';
}
$('word').onclick = () => download(wordFile);
$('pdf').onclick = () => download(pdfFile);
$('shareWord').onclick = () => share(wordFile);
$('sharePdf').onclick = () => share(pdfFile);
try {
  const req = indexedDB.open('rl-registro-semanal',1);
  req.onupgradeneeded = () => req.result.createObjectStore('reports',{keyPath:'start'});
  db = await requestResult(req);
  for (const record of await requestResult(db.transaction('reports').objectStore('reports').getAll())) reports.set(record.start,record);
  eligible = true;
  openWeek(iso(new Date()));
  setStatus('Registros e fotos ficam neste dispositivo.');
} catch {
  setStatus('Armazenamento local indisponível neste navegador.');
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
