# -*- coding: utf-8 -*-
"""API compartida entre la ventana nativa (pywebview) y el modo navegador (servidor local)."""
import base64
import json
import os
import sys
import threading
import urllib.request
import urllib.error

from . import extract, plan

SETTINGS_DIR = os.path.join(os.path.expanduser("~"), ".lienzo")
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "settings.json")


def _load_settings():
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _save_settings(data):
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)


class Api(object):
    """Métodos invocables desde JS. Todos reciben/devuelven JSON simple."""

    def __init__(self, window_getter=None):
        self._window_getter = window_getter

    # ---- utilidades
    def ping(self):
        return {"ok": True, "version": VERSION}

    def get_settings(self):
        s = _load_settings()
        s.setdefault("presenter", "")
        s.setdefault("ollama_url", "http://localhost:11434")
        s.setdefault("ollama_model", "")
        return s

    def set_settings(self, data):
        s = _load_settings()
        s.update(data or {})
        _save_settings(s)
        return {"ok": True}

    # ---- análisis
    def analyze_files(self, files, options=None):
        """files: [{name, b64}] (PDF o .txt/.md). Devuelve esquema + láminas."""
        options = options or {}
        outlines = []
        errors = []
        for f in files or []:
            name = f.get("name", "documento")
            try:
                raw = base64.b64decode(f.get("b64", "").split(",")[-1])
                if name.lower().endswith(".pdf") or raw[:5] == b"%PDF-":
                    outlines.append(extract.analyze_pdf_bytes(raw, max_pages=int(options.get("max_pages", 80)), want_figures=bool(options.get("figures", True))))
                else:
                    outlines.append(extract.analyze_text(raw.decode("utf-8", "replace"), title_hint=os.path.splitext(name)[0]))
            except Exception as e:  # noqa
                errors.append("%s: %s" % (name, e))
        if not outlines:
            return {"error": "No se pudo leer ningún archivo. " + "; ".join(errors)}
        outline = extract.merge_outlines(outlines)
        slides = plan.plan_slides(outline, max_slides=int(options.get("max_slides", 14)), presenter=options.get("presenter", ""), event=options.get("event", ""))
        return {"outline": _light_outline(outline), "slides": slides, "warnings": errors}

    def analyze_paths(self, paths, options=None):
        files = []
        for p in paths or []:
            try:
                with open(p, "rb") as fh:
                    files.append({"name": os.path.basename(p), "b64": base64.b64encode(fh.read()).decode("ascii")})
            except Exception as e:  # noqa
                return {"error": "No se pudo abrir %s: %s" % (p, e)}
        return self.analyze_files(files, options)

    def analyze_text(self, text, options=None):
        options = options or {}
        outline = extract.analyze_text(text or "", title_hint=options.get("title", ""))
        slides = plan.plan_slides(outline, max_slides=int(options.get("max_slides", 14)), presenter=options.get("presenter", ""), event=options.get("event", ""))
        return {"outline": _light_outline(outline), "slides": slides, "warnings": []}

    def replan(self, outline, options=None):
        """Vuelve a armar las láminas desde el esquema guardado (p. ej. con otro máximo de láminas)."""
        options = options or {}
        slides = plan.plan_slides(outline, max_slides=int(options.get("max_slides", 14)), presenter=options.get("presenter", ""), event=options.get("event", ""))
        return {"slides": slides}

    # ---- archivos (modo nativo)
    def pick_files(self, kind="pdf"):
        w = self._window_getter() if self._window_getter else None
        if w is None:
            return {"paths": []}
        import webview  # noqa
        if kind == "pdf":
            types = ("Documentos (*.pdf;*.txt;*.md)", "Todos los archivos (*.*)")
        elif kind == "image":
            types = ("Imágenes (*.png;*.jpg;*.jpeg;*.svg;*.webp)",)
        else:
            types = ("Proyecto Lienzo (*.lienzo.json;*.json)",)
        res = w.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=(kind == "pdf"), file_types=types)
        return {"paths": list(res or [])}

    def read_file_b64(self, path):
        with open(path, "rb") as fh:
            data = fh.read()
        ext = os.path.splitext(path)[1].lower().strip(".")
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "webp": "image/webp", "json": "application/json"}.get(ext, "application/octet-stream")
        return {"name": os.path.basename(path), "data": "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))}

    def save_file(self, suggested_name, content, kind="html"):
        """Guarda con diálogo nativo. En modo navegador el JS descarga el archivo por su cuenta."""
        w = self._window_getter() if self._window_getter else None
        if w is None:
            return {"saved": False, "reason": "no-window"}
        import webview  # noqa
        types = ("Presentación HTML (*.html)",) if kind == "html" else ("Proyecto Lienzo (*.lienzo.json)",)
        s = _load_settings()
        directory = s.get("last_dir") or os.path.join(os.path.expanduser("~"), "Documents")
        if not os.path.isdir(directory):
            directory = os.path.expanduser("~")
        res = w.create_file_dialog(webview.SAVE_DIALOG, directory=directory, save_filename=suggested_name, file_types=types)
        if not res:
            return {"saved": False, "reason": "cancel"}
        path = res if isinstance(res, str) else res[0]
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        s["last_dir"] = os.path.dirname(path)
        _save_settings(s)
        return {"saved": True, "path": path}

    def preview_file(self, content):
        """Escribe la presentación en ~/.lienzo y la abre en el navegador del sistema (para presentar)."""
        import webbrowser
        os.makedirs(SETTINGS_DIR, exist_ok=True)
        path = os.path.join(SETTINGS_DIR, "vista_previa.html")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        webbrowser.open("file://" + os.path.abspath(path))
        return {"ok": True, "path": path}

    def open_path(self, path):
        import webbrowser
        webbrowser.open("file://" + os.path.abspath(path))
        return {"ok": True}

    # ---- IA local (Ollama)
    def ollama_models(self, url):
        try:
            with urllib.request.urlopen((url or "http://localhost:11434").rstrip("/") + "/api/tags", timeout=4) as r:
                data = json.loads(r.read().decode("utf-8"))
            return {"ok": True, "models": [m.get("name") for m in data.get("models", [])]}
        except Exception as e:  # noqa
            return {"ok": False, "error": str(e)}

    def ollama_generate(self, url, model, prompt):
        body = json.dumps({"model": model, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.3, "num_ctx": 16384}}).encode("utf-8")
        req = urllib.request.Request((url or "http://localhost:11434").rstrip("/") + "/api/generate", data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read().decode("utf-8"))
            return {"ok": True, "text": data.get("response", "")}
        except urllib.error.URLError as e:
            return {"ok": False, "error": "No se pudo conectar con Ollama (%s)." % e}
        except Exception as e:  # noqa
            return {"ok": False, "error": str(e)}


VERSION = "1.0.0"


def _light_outline(o):
    """Esquema sin las imágenes (ya viajan dentro de las láminas) para guardar en el proyecto."""
    out = dict(o)
    out["figures"] = [{k: v for k, v in f.items() if k != "data"} for f in o.get("figures", [])]
    return out
