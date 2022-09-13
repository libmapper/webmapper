# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_dynamic_libs
import libmapper

block_cipher = None

binaries = []
binaries += collect_dynamic_libs('libmapper')
if sys.platform == 'linux':
    binaries += [(os.path.join(os.path.dirname(libmapper.__file__), "..", 'libmapper.libs'), 'libmapper.libs')]

added_files=[
    ('html', 'html'),
    ('css', 'css'),
    ('js', 'js'),
    ('images', 'images'),
    ('includes', 'includes')
    ]

a = Analysis(
    ['webmapper.py'],
    pathex=[],
    binaries=binaries,
    datas=added_files,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='webmapper',
    debug=True,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon='images\\webmapperlogo.ico',
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='webmapper',
)
# Build a .app if on OS X
if sys.platform == 'darwin':
   app = BUNDLE(exe,
                name='webmapper.app',
                icon=None)
