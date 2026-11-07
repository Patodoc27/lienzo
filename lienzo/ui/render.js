/* Lienzo · render.js — convierte el proyecto en un HTML autocontenido (motor de zoom tipo Prezi).
   Se usa tanto para la previsualización del editor como para la exportación final. */
(function (global) {
  'use strict';

  var PALETTES = [
    { id: 'selva', name: 'Selva', paper: '#F4FBF8', ink: '#0B3B36', ink2: '#41675F', rule: '#CFE8E1', a1: '#9CCB3B', a2: '#13996E', a3: '#2CC6C9', a4: '#0B7A8A', mint: '#BDEBDD', sea: '#E3F5EF' },
    { id: 'oceano', name: 'Océano', paper: '#F3F8FD', ink: '#0B2545', ink2: '#3E5C76', rule: '#CFE0F2', a1: '#4CC9F0', a2: '#1B6FD6', a3: '#9D4EDD', a4: '#134E9B', mint: '#CDE7FB', sea: '#E4EFFA' },
    { id: 'terracota', name: 'Terracota', paper: '#FBF6F0', ink: '#3B1F12', ink2: '#7A5240', rule: '#EBD9C8', a1: '#F2B950', a2: '#B8432E', a3: '#E07A3F', a4: '#8C3B22', mint: '#F5D9C2', sea: '#F6EBE0' },
    { id: 'uva', name: 'Uva', paper: '#FAF6FC', ink: '#2A1140', ink2: '#5E4473', rule: '#E6D6F0', a1: '#C77DFF', a2: '#7B2CBF', a3: '#FF6FB5', a4: '#5A189A', mint: '#EBD7F7', sea: '#F2E9F8' },
    { id: 'sol', name: 'Sol', paper: '#FFFBEF', ink: '#3A2A00', ink2: '#6E5A1E', rule: '#F1E4B8', a1: '#F9C74F', a2: '#F3722C', a3: '#F9844A', a4: '#B5651D', mint: '#FBE9B6', sea: '#FCF3D9' },
    { id: 'pizarra', name: 'Pizarra', paper: '#F5F6F8', ink: '#1E2430', ink2: '#4F5B6B', rule: '#D9DEE6', a1: '#FFB703', a2: '#219EBC', a3: '#8ECAE6', a4: '#023047', mint: '#D6E9F2', sea: '#E8EDF2' },
    { id: 'coral', name: 'Coral', paper: '#FFF7F5', ink: '#3D1A1A', ink2: '#7A4A4A', rule: '#F4D6D0', a1: '#FFB4A2', a2: '#E63946', a3: '#FF8C7A', a4: '#9D2235', mint: '#FFD9D0', sea: '#FBE8E4' },
    { id: 'bosque', name: 'Bosque', paper: '#F6F8F2', ink: '#1D2E1A', ink2: '#4E6446', rule: '#D9E3CF', a1: '#A7C957', a2: '#6A994E', a3: '#BC4749', a4: '#386641', mint: '#DCE8CB', sea: '#EBF1E2' }
  ];

  var FONTS = [
    { id: 'bricolage', name: 'Bricolage + Atkinson', display: '"Bricolage Grotesque","Trebuchet MS",sans-serif', body: '"Atkinson Hyperlegible","Segoe UI",Arial,sans-serif', mono: '"JetBrains Mono",Consolas,monospace',
      link: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@500;700&display=swap' },
    { id: 'fraunces', name: 'Fraunces + Source Sans', display: '"Fraunces",Georgia,serif', body: '"Source Sans 3","Segoe UI",Arial,sans-serif', mono: '"IBM Plex Mono",Consolas,monospace',
      link: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=IBM+Plex+Mono:wght@500;700&family=Source+Sans+3:ital,wght@0,400;0,700;1,400&display=swap' },
    { id: 'space', name: 'Space Grotesk + Inter', display: '"Space Grotesk","Segoe UI",sans-serif', body: '"Inter","Segoe UI",Arial,sans-serif', mono: '"Space Mono",Consolas,monospace',
      link: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@700&display=swap' },
    { id: 'playfair', name: 'Playfair + Lato', display: '"Playfair Display",Georgia,serif', body: '"Lato","Segoe UI",Arial,sans-serif', mono: '"Courier Prime",Consolas,monospace',
      link: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Lato:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@700;800&display=swap' }
  ];

  var LAYOUTS = [
    { id: 'ring', name: 'Anillo' }, { id: 'spiral', name: 'Espiral' }, { id: 'path', name: 'Camino' }, { id: 'grid', name: 'Grilla' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // **negrita** y *color* en los textos
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/==(.+?)==/g, '<span class="mk">$1</span>').replace(/\*(.+?)\*/g, '<span class="tq">$1</span>');
  }
  function hexToRgb(h) {
    h = (h || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) { var c = hexToRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    var r = a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); });
    return '#' + r.map(function (v) { var s = v.toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }
  function paletteFrom(p) {
    // completa una paleta personalizada (paper, ink, a1..a4) con derivados
    var out = {};
    for (var k in p) out[k] = p[k];
    if (!out.ink2) out.ink2 = mix(out.ink, out.paper, 0.35);
    if (!out.rule) out.rule = mix(out.paper, out.a2, 0.22);
    if (!out.sea) out.sea = mix(out.paper, out.a2, 0.1);
    if (!out.mint) out.mint = mix(out.paper, out.a2, 0.28);
    return out;
  }

  /* ------------------------------------------------------------ disposición */
  function layoutPositions(n, kind) {
    // devuelve [{x,y,r,s}] para n láminas; la 0 es la portada
    var pos = [];
    var i, k;
    if (n === 0) return pos;
    if (kind === 'spiral') {
      pos.push({ x: 0, y: 0, s: 2.0, r: 0 });
      for (i = 1; i < n; i++) {
        var t = 0.6 + i * 2.4, rad = 3100 + 620 * i;
        pos.push({ x: Math.round(Math.cos(t) * rad), y: Math.round(Math.sin(t) * rad * 0.62), r: ((i % 3) - 1) * 2.2, s: 1 });
      }
      return pos;
    }
    if (kind === 'path') {
      pos.push({ x: 0, y: 0, r: 0, s: 1.7 });
      for (i = 1; i < n; i++) {
        pos.push({ x: 2000 * i, y: (i % 2 ? -560 : 560) + (i % 4 === 3 ? -120 : 0), r: (i % 2 ? -1 : 1) * (1.5 + (i % 3) * 0.6), s: 1 });
      }
      return pos;
    }
    if (kind === 'grid') {
      var cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.6)));
      for (i = 0; i < n; i++) {
        var c = i % cols, r = Math.floor(i / cols);
        pos.push({ x: c * 1900, y: r * 1150, r: 0, s: 1 });
      }
      return pos;
    }
    // ring (por defecto): portada grande al centro, el resto en un anillo rectangular
    pos.push({ x: 0, y: 0, r: 0, s: 2.2 });
    var m = n - 1;
    if (m === 0) return pos;
    var W = Math.max(5400, 1900 * Math.ceil(m / 2) * 0.72 + 1900), H = 3500;
    var top = Math.ceil(m / 2), bottom = m - top;
    var topPts = [], botPts = [];
    for (k = 0; k < top; k++) topPts.push({ x: Math.round(-W / 2 + (W) * (top === 1 ? 0.5 : k / (top - 1))), y: -H / 2 });
    for (k = 0; k < bottom; k++) botPts.push({ x: Math.round(W / 2 - (W) * (bottom === 1 ? 0.5 : k / (bottom - 1))), y: H / 2 });
    var all = topPts.concat(botPts);
    for (i = 0; i < all.length; i++) {
      var side = all[i];
      pos.push({ x: side.x, y: side.y, r: ((i % 2) ? 1.5 : -2.2) + ((i % 3) - 1) * 0.5, s: 1 });
    }
    return pos;
  }

  /* ------------------------------------------------------------ láminas */
  var ICONS = {
    quote: '<svg viewBox="0 0 64 64" width="92" height="92" aria-hidden="true"><path d="M14 38c0-10 6-18 16-22l2 4c-6 3-9 7-9 12h8v14H14V38zm22 0c0-10 6-18 16-22l2 4c-6 3-9 7-9 12h8v14H36V38z" fill="var(--a1)"/></svg>',
    spark: '<svg viewBox="0 0 48 48" width="64" height="64" aria-hidden="true"><path d="M24 4l4 14 14 4-14 4-4 14-4-14-14-4 14-4z" fill="var(--a3)"/></svg>',
    arrow: '<svg viewBox="0 0 64 32" width="110" height="55" aria-hidden="true"><path d="M2 16h52M42 4l14 12-14 12" fill="none" stroke="var(--a1)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var TINTS = ['a1', 'a3', 'a2', 'a4'];

  function blob(c, w, l, t, alpha) {
    return '<div class="blob" style="--c:' + rgba(c, alpha || 0.3) + ';width:' + w + 'px;height:' + w + 'px;left:' + l + 'px;top:' + t + 'px"></div>';
  }
  function eyebrow(t) { return t ? '<div class="eyebrow"><i></i>' + rich(t) + '</div>' : ''; }
  function logoTag(src, cls) { return src ? '<img class="logo ' + (cls || '') + '" src="' + esc(src) + '" alt="logo">' : ''; }
  function lines(arr) { return (arr || []).filter(function (x) { return x && String(x).trim(); }); }

  var TPL = {
    cover: function (s, P) {
      var h = blob(P.a3, 900, 820, 20, 0.38) + blob(P.a1, 620, 1080, -40, 0.4);
      h += logoTag(s.logo, 'cover-logo');
      h += eyebrow(s.eyebrow);
      h += '<h1>' + rich(s.title) + '</h1>';
      if (s.subtitle) h += '<p class="lead sub">' + rich(s.subtitle) + '</p>';
      if (s.authors || s.affiliation) h += '<p class="small authors">' + (s.authors ? '<b>' + rich(s.authors) + '</b>' : '') + (s.affiliation ? '<br>' + rich(s.affiliation) : '') + '</p>';
      if (s.badge) h += '<div><span class="badge">' + rich(s.badge) + '</span></div>';
      if (s.presenter) h += '<div class="presenter"><span>' + esc((s.presenterLabel || 'Expositora').toUpperCase()) + '</span><b>' + rich(s.presenter) + '</b></div>';
      return h;
    },
    idea: function (s, P) {
      var h = blob(P.a1, 760, 900, 140, 0.3) + eyebrow(s.eyebrow);
      h += '<div class="row grow" style="align-items:center"><div class="col grow" style="gap:30px">';
      h += '<h2 class="xl">' + rich(s.title) + '</h2>';
      if (s.lead) h += '<p class="lead frag">' + rich(s.lead) + '</p>';
      lines(s.support).forEach(function (t) { h += '<p class="lead frag soft">' + rich(t) + '</p>'; });
      h += '</div><div class="ideaMark">' + ICONS.spark + '</div></div>';
      return h;
    },
    pops: function (s, P) {
      var items = (s.items || []).filter(function (it) { return it && (it.head || it.body); });
      var h = blob(P.a3, 700, -120, 200, 0.22) + eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2>';
      h += '<div class="vgrid n' + Math.min(4, Math.max(1, items.length)) + '">';
      items.forEach(function (it, i) {
        var tint = P[TINTS[i % 4]];
        h += '<div class="pop vcard" style="--t:' + rgba(tint, 0.18) + ';--d:' + tint + '"><div class="ph">' + rich(it.head || '') + '</div><div class="pb"><div><p>' + rich(it.body || '') + '</p></div></div></div>';
      });
      return h + '</div>';
    },
    bullets: function (s, P) {
      var items = lines(s.items);
      var h = blob(P.a1, 640, 1060, 300, 0.26) + eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2><div class="callouts">';
      items.forEach(function (t, i) {
        h += '<div class="callout frag"><span class="num">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span><p>' + rich(t) + '</p></div>';
      });
      return h + '</div>';
    },
    stat: function (s, P) {
      var st = (s.stats || []).filter(function (x) { return x && x.value; });
      var h = blob(P.a3, 800, 900, -100, 0.24) + eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2><div class="stats n' + Math.min(3, st.length) + '">';
      st.forEach(function (x, i) {
        h += '<div class="stat frag" style="--d:' + P[TINTS[i % 4]] + '"><div class="big">' + rich(x.value) + '</div><p>' + rich(x.label || '') + '</p></div>';
      });
      return h + '</div>';
    },
    compare: function (s, P) {
      var L = s.left || {}, R = s.right || {};
      var h = eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2><div class="aa">';
      h += '<div class="side"><h3>' + rich(L.head || '') + '</h3><ul>' + lines(L.items).map(function (t) { return '<li class="frag">' + rich(t) + '</li>'; }).join('') + '</ul></div>';
      h += '<div class="arr">' + ICONS.arrow + '</div>';
      h += '<div class="side now"><h3>' + rich(R.head || '') + '</h3><ul>' + lines(R.items).map(function (t) { return '<li class="frag">' + rich(t) + '</li>'; }).join('') + '</ul></div>';
      return h + '</div>';
    },
    quote: function (s, P) {
      var h = blob(P.a2, 900, 700, 0, 0.16) + eyebrow(s.eyebrow);
      h += '<div class="quoteWrap">' + ICONS.quote + '<blockquote>' + rich(s.text) + '</blockquote>' + (s.cite ? '<p class="cite">— ' + rich(s.cite) + '</p>' : '') + '</div>';
      return h;
    },
    figure: function (s, P) {
      var h = eyebrow(s.eyebrow) + '<h3 class="figTitle">' + rich(s.title) + '</h3>';
      h += '<div class="figWrap">' + (s.image ? '<img src="' + esc(s.image) + '" alt="' + esc(s.caption || s.title) + '">' : '<div class="figEmpty">Sin imagen</div>') + '</div>';
      if (s.caption) h += '<p class="cite figCap">' + rich(s.caption) + '</p>';
      if (s.note) h += '<p class="small frag">' + rich(s.note) + '</p>';
      return h;
    },
    chips: function (s, P) {
      var h = blob(P.a1, 700, 980, 200, 0.28) + eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2><div class="chips">';
      lines(s.items).forEach(function (t, i) { h += '<span class="chip frag" style="--c:' + rgba(P[TINTS[i % 4]], 0.35) + '">' + rich(t) + '</span>'; });
      return h + '</div>';
    },
    refs: function (s, P) {
      var h = eyebrow(s.eyebrow) + '<h2>' + rich(s.title) + '</h2><div class="refs">';
      if (s.main) h += '<p class="main">' + rich(s.main) + '</p>';
      lines(s.items).forEach(function (t) { h += '<p>' + rich(t) + '</p>'; });
      return h + '</div>';
    },
    closing: function (s, P) {
      var h = blob(P.a3, 900, 820, 20, 0.38) + blob(P.a1, 620, 1080, -40, 0.4) + logoTag(s.logo, 'cover-logo');
      h += '<h1 class="thanks">' + rich(s.title || 'Gracias') + '</h1>';
      if (s.text) h += '<p class="lead">' + rich(s.text) + '</p>';
      if (s.presenter) h += '<div class="presenter"><span>' + esc((s.presenterLabel || 'Expositora').toUpperCase()) + '</span><b>' + rich(s.presenter) + '</b>' + (s.contact ? '<span class="contact">' + rich(s.contact) + '</span>' : '') + '</div>';
      return h;
    }
  };

  function slideHTML(s, P) {
    var fn = TPL[s.type] || TPL.bullets;
    return fn(s, P);
  }

  /* ------------------------------------------------------------ CSS */
  function css(P, F) {
    return [
      ':root{--paper:' + P.paper + ';--ink:' + P.ink + ';--ink2:' + P.ink2 + ';--rule:' + P.rule + ';--a1:' + P.a1 + ';--a2:' + P.a2 + ';--a3:' + P.a3 + ';--a4:' + P.a4 + ';--mint:' + P.mint + ';--sea:' + P.sea + ';',
      '--display:' + F.display + ';--body:' + F.body + ';--mono:' + F.mono + ';color-scheme:light}',
      'html,body{height:100%;margin:0;overflow:hidden}',
      'body{background:var(--paper);color:var(--ink);font-family:var(--body);user-select:none;-webkit-user-select:none}',
      '#stage{position:fixed;inset:0;overflow:hidden;cursor:pointer}',
      '#world{position:absolute;left:0;top:0;transform-origin:0 0}',
      '#trail{position:absolute;overflow:visible;pointer-events:none;opacity:0;transition:opacity .9s}',
      '.ov #trail{opacity:1}',
      '.frame{position:absolute;width:1600px;height:900px;box-sizing:border-box;padding:66px 92px;background:var(--paper);transform-origin:50% 50%;display:flex;flex-direction:column;justify-content:center;gap:26px;overflow:hidden;border-radius:18px}',
      '.ov .frame{box-shadow:0 0 0 6px var(--rule);cursor:zoom-in}',
      '.frame>*:not(.blob){position:relative;z-index:1}',
      '.blob{position:absolute;border-radius:50%;pointer-events:none;z-index:0;background:radial-gradient(circle at 40% 40%, var(--c) 0%, transparent 68%)}',
      '.eyebrow{font-family:var(--mono);font-weight:700;font-size:21px;letter-spacing:.18em;text-transform:uppercase;color:var(--a4);display:flex;align-items:center;gap:16px}',
      '.eyebrow i{display:inline-block;width:44px;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--a1),var(--a3))}',
      'h1,h2,h3{font-family:var(--display);margin:0;text-wrap:balance;line-height:1.02;color:var(--ink)}',
      'h1{font-size:76px;font-weight:800;letter-spacing:-.03em;max-width:1150px;line-height:.98}',
      'h1.long{font-size:58px}h1.xlong{font-size:46px}',
      'h2{font-size:66px;font-weight:800;letter-spacing:-.025em}h2.xl{font-size:82px}h2.long{font-size:52px}',
      'h3{font-size:36px;font-weight:700}',
      'p{margin:0}',
      '.mk{background:linear-gradient(transparent 58%, ' + rgba(P.a1, 0.55) + ' 58% 92%, transparent 92%);padding:0 .08em}',
      '.tq{color:var(--a4)}.em{color:var(--a2)}',
      '.lead{font-size:34px;line-height:1.3}.lead.soft{font-size:28px;color:var(--ink2)}.lead.sub{font-size:30px;color:var(--ink2);max-width:1100px}',
      '.small{font-size:25px;line-height:1.38;color:var(--ink2)}.authors{max-width:980px;font-size:24px}.authors b{color:var(--ink);font-size:28px}',
      '.cite{font-family:var(--mono);font-size:18px;color:var(--ink2);letter-spacing:.02em}',
      '.row{display:flex;gap:40px}.col{display:flex;flex-direction:column;gap:22px}.grow{flex:1;min-width:0}',
      '.frag{opacity:0;transform:translateY(24px);transition:opacity .6s ease, transform .6s cubic-bezier(.2,.7,.2,1)}.frag.on{opacity:1;transform:none}',
      '.pop{border-radius:26px;padding:20px 28px;background:var(--sea);transition:background .5s, box-shadow .5s}',
      '.pop .ph{display:flex;align-items:center;gap:16px;font-family:var(--display);font-weight:700;font-size:31px;line-height:1.1}',
      '.pop .ph::before{content:"";flex:none;width:16px;height:16px;border-radius:50%;border:3px solid var(--d,var(--a2));transition:background .4s}',
      '.pop.open{background:#fff;box-shadow:0 18px 50px ' + rgba(P.ink, 0.12) + '}.pop.open .ph::before{background:var(--d,var(--a2))}',
      '.pop .pb{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .65s cubic-bezier(.2,.7,.2,1), opacity .5s .1s}',
      '.pop.open .pb{grid-template-rows:1fr;opacity:1}.pop .pb>div{overflow:hidden}.pop .pb p{padding-top:12px;font-size:26px;line-height:1.36;color:var(--ink2)}',
      '.vgrid{display:grid;grid-template-columns:1fr 1fr;gap:26px;flex:1;min-height:0;align-content:start}.vgrid.n1{grid-template-columns:1fr}.vgrid.n3{grid-template-columns:1fr 1fr 1fr}',
      '.vcard{background:var(--t);display:flex;flex-direction:column;justify-content:flex-start;gap:4px}.vcard.open{background:#fff}',
      '.vgrid.n3 .vcard .ph{font-size:28px}.vgrid.n3 .vcard .pb p{font-size:23px}',
      '.callouts{display:flex;flex-direction:column;gap:22px;max-width:1300px}',
      '.callout{display:flex;gap:26px;align-items:flex-start;border-left:8px solid var(--a1);padding:6px 0 6px 26px}',
      '.callout .num{font-family:var(--mono);font-weight:700;font-size:24px;color:var(--a4);padding-top:6px;flex:none}.callout p{font-size:30px;line-height:1.3}',
      '.callouts.dense .callout p{font-size:26px}',
      '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;flex:1;align-items:center}.stats.n1{grid-template-columns:1fr}.stats.n2{grid-template-columns:1fr 1fr}',
      '.stat{border-top:10px solid var(--d);padding-top:22px}.stat .big{font-family:var(--display);font-weight:800;font-size:112px;letter-spacing:-.04em;line-height:1;color:var(--d)}.stats.n1 .big{font-size:160px}',
      '.stat p{font-size:26px;line-height:1.3;color:var(--ink2);margin-top:14px}',
      '.aa{display:grid;grid-template-columns:1fr 140px 1.1fr;gap:20px;align-items:center;flex:1}.aa h3{margin-bottom:16px}',
      '.aa ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px}.aa li{font-size:27px;line-height:1.3;padding:18px 24px;border-radius:22px;background:var(--sea)}',
      '.aa .now li{background:#fff;box-shadow:0 14px 36px ' + rgba(P.ink, 0.1) + ';border-left:8px solid var(--a3)}.aa .arr{text-align:center}',
      '.chips{display:flex;flex-wrap:wrap;gap:18px;max-width:1300px}.chip{font-family:var(--display);font-weight:700;font-size:32px;padding:16px 30px;border-radius:999px;background:var(--c);color:var(--ink)}',
      '.quoteWrap{display:flex;flex-direction:column;gap:18px;max-width:1300px}.quoteWrap blockquote{margin:0;font-family:var(--display);font-weight:700;font-size:54px;line-height:1.14;letter-spacing:-.01em}.quoteWrap blockquote.long{font-size:42px}',
      '.figTitle{max-width:1300px}.figWrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.figWrap img{max-width:100%;max-height:100%;object-fit:contain;border-radius:14px}',
      '.figEmpty{width:600px;height:360px;border-radius:14px;border:3px dashed var(--rule);display:flex;align-items:center;justify-content:center;color:var(--ink2);font-size:26px}.figCap{max-width:1300px}',
      '.refs{columns:2;column-gap:60px;font-size:23px;line-height:1.4;margin-top:10px}.refs p{break-inside:avoid;margin:0 0 14px;padding-left:28px;text-indent:-28px}.refs .main{font-size:25px;padding:16px 20px 16px 48px;border-radius:20px;background:var(--sea);column-span:all;margin-bottom:22px}',
      '.presenter{display:flex;flex-direction:column;gap:4px;padding-left:22px;border-left:8px solid var(--a1)}.presenter span{font-family:var(--mono);font-weight:700;font-size:19px;letter-spacing:.2em;color:var(--a4)}.presenter b{font-family:var(--display);font-size:46px;font-weight:800;letter-spacing:-.01em}.presenter .contact{letter-spacing:0;text-transform:none;font-size:22px;color:var(--ink2);font-weight:500}',
      '.badge{display:inline-flex;align-items:center;gap:12px;font-family:var(--mono);font-weight:500;font-size:20px;padding:10px 20px;border-radius:999px;background:var(--ink);color:var(--paper)}',
      '.logo{position:absolute;right:92px;top:66px;max-width:260px;max-height:130px;object-fit:contain;z-index:2}',
      '.ideaMark{flex:none;width:260px;display:flex;justify-content:center}.ideaMark svg{width:220px;height:220px;opacity:.9}',
      'h1.thanks{font-size:150px}',
      '#bar{position:fixed;left:0;bottom:0;height:6px;width:0;z-index:20;background:linear-gradient(90deg,var(--a1),var(--a2),var(--a3));transition:width .6s}',
      '#help{position:fixed;right:18px;bottom:16px;z-index:21;font-family:var(--mono);font-size:12px;color:var(--ink2);opacity:.55;letter-spacing:.04em;pointer-events:none}',
      '@media (prefers-reduced-motion:reduce){.frag,.pop .pb{transition:none}}'
    ].join('\n');
  }

  /* ------------------------------------------------------------ runtime (ES2017) */
  var RUNTIME = function () {
    var world = document.getElementById('world'), stage = document.getElementById('stage');
    var frames = Array.prototype.slice.call(document.querySelectorAll('.frame'));
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frames.forEach(function (f) { f.style.left = (f.dataset.x - 800) + 'px'; f.style.top = (f.dataset.y - 450) + 'px'; f.style.transform = 'rotate(' + f.dataset.r + 'deg) scale(' + f.dataset.s + ')'; });
    // ajusta tamaños de títulos largos
    frames.forEach(function (f) {
      var h1 = f.querySelector('h1'); if (h1 && !h1.classList.contains('thanks')) { var n = h1.textContent.length; if (n > 150) h1.classList.add('xlong'); else if (n > 85) h1.classList.add('long'); }
      var h2 = f.querySelector('h2'); if (h2) { var m = h2.textContent.length; if (m > 70) { h2.classList.add('long'); h2.classList.remove('xl'); } else if (m > 45) h2.classList.remove('xl'); }
      var bq = f.querySelector('blockquote'); if (bq && bq.textContent.length > 160) bq.classList.add('long');
      var co = f.querySelector('.callouts'); if (co) { var total = 0; co.querySelectorAll('p').forEach(function (p) { total += p.textContent.length; }); if (total > 520 || co.children.length > 4) co.classList.add('dense'); }
    });
    // caja envolvente para la vista general
    var bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    frames.forEach(function (f) { var x = +f.dataset.x, y = +f.dataset.y, s = +f.dataset.s; bb.x0 = Math.min(bb.x0, x - 800 * s); bb.x1 = Math.max(bb.x1, x + 800 * s); bb.y0 = Math.min(bb.y0, y - 450 * s); bb.y1 = Math.max(bb.y1, y + 450 * s); });
    var trail = document.getElementById('trail');
    if (trail) {
      var pad = 600; trail.setAttribute('viewBox', (bb.x0 - pad) + ' ' + (bb.y0 - pad) + ' ' + (bb.x1 - bb.x0 + 2 * pad) + ' ' + (bb.y1 - bb.y0 + 2 * pad));
      trail.style.left = (bb.x0 - pad) + 'px'; trail.style.top = (bb.y0 - pad) + 'px'; trail.style.width = (bb.x1 - bb.x0 + 2 * pad) + 'px'; trail.style.height = (bb.y1 - bb.y0 + 2 * pad) + 'px';
      var d = frames.map(function (f, i) { return (i ? 'L' : 'M') + f.dataset.x + ' ' + f.dataset.y; }).join(' ');
      trail.querySelector('path').setAttribute('d', d);
    }
    var steps = [], items = new Map(), W, H, idx = 0, cur = null, anim = null, peek = false;
    function build() {
      frames.forEach(function (f) { items.set(f, Array.prototype.slice.call(f.querySelectorAll('.frag, .pop'))); });
      frames.forEach(function (f, i) {
        if (f.dataset.kind === 'refs' && i > 0) steps.push({ ov: true });
        for (var k = 0; k <= items.get(f).length; k++) steps.push({ f: f, n: k });
      });
      if (!steps.some(function (s) { return s.ov; })) steps.push({ ov: true });
    }
    function size() { W = stage.clientWidth; H = stage.clientHeight; }
    function camFor(st) {
      if (st.ov) { var bw = bb.x1 - bb.x0 + 1200, bh = bb.y1 - bb.y0 + 1200; return { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2, r: 0, k: Math.min(W / bw, H / bh) }; }
      var f = st.f, s = +f.dataset.s; return { x: +f.dataset.x, y: +f.dataset.y, r: +f.dataset.r, k: Math.min(W / 1600, H / 900) * 0.96 / s };
    }
    function T(c) { return 'translate(' + (W / 2) + 'px, ' + (H / 2) + 'px) scale(' + c.k + ') rotate(' + (-c.r) + 'deg) translate(' + (-c.x) + 'px, ' + (-c.y) + 'px)'; }
    function fly(to) {
      if (anim) { anim.cancel(); anim = null; }
      var from = cur; cur = to; world.style.transform = T(to);
      if (!from || reduce || !world.animate) return;
      if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1 && Math.abs(from.k - to.k) < 1e-6) return;
      var dx = Math.abs(from.x - to.x), dy = Math.abs(from.y - to.y), lo = Math.min(from.k, to.k), km = Math.min(lo, Math.min(W / (dx + 1900), H / (dy + 1150)) * 0.9);
      var kf = [{ transform: T(from) }, { transform: T(to) }], dur = 1000;
      if (km < lo * 0.85) { kf = [{ transform: T(from) }, { transform: T({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, r: (from.r + to.r) / 2, k: km }), offset: 0.5 }, { transform: T(to) }]; dur = 1700; }
      else if (Math.max(from.k, to.k) / lo > 3) dur = 1800;
      anim = world.animate(kf, { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)' }); anim.onfinish = function () { anim = null; };
    }
    function render() {
      var st = steps[idx];
      document.body.classList.toggle('ov', !!st.ov || peek);
      frames.forEach(function (f) {
        var here = !st.ov && st.f === f; f.classList.toggle('here', here && !peek);
        items.get(f).forEach(function (e, i) { var v = !here || i < st.n; if (e.classList.contains('pop')) e.classList.toggle('open', v); else e.classList.toggle('on', v); });
      });
      fly(peek ? camFor({ ov: true }) : camFor(st));
      document.getElementById('bar').style.width = (idx / (steps.length - 1) * 100) + '%';
      try { if (window.parent !== window) window.parent.postMessage({ lienzo: 'step', idx: idx, total: steps.length, frame: st.f ? frames.indexOf(st.f) : -1 }, '*'); } catch (e) {}
    }
    function go(i) { peek = false; idx = Math.max(0, Math.min(steps.length - 1, i)); render(); }
    function goFrame(fi) { var j = steps.findIndex(function (s) { return s.f === frames[fi] && s.n === 0; }); if (j >= 0) go(j); }
    stage.addEventListener('click', function (e) {
      if (peek || steps[idx].ov) { var f = e.target.closest('.frame'); if (f) { goFrame(frames.indexOf(f)); return; } }
      go(idx + 1);
    });
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); go(idx - 1); });
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].indexOf(k) >= 0) { e.preventDefault(); go(idx + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(k) >= 0) { e.preventDefault(); go(idx - 1); }
      else if (k === 'Home') go(0); else if (k === 'End') go(steps.length - 1);
      else if (k === 'o' || k === 'O') { peek = !peek; render(); }
      else if (k === 'f' || k === 'F') { try { document.fullscreenElement ? document.exitFullscreen().catch(function () {}) : document.documentElement.requestFullscreen().catch(function () {}); } catch (_) {} }
    });
    window.addEventListener('message', function (e) {
      var m = e.data || {}; if (m.lienzo === 'go') goFrame(m.frame); else if (m.lienzo === 'next') go(idx + 1); else if (m.lienzo === 'prev') go(idx - 1); else if (m.lienzo === 'overview') { peek = !peek; render(); }
    });
    window.addEventListener('resize', function () { size(); if (anim) { anim.cancel(); anim = null; } cur = peek ? camFor({ ov: true }) : camFor(steps[idx]); world.style.transform = T(cur); });
    build(); size();
    var start = 0; if (location.hash && /^#s\d+$/.test(location.hash)) { var fi = +location.hash.slice(2); var j = steps.findIndex(function (s) { return s.f === frames[fi] && s.n === 0; }); if (j >= 0) start = j; }
    idx = start; render();
  };

  /* ------------------------------------------------------------ documento */
  function build(project, opts) {
    opts = opts || {};
    var P = paletteFrom(project.palette || PALETTES[0]);
    var F = FONTS.filter(function (f) { return f.id === (project.font || 'bricolage'); })[0] || FONTS[0];
    var slides = project.slides || [];
    var pos = layoutPositions(slides.length, project.layout || 'ring');
    var meta = project.meta || {};
    var framesHTML = slides.map(function (s, i) {
      var p = pos[i];
      var ss = Object.assign({}, s);
      if (s.type === 'cover' || s.type === 'closing') {
        if (!ss.presenter && meta.presenter) ss.presenter = meta.presenter;
        if (!ss.logo && meta.logo) ss.logo = meta.logo;
        if (meta.presenterLabel) ss.presenterLabel = meta.presenterLabel;
      }
      if (s.type === 'cover' && meta.event && !s.eyebrowLocked) ss.eyebrow = s.eyebrow || meta.event;
      return '<section class="frame ' + esc(s.type) + '" data-x="' + p.x + '" data-y="' + p.y + '" data-r="' + p.r + '" data-s="' + p.s + '" data-kind="' + esc(s.type) + '" data-name="' + esc(s.name || s.type) + '">' + slideHTML(ss, P) + '</section>';
    }).join('\n');
    var title = (slides[0] && slides[0].title) || meta.title || 'Presentación';
    var fontLink = opts.offline ? '' : '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="' + F.link + '">\n';
    var html = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + '</title>\n' + fontLink +
      '<meta name="generator" content="Lienzo">\n<style>\n' + css(P, F) + '\n</style>\n</head>\n<body>\n<div id="stage">\n<div id="world">\n' +
      '<svg id="trail" aria-hidden="true"><defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="' + P.a1 + '"/><stop offset=".5" stop-color="' + P.a2 + '"/><stop offset="1" stop-color="' + P.a3 + '"/></linearGradient></defs><path d="" fill="none" stroke="url(#tg)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 46"/></svg>\n' +
      framesHTML + '\n</div>\n</div>\n<div id="bar"></div>\n' + (opts.preview ? '' : '<div id="help">clic / → avanza · clic derecho / ← vuelve · O vista general · F pantalla completa</div>\n') +
      '<script>\n(' + RUNTIME.toString() + ')();\n</script>\n</body>\n</html>\n';
    return html;
  }

  global.LienzoRender = { build: build, PALETTES: PALETTES, FONTS: FONTS, LAYOUTS: LAYOUTS, paletteFrom: paletteFrom, layoutPositions: layoutPositions, esc: esc, mix: mix };
})(typeof window !== 'undefined' ? window : this);
