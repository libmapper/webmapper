#!/usr/bin/env python

import webmapper_http_server as server
import mapper

monitor = mapper.monitor()

def on_device(dev, action):
    if action == mapper.MDB_NEW:
        server.send_command("newdevice", dev)

monitor.db.add_device_callback(on_device)

server.add_command_handler("alldevices",
                           lambda x: ("alldevices",
                                      list(monitor.db.all_devices())))

server.serve(port=8000, poll=lambda: monitor.poll(100))
