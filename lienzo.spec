# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: pyinstaller lienzo.spec
block_cipher = None

a = Analysis(
    ['lienzo.py'],
    pathex=['.'],
    binaries=[],
    datas=[('lienzo/ui', 'lienzo/ui')],
    hiddenimports=['webview.platforms.edgechromium', 'webview.platforms.winforms', 'clr_loader', 'pythonnet'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL'],
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz, a.scripts, a.binaries, a.zipfiles, a.datas, [],
    name='Lienzo',
    debug=False,
    strip=False,
    upx=False,
    console=False,
    icon='assets/lienzo.ico',
)
