
import SocketServer
import SimpleHTTPServer
import urllib
import threading
import time
import json
from select import select
import sys

message_pipe = []

class ReuseTCPServer(SocketServer.ThreadingTCPServer):
    allow_reuse_address = True

class MapperHTTPServer(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        command = self.path
        args = []
        try:
            (command, args_together) = self.path.split('?')
            args_list = [[urllib.unquote(y) for y in x.split('=')]
                         for x in args_together.split('&')]
            args = dict(args_list)
        except:
            pass

        contenttype = { 'html': 'Content-Type: text/html; charset=UTF-8',
                        'js': 'Content-Type: text/javascript',
                        'css': 'Content-Type: text/css',
                        'json': 'Content-Type: text/javascript' }
        def found(type=''):
            print >>self.wfile, "HTTP/1.0 200 OK"
            try:
                print >>self.wfile, contenttype[type]
            except KeyError:
                pass
            finally:
                print >>self.wfile

        def notfound(type=''):
            print >>self.wfile, "HTTP/1.0 404 Not Found"
            try:
                print >>self.wfile, contenttype[type]
            finally:
                print >>self.wfile

        try:
            found(handlers[command][1])
            handlers[command][0](self.wfile, args)
        except KeyError:
            try:
                f = open(self.path[1:])
                found(self.path.rsplit('.',1)[-1])
                self.copyfile(f, self.wfile)
            except IOError:
                notfound('html')
                print >>self.wfile, "404 Not Found:", self.path

def handler_page(out, args):
    print >>out, """<html>
<head>
<title>Testing mapper interface</title>
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
<script type="text/javascript" src="util.js"></script>
<script type="text/javascript" src="json2.js"></script>
<script type="text/javascript" src="command.js"></script>
<script type="text/javascript" src="main.js"></script>
</head>
<body>
<div id="output"></div>
</body>
</html>"""

def handler_wait_command(out, args):
    i=0
    while len(message_pipe)==0:
        time.sleep(0.1)
        i = i + 1
        if (i>50):
            r, w, e=select([out._sock],[],[out._sock], 0)
            if len(r)>0 or len(e)>0:
                return
            print >>out, json.dumps( {"id": int(args['id'])} );
            return
    r, w, e=select([out._sock],[],[out._sock], 0)
    if len(r)>0 or len(e)>0:
        return
    # Receive command from back-end
    msg = message_pipe.pop()
    print 'Sending command:',msg
    print >>out, json.dumps( {"id": int(args['id']),
                              "cmd": msg[0],
                              "args": msg[1]} )

def handler_send_command(out, args):
    try:
        msgstring = args['msg']
        vals = json.loads(msgstring)
        h = cmd_handlers[vals['cmd']]
    except KeyError:
        print 'send_command: no message found in "%s"'%str(msgstring)
        return
    except ValueError:
        print 'send_command: bad embedded JSON "%s"'%str(vals)
        return
    res = h(vals['args'])
    if res:
        print >>out, json.dumps( { "cmd": res[0],
                                   "args": res[1] } )

handlers = {'/': [handler_page, 'html'],
            '/wait_cmd': [handler_wait_command, 'json'],
            '/send_cmd': [handler_send_command, 'json']}

cmd_handlers = {}

def send_command(cmd, args):
    message_pipe.append((cmd, args))

def add_command_handler(cmd, handler):
    cmd_handlers[cmd] = handler

def serve(port=8000, poll=lambda: time.sleep(10)):
    httpd = ReuseTCPServer(('', port), MapperHTTPServer)

    http_thread = threading.Thread(target=httpd.serve_forever)
    http_thread.start()

    print "serving at port", port
    try:
        while 1:
            time.sleep(1)
            poll()
    except KeyboardInterrupt:
        pass

    print "shutting down..."
    httpd.shutdown()
    http_thread.join()
    print 'bye.'
