# -*- coding: utf-8 -*-
"""Prueba rápida: el analizador y el planificador producen láminas a partir de texto plano."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lienzo import extract, plan  # noqa: E402

TXT = """Homogamia educativa en Argentina
Resumen
Este trabajo analiza la homogamia educativa en parejas argentinas entre 2004 y 2020 con datos de la EPH. El objetivo fue estimar la tendencia y sus diferencias regionales.
Introducción
La homogamia educativa describe la tendencia a formar pareja con personas de nivel educativo similar. Es un mecanismo central de reproducción de la desigualdad.
Resultados
El 62 % de las parejas comparte nivel educativo. La homogamia aumentó 8 puntos entre 2004 y 2020. Las diferencias regionales son significativas.
Conclusiones
Los resultados muestran que la homogamia educativa se intensificó. Se concluye que la expansión universitaria no redujo la selectividad de las uniones.
"""


def test_text_pipeline():
    o = extract.analyze_text(TXT)
    assert o["title"].startswith("Homogamia")
    assert any(s["heading"].lower().startswith("result") for s in o["sections"])
    slides = plan.plan_slides(o, max_slides=12)
    types = [s["type"] for s in slides]
    assert types[0] == "cover" and types[-1] == "closing"
    assert "stat" in types or "bullets" in types


if __name__ == "__main__":
    test_text_pipeline()
    print("ok")
