from distutils.core import setup
import sys
if 'py2exe' in sys.argv: import py2exe
if 'py2app' in sys.argv: import py2app

data_files = [('js',['js/command.js',
                     'js/main.js',
                     'js/util.js',
                     'js/jquery.min.js',
                     'js/jquery.tablesorter.min.js',
                     'js/LibMapperModel.js',
                     'js/raphael.js',
                     'js/json2.js',
                     'js/viz/grid.js',
                     'js/viz/list.js',
                     'js/viz/grid/jquery-ui-1.10.0.custom.js',
                     'js/viz/grid/SvgGrid.js']),
              ('css',['css/style.css',
                      'js/viz/grid/GridView_style.css',
                      'js/viz/grid/ui-lightness/jquery-ui-1.10.0.custom.css']),
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
