/* Lienzo · app.js — lógica del editor */
(function () {
  'use strict';
  var R = window.LienzoRender;
  var $ = function (id) { return document.getElementById(id); };

  var TYPES = {
    cover: 'Portada', idea: 'Idea fuerza', pops: 'Tarjetas', bullets: 'Puntos clave', stat: 'Cifras', compare: 'Comparación',
    quote: 'Cita', figure: 'Figura', chips: 'Conceptos', refs: 'Referencias', closing: 'Cierre'
  };
  var FIELDS = {
    cover: [['eyebrow', 'Encabezado (evento)'], ['title', 'Título', 'area'], ['subtitle', 'Subtítulo', 'area'], ['authors', 'Autores/as'], ['affiliation', 'Institución'], ['badge', 'Etiqueta de fuente'], ['presenter', 'Expositor/a (vacío = el de Datos)']],
    idea: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['lead', 'Idea fuerza', 'area'], ['support', 'Frases de apoyo (una por línea)', 'list']],
    pops: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['items', 'Tarjetas', 'pairs', ['head', 'body']]],
    bullets: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['items', 'Puntos (uno por línea)', 'list']],
    stat: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['stats', 'Cifras', 'pairs', ['value', 'label']]],
    compare: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['left.head', 'Columna izquierda: título'], ['left.items', 'Columna izquierda (una por línea)', 'list'], ['right.head', 'Columna derecha: título'], ['right.items', 'Columna derecha (una por línea)', 'list']],
    quote: [['eyebrow', 'Encabezado'], ['text', 'Cita', 'area'], ['cite', 'Autor/a o fuente']],
    figure: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['image', 'Imagen', 'image'], ['caption', 'Epígrafe', 'area'], ['note', 'Nota (aparece al avanzar)', 'area']],
    chips: [['eyebrow', 'Encabezado'], ['title', 'Título', 'area'], ['items', 'Conceptos (uno por línea)', 'list']],
    refs: [['eyebrow', 'Encabezado'], ['title', 'Título'], ['main', 'Referencia principal', 'area'], ['items', 'Otras referencias (una por línea)', 'list']],
    closing: [['title', 'Título'], ['text', 'Texto', 'area'], ['presenter', 'Expositor/a (vacío = el de Datos)'], ['contact', 'Contacto']]
  };
  var NEW_SLIDE = {
    cover: { eyebrow: '', title: 'Título de la presentación', subtitle: '', authors: '', affiliation: '', badge: '' },
    idea: { eyebrow: 'Idea fuerza', title: 'La idea central', lead: 'Una frase que resuma lo esencial.', support: [] },
    pops: { eyebrow: 'Puntos', title: 'Tres ideas', items: [{ head: 'Primera', body: 'Detalle breve.' }, { head: 'Segunda', body: 'Detalle breve.' }, { head: 'Tercera', body: 'Detalle breve.' }] },
    bullets: { eyebrow: 'Claves', title: 'Puntos clave', items: ['Primer punto', 'Segundo punto', 'Tercer punto'] },
    stat: { eyebrow: 'Datos', title: 'En números', stats: [{ value: '50 %', label: 'de los casos' }, { value: '3', label: 'dimensiones' }] },
    compare: { eyebrow: 'Comparación', title: 'Antes y después', left: { head: 'Antes', items: ['…'] }, right: { head: 'Ahora', items: ['…'] } },
    quote: { eyebrow: 'Cita', text: 'Una frase textual que valga la pena leer en voz alta.', cite: '' },
    figure: { eyebrow: 'Figura', title: 'Figura', image: '', caption: '' },
    chips: { eyebrow: 'Conceptos', title: 'Palabras clave', items: ['concepto', 'otro concepto'] },
    refs: { eyebrow: 'Para seguir leyendo', title: 'Referencias', main: '', items: [] },
    closing: { title: 'Gracias', text: '¿Preguntas?', contact: '' }
  };

  var state = { meta: { title: '', presenter: '', presenterLabel: 'Expositora', event: '', authors: '', affiliation: '', logo: '' }, paletteId: 'selva', palette: null, font: 'bricolage', layout: 'ring', slides: [], outline: null };
  var files = []; // {name,b64}
  var sel = -1, curFrame = 0, renderTimer = null, settings = {};

  /* ---------- puente con Python */
  function native() { return !!(window.pywebview && window.pywebview.api); }
  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (native()) return window.pywebview.api[name].apply(window.pywebview.api, args);
    return fetch('/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: args }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && j.error && Object.keys(j).length === 1) throw new Error(j.error); return j; });
  }

  /* ---------- utilidades UI */
  function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2600); }
  function status(msg, cls) { var s = $('status'); s.textContent = msg || ''; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function get(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function set(obj, path, v) { var ks = path.split('.'); var o = obj; for (var i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
  function slug(s) { return (s || 'presentacion').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'presentacion'; }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function icon(id) { return el('svg', { class: 'i', html: '<use href="#' + id + '"/>' }); }
  function readAsB64(file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result)); }; fr.onerror = rej; fr.readAsDataURL(file); }); }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/html;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function saveAs(name, content, kind) {
    if (native()) {
      return call('save_file', name, content, kind).then(function (r) { if (r.saved) toast('Guardado en ' + r.path, 4000); else if (r.reason !== 'cancel') { download(name, content); } return r; });
    }
    download(name, content, kind === 'html' ? 'text/html;charset=utf-8' : 'application/json;charset=utf-8');
    toast('Descargado: ' + name);
    return Promise.resolve({ saved: true });
  }

  /* ---------- proyecto → HTML */
  function project() {
    return { version: 1, meta: state.meta, palette: currentPalette(), paletteId: state.paletteId, font: state.font, layout: state.layout, slides: state.slides, outline: state.outline };
  }
  function currentPalette() {
    if (state.paletteId === 'custom') return R.paletteFrom({ id: 'custom', name: 'Personalizada', paper: $('cPaper').value, ink: $('cInk').value, a1: $('cA1').value, a2: $('cA2').value, a3: $('cA3').value, a4: $('cA4').value });
    return R.PALETTES.filter(function (p) { return p.id === state.paletteId; })[0] || R.PALETTES[0];
  }
  function buildHTML() { return R.build(project()); }

  function renderPreview(now) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      var has = state.slides.length > 0;
      $('empty').classList.toggle('hidden', has);
      $('preview').classList.toggle('hidden', !has);
      if (!has) { $('counter').textContent = ''; return; }
      var html = R.build(project(), { preview: true }).replace('<body>', '<body data-start="' + Math.min(curFrame, state.slides.length - 1) + '">');
      // arranca en la lámina seleccionada
      html = html.replace('idx = start; render();', 'var ds = +document.body.getAttribute("data-start"); if (ds >= 0) { var jj = steps.findIndex(function (s) { return s.f === frames[ds] && s.n === 0; }); if (jj >= 0) start = jj; } idx = start; render();');
      $('preview').srcdoc = html;
    }, now ? 0 : 220);
  }
  window.addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.lienzo === 'step') {
      $('counter').textContent = 'paso ' + (m.idx + 1) + ' de ' + m.total + (m.frame >= 0 ? ' · lámina ' + (m.frame + 1) : ' · vista general');
      if (m.frame >= 0 && m.frame !== sel) { curFrame = m.frame; selectSlide(m.frame, true); }
    }
  });
  function pv(msg) { var w = $('preview').contentWindow; if (w) w.postMessage(msg, '*'); }

  /* ---------- lista de láminas y formulario */
  function renderList() {
    var ul = $('slideList'); ul.innerHTML = '';
    $('slideCount').textContent = state.slides.length ? '(' + state.slides.length + ')' : '';
    state.slides.forEach(function (s, i) {
      var li = el('li', { class: i === sel ? 'on' : '', draggable: 'true' }, [
        el('span', { class: 'k' }, [TYPES[s.type] || s.type]),
        el('span', { class: 't' }, [String(s.title || s.text || s.name || '').replace(/[*=]/g, '').slice(0, 70)]),
        el('span', { class: 'ops' }, [
          el('button', { class: 'icon ghost', title: 'Subir', onclick: function (e) { e.stopPropagation(); move(i, -1); } }, [icon('i-up')]),
          el('button', { class: 'icon ghost', title: 'Bajar', onclick: function (e) { e.stopPropagation(); move(i, 1); } }, [icon('i-down')]),
          el('button', { class: 'icon ghost', title: 'Duplicar', onclick: function (e) { e.stopPropagation(); state.slides.splice(i + 1, 0, JSON.parse(JSON.stringify(s))); selectSlide(i + 1); renderList(); renderPreview(); } }, [icon('i-copy')]),
          el('button', { class: 'icon ghost', title: 'Borrar', onclick: function (e) { e.stopPropagation(); if (confirm('¿Borrar la lámina «' + (s.title || TYPES[s.type]) + '»?')) { state.slides.splice(i, 1); sel = Math.min(sel, state.slides.length - 1); curFrame = Math.max(0, sel); renderList(); renderForm(); renderPreview(); } } }, [icon('i-x')])
        ])
      ]);
      li.addEventListener('click', function () { curFrame = i; selectSlide(i); pv({ lienzo: 'go', frame: i }); });
      li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); li.classList.add('drag'); });
      li.addEventListener('dragend', function () { li.classList.remove('drag'); });
      li.addEventListener('dragover', function (e) { e.preventDefault(); });
      li.addEventListener('drop', function (e) { e.preventDefault(); var from = +e.dataTransfer.getData('text/plain'); if (from === i) return; var it = state.slides.splice(from, 1)[0]; state.slides.splice(i, 0, it); sel = i; curFrame = i; renderList(); renderForm(); renderPreview(); });
      ul.appendChild(li);
    });
  }
  function move(i, d) { var j = i + d; if (j < 0 || j >= state.slides.length) return; var t = state.slides[i]; state.slides[i] = state.slides[j]; state.slides[j] = t; sel = j; curFrame = j; renderList(); renderForm(); renderPreview(); }
  function selectSlide(i, quiet) { sel = i; renderList(); renderForm(); if (!quiet) { var li = $('slideList').children[i]; if (li) li.scrollIntoView({ block: 'nearest' }); } }

  function renderForm() {
    var f = $('slideForm'); f.innerHTML = '';
    var s = state.slides[sel];
    if (!s) { f.appendChild(el('p', { class: 'hint' }, ['Elegí una lámina para editarla. Podés usar **negrita**, ==resaltado== y *color* en los textos.'])); return; }
    var typeSel = el('select', { onchange: function () { changeType(s, typeSel.value); } });
    Object.keys(TYPES).forEach(function (k) { typeSel.appendChild(el('option', { value: k }, [TYPES[k]])); });
    typeSel.value = s.type;
    f.appendChild(el('div', { class: 'typeRow' }, [el('label', { style: 'margin:0' }, ['Tipo']), typeSel]));
    (FIELDS[s.type] || FIELDS.bullets).forEach(function (fd) {
      var key = fd[0], label = fd[1], kind = fd[2] || 'text';
      var wrap = el('div', { class: 'field' }, [el('label', null, [label])]);
      var val = get(s, key);
      if (kind === 'text') {
        wrap.appendChild(el('input', { type: 'text', value: val == null ? '' : val, oninput: function (e) { set(s, key, e.target.value); onEdit(); } }));
      } else if (kind === 'area') {
        var ta = el('textarea', { rows: '2', oninput: function (e) { set(s, key, e.target.value); onEdit(); } }); ta.value = val == null ? '' : val; wrap.appendChild(ta);
      } else if (kind === 'list') {
        var tl = el('textarea', { rows: '4', oninput: function (e) { set(s, key, e.target.value.split('\n').map(function (x) { return x.replace(/^\s*[-•·]\s*/, ''); }).filter(function (x) { return x.trim(); })); onEdit(); } });
        tl.value = (val || []).join('\n'); wrap.appendChild(tl);
      } else if (kind === 'pairs') {
        var k1 = fd[3][0], k2 = fd[3][1]; var box = el('div', { class: 'pairs' });
        if (!Array.isArray(val)) { val = []; set(s, key, val); }
        var drawPairs = function () {
          box.innerHTML = '';
          val.forEach(function (it, idx) {
            var a = el('textarea', { rows: '1', placeholder: k1 === 'value' ? 'Cifra' : 'Título', oninput: function (e) { it[k1] = e.target.value; onEdit(); } }); a.value = it[k1] || '';
            var b = el('textarea', { rows: '2', placeholder: k2 === 'label' ? 'Etiqueta' : 'Texto', oninput: function (e) { it[k2] = e.target.value; onEdit(); } }); b.value = it[k2] || '';
            box.appendChild(el('div', { class: 'pr' }, [a, b, el('button', { class: 'icon ghost', title: 'Quitar', onclick: function () { val.splice(idx, 1); drawPairs(); onEdit(); } }, [icon('i-x')])]));
          });
          box.appendChild(el('button', { class: 'add', onclick: function () { var o = {}; o[k1] = ''; o[k2] = ''; val.push(o); drawPairs(); } }, [icon('i-plus'), ' Agregar']));
        };
        drawPairs(); wrap.appendChild(box);
      } else if (kind === 'image') {
        var img = el('img', { class: val ? '' : 'hidden', src: val || '' });
        var inp = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: function (e) { var file = e.target.files[0]; if (!file) return; readAsB64(file).then(function (d) { set(s, key, d); renderForm(); onEdit(); }); } });
        wrap.appendChild(el('div', { class: 'imgField' }, [img, el('button', { onclick: function () { pickImage().then(function (d) { if (d) { set(s, key, d); renderForm(); onEdit(); } }); } }, [icon('i-open'), ' Elegir imagen']), val ? el('button', { class: 'ghost', onclick: function () { set(s, key, ''); renderForm(); onEdit(); } }, ['Quitar']) : null, inp]));
      }
      f.appendChild(wrap);
    });
    var tipText = s.type === 'cover' || s.type === 'closing' ? 'El/la expositor/a y el logo se toman de «Datos de la exposición» si acá quedan vacíos.' : 'Recordá: pocas palabras por lámina. Lo que no entra, se dice en voz alta.';
    f.appendChild(el('p', { class: 'hint' }, [tipText]));
  }
  function onEdit() { renderList(); renderPreview(); }
  function changeType(s, t) {
    var base = JSON.parse(JSON.stringify(NEW_SLIDE[t]));
    var n = { type: t, name: TYPES[t] };
    Object.keys(base).forEach(function (k) { n[k] = base[k]; });
    ['eyebrow', 'title'].forEach(function (k) { if (s[k]) n[k] = s[k]; });
    if (t === 'bullets' || t === 'chips') { var src = s.items && s.items.length && typeof s.items[0] === 'object' ? s.items.map(function (x) { return x.head; }) : s.items; if (src) n.items = src.slice(); if (s.support) n.items = s.support.slice(); }
    if (t === 'pops' && s.items && typeof s.items[0] === 'string') n.items = s.items.map(function (x) { return { head: x, body: '' }; });
    if (t === 'idea' && s.items && typeof s.items[0] === 'string') { n.lead = s.items[0]; n.support = s.items.slice(1); }
    if (t === 'quote' && s.lead) n.text = s.lead;
    state.slides[sel] = n; renderList(); renderForm(); renderPreview();
  }
  function pickImage() {
    if (native()) return call('pick_files', 'image').then(function (r) { if (!r.paths.length) return ''; return call('read_file_b64', r.paths[0]).then(function (f) { return f.data; }); });
    return new Promise(function (res) { var inp = el('input', { type: 'file', accept: 'image/*' }); inp.onchange = function () { var f = inp.files[0]; if (!f) return res(''); readAsB64(f).then(res); }; inp.click(); });
  }

  /* ---------- paletas / estilo */
  function renderPalettes() {
    var box = $('palettes'); box.innerHTML = '';
    R.PALETTES.concat([{ id: 'custom', name: 'Propia', paper: $('cPaper').value, ink: $('cInk').value, a1: $('cA1').value, a2: $('cA2').value, a3: $('cA3').value, a4: $('cA4').value }]).forEach(function (p) {
      var sw = el('div', { class: 'sw' }, [p.paper, p.a1, p.a2, p.a3, p.a4, p.ink].map(function (c) { return el('i', { style: 'background:' + c }); }));
      var b = el('div', { class: 'pal' + (p.id === state.paletteId ? ' on' : ''), title: p.name, onclick: function () { state.paletteId = p.id; renderPalettes(); renderPreview(); } }, [sw, el('small', null, [p.name])]);
      box.appendChild(b);
    });
  }
  ['cPaper', 'cInk', 'cA1', 'cA2', 'cA3', 'cA4'].forEach(function (id) { $(id).addEventListener('input', function () { state.paletteId = 'custom'; renderPalettes(); renderPreview(); }); });
  R.FONTS.forEach(function (f) { $('font').appendChild(el('option', { value: f.id }, [f.name])); });
  R.LAYOUTS.forEach(function (l) { $('layout').appendChild(el('option', { value: l.id }, [l.name])); });
  $('font').addEventListener('change', function () { state.font = this.value; renderPreview(); });
  $('layout').addEventListener('change', function () { state.layout = this.value; renderPreview(); });

  /* ---------- datos de la exposición */
  function bindMeta(id, key) { $(id).addEventListener('input', function () { state.meta[key] = this.value; syncMetaToSlides(); renderPreview(); }); }
  bindMeta('mPresenter', 'presenter'); bindMeta('mEvent', 'event'); bindMeta('mAuthors', 'authors'); bindMeta('mAffiliation', 'affiliation');
  $('mPresenterLabel').addEventListener('change', function () { state.meta.presenterLabel = this.value; renderPreview(); });
  $('projTitle').addEventListener('input', function () { state.meta.title = this.value; });
  function syncMetaToSlides() {
    var c = state.slides.filter(function (s) { return s.type === 'cover'; })[0];
    if (c) { c.authors = state.meta.authors; c.affiliation = state.meta.affiliation; }
    renderList();
  }
  function metaToForm() {
    $('mPresenter').value = state.meta.presenter || ''; $('mEvent').value = state.meta.event || ''; $('mAuthors').value = state.meta.authors || ''; $('mAffiliation').value = state.meta.affiliation || '';
    $('mPresenterLabel').value = state.meta.presenterLabel || 'Expositora'; $('projTitle').value = state.meta.title || '';
    setLogo(state.meta.logo);
    $('font').value = state.font; $('layout').value = state.layout;
    if (state.paletteId === 'custom' && state.palette) { ['paper', 'ink', 'a1', 'a2', 'a3', 'a4'].forEach(function (k, i) { $(['cPaper', 'cInk', 'cA1', 'cA2', 'cA3', 'cA4'][i]).value = state.palette[k]; }); }
    renderPalettes();
  }
  function setLogo(d) {
    state.meta.logo = d || '';
    $('logoImg').src = d || ''; $('logoImg').classList.toggle('hidden', !d); $('btnLogoClear').classList.toggle('hidden', !d);
  }
  $('btnLogo').addEventListener('click', function () { pickImage().then(function (d) { if (d) { setLogo(d); renderPreview(); } }); });
  $('btnLogoClear').addEventListener('click', function () { setLogo(''); renderPreview(); });

  /* ---------- fuente: archivos / texto */
  var tab = 'pdf';
  document.querySelectorAll('.tabs button').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('tabPdf').classList.toggle('hidden', tab !== 'pdf'); $('tabText').classList.toggle('hidden', tab !== 'text'); }); });
  function renderFiles() {
    var ul = $('fileList'); ul.innerHTML = '';
    files.forEach(function (f, i) { ul.appendChild(el('li', null, [icon('i-pdf'), el('span', null, [f.name]), el('button', { class: 'icon ghost', title: 'Quitar', onclick: function () { files.splice(i, 1); renderFiles(); } }, [icon('i-x')])])); });
  }
  function addFiles(list) {
    var ps = Array.prototype.slice.call(list).filter(function (f) { return /\.(pdf|txt|md)$/i.test(f.name); }).map(function (f) { return readAsB64(f).then(function (d) { files.push({ name: f.name, b64: d }); }); });
    Promise.all(ps).then(renderFiles);
  }
  $('btnPick').addEventListener('click', function (e) {
    e.preventDefault();
    if (native()) { call('pick_files', 'pdf').then(function (r) { (r.paths || []).forEach(function (p) { files.push({ name: p.split(/[\\/]/).pop(), path: p }); }); renderFiles(); }); }
    else $('fileInput').click();
  });
  $('fileInput').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  $('maxSlides').addEventListener('input', function () { $('maxSlidesOut').textContent = this.value; });

  $('btnAnalyze').addEventListener('click', function () {
    var opts = { max_slides: +$('maxSlides').value, figures: $('optFigs').checked, presenter: state.meta.presenter, event: state.meta.event };
    var p;
    if (tab === 'text') {
      var txt = $('srcText').value.trim();
      if (txt.length < 40) { status('Pegá un texto más largo.', 'err'); return; }
      p = call('analyze_text', txt, opts);
    } else {
      if (!files.length) { status('Primero elegí al menos un PDF.', 'err'); return; }
      var paths = files.filter(function (f) { return f.path; }).map(function (f) { return f.path; });
      var b64s = files.filter(function (f) { return f.b64; });
      if (paths.length && !b64s.length) p = call('analyze_paths', paths, opts);
      else if (paths.length) p = Promise.all(paths.map(function (pt) { return call('read_file_b64', pt); })).then(function (rs) { return call('analyze_files', b64s.concat(rs.map(function (r) { return { name: r.name, b64: r.data }; })), opts); });
      else p = call('analyze_files', b64s, opts);
    }
    status('Leyendo y armando láminas…'); $('btnAnalyze').disabled = true;
    p.then(function (r) {
      if (r.error) { status(r.error, 'err'); return; }
      applyAnalysis(r);
      status('Listo: ' + r.slides.length + ' láminas. Revisá y corregí lo que haga falta.' + (r.warnings && r.warnings.length ? ' Avisos: ' + r.warnings.join('; ') : ''), 'ok');
    }).catch(function (e) { status('Error: ' + e.message, 'err'); }).then(function () { $('btnAnalyze').disabled = false; });
  });
  function applyAnalysis(r) {
    state.outline = r.outline; state.slides = r.slides;
    var cover = r.slides[0] || {};
    state.meta.title = r.outline.title || cover.title || state.meta.title;
    if (!state.meta.authors) state.meta.authors = cover.authors || '';
    if (!state.meta.affiliation) state.meta.affiliation = cover.affiliation || '';
    syncMetaToSlides();
    metaToForm(); sel = 0; curFrame = 0; renderList(); renderForm(); renderPreview(true);
  }

  /* ---------- láminas: agregar */
  $('btnAddSlide').addEventListener('click', function (e) {
    var old = document.querySelector('.typeMenu'); if (old) { old.remove(); return; }
    var menu = el('div', { class: 'typeMenu' });
    Object.keys(TYPES).forEach(function (k) { menu.appendChild(el('button', { onclick: function () { addSlide(k); menu.remove(); } }, [TYPES[k]])); });
    document.body.appendChild(menu);
    var rect = e.currentTarget.getBoundingClientRect(); menu.style.top = (rect.bottom + 6) + 'px'; menu.style.left = Math.max(8, rect.right - 300) + 'px';
    setTimeout(function () { document.addEventListener('click', function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', h); } }); }, 0);
  });
  function addSlide(t) {
    var s = JSON.parse(JSON.stringify(NEW_SLIDE[t])); s.type = t; s.name = TYPES[t];
    var at = sel >= 0 ? sel + 1 : state.slides.length;
    // referencias y cierre van siempre al final
    var endIdx = state.slides.findIndex(function (x) { return x.type === 'refs' || x.type === 'closing'; });
    if (t !== 'refs' && t !== 'closing' && endIdx >= 0 && at > endIdx) at = endIdx;
    state.slides.splice(at, 0, s); curFrame = at; selectSlide(at); renderPreview();
  }

  /* ---------- vista previa: controles */
  $('btnPrev').addEventListener('click', function () { pv({ lienzo: 'prev' }); });
  $('btnNext').addEventListener('click', function () { pv({ lienzo: 'next' }); });
  $('btnOverview').addEventListener('click', function () { pv({ lienzo: 'overview' }); });

  /* ---------- proyecto: nuevo / abrir / guardar / exportar / presentar */
  $('btnNew').addEventListener('click', function () {
    if (state.slides.length && !confirm('¿Empezar un proyecto nuevo? Se pierde lo no guardado.')) return;
    state.slides = []; state.outline = null; state.meta.title = ''; state.meta.authors = ''; state.meta.affiliation = ''; files = []; renderFiles(); $('srcText').value = '';
    sel = -1; curFrame = 0; metaToForm(); renderList(); renderForm(); renderPreview(true); status('');
  });
  $('btnSave').addEventListener('click', function () {
    if (!state.slides.length) { toast('No hay nada para guardar todavía.'); return; }
    saveAs(slug(state.meta.title) + '.lienzo.json', JSON.stringify(project(), null, 1), 'json');
  });
  function loadProject(obj) {
    if (!obj || !Array.isArray(obj.slides)) throw new Error('El archivo no parece un proyecto de Lienzo.');
    state.slides = obj.slides; state.outline = obj.outline || null; state.meta = Object.assign(state.meta, obj.meta || {});
    state.paletteId = obj.paletteId || 'selva'; state.palette = obj.palette || null; state.font = obj.font || 'bricolage'; state.layout = obj.layout || 'ring';
    sel = 0; curFrame = 0; metaToForm(); renderList(); renderForm(); renderPreview(true); toast('Proyecto abierto.');
  }
  $('btnOpen').addEventListener('click', function () {
    if (native()) { call('pick_files', 'project').then(function (r) { if (!r.paths.length) return; return call('read_file_b64', r.paths[0]).then(function (f) { loadProject(JSON.parse(decodeURIComponent(escape(atob(f.data.split(',')[1]))))); }); }).catch(function (e) { toast(e.message); }); return; }
    var inp = el('input', { type: 'file', accept: '.json' }); inp.onchange = function () { var f = inp.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { try { loadProject(JSON.parse(fr.result)); } catch (e) { toast(e.message); } }; fr.readAsText(f, 'utf-8'); }; inp.click();
  });
  $('btnExport').addEventListener('click', function () {
    if (!state.slides.length) { toast('Primero armá las láminas.'); return; }
    saveAs(slug(state.meta.title) + '.html', buildHTML(), 'html');
  });
  $('btnPresent').addEventListener('click', function () {
    if (!state.slides.length) { toast('Primero armá las láminas.'); return; }
    var html = buildHTML();
    if (native()) { call('preview_file', html); return; }
    var w = window.open('', '_blank'); if (!w) { toast('El navegador bloqueó la ventana; exportá el HTML y abrilo.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  });

  /* ---------- IA: prompt, importación, Ollama */
  var SCHEMA_HINT = 'Tipos de lámina y campos:\n' +
    '- "idea": {"eyebrow","title","lead" (una frase potente),"support": [hasta 2 frases cortas]}\n' +
    '- "pops": {"eyebrow","title","items":[{"head": 2-4 palabras,"body": 1 frase}] (2 a 4 tarjetas)}\n' +
    '- "bullets": {"eyebrow","title","items":[3 a 5 frases de máximo 14 palabras]}\n' +
    '- "stat": {"eyebrow","title","stats":[{"value":"48 %","label":"qué mide"}] (1 a 3 cifras REALES del texto)}\n' +
    '- "compare": {"eyebrow","title","left":{"head","items":[]},"right":{"head","items":[]}}\n' +
    '- "quote": {"eyebrow","text": cita textual breve,"cite": autor}\n' +
    '- "chips": {"eyebrow","title","items":[4 a 8 conceptos de 1-3 palabras]}\n' +
    'Podés marcar **negrita** y ==resaltado== dentro de los textos.';
  function buildPrompt() {
    var o = state.outline || {};
    var parts = [];
    parts.push('Sos un/a diseñador/a de presentaciones académicas. A partir del siguiente material, armá el contenido de ' + Math.max(6, state.slides.length - 3) + ' láminas en español rioplatense, con MUY poco texto por lámina, jerarquía clara y foco en lo relevante (objetivo, hallazgos, conclusiones). No inventes datos.');
    parts.push('Respondé SOLO con JSON válido con esta forma: {"slides":[...]} (sin portada, referencias ni cierre: esas ya están armadas).');
    parts.push(SCHEMA_HINT);
    parts.push('MATERIAL:\nTítulo: ' + (o.title || state.meta.title || ''));
    if (o.abstract) parts.push('Resumen: ' + o.abstract);
    if (o.keywords && o.keywords.length) parts.push('Palabras clave: ' + o.keywords.join(', '));
    var budget = 9000, used = 0;
    (o.sections || []).forEach(function (s) {
      var t = '## ' + s.heading + '\n' + (s.key_sentences || []).slice(0, 5).join(' ') + (s.numbers && s.numbers.length ? '\nCifras: ' + s.numbers.slice(0, 6).join(' | ') : '');
      if (used + t.length < budget) { parts.push(t); used += t.length; }
    });
    if (!o.sections && state.slides.length) parts.push('Láminas actuales (mejoralas): ' + JSON.stringify(state.slides.filter(function (s) { return ['cover', 'refs', 'closing', 'figure'].indexOf(s.type) < 0; })));
    return parts.join('\n\n');
  }
  $('btnPrompt').addEventListener('click', function () {
    if (!state.outline && !state.slides.length) { toast('Primero analizá un PDF o texto.'); return; }
    var txt = buildPrompt();
    var done = function () { toast('Pedido copiado. Pegalo en ChatGPT o Gemini y después usá «Pegar respuesta».', 4500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { showModal('Copiá este pedido', txt); });
    else showModal('Copiá este pedido', txt);
  });
  function showModal(title, text, onImport) {
    var m = $('modal'); m.classList.remove('hidden'); m.innerHTML = '';
    var ta = el('textarea'); ta.value = text || ''; if (onImport) ta.placeholder = 'Pegá acá la respuesta de la IA (JSON)…';
    var box = el('div', { class: 'box' }, [el('h3', null, [title]), ta, el('div', { class: 'row', style: 'margin-top:10px;justify-content:flex-end' }, [
      el('button', { class: 'ghost', onclick: function () { m.classList.add('hidden'); } }, ['Cerrar']),
      onImport ? el('button', { class: 'primary', onclick: function () { try { onImport(ta.value); m.classList.add('hidden'); } catch (e) { toast('No se pudo leer: ' + e.message, 4000); } } }, ['Importar láminas']) : null
    ])]);
    m.appendChild(box); if (!onImport) { ta.select(); } else ta.focus();
    m.onclick = function (e) { if (e.target === m) m.classList.add('hidden'); };
  }
  function importAI(text) {
    var t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var a = t.indexOf('{'), b = t.indexOf('['); var start = (a < 0) ? b : (b < 0 ? a : Math.min(a, b));
    if (start < 0) throw new Error('no hay JSON');
    var obj = JSON.parse(t.slice(start, Math.max(t.lastIndexOf('}'), t.lastIndexOf(']')) + 1));
    var arr = Array.isArray(obj) ? obj : (obj.slides || obj.laminas || []);
    var ok = arr.filter(function (s) { return s && TYPES[s.type] && ['cover', 'refs', 'closing'].indexOf(s.type) < 0; }).map(function (s) {
      s.name = TYPES[s.type];
      if (s.items && typeof s.items[0] === 'string' && s.type === 'pops') s.items = s.items.map(function (x) { return { head: x, body: '' }; });
      if (s.type === 'stat' && !s.stats && s.items) s.stats = s.items;
      if (s.type === 'quote' && !s.text && s.lead) s.text = s.lead;
      return s;
    });
    if (!ok.length) throw new Error('no encontré láminas válidas');
    var keep = state.slides.filter(function (s) { return s.type === 'cover'; });
    var figs = state.slides.filter(function (s) { return s.type === 'figure'; });
    var tail = state.slides.filter(function (s) { return s.type === 'refs' || s.type === 'closing'; });
    state.slides = keep.concat(ok, figs, tail);
    sel = 0; curFrame = 0; renderList(); renderForm(); renderPreview(true); toast('Se importaron ' + ok.length + ' láminas de la IA.');
  }
  $('btnImport').addEventListener('click', function () { showModal('Pegar respuesta de la IA', '', importAI); });

  $('btnOllamaDetect').addEventListener('click', function () {
    var st = $('ollamaStatus'); st.textContent = 'Buscando…'; st.className = 'status';
    call('ollama_models', $('ollamaUrl').value).then(function (r) {
      var selm = $('ollamaModel'); selm.innerHTML = '';
      if (!r.ok) { st.textContent = 'No responde: ¿Ollama está abierto? (' + r.error + ')'; st.className = 'status err'; selm.appendChild(el('option', { value: '' }, ['— detectar —'])); return; }
      r.models.forEach(function (m) { selm.appendChild(el('option', { value: m }, [m])); });
      if (settings.ollama_model && r.models.indexOf(settings.ollama_model) >= 0) selm.value = settings.ollama_model;
      st.textContent = r.models.length ? r.models.length + ' modelo(s) disponibles.' : 'Ollama responde pero no tiene modelos (ollama pull llama3.2).'; st.className = 'status ok';
      call('set_settings', { ollama_url: $('ollamaUrl').value, ollama_model: selm.value });
    });
  });
  $('btnOllama').addEventListener('click', function () {
    if (!state.outline && !state.slides.length) { toast('Primero analizá un PDF o texto.'); return; }
    var model = $('ollamaModel').value; var st = $('ollamaStatus');
    if (!model) { st.textContent = 'Elegí un modelo (tocá «Detectar»).'; st.className = 'status err'; return; }
    st.textContent = 'Generando con ' + model + '… puede tardar varios minutos.'; st.className = 'status'; $('btnOllama').disabled = true;
    call('ollama_generate', $('ollamaUrl').value, model, buildPrompt()).then(function (r) {
      if (!r.ok) { st.textContent = r.error; st.className = 'status err'; return; }
      try { importAI(r.text); st.textContent = 'Láminas actualizadas con Ollama.'; st.className = 'status ok'; call('set_settings', { ollama_url: $('ollamaUrl').value, ollama_model: model }); }
      catch (e) { st.textContent = 'La respuesta no se pudo interpretar: ' + e.message; st.className = 'status err'; }
    }).then(function () { $('btnOllama').disabled = false; });
  });

  /* ---------- arranque */
  function init() {
    renderPalettes(); metaToForm(); renderList(); renderForm(); renderPreview(true);
    call('get_settings').then(function (s) {
      settings = s || {};
      if (settings.presenter && !state.meta.presenter) { state.meta.presenter = settings.presenter; $('mPresenter').value = settings.presenter; }
      if (settings.presenter_label) { state.meta.presenterLabel = settings.presenter_label; $('mPresenterLabel').value = settings.presenter_label; }
      if (settings.ollama_url) $('ollamaUrl').value = settings.ollama_url;
    }).catch(function () {});
    $('mPresenter').addEventListener('change', function () { call('set_settings', { presenter: this.value, presenter_label: $('mPresenterLabel').value }).catch(function () {}); });
    $('mPresenterLabel').addEventListener('change', function () { call('set_settings', { presenter_label: this.value }).catch(function () {}); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); $('btnSave').click(); }
    });
  }
  if (window.pywebview && window.pywebview.api) init();
  else { var started = false; window.addEventListener('pywebviewready', function () { if (!started) { started = true; init(); } }); setTimeout(function () { if (!started) { started = true; init(); } }, 350); }
})();
