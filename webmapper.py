#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import sys

if 'tracing' in sys.argv[1:]:
    server.tracing = True

monitor = mapper.monitor()

def on_device(dev, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_device", dev)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_device", dev)

def on_signal(sig, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_signal", sig)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_signal", sig)

def on_link(link, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_link", link)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_link", link)

def on_connection(con, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_connection", con)
    if action == mapper.MDB_MODIFY:
        server.send_command("mod_connection", con)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_connection", con)

def set_connection(con):
    if con.has_key('mode'):
        con['mode'] = {'bypass': mapper.MO_BYPASS,
                       'linear': mapper.MO_LINEAR,
                       'calibrate': mapper.MO_CALIBRATE,
                       'expression': mapper.MO_EXPRESSION}[con['mode']]
    monitor.modify(con)

monitor.db.add_device_callback(on_device)
monitor.db.add_signal_callback(on_signal)
monitor.db.add_link_callback(on_link)
monitor.db.add_mapping_callback(on_connection)

server.add_command_handler("all_devices",
                           lambda x: ("all_devices",
                                      list(monitor.db.all_devices())))

server.add_command_handler("all_signals",
                           lambda x: ("all_signals",
                                      list(monitor.db.all_inputs())
                                      + list(monitor.db.all_outputs())))

server.add_command_handler("all_links",
                           lambda x: ("all_links",
                                      list(monitor.db.all_links())))

server.add_command_handler("all_connections",
                           lambda x: ("all_connections",
                                      list(monitor.db.all_mappings())))

server.add_command_handler("set_connection", set_connection)

server.add_command_handler("link",
                           lambda x: monitor.link(*map(str,x)))

server.add_command_handler("unlink",
                           lambda x: monitor.unlink(*map(str,x)))

server.add_command_handler("connect",
                           lambda x: monitor.connect(*map(str,x)))

server.add_command_handler("disconnect",
                           lambda x: monitor.disconnect(*map(str,x)))

server.serve(port=8000, poll=lambda: monitor.poll(100))
