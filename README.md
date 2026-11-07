# Lienzo

Programa de escritorio que convierte **PDF o texto** en una **presentación HTML con zoom (estilo Prezi)**, lista para proyectar. Funciona **100 % en tu computadora**: no sube nada a internet ni necesita cuentas.

## Qué hace

1. **Lee tus PDF** (uno o varios) o un texto pegado y detecta título, autores, resumen, palabras clave, secciones, ideas fuerza, cifras, figuras y referencias.
2. **Arma láminas poco cargadas**: portada, idea fuerza, conceptos, tarjetas desplegables, puntos clave, cifras, figura, cita, referencias y cierre.
3. **Te deja completar**: expositor/a, evento o cátedra, autores, institución y logo; paleta de colores (8 incluidas + propia), tipografía y recorrido (anillo, espiral, camino, grilla).
4. **Editás** cada lámina (texto, tipo, orden, duplicar, borrar) con vista previa en vivo.
5. **Exportás un único archivo HTML** autocontenido que se abre en cualquier navegador: clic/flechas para avanzar, `O` vista general, `F` pantalla completa.
6. **Guardás el proyecto** (`.lienzo.json`) para seguir editando otro día.
7. **IA opcional**: copia un pedido listo para ChatGPT/Gemini y pega la respuesta, o usa [Ollama](https://ollama.com) si lo tenés instalado. Sin IA también funciona.

## Instalar en Windows

1. Entrá a **Releases** y descargá `Lienzo-windows.zip`.
2. Descomprimilo y hacé doble clic en `Lienzo.exe`.
3. Si aparece "Windows protegió su PC": *Más información → Ejecutar de todas formas* (el programa no está firmado digitalmente).

## Ejecutar desde el código (cualquier sistema)

```bash
pip install -r requirements.txt
python -m lienzo          # ventana propia (pywebview)
python -m lienzo --web    # o en el navegador: http://127.0.0.1:8765
```

## Compilar el ejecutable

El workflow `.github/workflows/build-windows.yml` compila `Lienzo.exe` con PyInstaller al publicar un tag `v*` (o a mano desde *Actions → Run workflow*). Localmente: `pip install pyinstaller && pyinstaller lienzo.spec`.

## Estructura

- `lienzo/extract.py`: análisis de PDF/texto (PyMuPDF), sin IA.
- `lienzo/plan.py`: convierte el esquema en láminas.
- `lienzo/ui/render.js`: genera el HTML final (motor de zoom, plantillas, paletas).
- `lienzo/ui/index.html`, `app.js`, `styles.css`: el editor.
- `lienzo/api.py`, `server.py`, `__main__.py`: puente Python ↔ interfaz, modo ventana y modo navegador.

## Créditos

Idea y dirección: Patricia Inés Castro.
