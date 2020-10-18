from distutils.core import setup


import sys
if 'py2exe' in sys.argv: import py2exe
if 'py2app' in sys.argv: import py2app

data_files = [('',['js']),
              ('',['includes']),
              ('',['css']),
              ('',['images']),
              ('',['html'])
              ]

options = {'argv_emulation': True, 'iconfile': 'images/libmapper.icns'}

setup(name='WebMapper',
      version='0.2',
      description='Graphical interface for the libmapper distributed mapping graph',
      author='Stephen Sinclair, Joseph Malloch, Vijay Rudraraju, Aaron Krajeski, Jon Wilansky, Johnty Wang, Travis West, Mathias Bredholt',
      author_email='jmalloch@dal.ca',
      url='http://libmapper.org',
      data_files = data_files,
      options={'py2app': options},
      windows=['webmapper.py'],
      app=['webmapper.py'],
     )
