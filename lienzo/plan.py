# -*- coding: utf-8 -*-
"""Convierte el esquema extraído en láminas poco cargadas, listas para editar."""
import re
import uuid

from .extract import short_title, condense, norm_key, split_sentences, CUE_RE, content_words

ES = {
    "idea": "Idea fuerza", "start": "Punto de partida", "context": "Contexto", "method": "Cómo se hizo", "results": "Qué se encontró",
    "discussion": "Qué significa", "conclusions": "Lo que nos llevamos", "keywords": "Palabras clave", "refs": "Referencias",
    "closing": "Gracias", "figure": "Figura", "data": "En números", "question": "Una pregunta", "takeaway": "Para cerrar",
    "presenter": "Expositora", "sources": "Fuentes", "closing_text": "¿Preguntas, comentarios?", "ref_main": "Texto de base",
}

ROLE_RE = [
    ("abstract", re.compile(r"resumen|abstract|resumo|summary", re.I)),
    ("intro", re.compile(r"introducci|introduction|antecedentes|background|punto de partida|presentaci[oó]n|planteamiento|problema", re.I)),
    ("theory", re.compile(r"marco|teor|estado de la cuesti|literatura|review|conceptual", re.I)),
    ("objectives", re.compile(r"objetiv|objective|aims?|prop[oó]sito|hip[oó]tesis|hypothes", re.I)),
    ("method", re.compile(r"m[eé]todo|method|metodolog|materiales|materials|muestra|sample|procedimiento|dise[nñ]o|design|participantes|participants|measurement|statistical|an[aá]lisis de datos", re.I)),
    ("results", re.compile(r"resultado|results|findings|hallazgos|an[aá]lisis", re.I)),
    ("discussion", re.compile(r"discusi|discussion|interpretaci|implicaci|limitaci|limitation", re.I)),
    ("conclusions", re.compile(r"conclusi|conclusion|consideraciones finales|reflexiones finales|recomendacion|cierre|s[ií]ntesis", re.I)),
]

PRIORITY = {"intro": 3, "objectives": 3, "results": 4, "discussion": 3, "conclusions": 4, "theory": 2, "method": 2, "other": 1, "abstract": 0}


def _role(heading):
    for role, rx in ROLE_RE:
        if rx.search(heading):
            return role
    return "other"


def _id():
    return uuid.uuid4().hex[:8]


def _fmt_authors(authors):
    if not authors:
        return ""
    if len(authors) == 1:
        return authors[0]
    if len(authors) <= 3:
        return ", ".join(authors[:-1]) + " y " + authors[-1]
    return authors[0] + " et al."


def _main_reference(outline):
    a = _fmt_authors(outline.get("authors") or [])
    src = outline.get("source") or ""
    year = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", src)
    parts = []
    if a:
        parts.append(a)
    if year:
        parts.append("(%s)." % year.group(1))
    parts.append(outline.get("title", "").rstrip(".") + ".")
    if src:
        parts.append(re.sub(r"\s*\b(1[5-9]\d{2}|20\d{2})\b\s*", " ", src).strip(" ,.;") + ".")
    out = " ".join(parts).strip()
    out = re.sub(r"\s+\.", ".", out)
    out = re.sub(r"\.{2,}", ".", out)
    return out


def _idea_title(lead, lang):
    """Título corto para la lámina de idea fuerza: una etiqueta según el tipo de frase, no una repetición de la frase."""
    l = lead.lower()
    if lang == "es":
        if re.search(r"\bobjetiv|\bprop[oó]sito|\bbusca|\bpretend|\bse propone|\banaliz", l):
            return "¿Qué se buscó?"
        if re.search(r"\bresultado|\bmuestra|\bmostr|\bhallazgo|\bencontr|\bevidenci|\bregistr", l):
            return "Lo que se encontró"
        if re.search(r"\bconclu|\bsugier|\bpermite|\bimplica", l):
            return "La idea central"
        if re.search(r"\bpregunt|\bproblema|\bdebate|\binterrog", l):
            return "El problema"
        return "La idea central"
    if re.search(r"\baim|\bobjective|\bpurpose|\bwe (study|examine|analy[sz]e|investigate|propose|explore)|\bthis (paper|study|article)", l):
        return "What was the goal?"
    if re.search(r"\bresult|\bshow|\bfound|\bfinding|\bevidence|\bdemonstrat", l):
        return "What was found"
    return "The core idea"


def _dedupe(items, lang):
    out = []
    for it in items:
        cw = set(content_words(it, lang))
        if any(len(cw & set(content_words(o, lang))) / max(1, len(cw | set(content_words(o, lang)))) > 0.5 for o in out):
            continue
        out.append(it)
    return out


def _pick_lead(abstract, sections, lang):
    """Frase que resume el trabajo (objetivo / hallazgo principal)."""
    cands = []
    pool = split_sentences(abstract) if abstract else []
    if not pool:
        for s in sections[:2]:
            pool += s.get("key_sentences", [])[:3]
    for i, s in enumerate(pool):
        nw = len(s.split())
        if nw < 6 or nw > 60:
            continue
        sc = 1.0
        if re.search(r"\b(objetivo|prop[oó]sito|busca|analiza|estudia|examina|aim|purpose|we (propose|show|examine|analy[sz]e|study)|este (trabajo|art[ií]culo) )", s, re.I):
            sc += 1.0
        if CUE_RE.search(s):
            sc += 0.4
        if i == 0:
            sc += 0.3
        if re.search(r"\d", s):
            sc += 0.2
        cands.append((sc, i, s))
    if not cands:
        return "", []
    cands.sort(key=lambda x: (-x[0], x[1]))
    lead = condense(cands[0][2], 26)
    support = []
    for sc, i, s in cands[1:]:
        c = condense(s, 24)
        if norm_key(c) != norm_key(lead):
            support.append(c)
        if len(support) >= 2:
            break
    return lead, support


def plan_slides(outline, max_slides=14, presenter="", event="", logo=""):
    lang = outline.get("language", "es")
    sections = [s for s in outline.get("sections", []) if s.get("paragraphs")]
    total_words = sum(s.get("word_count", 0) for s in sections) or outline.get("stats", {}).get("words", 0)
    budget = max(6, min(max_slides, 7 + total_words // 1400))

    slides = []
    cover = {
        "id": _id(), "type": "cover", "name": "Portada",
        "eyebrow": event or (outline.get("source") and short_title(outline["source"], 6)) or "Presentación",
        "title": outline.get("title", "Presentación"),
        "subtitle": "",
        "authors": _fmt_authors(outline.get("authors") or []),
        "affiliation": outline.get("affiliation", ""),
        "badge": outline.get("source", ""),
        "presenter": presenter,
        "presenterLabel": ES["presenter"],
        "logo": logo,
    }
    sub = outline.get("subtitle", "")
    if sub and norm_key(sub) != norm_key(cover["title"]) and not re.search(r"[A-Z]{6,}", sub):
        cover["subtitle"] = sub
    slides.append(cover)

    lead, support = _pick_lead(outline.get("abstract", ""), sections, lang)
    if lead:
        slides.append({"id": _id(), "type": "idea", "name": ES["idea"], "eyebrow": ES["idea"], "title": _idea_title(lead, lang), "lead": lead, "support": support})

    kws = [k for k in outline.get("keywords", []) if 2 <= len(k) <= 40]
    if len(kws) >= 3:
        slides.append({"id": _id(), "type": "chips", "name": ES["keywords"], "eyebrow": ES["keywords"], "title": "De qué vamos a hablar", "items": kws[:8]})

    # --- selección de secciones según presupuesto
    body_budget = budget - len(slides) - 2  # refs + cierre
    figs = [f for f in outline.get("figures", []) if f.get("w", 0) >= 200 and f.get("h", 0) >= 150 and (f.get("caption") or (f.get("kind") == "vec" and f.get("w", 0) >= 500) or f.get("w", 0) * f.get("h", 0) > 500000)]
    fig_budget = min(3, len(figs), max(0, body_budget // 4))
    body_budget -= fig_budget
    ranked = sorted(range(len(sections)), key=lambda i: (-PRIORITY[_role(sections[i]["heading"])], -sections[i].get("word_count", 0)))
    chosen = set()
    for i in ranked:
        if _role(sections[i]["heading"]) == "abstract":
            continue
        if len(chosen) >= max(2, body_budget):
            break
        if not sections[i].get("key_sentences"):
            continue
        chosen.add(i)
    # las secciones de resultados con cifras merecen una lámina extra "En números"
    extra_stats = None
    for i in sorted(chosen):
        sec = sections[i]
        if _role(sec["heading"]) in ("results", "abstract") and len(sec.get("numbers", [])) >= 2 and len(chosen) < body_budget + 1:
            extra_stats = i
            break

    sec_pages = [s.get("page", 0) for s in sections]
    used_figs = 0
    for order, i in enumerate(sorted(chosen)):
        sec = sections[i]
        role = _role(sec["heading"])
        ks = _dedupe(sec.get("key_sentences", []), lang)
        if not ks:
            continue
        eyebrow = {"intro": ES["start"], "theory": ES["context"], "objectives": "Objetivo", "method": ES["method"], "results": ES["results"], "discussion": ES["discussion"], "conclusions": ES["conclusions"]}.get(role, sec["heading"])
        title = sec["heading"] if role == "other" or len(sec["heading"]) <= 60 else short_title(sec["heading"], 7)
        if role in ("intro", "theory", "discussion", "other") and len(ks) >= 3:
            items = [{"head": short_title(k, 6), "body": k} for k in ks[:4]]
            slides.append({"id": _id(), "type": "pops", "name": short_title(sec["heading"], 3), "eyebrow": eyebrow, "title": title, "items": items})
        elif role == "conclusions":
            q = sec.get("question")
            slides.append({"id": _id(), "type": "bullets", "name": ES["conclusions"], "eyebrow": ES["conclusions"], "title": title if title.lower() not in ("conclusiones", "conclusión", "conclusion", "conclusions") else "Lo que nos llevamos", "items": ks[:4]})
            strongest = max(ks, key=lambda k: (bool(CUE_RE.search(k)), -abs(len(k.split()) - 18)))
            if len(ks) >= 2 and len(slides) < budget - 1:
                slides.append({"id": _id(), "type": "quote", "name": ES["takeaway"], "eyebrow": ES["takeaway"], "text": strongest, "cite": _fmt_authors(outline.get("authors") or []) or outline.get("source", "")})
        elif role == "objectives" or sec.get("question"):
            lead_s = sec.get("question") or ks[0]
            slides.append({"id": _id(), "type": "idea", "name": short_title(sec["heading"], 3), "eyebrow": eyebrow, "title": _idea_title(lead_s, lang) if not sec.get("question") else lead_s, "lead": ks[0] if sec.get("question") else lead_s, "support": [k for k in ks[1:3]]})
        else:
            slides.append({"id": _id(), "type": "bullets", "name": short_title(sec["heading"], 3), "eyebrow": eyebrow, "title": title, "items": ks[:4]})
        if extra_stats == i:
            stats = []
            for n in sec["numbers"]:
                if any(norm_key(n["value"]) == norm_key(s_["value"]) for s_ in stats):
                    continue
                stats.append({"value": n["value"], "label": n["context"]})
                if len(stats) >= 3:
                    break
            slides.append({"id": _id(), "type": "stat", "name": ES["data"], "eyebrow": ES["data"], "title": "Los datos que importan", "stats": stats})
        # figuras de esta sección
        next_page = sec_pages[i + 1] if i + 1 < len(sec_pages) else 10 ** 6
        while used_figs < fig_budget and figs and figs[0]["page"] - 1 < next_page:
            f = figs.pop(0)
            if f["page"] - 1 < sec.get("page", 0) - 1:
                continue
            cap = f.get("caption", "")
            slides.append({"id": _id(), "type": "figure", "name": ES["figure"], "eyebrow": ES["figure"] if not cap else short_title(cap, 3), "title": re.sub(r"^\s*(figura|fig\.?|gr[aá]fico|tabla|figure|table|imagen|cuadro)\s*\.?\s*(n[°º]?\s*)?\d+[a-z]?\s*[.:\-–—]?\s*", "", cap, flags=re.I)[:140] or sec["heading"], "image": f["data"], "caption": cap, "note": ""})
            used_figs += 1

    # referencias
    refs = outline.get("references", [])
    main_ref = _main_reference(outline)
    picked = [r for r in refs if re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", r)]
    picked = sorted(picked, key=lambda r: len(r))[:6]
    picked.sort()
    slides.append({"id": _id(), "type": "refs", "name": ES["refs"], "eyebrow": ES["sources"], "title": ES["refs"], "main": main_ref, "items": picked})
    slides.append({"id": _id(), "type": "closing", "name": ES["closing"], "title": "Gracias", "text": ES["closing_text"], "presenter": presenter, "contact": "", "logo": logo})

    for k, s in enumerate(slides):
        s.setdefault("notes", "")
    return slides


def plan_from_outline(outline, **kw):
    return {"outline_summary": {"title": outline.get("title"), "authors": outline.get("authors"), "sections": [s["heading"] for s in outline.get("sections", [])], "stats": outline.get("stats")}, "slides": plan_slides(outline, **kw)}
