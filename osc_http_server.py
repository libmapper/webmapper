#!/usr/bin/env python
# -*- coding: utf-8 -*-

import SocketServer
import SimpleHTTPServer
import urllib
import subprocess
import threading
import OSC
import socket
import time
import struct
import json

PORT = 8000

message_pipe = []

class ReuseTCPServer(SocketServer.ThreadingTCPServer):
    allow_reuse_address = True

class OscHTTPServer(SimpleHTTPServer.SimpleHTTPRequestHandler):
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
                        'js': 'Content-Type: text/javascript' }
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
            handlers[command](self.wfile, args)
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
<title>Testing OSC</title>
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
<script type="text/javascript" src="util.js"></script>
<script type="text/javascript" src="json2.js"></script>
<script type="text/javascript" src="osc.js"></script>
<script type="text/javascript" src="main.js"></script>
</head>
<body>
<div id="output"></div>
</body>
</html>"""

def handler_wait_osc(out, args):
    i=0
    while len(message_pipe)==0:
        time.sleep(0.1)
        i = i + 1
        if (i>50):
            print >>out, json.dumps( {"id": int(args['id'])} );
            return
    msg = message_pipe.pop()
    print >>out, json.dumps( {"id": int(args['id']), "path": msg[0],
                              "types": msg[1], "args": msg[2]} );

def handler_send_osc(out, args):
    try:
        msgstring = args['msg']
        vals = json.loads(msgstring)
        osc = OSC.OSCMessage(vals['path'])
        for a in zip(vals['args'],list(vals['types'])):
            osc.append(*a)
        osc_client.sendto(osc, ('224.0.1.3', 7570))
    except KeyError:
        print 'send_osc: no message found in "%s"'%str(msgstring)
    except ValueError:
        print 'send_osc: bad embedded JSON "%s"'%str(vals)

handlers = {'/': handler_page,
            '/wait_osc': handler_wait_osc,
            '/send_osc': handler_send_osc}

def catchall_osc_handler(addr, typetags, args, source):
    print 'testing catch-all OSC handler:', addr, typetags, args, source
    message_pipe.append((addr, typetags, args))

# Code from http://wiki.python.org/moin/UdpCommunication
def udp_multicast_socket(group, port, buf_size=1024):
    """udp_multicast_socket(group, port [,buf_size]]]) - returns a multicast-enabled UDP socket"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)

    # Set some options to make it multicast-friendly
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
    except AttributeError:
        pass # Some systems don't support SO_REUSEPORT
    s.setsockopt(socket.SOL_IP, socket.IP_MULTICAST_TTL, 1)
    s.setsockopt(socket.SOL_IP, socket.IP_MULTICAST_LOOP, 1)

    # Bind to the port
    s.bind(('', port))

    # Set some more multicast options
    intf = socket.gethostbyname(socket.gethostname())
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF,
                 socket.inet_aton(intf))
    mreq = struct.pack("4sl", socket.inet_aton(group), socket.INADDR_ANY)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
    return s

osc_server = OSC.OSCServer(('localhost', 9000))
osc_server.socket = udp_multicast_socket('224.0.1.3', 7570)
osc_server.socket.settimeout(1)
osc_server.addMsgHandler('default', catchall_osc_handler)

osc_client = OSC.OSCClient()
osc_client.socket.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)

osc_thread = threading.Thread(target=osc_server.serve_forever)
osc_thread.start()

httpd = ReuseTCPServer(('', PORT), OscHTTPServer)

http_thread = threading.Thread(target=httpd.serve_forever)
http_thread.start()

print "serving at port", PORT
try:
    while 1:
        time.sleep(10)
except KeyboardInterrupt:
    pass

print "shutting down..."
osc_server.close()
while osc_server.running:
    time.sleep(0.1)
httpd.shutdown()
osc_thread.join()
http_thread.join()
print 'bye.'
