#!/usr/bin/env python

import webmapper_http_server as server
import mapper

monitor = mapper.monitor()

def on_device(dev, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_device", dev)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_device", dev)

def on_signal(dev, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_signal", dev)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_signal", dev)

monitor.db.add_device_callback(on_device)
monitor.db.add_signal_callback(on_signal)

server.add_command_handler("all_devices",
                           lambda x: ("all_devices",
                                      list(monitor.db.all_devices())))

server.add_command_handler("all_signals",
                           lambda x: ("all_signals",
                                      list(monitor.db.all_inputs())
                                      + list(monitor.db.all_outputs())))

server.serve(port=8000, poll=lambda: monitor.poll(100))
