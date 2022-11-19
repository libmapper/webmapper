
import socketserver
import http.server
import socket, errno
import urllib
#import urllib.request, urllib.parse, urllib.error
#import urllib.parse
import cgi
import threading, queue
import time
import json
from select import select
import sys
import struct
import hashlib
from io import BytesIO
import pdb

message_pipe = queue.Queue()
tracing = False
done = False

class RequestCounter(object):
    def __init__(self):
        self.count = 1
        self.started = False
    def start(self):
        if not self.started:
            self.started = True
            self.count -= 1
    def inc(self):
        if (not self.started):
            self.start()
        self.count += 1
    def dec(self):
        if (self.started):
            self.count -= 1
ref = RequestCounter()

class ReuseTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

class MprHTTPServer(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        ctype, pdict = cgi.parse_header(self.headers.getheader('content-type'))
        if ctype == 'multipart/form-data':
            query = cgi.parse_multipart(self.rfile, pdict)
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        fn = query['filename'][0].split('\\')[-1]
        er = 0
        try:
            er = 1
            if 'load' in cmd_handlers:
                er = 2
                sources = query['sources'][0].split(',')
                destinations = query['destinations'][0].split(',')
                msg = {'sources': sources, 'destinations': destinations,
                       'loading': query['mapping_json'][0]}
                cmd_handlers['load'](msg)
            self.wfile.write(("Success: %s loaded successfully."%fn).encode('utf-8'))
        except Exception as e:
            self.wfile.write(("Error: loading %s (%d)."%(fn,er)).encode('utf-8'))
            raise e

    def do_GET(self):
        command = self.path
        args = []
        try:
            parsed = urllib.parse.urlparse(self.path)
            command = parsed.path
            args = dict(urllib.parse.parse_qsl(parsed.query))
        except Exception as e:
            print('exception:', e)

        contenttype = { 'html': 'text/html; charset=UTF-8',
                        'js':   'text/javascript',
                        'css':  'text/css',
                        'json': 'text/javascript',
                        'png':  'image/png',
                        'dl':   None}

        def found(type=''):
            if (type=='socket'):
                if tracing: print('websocket requested')
                return self.do_websocket()
            self.send_response(200)
            if type=='dl': return
            elif type in contenttype:
                self.send_header('Content-Type', contenttype[type])
                self.end_headers()

        def notfound(type=''):
            self.send_response(404)
            self.send_header('Content-Type', contenttype['html'])
            self.end_headers()
            self.wfile.write(b'404 Not Found:'+self.path.encode('utf-8'))

        try:
            found(handlers[command][1])
            if command=='/send_cmd':
                if tracing: print('hxr_recv:', args['msg'])
            handlers[command][0](self.wfile, args)
        except KeyError:
            try:
                type = self.path.rsplit('.',1)[-1]
                if type in contenttype:
                    self.send_response(200)
                    f = open(self.path[1:], 'rb')
                    found(type)
                    self.copyfile(f, self.wfile)
            except IOError:
                notfound(self.path)

    def do_websocket(self):
        ref.inc()
        ws_version = self.websocket_handshake()
        try:
            if ws_version < 8:
                self.do_websocket_0()
            else:
                self.do_websocket_8()
        except socket.error as e:
            if e.errno == errno.EPIPE or e.errno == errno.ECONNRESET:
                # Avoid reporting a huge stack trace for broken pipe
                # exception, it just means that the websocket closed
                # because the browser window was closed for example.
                print('[ws]', e)
            else:
                raise e
        finally:
            ref.dec()

    def do_websocket_0(self):
        msg = ""
        while not done:
            time.sleep(0.1)

            if not message_pipe.empty():
                sendmsg = message_pipe.get()
                if tracing: print('ws0_send:', sendmsg)
                self.wfile.write(bytes([0])+json.dumps({"cmd": sendmsg[0],
                                                        "args": sendmsg[1]})
                                 + bytes([0xFF]));
                self.wfile.flush()

            while len(select([self.rfile],[],[],0)[0])>0:
                msg += self.rfile.read(1)
                if len(msg)==0:
                    break
                if msg[-1]==0x00:
                    msg = "";
                elif msg[-1]==0xFF:
                    break;

            if len(msg)>0 and msg[-1]==0xFF:
                out = BytesIO()
                if tracing: print('ws0_recv:', msg[:-1])
                handler_send_command(out, {'msg':msg[:-1]})
                msg = ""
                r = out.getvalue()
                if len(r) > 0:
                    if tracing: print('ws0_send2:', r)
                    self.wfile.write(bytes([0])+r.encode('utf-8')+bytes([0xFF]))
                    self.wfile.flush()

    def do_websocket_8(self):
        def send_string(s):
            if isinstance(s, str):
                s = s.encode('utf-8')
            l = len(s)
            header = bytearray()
            first = 1

            while l > 0:
                temp = None
                if l >= 32767:
                    header = bytearray([first, 126, (32767>>8)&0xFF, 32767&0xFF])
                    temp = s[32767:l]
                    s = s[0:32767]
                    first = 0
                else:
                    if l<126:
                        header = bytearray([(1<<7)|first, l])
                    else:
                        header = bytearray([(1<<7)|first, 126, (l>>8)&0xFF, l&0xFF])
                    l = 0
                self.request.sendall(header+s)
                self.wfile.flush()
                if temp != None:
                    s = temp
                    l = len(s)

        def decrypt_and_forward(buffer, key, length):
            m = bytearray([buffer[i] ^ key[i%4] for i in range(length)])
            out = BytesIO()
            if tracing: print('ws8_recv:', m)
            handler_send_command(out, {'msg':m})
            length = offset = -1
            r = out.getvalue()
            if len(r) > 0:
                if tracing: print('ws8_send2:', r)
                send_string(r)

        def check_backend():
            n = 0
            while not message_pipe.empty() and n < 30:
                sendmsg = message_pipe.get()
                if tracing: print('ws8_send:', sendmsg)
                s = json.dumps({"cmd": sendmsg[0],
                                "args": sendmsg[1]})
                send_string(s)
                n += 1

        msg = b""
        length = -1
        offset = -1
        while not done:
            to_read = len(select([self.rfile],[],[],0.1)[0]) > 0

            check_backend()

            while True:
                if to_read:
                    msg += self.rfile.read1()
                if len(msg) < 8:
                    break

                opcode=msg[0] # TODO check FIN
                # opcode&0x7F should be 1 for text, 2 for binary
                if (opcode&0x7F) == 8:
                    # Connection close
                    print('[ws] connection close!')
                    return
                if (opcode&0x7F)!=1 and (opcode&0x7F)!=2:
                    print('[ws] unknown opcode %#x'%(opcode&0x7F))

                if length == -1:
                    mask = msg[1] & 0x80
                    length = msg[1] & 0x7F
                    offset = 2 + 4*(mask!=0)

                    if length == 126:
                        length = (msg[2]<<8) | msg[3]
                        offset = 4 + 4*(mask!=0)
                    elif length == 127:
                        print('TODO extended message length')

                    if length<126:
                        key = msg[2:6]
                    elif mask!=0:
                        key = msg[4:8]
                    else:
                        print('error: unknown key')

                if len(msg) >= length+offset:
                    decrypt_and_forward(msg[offset:offset+length], key, length)
                    msg = msg[offset+length:]
                    length = offset = -1

                to_read = len(select([self.rfile],[],[],0)[0]) > 0

    def websocket_handshake(self):
        self.send_response(101, 'Web Socket Protocol Handshake')
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')

        import hashlib

        if ('Sec-WebSocket-Version' not in self.headers
            or int(self.headers['Sec-WebSocket-Version'])<8):
            self.send_header('Sec-WebSocket-Origin', self.headers['Origin'])
            self.send_header('Sec-WebSocket-Location',
                             'ws://%s%s'%(self.headers['Host'], self.path))

            key1 = self.headers['Sec-WebSocket-Key1']
            key2 = self.headers['Sec-WebSocket-Key2']
            code = self.rfile.read(8)

            def websocket_key_calc(key1,key2,code):
                i1=int([x for x in key1 if x.isdigit()])/key1.count(' ')
                i2=int([x for x in key2 if x.isdigit()])/key2.count(' ')
                return hashlib.md5(struct.pack('!II',i1,i2)+code).digest()

            self.end_headers()
            self.wfile.write(websocket_key_calc(key1,key2,code))

        elif int(self.headers['Sec-WebSocket-Version'])>=8:
            key = self.headers['Sec-WebSocket-Key']
            key = key.encode('utf-8')
            magic_guid = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
            import base64
            sha1 = hashlib.sha1(key+magic_guid)
            digest = sha1.digest()
            result = base64.b64encode(digest)
            self.send_header('Sec-WebSocket-Accept', result.decode())
            if 'Sec-WebSocket-Protocol' in self.headers:
                self.send_header('Sec-WebSocket-Protocol', 'webmapper')
            self.end_headers()
        self.wfile.flush()

        if 'Sec-WebSocket-Version' not in self.headers:
            return 0
        else:
            return int(self.headers['Sec-WebSocket-Version'])

def handler_page(out, args):
    htmlfile = open('html/webmapper.html')
    htmltext = htmlfile.read()
    out.write(htmltext.encode('utf-8'))

def handler_wait_command(out, args):
    i=0
    ref.inc()
    while message_pipe.empty()==False:
        time.sleep(0.1)
        i = i + 1
        if (i>50):
            r, w, e=select([out],[],[out], 0)
            ref.dec()
            if len(r)>0 or len(e)>0:
                return
            out.write(json.dumps({"id": int(args['id'])}));
            return
    ref.dec()
    r, w, e=select([out],[],[out], 0)
    if len(r)>0 or len(e)>0:
        return
    # Receive command from back-end
    msg = message_pipe.get()
    if tracing: print('hxr_send:', msg)
    out.write(json.dumps({"id": int(args['id']),
                          "cmd": msg[0],
                          "args": msg[1]}))

def handler_send_command(out, args):
    try:
        msgstring = args['msg']
        vals = json.loads(msgstring)
        h = cmd_handlers[vals['cmd']]
    except KeyError:
        print('send_command: no message found in "%s"'%str(msgstring))
        return
    except ValueError as e:
        print('send_command: bad embedded JSON "%s"'%msgstring)
        raise e
        return

    res = h(vals['args'])
    if res:
        out.write(json.dumps({"cmd": res[0],
                              "args": res[1]}).encode('utf-8'))

def handler_sock(out, args):
    pass

def handler_save(out, args):
    if not 'save' in cmd_handlers:
        out.write(b'\r')
        out.write(b'Error, no save handler registered.')
        return
    f = cmd_handlers['save']
    result = f(args)
    if result==None:
        out.write(b'\r')
        out.write(b'Error saving'+args.encode('utf-8'))
        return
    fn, content = result

    out.write(b'Expires: 0')
    out.write(b'Cache-Control: no-store')
    out.write(b'Content-Description: File Transfer')
    out.write(('Content-Disposition: attachment; filename="%s"'%fn).encode('utf-8'))
    out.write(b'Content-Type: text/javascript')
    out.write(b'Content-Transfer-Encoding: binary')
    out.write(('Content-Length: %d'%len(content)).encode('utf-8'))
    out.write(b'\r')
    out.write(content.encode('utf-8'))

handlers = {'/': [handler_page, 'html'],
            '/wait_cmd': [handler_wait_command, 'json'],
            '/send_cmd': [handler_send_command, 'json'],
            '/chat': [handler_sock, 'socket'],
            '/save': [handler_save, 'dl']}

cmd_handlers = {}

def send_command(cmd, args):
    message_pipe.put((cmd, args))

def add_command_handler(cmd, handler):
    cmd_handlers[cmd] = handler

def serve(port=8000, poll=lambda: time.sleep(10), on_open=lambda: (),
          quit_on_disconnect=True):
    httpd = ReuseTCPServer(('', port), MprHTTPServer)
    on_open()

    http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    http_thread.start()

    print("serving at port", port)
    try:
        while ref.count > 0 or not quit_on_disconnect:
            for i in range(100):
                poll()
        print("Lost connection.")
    except KeyboardInterrupt:
        pass

    print("shutting down...")
    httpd.shutdown()
    print('bye.')
