# -*- coding: utf-8 -*-
"""Análisis de PDF y texto: estructura, ideas fuerza, cifras, figuras y referencias.

Todo funciona sin conexión. La salida es un "esquema" (dict) que luego plan.py
convierte en láminas.
"""
import base64
import collections
import io
import math
import re
import unicodedata

try:
    import pymupdf
except ImportError:  # pragma: no cover
    import fitz as pymupdf  # type: ignore

STOP_ES = set("""a al algo algunas algunos ante antes como con contra cual cuales cuando de del desde donde dos durante e el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estaban estamos estan están estar estas este esto estos fue fueron ha habia había hace hacia han has hasta hay la las le les lo los mas más me mi mis mientras muy nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque que quien quienes qué se sea sean segun según ser si sido siendo sin sobre sois somos son soy su sus tal también tambien tanto te tener tiene tienen toda todas todo todos tras tu tus un una unas uno unos usted ustedes vosotros y ya yo así asi aquí aqui ahí ahi allí alli bien cada cómo donde dónde ese esa eso ello mismo misma mismos mismas sólo solo tan ambos puede pueden ser este trabajo artículo articulo presente decir dentro además ademas embargo ejemplo manera forma modo parte partes través traves respecto caso casos vez veces sino aunque mediante luego después despues entonces menos mayor menor gran grande grandes pues etc""".split())
STOP_EN = set("""a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just more most my no nor not of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours also however thus therefore may might paper study results using used based show shown two one three within among across between et al e.g i.e""".split())

HEADING_WORDS = [
    r"resumen", r"abstract", r"resumo", r"introducci[oó]n", r"introduction", r"antecedentes", r"background",
    r"marco te[oó]rico", r"estado de la cuesti[oó]n", r"objetivos?", r"objectives?", r"hip[oó]tesis", r"m[eé]todos?", r"methods?",
    r"metodolog[ií]a", r"methodology", r"materiales? y m[eé]todos?", r"materials? and methods?", r"muestra", r"procedimiento",
    r"resultados?", r"results?", r"an[aá]lisis", r"analysis", r"discusi[oó]n", r"discussion", r"conclusi[oó]n(es)?",
    r"conclusions?", r"consideraciones finales", r"reflexiones finales", r"recomendaciones", r"limitaciones", r"limitations",
    r"referencias( bibliogr[aá]ficas)?", r"bibliograf[ií]a", r"references", r"agradecimientos?", r"acknowledg?ments?",
    r"anexos?", r"ap[eé]ndices?", r"appendix", r"notas?", r"notes", r"palabras clave", r"keywords?", r"key words",
]
HEADING_RE = re.compile(r"^\s*(\d+(\.\d+)*\.?\s+)?(" + "|".join(HEADING_WORDS) + r")\s*[:.\-–—]?\s*$", re.I)
NUMBERED_RE = re.compile(r"^\s*(\d{1,2}(\.\d{1,2}){0,2}\.?|[IVX]{1,4}\.?|[A-Z]\.)\s+[A-ZÁÉÍÓÚÑ¿¡\"“]")
REF_HEAD_RE = re.compile(r"^\s*(\d+\.?\s*)?(referencias( bibliogr[aá]ficas)?|bibliograf[ií]a( citada| consultada)?|references|obras citadas|fuentes( consultadas)?|literatura citada|works cited)\s*[:.]?\s*$", re.I)
ABSTRACT_RE = re.compile(r"^\s*(resumen|abstract|resumo|summary)\b", re.I)
KEYWORDS_RE = re.compile(r"^\s*(palabras[\s\-]*claves?|keywords?|key\s*words|palavras[\s\-]*chave|descriptores)\s*[:.\-–—]*\s*(.*)$", re.I)
CAPTION_RE = re.compile(r"^\s*(figura|fig\.?|gr[aá]fico|imagen|ilustraci[oó]n|cuadro|tabla|mapa|esquema|diagrama|figure|table|chart|graph)\s*\.?\s*(n[°º]?\s*)?\d+[a-z]?\b", re.I)
CITE_RE = re.compile(r"\(([^()]*?\b(1[5-9]\d{2}|20\d{2})[a-z]?\b[^()]*?)\)|\[\d+([,\-–]\s*\d+)*\]|\b(cf\.|véase|ver)\s+[A-Z][^,.;]+,\s*\d{4}", re.I)
NUM_RE = re.compile(r"(?<![\w.,])(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s?(%|por ciento|porciento|percent|millones|millón|miles|mil\b|años|habitantes|personas|individuos|casos|participantes|estudiantes|escuelas|países|paises)", re.I)
YEAR_RE = re.compile(r"\b(1[5-9]\d{2}|20\d{2})[a-z]?\b")
CONNECTORS = re.compile(r"^(y|e|o|u|pero|mas|ni|pues|que|ya|and|but|or|yet|so|sin embargo|no obstante|además|ademas|asimismo|así mismo|por otro lado|por otra parte|por lo tanto|por tanto|en este sentido|en consecuencia|de este modo|de esta manera|en efecto|es decir|por ejemplo|ahora bien|finalmente|en primer lugar|en segundo lugar|en tercer lugar|por último|por ultimo|en síntesis|en sintesis|en suma|en resumen|en conclusión|en conclusion|de hecho|ciertamente|así|asi|también|tambien|luego|entonces|en cambio|however|moreover|furthermore|in addition|therefore|thus|hence|for example|for instance|in this sense|finally|first|second|third|in conclusion|in summary|overall|importantly|notably|indeed|also|por el contrario|incluso|en base a (estos|los|dichos) resultados|a partir de (estos|los) resultados|por su parte|por ello|por eso|de igual modo|igualmente|en particular|particularmente|a su vez|sumado a esto|al respecto|en relación con esto|cabe destacar que|cabe señalar que|es importante destacar que|in contrast|on the other hand|on the contrary|in particular|additionally|consequently|as a result|similarly|likewise|nevertheless|nonetheless|interestingly|in fact|of note)\s*,?\s+(?=[\wáéíóúñ¿¡“\"(])", re.I)
CUE_RE = re.compile(r"\b(objetivo|objetivos|prop[oó]sito|hip[oó]tesis|se concluye|concluimos|conclusi[oó]n|resultados? (muestran|indican|sugieren|revelan|evidencian)|hallazgos?|se observ[oó]|se encontr[oó]|demuestra[n]?|evidencia|clave|fundamental|principal|importante|significativ[oa]|mayor|menor|aument[oó]|disminu|creci[oó]|tendencia|frente a|respecto a|en comparaci[oó]n|aim|purpose|objective|we found|we show|results (show|indicate|suggest|reveal)|conclude|key|main|significant|increase|decrease|compared)\b", re.I)
NAME_TOKEN = re.compile(r"^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’\-]+\.?$|^[A-ZÁÉÍÓÚÑÜ]\.$|^(de|del|la|las|los|van|von|der|den|da|do|dos|y|and|e|&|di|le)$")
INSTITUTION_RE = re.compile(r"universi|institut|departamento|department|facultad|faculty|centro|center|centre|conicet|csic|laborator|escuela|school|hospital|ministerio|fundaci|college|unidad|grupo de investigaci|programa|@|e-?mail|correo|correspondencia|doi|issn|http", re.I)

LANG_MARKERS_ES = set("el la los las de del que y en es por para con una un como más se su sus al lo".split())
LANG_MARKERS_EN = set("the of and to in is that for with as on by this are from be an it we or which".split())


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_key(s):
    s = strip_accents(s.lower())
    s = re.sub(r"\d+", "#", s)
    return re.sub(r"[^a-z#]+", " ", s).strip()


def words(s):
    return re.findall(r"[a-záéíóúñüA-ZÁÉÍÓÚÑÜ][a-záéíóúñüA-ZÁÉÍÓÚÑÜ\-]+", s)


def content_words(s, lang):
    stop = STOP_ES | STOP_EN if lang == "mixed" else (STOP_ES if lang == "es" else STOP_EN)
    out = []
    for w in words(s):
        lw = w.lower()
        if len(lw) < 3 or lw in stop or lw in STOP_ES and lang == "es":
            continue
        out.append(stem(lw))
    return out


def stem(w):
    # raíz tosca compartida es/en: recorta plurales y terminaciones frecuentes
    w = strip_accents(w)
    for suf in ("mente", "ciones", "cion", "sion", "siones", "idades", "idad", "mientos", "miento", "ations", "ation", "ing", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def detect_lang(text):
    ws = [w.lower() for w in words(text[:20000])]
    es = sum(1 for w in ws if w in LANG_MARKERS_ES)
    en = sum(1 for w in ws if w in LANG_MARKERS_EN)
    if es == 0 and en == 0:
        return "es"
    if en > es * 1.6:
        return "en"
    if es > en * 1.6:
        return "es"
    return "es" if es >= en else "en"


def fix_hyphenation(text):
    text = re.sub(r"(\w)-\n(\w)", lambda m: m.group(1) + m.group(2), text)
    text = re.sub(r"[ \t]*\n[ \t]*", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    protected = re.sub(r"\b(Dr|Dra|Sr|Sra|Lic|Prof|Mg|Mgter|Ing|et al|cf|vs|pp|p|ed|eds|vol|núm|no|n|fig|Fig|aprox|etc|e\.g|i\.e|ca|op\. cit|ibid|Ibid|cap|art|núm)\.", lambda m: m.group(0).replace(".", "§"), text)
    protected = re.sub(r"(\d)\.(\d)", r"\1¤\2", protected)
    parts = re.split(r"(?<=[.!?…])\s+(?=[¿¡\"“(\[A-ZÁÉÍÓÚÑ0-9])", protected)
    out = []
    for p in parts:
        p = p.replace("§", ".").replace("¤", ".").strip()
        if len(p) > 1:
            out.append(p)
    return out


def clean_sentence(s):
    s = CITE_RE.sub("", s)
    s = re.sub(r"\s+([,;:.)])", r"\1", s)
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    s = re.sub(r"^[\-–—•·▪■●\*]+\s*", "", s)
    s = CONNECTORS.sub("", s)
    if s:
        s = s[0].upper() + s[1:]
    s = re.sub(r"\s*[;,:]\s*$", ".", s)
    return s.strip()


def condense(s, max_words=28):
    """Acorta una oración para lámina: corta en una frontera de cláusula si es larga."""
    s = clean_sentence(s)
    ws = s.split()
    if len(ws) <= max_words + 5:
        return s
    best = None
    for m in re.finditer(r"[;:—–]|,\s+(?=(y|pero|aunque|mientras|lo que|que|donde|cuando|porque|ya que|and|but|which|while|where|although)\b)", s):
        n = len(s[: m.start()].split())
        if 8 <= n <= max_words:
            best = m.start()
    if best is None:
        for m in re.finditer(r",", s):
            n = len(s[: m.start()].split())
            if 10 <= n <= max_words:
                best = m.start()
    if best is not None:
        cut = s[:best].rstrip(" ,;:—–")
        return cut + "."
    return " ".join(ws[:max_words]).rstrip(",;:") + "…"


def short_title(s, max_words=7):
    """Título corto a partir de una oración (para burbujas y tarjetas)."""
    s = clean_sentence(s)
    s = re.sub(r"[.…!?]+$", "", s)
    lead = re.split(r"[:;—–(]|,\s", s)[0]
    ws = lead.split()
    low_start = re.compile(r"^(el|la|los|las|un|una|unos|unas|the|a|an|this|these|that|those|este|esta|estos|estas|ese|esa|eso|dicho|dicha)$", re.I)
    while ws and low_start.match(ws[0]):
        ws = ws[1:]
    if len(ws) > max_words:
        ws = ws[:max_words]
        # evita terminar en palabra vacía
        while ws and ws[-1].lower() in STOP_ES | STOP_EN:
            ws.pop()
    t = " ".join(ws).strip(" ,;:-")
    if not t:
        t = " ".join(s.split()[:max_words])
    return t[0].upper() + t[1:] if t else ""


# ---------------------------------------------------------------- PDF → líneas


def _page_lines(page):
    """Devuelve lista de bloques; cada bloque = lista de líneas (texto, tamaño, negrita, cursiva, bbox)."""
    blocks = []
    d = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_DEHYPHENATE)
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        lines = []
        for l in b["lines"]:
            d_ = l.get("dir", (1, 0))
            if abs(d_[0]) < 0.9:
                continue  # texto vertical (marcas de agua, lomos)
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans:
                continue
            text = "".join(s["text"] for s in l["spans"]).strip()
            if not text or re.match(r"^arXiv:\d", text):
                continue
            n = sum(len(s["text"]) for s in spans) or 1
            size = sum(s["size"] * len(s["text"]) for s in spans) / n
            bold_chars = sum(len(s["text"]) for s in spans if (s["flags"] & 16) or re.search(r"bold|black|heavy|semibold|demi", s["font"], re.I))
            ital_chars = sum(len(s["text"]) for s in spans if (s["flags"] & 2) or re.search(r"italic|oblique", s["font"], re.I))
            caps = sum(1 for c in text if c.isupper()) / max(1, sum(1 for c in text if c.isalpha()))
            lines.append({
                "text": text, "size": size, "bold": bold_chars / n > 0.6, "italic": ital_chars / n > 0.6,
                "caps": caps, "bbox": l["bbox"], "lead_bold": bool(spans and ((spans[0]["flags"] & 16) or re.search(r"bold|black|heavy", spans[0]["font"], re.I))),
                "lead_text": spans[0]["text"].strip(),
            })
        if lines:
            blocks.append({"lines": lines, "bbox": b["bbox"]})
    return blocks


def _body_size(pages_blocks):
    c = collections.Counter()
    for blocks in pages_blocks:
        for b in blocks:
            for l in b["lines"]:
                c[round(l["size"] * 2) / 2] += len(l["text"])
    if not c:
        return 10.0
    return c.most_common(1)[0][0]


def _repeated_lines(pages_blocks):
    """Encabezados y pies: textos (normalizados) que se repiten en muchas páginas."""
    n = len(pages_blocks)
    if n < 3:
        return set()
    c = collections.Counter()
    for blocks in pages_blocks:
        seen = set()
        for b in blocks:
            for l in b["lines"]:
                k = norm_key(l["text"])
                if len(k) >= 4 and k not in seen:
                    seen.add(k)
                    c[k] += 1
    thr = max(3, math.ceil(n * 0.35))
    return {k for k, v in c.items() if v >= thr}


def _is_name_line(text):
    t = re.sub(r"[\d\*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰ᵃᵇᶜ]+", "", text)
    t = re.sub(r"\bID\b", "", t)
    t = t.replace("ID", "") if re.search(r"[a-z]ID\b", text) else t
    if INSTITUTION_RE.search(t) or "," not in t and len(t.split()) > 12:
        return False
    toks = [w for w in re.split(r"[\s,;]+|\by\b|\band\b|&", t) if w]
    if len(toks) < 2:
        return False
    ok = sum(1 for w in toks if NAME_TOKEN.match(w))
    return ok / len(toks) >= 0.8


def _split_names(text):
    t = re.sub(r"[\d\*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰]+", "", text)
    t = re.sub(r"(?<=[a-z])ID\b", "", t)
    parts = re.split(r"\s*(?:,|;|\by\b|\band\b|&|\be\b)\s*", t)
    names = []
    for p in parts:
        p = re.sub(r"\s+", " ", p).strip(" .")
        if len(p) >= 3 and re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", p) and len(p.split()) <= 6:
            names.append(p)
    return names


def analyze_pdf_bytes(data, max_pages=80, want_figures=True):
    doc = pymupdf.open(stream=data, filetype="pdf")
    try:
        return _analyze_doc(doc, max_pages=max_pages, want_figures=want_figures)
    finally:
        doc.close()


def analyze_pdf(path, max_pages=80, want_figures=True):
    doc = pymupdf.open(path)
    try:
        return _analyze_doc(doc, max_pages=max_pages, want_figures=want_figures)
    finally:
        doc.close()


def _analyze_doc(doc, max_pages=80, want_figures=True):
    npages = min(len(doc), max_pages)
    pages_blocks = [_page_lines(doc[i]) for i in range(npages)]
    body = _body_size(pages_blocks)
    repeated = _repeated_lines(pages_blocks)

    # --- elementos lineales (párrafos y encabezados) en orden de lectura
    elements = []  # {kind: heading|para|caption, text, level, page, size, bbox}
    for pi, blocks in enumerate(pages_blocks):
        page_h = doc[pi].rect.height
        for b in blocks:
            lines = [l for l in b["lines"] if norm_key(l["text"]) not in repeated and not re.fullmatch(r"[\d\s\-–|/·.]+", l["text"])]
            if not lines:
                continue
            # pies de página al borde inferior con tamaño chico
            if b["bbox"][1] > page_h * 0.93 and all(l["size"] < body for l in lines):
                continue
            run = [lines[0]]
            for l in lines[1:]:
                if abs(l["size"] - run[-1]["size"]) > 1.4 and (run[-1]["size"] >= body + 1.2 or l["size"] >= body + 1.2):
                    _emit_block(elements, run, body, pi)
                    run = [l]
                else:
                    run.append(l)
            _emit_block(elements, run, body, pi)

    # --- título
    title, title_idx = _find_title(elements, body)
    # --- autores / afiliación
    authors, affiliation = _find_authors(elements, title_idx, body)
    meta = doc.metadata or {}
    if not authors and meta.get("author"):
        a = re.sub(r"\s+", " ", meta["author"]).strip()
        if a and not re.search(r"user|usuario|admin|microsoft|adobe|windows", a, re.I):
            if re.fullmatch(r"[^,]+,\s*[^,]+", a) and " y " not in a and " and " not in a:
                ap, nom = [x.strip() for x in a.split(",")]
                a = nom + " " + ap
                authors = [a]
            else:
                authors = _split_names(a) if "," in a or " y " in a or " and " in a else [a]
    if (not title or len(title) < 8) and meta.get("title"):
        mt = meta["title"].strip()
        if mt and not re.search(r"microsoft word|untitled|sin t[ií]tulo|\.docx?$|\.pdf$|^redalyc\.", mt, re.I) and len(mt.split()) >= 3:
            title = mt
    if meta.get("title") and re.match(r"^redalyc\.", meta["title"], re.I) and (not title or len(title) < 8):
        title = re.sub(r"^redalyc\.", "", meta["title"], flags=re.I).strip()

    full_text = "\n".join(e["text"] for e in elements if e["kind"] == "para")
    lang = detect_lang(full_text)

    # --- secciones
    sections, abstract, keywords, references = _build_sections(elements, title_idx, lang)
    if not keywords and meta.get("keywords"):
        keywords = [k.strip() for k in re.split(r"[;,]", meta["keywords"]) if k.strip()][:10]

    # --- puntuación de oraciones
    df = _doc_freq(sections, abstract, lang)
    for s in sections:
        _score_section(s, df, lang)

    # --- fuente (revista / año)
    source = _find_source(elements[: min(len(elements), 40)], meta)

    figures = _extract_figures(doc, npages, elements) if want_figures else []

    subtitle = ""
    for e in elements:
        if e["kind"] == "subtitle" and not e.get("is_title") and e["text"] != title:
            subtitle = e["text"]
            break
    outline = {
        "title": title or (meta.get("title") or "").strip() or "Presentación",
        "subtitle": subtitle,
        "authors": authors[:8],
        "affiliation": affiliation,
        "source": source,
        "language": lang,
        "abstract": abstract,
        "keywords": keywords[:12],
        "sections": sections,
        "figures": figures,
        "references": references[:40],
        "stats": {"pages": len(doc), "words": len(words(full_text)), "sections": len(sections), "figures": len(figures)},
    }
    return outline


def _emit_block(elements, lines, body, pi):
    """Clasifica un bloque: puede ser encabezado, párrafo, o encabezado+párrafo pegados."""
    first = lines[0]
    text_all = fix_hyphenation("\n".join(l["text"] for l in lines))
    sizes = [l["size"] for l in lines]
    bsize = sum(sizes) / len(sizes)
    letters = sum(1 for c in text_all if c.isalpha())
    headingish = letters >= 3 and letters / max(1, len(text_all.replace(" ", ""))) > 0.72 and not re.search(r"\(p\s*[=<>]|\bN\s*=|=|\d+[.,]\d+\s*\(|^\d+\s*$|^[A-Z]{1,4}\d*$", text_all) and not _is_name_line(text_all) and not re.search(r"^(incuapa|conicet|total|masc|fem)\b", text_all, re.I)

    # título de sección como bloque corto
    if headingish and len(text_all) <= 120 and (bsize >= body + 1.2 or (first["bold"] and all(l["bold"] for l in lines)) or HEADING_RE.match(text_all) or (first["caps"] > 0.85 and len(text_all) > 3 and len(lines) <= 2)) and not re.search(r"[.;,]\s*$", text_all) or HEADING_RE.match(text_all) and len(text_all) <= 60:
        if bsize >= body + 1.2 and not HEADING_RE.match(text_all) and _is_subtitle_zone(elements):
            elements.append({"kind": "subtitle", "text": text_all, "page": pi, "size": bsize})
            return
        if CAPTION_RE.match(text_all) and len(text_all) > 40:
            elements.append({"kind": "caption", "text": text_all, "page": pi, "size": bsize})
            return
        lvl = 1 if (bsize >= body + 1.2 or HEADING_RE.match(text_all)) else 2
        if NUMBERED_RE.match(text_all) and re.match(r"^\s*\d+\.\d+", text_all):
            lvl = 2
        if lvl == 2 and len(text_all.split()) > 7 and not NUMBERED_RE.match(text_all):
            elements.append({"kind": "para", "text": text_all, "page": pi, "size": bsize, "small": True})
            return
        elements.append({"kind": "heading", "text": re.sub(r"\s*[:.]$", "", text_all), "level": lvl, "page": pi, "size": bsize, "caps": first["caps"]})
        return

    if CAPTION_RE.match(text_all) and len(text_all) <= 400:
        elements.append({"kind": "caption", "text": text_all, "page": pi, "size": bsize})
        return

    # encabezado inline: "RESUMEN La exostosis..." o "Palabras clave: ..."
    m = KEYWORDS_RE.match(text_all)
    if m:
        elements.append({"kind": "keywords", "text": m.group(2) or text_all, "page": pi, "size": bsize})
        # a veces el bloque continúa con otro párrafo (Abstract) en la misma caja
        return
    if ABSTRACT_RE.match(text_all) and (first["lead_bold"] or first["lead_text"].isupper() or first["caps"] > 0.5 or re.match(r"^\s*(resumen|abstract|resumo|summary)\s*[:.\-–—]", text_all, re.I)):
        body_txt = re.sub(r"^\s*(resumen|abstract|resumo|summary)\s*[:.\-–—]*\s*", "", text_all, flags=re.I)
        elements.append({"kind": "heading", "text": re.match(r"^\s*(\w+)", text_all).group(1).capitalize(), "level": 1, "page": pi, "size": bsize, "caps": 1})
        if body_txt:
            elements.append({"kind": "para", "text": body_txt, "page": pi, "size": bsize})
        return
    # primera línea corta en negrita seguida de párrafo → encabezado + párrafo
    if len(lines) > 1 and first["bold"] and not lines[1]["bold"] and len(first["text"]) <= 90 and not re.search(r"[.;,]\s*$", first["text"]) and not _is_name_line(first["text"]):
        elements.append({"kind": "heading", "text": first["text"].strip(" :."), "level": 2, "page": pi, "size": first["size"], "caps": first["caps"]})
        rest = fix_hyphenation("\n".join(l["text"] for l in lines[1:]))
        if rest:
            elements.append({"kind": "para", "text": rest, "page": pi, "size": bsize})
        return
    # párrafo normal; separa si hay varias "oraciones" con líneas que empiezan con viñeta
    if all(re.match(r"^[•·\-–—▪■●\*]\s", l["text"]) for l in lines) and len(lines) >= 2:
        for l in lines:
            elements.append({"kind": "para", "text": re.sub(r"^[•·\-–—▪■●\*]\s*", "", l["text"]), "page": pi, "size": bsize, "bullet": True})
        return
    if bsize < body - 1.6 and len(text_all) < 400 and re.search(r"@|doi|http|recibido|aceptado|received|accepted|correspond|financ|funding|issn|©", text_all, re.I):
        return  # notas administrativas
    elements.append({"kind": "para", "text": text_all, "page": pi, "size": bsize, "small": bsize < body - 1.2})


def _is_subtitle_zone(elements):
    """Entre el título y el resumen: lo grande que aparezca es subtítulo (p. ej. título en inglés)."""
    has_title = any(e.get("is_title") for e in elements)
    if has_title:
        return True
    big = [e for e in elements if e["kind"] in ("heading", "subtitle")]
    return 0 < len(big) <= 3 and all(e["page"] == 0 for e in elements) and not any(HEADING_RE.match(e["text"]) for e in big)


def _find_title(elements, body):
    cands = []
    for i, e in enumerate(elements):
        if e["page"] > 2:
            break
        if e["kind"] not in ("heading", "para", "subtitle"):
            continue
        t = e["text"]
        nw = len(t.split())
        if 2 <= nw <= 40 and e["size"] >= body + 1.5 and not HEADING_RE.match(t) and not re.search(r"@|http|issn|doi|redalyc|www\.", t, re.I):
            cands.append((e["size"], -i, i))
    if not cands:
        for i, e in enumerate(elements[:12]):
            if e["kind"] == "heading" and 2 <= len(e["text"].split()) <= 40 and not HEADING_RE.match(e["text"]):
                return e["text"], i
        return "", -1
    cands.sort(reverse=True)
    size, _, i = cands[0]
    # une líneas/elementos contiguos del mismo tamaño (títulos partidos en bloques)
    parts = [elements[i]["text"]]
    j = i + 1
    while j < len(elements) and elements[j]["kind"] in ("heading", "para", "subtitle") and abs(elements[j]["size"] - size) < 0.6 and elements[j]["page"] == elements[i]["page"] and len(" ".join(parts).split()) < 40:
        parts.append(elements[j]["text"])
        j += 1
    title = fix_hyphenation(" ".join(parts))
    title = re.sub(r"\s+", " ", title).strip(" .")
    if title.isupper():
        title = _smart_title_case(title)
    for k in range(i, j):
        elements[k]["is_title"] = True
    return title, i


def _smart_title_case(t):
    small = {"de", "del", "la", "las", "los", "el", "y", "e", "o", "u", "en", "a", "al", "con", "por", "para", "un", "una", "the", "of", "and", "in", "on", "for", "to", "an", "from", "sobre", "entre", "hacia", "desde", "sin", "vs"}
    roman = re.compile(r"^[IVXLCDM]{1,6}$")
    abbr = {"AP", "BP", "DC", "AC", "ADN", "DNA", "ARN", "RNA", "UBA", "EPH", "ONU", "UE", "EEUU", "EE", "UU", "OMS", "INDEC", "CONICET", "UNLP", "OIT"}
    out = []
    for k, w in enumerate(t.split()):
        core = w.strip("(),.;:¿?¡!\"“”")
        if roman.match(core) or core in abbr or (len(core) <= 4 and core.isupper() and any(c in "BCDFGHJKLMNPQRSTVWXZ" for c in core) and not re.search(r"[AEIOU]{2}", core) and core.lower() not in small and k > 0):
            out.append(w)
            continue
        lw = w.lower()
        if k > 0 and lw in small:
            out.append(lw)
        else:
            out.append(lw[0].upper() + lw[1:] if lw else lw)
    return " ".join(out)


def _find_authors(elements, title_idx, body):
    if title_idx < 0:
        return [], ""
    authors, aff = [], []
    j = title_idx + 1
    # salta el resto del título si quedó partido
    while j < len(elements) and elements[j].get("is_title"):
        j += 1
    steps = 0
    while j < len(elements) and steps < 10:
        e = elements[j]
        if e["kind"] == "heading" and (HEADING_RE.match(e["text"]) or e["text"].lower() in ("resumen", "abstract")):
            break
        t = e["text"]
        if e["kind"] in ("para", "heading", "subtitle") and len(t) < 400 and not authors:
            mi = INSTITUTION_RE.search(t)
            if mi and mi.start() > 6 and _is_name_line(t[:mi.start()]):
                authors = _split_names(t[:mi.start()])
                aff.append(t[mi.start():])
                j += 1
                steps += 1
                continue
        if e["kind"] in ("para", "heading") and len(t) < 260:
            if _is_name_line(t) and not authors:
                authors = _split_names(t)
            elif _is_name_line(t) and authors and not aff:
                authors += _split_names(t)
            elif INSTITUTION_RE.search(t) and len(t) < 260 and not re.search(r"@|doi|http|issn", t, re.I):
                aff.append(re.sub(r"^[\d\*,\s]+", "", t))
        if authors and aff and len(aff) >= 1 and not _is_name_line(t):
            if len(aff) >= 2:
                break
        if e["kind"] == "para" and len(t) > 300:
            break
        j += 1
        steps += 1
    affiliation = ""
    if aff:
        a = re.split(r"[.;]\s|\s\d\s", aff[0])[0]
        a = re.sub(r"^\d+\s*", "", a).strip(" .,;")
        affiliation = a[:140]
    return [a for a in authors if 2 <= len(a.split()) <= 6][:10], affiliation


def _find_source(elements, meta):
    txt = " ".join(e["text"] for e in elements)
    m = re.search(r"\b(?:Rev(?:ista)?\.?\s[^.,;|]{3,60}|[A-Z][A-Za-z&\s]{2,40}Journal[^.,;|]{0,40}|PLOS\s\w+|Nómadas|Panorama Social)[^.;|]{0,40}?\b(1[5-9]\d{2}|20\d{2})\b", txt)
    if m:
        return re.sub(r"\s+", " ", m.group(0)).strip()[:120]
    years = YEAR_RE.findall(txt[:3000])
    y = ""
    if years:
        y = collections.Counter(yy for yy in years).most_common(1)[0][0]
    subj = (meta.get("subject") or "").strip()
    if subj and len(subj) < 160 and "\n" not in subj:
        return subj
    return y


def _build_sections(elements, title_idx, lang):
    sections = []
    abstract = ""
    keywords = []
    references = []
    cur = None
    in_refs = False
    in_abstract = False
    skip_section = False
    for i, e in enumerate(elements):
        if i <= title_idx or e.get("is_title"):
            continue
        if e["kind"] == "keywords":
            if not keywords:
                keywords = [k.strip(" .;") for k in re.split(r"[;,·•|]", e["text"]) if k.strip(" .;")][:12]
            continue
        if e["kind"] in ("caption", "subtitle"):
            continue
        if e["kind"] == "heading":
            t = e["text"]
            if REF_HEAD_RE.match(t):
                in_refs = True
                cur = None
                continue
            in_refs = False
            if re.match(r"^\s*(\d+\.?\s*)?(resumen|abstract|resumo|summary)\s*$", t, re.I):
                in_abstract = not bool(abstract)
                skip_section = True
                cur = None
                continue
            in_abstract = False
            skip_section = bool(re.match(r"^\s*(\d+\.?\s*)?(agradecimientos?|acknowledg?ments?|anexos?|ap[eé]ndices?|appendix|notas?|notes|financiamiento|funding|conflicto de inter|competing interests|declaraci[oó]n|palabras clave|keywords?|author contributions?|contribuci[oó]n de (los )?autores|supporting information|data availability|disponibilidad de datos|informaci[oó]n suplementaria|supplementary|correspondencia|ethics|[eé]tica)\b", t, re.I))
            if skip_section:
                cur = None
                continue
            if cur is not None and cur.get("implicit") and sum(len(p.split()) for p in cur["paragraphs"]) < 260:
                carry = cur["paragraphs"]
                sections.remove(cur)
                cur = {"heading": _clean_heading(t), "level": e["level"], "paragraphs": carry, "page": e["page"]}
                sections.append(cur)
            elif cur is None or cur["paragraphs"] or e["level"] <= cur["level"]:
                cur = {"heading": _clean_heading(t), "level": e["level"], "paragraphs": [], "page": e["page"]}
                sections.append(cur)
            else:
                # dos encabezados seguidos: el segundo es subtítulo del primero
                cur["heading"] = cur["heading"] + " · " + _clean_heading(t) if len(cur["heading"]) < 40 else cur["heading"]
            continue
        # párrafo
        if in_refs:
            references.extend(_split_refs(e["text"]))
            continue
        if in_abstract:
            if len(abstract) < 2500:
                abstract = (abstract + " " + e["text"]).strip()
            continue
        if skip_section:
            continue
        if e.get("small") and len(e["text"]) < 400:
            continue
        if _is_name_line(e["text"]) or re.match(r"^\s*\d+\s*/\s*\d+\s*$", e["text"]):
            continue
        if cur is None:
            cur = {"heading": "Introducción" if lang == "es" else "Introduction", "level": 1, "paragraphs": [], "page": e["page"], "implicit": True}
            sections.append(cur)
        cur["paragraphs"].append(e["text"])

    # fusiona secciones vacías y muy cortas
    merged = []
    total = sum(len(p.split()) for s in sections for p in s["paragraphs"])
    lo, hi = (12, 30) if total < 1500 else (40, 90)
    for s in sections:
        wc = sum(len(p.split()) for p in s["paragraphs"])
        if not s["paragraphs"]:
            continue
        if not merged and wc < lo:
            continue
        if merged and norm_key(merged[-1]["heading"]) == norm_key(s["heading"]):
            merged[-1]["paragraphs"].extend(s["paragraphs"])
            continue
        if merged and (wc < lo or s["level"] > 1 and wc < hi) and merged[-1]["level"] <= s["level"]:
            merged[-1]["paragraphs"].extend(s["paragraphs"])
            continue
        merged.append(s)
    # si el resumen no se detectó por encabezado, busca "Resumen" al inicio de un párrafo
    if not abstract:
        for s in merged[:2]:
            for p in s["paragraphs"][:3]:
                if ABSTRACT_RE.match(p):
                    abstract = re.sub(r"^\s*(resumen|abstract|resumo|summary)\s*[:.\-–—]*\s*", "", p, flags=re.I)
                    break
    refs = []
    seen = set()
    for r in references:
        k = norm_key(r)[:60]
        if len(r) > 25 and k not in seen and (YEAR_RE.search(r) or "," in r) and sum(1 for c in r if c.isalpha()) / max(1, len(r)) > 0.55:
            seen.add(k)
            refs.append(r)
    return merged, abstract.strip(), keywords, refs


def _clean_heading(t):
    t = re.sub(r"^\s*(\d+(\.\d+)*\.?|[IVX]{1,4}\.?|[A-Z]\.)\s+", "", t).strip(" :.-–—")
    if t.isupper() and len(t) > 3:
        t = t[0] + t[1:].lower()
    return t[:90]


def _split_refs(text):
    # entradas separadas por patrón Apellido, X. (año) o línea con año
    if re.match(r"^\s*(\[\d+\]|\d{1,3}\.)\s", text) and len(re.findall(r"(^|\s)(\[\d+\]|\d{1,3}\.)\s+[A-Z]", text)) >= 2:
        parts = re.split(r"\s+(?=(?:\[\d+\]|\d{1,3}\.)\s+[A-ZÁÉÍÓÚÑ])", text)
    else:
        parts = re.split(r"(?<=[.)])\s+(?=[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'\-]+,\s)", text)
    out = []
    for p in parts:
        p = p.strip()
        if len(p) < 20:
            if out:
                out[-1] += " " + p
            continue
        out.append(p)
    return out


def _doc_freq(sections, abstract, lang):
    c = collections.Counter()
    for s in sections:
        for p in s["paragraphs"]:
            c.update(set(content_words(p, lang)))
    if abstract:
        c.update(content_words(abstract, lang))
    return c


def _score_section(sec, df, lang):
    paras = sec["paragraphs"]
    sents = []
    for pi, p in enumerate(paras):
        ss = split_sentences(p)
        for si, s in enumerate(ss):
            sents.append({"text": s, "first": si == 0, "pos": pi / max(1, len(paras))})
    total = sum(df.values()) or 1
    scored = []
    for s in sents:
        t = s["text"]
        ws = content_words(t, lang)
        nw = len(t.split())
        if nw < 6 or nw > 70 or not ws:
            continue
        if re.search(r"^(figura|fig\.|tabla|table|figure|cuadro|gr[aá]fico)\b", t, re.I):
            continue
        if re.search(r"\b(doi|http|www\.|issn|©)\b", t, re.I):
            continue
        uniq = set(ws)
        base = sum(math.log1p(df.get(w, 0)) for w in uniq) / (len(ws) ** 0.65)
        score = base
        if NUM_RE.search(t) or re.search(r"\d+(?:[.,]\d+)?\s?%", t):
            score *= 1.25
        if CUE_RE.search(t):
            score *= 1.2
        if s["first"]:
            score *= 1.12
        cites = len(CITE_RE.findall(t))
        if cites >= 2:
            score *= 0.8
        if nw > 45:
            score *= 0.85
        if re.search(r"\b(este trabajo|este artículo|en este apartado|a continuación|this paper|this article|in this section|the following)\b", t, re.I) and not re.search(r"objetivo|aim|propósito|purpose", t, re.I):
            score *= 0.75
        if re.search(r"\?$", t.strip()):
            score *= 1.1
        scored.append((score, t))
    scored.sort(key=lambda x: -x[0])
    picked = []
    for sc, t in scored:
        ct = condense(t)
        if len(ct.split()) < 5:
            continue
        cw = set(content_words(ct, lang))
        if any(_jaccard(cw, set(content_words(p, lang))) > 0.45 for p in picked):
            continue
        picked.append(ct)
        if len(picked) >= 6:
            break
    sec["key_sentences"] = picked
    sec["word_count"] = sum(len(p.split()) for p in paras)
    sec["numbers"] = _numbers(paras, lang)
    sec["question"] = next((condense(s["text"]) for s in sents if s["text"].strip().endswith("?") and 5 <= len(s["text"].split()) <= 25), "")


def _jaccard(a, b):
    if not a or not b:
        return 0
    return len(a & b) / len(a | b)


def _numbers(paras, lang):
    out = []
    seen = set()
    for p in paras:
        for s in split_sentences(p):
            for m in NUM_RE.finditer(s):
                val = m.group(1)
                unit = m.group(2)
                if unit.lower() in ("mil",) and re.search(r"\bmil\s+(novecientos|ochocientos)", s, re.I):
                    continue
                key = (val, unit.lower())
                if key in seen:
                    continue
                seen.add(key)
                big = val + (" %" if unit == "%" else " " + unit)
                out.append({"value": big.replace("por ciento", "%"), "context": condense(s, 22)})
                if len(out) >= 8:
                    return out
    return out


def _extract_figures(doc, npages, elements, max_figs=14):
    figs = []
    captions = [e for e in elements if e["kind"] == "caption"]
    seen_xref = set()
    for pi in range(npages):
        page = doc[pi]
        page_caps = [c["text"] for c in captions if c["page"] == pi]
        rects = []
        # imágenes raster
        for img in page.get_images(full=True):
            xref = img[0]
            if xref in seen_xref:
                continue
            try:
                for r in page.get_image_rects(xref):
                    if r.width < 90 or r.height < 70:
                        continue
                    rects.append(("img", xref, r))
            except Exception:
                continue
        # dibujos vectoriales (gráficos)
        try:
            for r in page.cluster_drawings(drift=12):
                if r.width >= 150 and r.height >= 110 and r.width * r.height > 25000:
                    rects.append(("vec", None, r))
        except Exception:
            pass
        # dedupe por solapamiento (prefiere raster)
        kept = []
        for kind, xref, r in rects:
            if any(_overlap(r, k[2]) > 0.6 for k in kept):
                continue
            kept.append((kind, xref, r))
        for kind, xref, r in kept:
            if len(figs) >= max_figs:
                return figs
            try:
                clip = pymupdf.Rect(r)
                if kind == "vec":
                    clip = clip + (-6, -6, 6, 6)
                clip = clip & page.rect
                if clip.is_empty or clip.width < 60 or clip.height < 50:
                    continue
                zoom = min(2.5, max(1.0, 1400 / max(clip.width, 1)))
                pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=False)
                if pix.width < 120 or pix.height < 90:
                    continue
                if _is_blank(pix):
                    continue
                png = pix.tobytes("png")
                if len(png) > 2_500_000:
                    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom / 2, zoom / 2), clip=clip, alpha=False)
                    png = pix.tobytes("png")
                if xref is not None:
                    seen_xref.add(xref)
                cap = _nearest_caption(page, r, page_caps)
                figs.append({
                    "id": "fig%d" % (len(figs) + 1), "page": pi + 1, "kind": kind,
                    "caption": cap, "w": pix.width, "h": pix.height,
                    "data": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
                })
            except Exception:
                continue
    return figs


def _is_blank(pix):
    try:
        import struct
        n = pix.n
        s = pix.samples
        step = max(1, len(s) // (4000 * n)) * n
        vals = s[::step]
        if not vals:
            return True
        mean = sum(vals) / len(vals)
        var = sum((v - mean) ** 2 for v in vals) / len(vals)
        return var < 40
    except Exception:
        return False


def _overlap(a, b):
    inter = a & b
    if inter.is_empty:
        return 0
    return inter.get_area() / min(a.get_area(), b.get_area())


def _nearest_caption(page, rect, page_caps):
    if not page_caps:
        return ""
    best, bd = "", 1e9
    for blk in page.get_text("blocks"):
        txt = re.sub(r"\s+", " ", blk[4]).strip()
        if not CAPTION_RE.match(txt):
            continue
        br = pymupdf.Rect(blk[:4])
        dy = min(abs(br.y0 - rect.y1), abs(rect.y0 - br.y1))
        dx = 0 if (br.x0 < rect.x1 and br.x1 > rect.x0) else min(abs(br.x0 - rect.x1), abs(rect.x0 - br.x1))
        d = dy + dx * 2
        if d < bd:
            bd, best = d, txt
    if bd > 260:
        return page_caps[0] if len(page_caps) == 1 else ""
    return best[:300]


# ---------------------------------------------------------------- texto plano / markdown


def analyze_text(text, title_hint=""):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [l.rstrip() for l in text.split("\n")]
    elements = []
    para = []

    def flush():
        if para:
            t = " ".join(para).strip()
            if t:
                elements.append({"kind": "para", "text": re.sub(r"\s+", " ", t), "page": 0, "size": 10})
            para.clear()

    for raw in lines:
        l = raw.strip()
        if not l:
            flush()
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", l)
        if m:
            flush()
            elements.append({"kind": "heading", "text": m.group(2).strip(" #"), "level": min(2, len(m.group(1))), "page": 0, "size": 14 if len(m.group(1)) == 1 else 12, "caps": 0})
            continue
        km = KEYWORDS_RE.match(l)
        if km:
            flush()
            elements.append({"kind": "keywords", "text": km.group(2), "page": 0, "size": 10})
            continue
        if re.match(r"^[\-\*•·]\s+", l):
            flush()
            elements.append({"kind": "para", "text": re.sub(r"^[\-\*•·]\s+", "", l), "page": 0, "size": 10, "bullet": True})
            continue
        if (len(l) <= 80 and not re.search(r"[.;,:]$", l) and (HEADING_RE.match(l) or NUMBERED_RE.match(l) or l.isupper() or (len(l.split()) <= 8 and not para and l[0].isupper()))):
            flush()
            elements.append({"kind": "heading", "text": l, "level": 1 if (HEADING_RE.match(l) or l.isupper()) else 2, "page": 0, "size": 12, "caps": 1 if l.isupper() else 0})
            continue
        para.append(l)
    flush()

    title = title_hint.strip()
    title_idx = -1
    if not title:
        for i, e in enumerate(elements[:3]):
            if e["kind"] == "heading" and not HEADING_RE.match(e["text"]):
                title, title_idx = e["text"], i
                break
    if not title:
        # primera oración corta
        for e in elements:
            if e["kind"] == "para":
                title = short_title(split_sentences(e["text"])[0], 9)
                break
    lang = detect_lang(text)
    sections, abstract, keywords, references = _build_sections(elements, title_idx, lang)
    df = _doc_freq(sections, abstract, lang)
    for s in sections:
        _score_section(s, df, lang)
    return {
        "title": title or "Presentación", "subtitle": "", "authors": [], "affiliation": "", "source": "", "language": lang,
        "abstract": abstract, "keywords": keywords, "sections": sections, "figures": [], "references": references[:40],
        "stats": {"pages": 0, "words": len(words(text)), "sections": len(sections), "figures": 0},
    }


def merge_outlines(outlines):
    """Varios PDF → un esquema: el primero manda en título/autores; las secciones se concatenan con prefijo."""
    if len(outlines) == 1:
        return outlines[0]
    base = dict(outlines[0])
    base["sections"] = []
    base["figures"] = []
    base["references"] = []
    kws = []
    for o in outlines:
        for s in o["sections"]:
            s = dict(s)
            if len(outlines) > 1 and o is not outlines[0]:
                s["heading"] = (short_title(o["title"], 4) + " · " + s["heading"])[:90]
            base["sections"].append(s)
        base["figures"].extend(o["figures"])
        base["references"].extend(o["references"])
        kws.extend(o["keywords"])
    seen = set()
    base["keywords"] = [k for k in kws if not (norm_key(k) in seen or seen.add(norm_key(k)))][:12]
    base["stats"] = {"pages": sum(o["stats"]["pages"] for o in outlines), "words": sum(o["stats"]["words"] for o in outlines), "sections": len(base["sections"]), "figures": len(base["figures"])}
    base["documents"] = [{"title": o["title"], "authors": o["authors"], "source": o["source"]} for o in outlines]
    return base
