from distutils.core import setup
import sys
if 'py2exe' in sys.argv: import py2exe
if 'py2app' in sys.argv: import py2app

data_files = [('js',['js/command.js',
                     'js/main.js',
                     'js/util.js',
                     'js/jquery-ui.min.js',
                     'js/jquery.min.js',
                     'js/json2.js']),
              ('css',['css/style.css']),
              ('images',['images/boundary_icons.png',
                         'images/range_switch.png',
                         'images/refresh.png']),
              ]

setup(name='WebMapper',
      version='0.1',
      description='GUI for libmapper OSC network',
      author='Stephen Sinclair',
      author_email='sinclair@music.mcgill.ca',
      url='http://libmapper.org',
      data_files = data_files,
      windows=['webmapper.py'],
      app=['webmapper.py'],
     )
