#!/usr/bin/env python
# -*- coding: utf-8 -*-

import SocketServer
import SimpleHTTPServer
import urllib
import subprocess
import threading
import OSC

PORT = 8000

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
    print >>out, "<p>wait_osc: "+str(args)+"</p>"

def handler_send_osc(out, args):
    pass

handlers = {'/': handler_page,
            '/wait_osc': handler_wait_osc,
            '/send_osc': handler_send_osc}

def catchall_osc_handler(addr, typetags, args, source):
    print 'testing catch-all OSC handler:', addr, typetags, args, source

osc_server = OSC.OSCServer(('localhost', 9000))
osc_server.addMsgHandler('default', catchall_osc_handler)
osc_thread = threading.Thread(target=osc_server.serve_forever)
osc_thread.start()

httpd = ReuseTCPServer(('', PORT), OscHTTPServer)
print "serving at port", PORT
httpd.serve_forever()

osc_server.close()
osc_thread.join()
