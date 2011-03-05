#!/usr/bin/env python

import webmapper_http_server
import mapper

monitor = mapper.monitor()

def dummy(a,b):
    print 'found',a['name']
    webmapper_http_server.send_command("newdevice", a)

monitor.db.add_device_callback(dummy)

webmapper_http_server.serve(port=8000, poll=lambda: monitor.poll(100))
