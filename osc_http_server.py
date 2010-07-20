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

PORT = 8000

message_pipe = []

class ReuseTCPServer(SocketServer.TCPServer):
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
        print >>self.wfile, """
<html>
<head>
<title>Testing OSC</title>
<meta http-equiv="content-type" content="text/html; charset=UTF-8">
<script type="text/javascript">
function request(path, args, ok_responder, error_responder) {
  var client = new XMLHttpRequest();
  client.onreadystatechange = function() {
    if(this.readyState == 4)
      ok_responder(this.responseText);
    else if (error_responder)
      error_responder(this.responseText);
  }
  a='';
  n=0;
  for (i in args) {
    if (n==0)
      a+='?';
    else
      a+='&';
    a += i + '=' + args[i];
    n++;
  }
  client.open("GET", path+a);
  client.send("");
}
</script>
</head>
"""
        ex = False
        try:
            ex = handlers[command]
        except:
            print >>self.wfile, "Error."
        if ex: ex(self.wfile, args)
        print >>self.wfile, "</html>"

def handler_page(out, args):
    print >>out, """
<script type="text/javascript">
function test_msg()
{
  request('wait_osc', {'asdf': 25},
      function (text) {
        document.getElementById('output').innerHTML += text;
      });
}
</script>
<body>
<p>Test: <input type="button" onclick="test_msg();" value="test"/></p>
<div id="output"></div>
</body>"""

def handler_wait_osc(out, args):
    while len(message_pipe)==0:
        time.sleep(0.1)
    msg = message_pipe.pop()
    print >>out, "<p>wait_osc: "+str(msg)+"</p>"

def handler_send_osc(out, args):
    pass

handlers = {'/': handler_page,
            '/wait_osc': handler_wait_osc,
            '/send_osc': handler_send_osc}

def catchall_osc_handler(addr, typetags, args, source):
    print 'testing catch-all OSC handler:', addr, typetags, args, source
    message_pipe.append((addr, typetags, args))

# Code from http://wiki.python.org/moin/UdpCommunication
def udp_multicast_socket(group, port, buf_size=1024):
    """udp_multicast_socket(group, port [,buf_size]]]) - returns a multicast-enabled UDP socket"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

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
    s.setsockopt(socket.SOL_IP, socket.IP_MULTICAST_IF, socket.inet_aton(intf))
    s.setsockopt(socket.SOL_IP, socket.IP_ADD_MEMBERSHIP, socket.inet_aton(group) + socket.inet_aton(intf))
    return s

osc_server = OSC.OSCServer(('localhost', 9000))
osc_server.socket = udp_multicast_socket('224.0.1.3', 7570)
osc_server.socket.settimeout(1)
osc_server.addMsgHandler('default', catchall_osc_handler)

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
