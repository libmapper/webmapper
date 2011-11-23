
import SocketServer
import SimpleHTTPServer
import urllib
import urlparse
import threading
import time
import json
from select import select
import sys
import struct
import hashlib
from cStringIO import StringIO

message_pipe = []
tracing = False

class ReuseTCPServer(SocketServer.ThreadingTCPServer):
    allow_reuse_address = True

class MapperHTTPServer(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        command = self.path
        args = []
        try:
            parsed = urlparse.urlparse(self.path)
            command = parsed.path
            args = dict(urlparse.parse_qsl(parsed.query))
        except Exception, e:
            print e

        contenttype = { 'html': 'Content-Type: text/html; charset=UTF-8',
                        'js': 'Content-Type: text/javascript',
                        'css': 'Content-Type: text/css',
                        'json': 'Content-Type: text/javascript',
                        'png': 'Content-Type: image/png',
                        'dl': None}
        def found(type=''):
            if (type=='socket'):
                return self.do_websocket()
            print >>self.wfile, "HTTP/1.0 200 OK"
            if type=='dl': return
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
            if command=='/send_cmd':
                if tracing: print 'hxr_recv:',args['msg']
            handlers[command][0](self.wfile, args)
        except KeyError:
            try:
                f = open(self.path[1:])
                found(self.path.rsplit('.',1)[-1])
                self.copyfile(f, self.wfile)
            except IOError:
                notfound('html')
                print >>self.wfile, "404 Not Found:", self.path

    def do_websocket(self):
        self.websocket_handshake()
        msg = ""
        while True:
            time.sleep(0.1)

            if len(message_pipe)>0:
                sendmsg = message_pipe.pop()
                if tracing: print 'ws_send:',sendmsg
                self.wfile.write(chr(0)+json.dumps({"cmd": sendmsg[0],
                                                    "args": sendmsg[1]})
                                 + chr(0xFF));
                self.wfile.flush()

            while len(select([self.rfile._sock],[],[],0)[0])>0:
                msg += self.rfile.read(1)
                if ord(msg[-1])==0x00:
                    msg = "";
                elif ord(msg[-1])==0xFF:
                    break;

            if len(msg)>0 and ord(msg[-1])==0xFF:
                out = StringIO()
                if tracing: print 'ws_recv:',msg[:-1]
                handler_send_command(out, {'msg':msg[:-1]})
                msg = ""
                r = out.getvalue()
                if len(r) > 0:
                    if tracing: print 'ws_send:',r
                    self.wfile.write(chr(0)+r.encode('utf-8')+chr(0xFF))
                    self.wfile.flush()

    def websocket_handshake(self):
        print >>self.wfile, ("HTTP/1.1 101 Web Socket Protocol Handshake\r")
        print >>self.wfile,'Upgrade: %s\r'%self.headers['Upgrade']
        print >>self.wfile,'Connection: %s\r'%self.headers['Connection'],'\r'
        print >>self.wfile,('Sec-WebSocket-Origin: %s\r'
                            %self.headers['Origin'])
        print >>self.wfile,('Sec-WebSocket-Location: ws://%s%s\r'
                            %(self.headers['Host'], self.path))

        key1 = self.headers['Sec-WebSocket-Key1']
        key2 = self.headers['Sec-WebSocket-Key2']
        code = self.rfile.read(8)

        def websocket_key_calc(key1,key2,code):
            i1=int(filter(lambda x: x.isdigit(),key1))/key1.count(' ')
            i2=int(filter(lambda x: x.isdigit(),key2))/key2.count(' ')
            return hashlib.md5(struct.pack('!II',i1,i2)+code).digest()

        print >>self.wfile,'\r'
        self.wfile.write(websocket_key_calc(key1,key2,code))
        self.wfile.flush()

def handler_page(out, args):
    print >>out, """<html>
<head>
<title>Testing mapper interface</title>
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
<script type="text/javascript" src="js/jquery.min.js"></script>
<script type="text/javascript" src="js/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/util.js"></script>
<script type="text/javascript" src="js/json2.js"></script>
<script type="text/javascript" src="js/command.js"></script>
<script type="text/javascript" src="js/main.js"></script>
<link rel="stylesheet" type="text/css" href="css/style.css"></link>
</head>
<body>
<table id="spacerTable"><tr><td></td><td></td><td></td></tr></table>
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
    if tracing: print 'hxr_send:',msg
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

    # JSON decoding returns unicode which doesn't work well with
    # our C library, so convert any strings to str.
    vals['args'] = deunicode(vals['args'])

    res = h(vals['args'])
    if res:
        print >>out, json.dumps( { "cmd": res[0],
                                   "args": res[1] } )

def handler_sock(out, args):
    pass

def handler_save(out, args):
    if not 'save' in cmd_handlers:
        print >>out
        print >>out, "Error, no save handler registered."
        return
    f = cmd_handlers['save']
    result = f(args)
    if result==None:
        print >>out
        print >>out, "Error saving", args
        return
    fn, content = result

    print >>out, 'Expires: 0'
    print >>out, 'Cache-Control: no-store'
    print >>out, 'Content-Description: File Transfer'
    print >>out, 'Content-Disposition: attachment; filename="%s"'%fn
    print >>out, 'Content-Type: text/javascript'
    print >>out, 'Content-Transfer-Encoding: binary'
    print >>out, 'Content-Length: %d'%len(content)
    print >>out
    print >>out, content

handlers = {'/': [handler_page, 'html'],
            '/wait_cmd': [handler_wait_command, 'json'],
            '/send_cmd': [handler_send_command, 'json'],
            '/sock': [handler_sock, 'socket'],
            '/save': [handler_save, 'dl']}

cmd_handlers = {}

def deunicode(o):
    d = dir(o)
    if 'items' in d:
        p = dict([(deunicode(x),deunicode(y)) for (x,y) in o.items()])
    elif '__dict__' in d:
        p = o.copy()
        p.__dict__ = dict([(deunicode(x),deunicode(y))
                           for (x,y) in o.__dict__.items()])
    elif '__iter__' in d:
        p = [deunicode(x) for x in o]
    elif o.__class__==unicode:
        p = o.encode('ascii','replace')
    else:
        p = o
    return p

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
