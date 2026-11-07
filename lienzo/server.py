# -*- coding: utf-8 -*-
"""Modo navegador: sirve la interfaz en http://127.0.0.1:PUERTO y expone la API por POST /api/<método>."""
import json
import mimetypes
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .api import Api

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")


def make_handler(api):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # silencio
            pass

        def _send(self, code, body, ctype="application/json; charset=utf-8"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/":
                path = "/index.html"
            fp = os.path.normpath(os.path.join(UI_DIR, path.lstrip("/")))
            if not fp.startswith(UI_DIR) or not os.path.isfile(fp):
                self._send(404, b"not found", "text/plain")
                return
            ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
                ctype += "; charset=utf-8"
            with open(fp, "rb") as fh:
                self._send(200, fh.read(), ctype)

        def do_POST(self):
            if not self.path.startswith("/api/"):
                self._send(404, b"{}")
                return
            # solo peticiones locales
            if self.client_address[0] not in ("127.0.0.1", "::1"):
                self._send(403, b"{}")
                return
            name = self.path[5:]
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            try:
                args = json.loads(raw.decode("utf-8") or "{}")
                fn = getattr(api, name, None)
                if fn is None or name.startswith("_"):
                    raise ValueError("método desconocido: " + name)
                res = fn(*args.get("args", []))
                body = json.dumps(res, ensure_ascii=False).encode("utf-8")
                self._send(200, body)
            except Exception as e:  # noqa
                self._send(500, json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8"))

    return Handler


def free_port(preferred=8765):
    for p in [preferred] + list(range(8766, 8800)):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            continue
    return 0


def serve(port=None, api=None, background=False):
    api = api or Api()
    port = port or free_port()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(api))
    if background:
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        return httpd, port
    print("Lienzo en http://127.0.0.1:%d  (Ctrl+C para salir)" % port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return httpd, port
