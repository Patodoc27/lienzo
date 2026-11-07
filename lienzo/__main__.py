# -*- coding: utf-8 -*-
"""Punto de entrada: `python -m lienzo` abre la ventana nativa; `python -m lienzo --web` usa el navegador."""
import argparse
import os
import sys
import webbrowser

from .api import Api
from . import server


def main(argv=None):
    ap = argparse.ArgumentParser(prog="lienzo", description="Lienzo: presentaciones con zoom desde PDF, en tu computadora.")
    ap.add_argument("--web", action="store_true", help="abrir en el navegador en lugar de la ventana propia")
    ap.add_argument("--port", type=int, default=None, help="puerto para el modo navegador")
    ap.add_argument("--no-open", action="store_true", help="no abrir el navegador automáticamente (modo web)")
    args = ap.parse_args(argv)

    if not args.web:
        try:
            import webview  # noqa
        except Exception:
            args.web = True
    if args.web:
        port = args.port or server.free_port()
        if not args.no_open:
            import threading
            threading.Timer(0.8, lambda: webbrowser.open("http://127.0.0.1:%d/" % port)).start()
        server.serve(port=port)
        return 0

    import webview
    holder = {}
    api = Api(window_getter=lambda: holder.get("w"))
    # el HTML se sirve por el servidor local para que carguen render.js/app.js igual que en modo web
    httpd, port = server.serve(api=api, background=True)
    w = webview.create_window("Lienzo", "http://127.0.0.1:%d/" % port, js_api=api, width=1480, height=920, min_size=(1100, 700), text_select=True)
    holder["w"] = w
    webview.start(debug=bool(os.environ.get("LIENZO_DEBUG")))
    httpd.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
