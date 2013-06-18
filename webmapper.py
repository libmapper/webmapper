#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import mapperstorage
import sys, os, os.path, threading, json, re
from random import randint

dirname = os.path.dirname(__file__)
if dirname:
   os.chdir(os.path.dirname(__file__))

if 'tracing' in sys.argv[1:]:
    server.tracing = True

def open_gui(port):
    url = 'http://localhost:%d'%port
    apps = ['~\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe --app=%s',
            '/usr/bin/chromium-browser --app=%s',
            ]
    if 'darwin' in sys.platform:
        # Dangerous to run 'open' on platforms other than OS X, so
        # check for OS explicitly in this case.
        apps = ['open -n -a "Google Chrome" --args --app=%s']
    def launch():
        try:
            import webbrowser, time
            time.sleep(0.2)
            for a in apps:
                a = os.path.expanduser(a)
                a = a.replace('\\','\\\\')
                if webbrowser.get(a).open(url):
                    return
            webbrowser.open(url)
        except:
            print 'Error opening web browser, continuing anyway.'
    launcher = threading.Thread(target=launch)
    launcher.start()

monitor = mapper.monitor(enable_autorequest=0)

def on_device(dev, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_device", dev)
    if action == mapper.MDB_MODIFY:
        server.send_command("mod_device", dev)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_device", dev)

def on_signal(sig, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_signal", sig)
    if action == mapper.MDB_MODIFY:
        server.send_command("mod_signal", sig)
    if action == mapper.MDB_REMOVE:
        server.send_command("del_signal", sig)

def on_link(link, action):
    if action == mapper.MDB_NEW:
        server.send_command("new_link", link)
    if action == mapper.MDB_MODIFY:
        server.send_command("mod_link", link)
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

def on_refresh(arg):
    global monitor
    del monitor
    monitor = mapper.monitor(enable_autorequest=0)
    init_monitor()

def on_save(arg):
    ds = list(monitor.db.match_devices_by_name(arg['dev']))
    fn = '/'.join(ds[0]['name'].split('/')[1:])
    fn.replace('/','_')
    fn = '.'.join(fn.split('.')[:-1]+['json'])
    return fn, mapperstorage.serialise(monitor, arg['dev'])

def on_load(mapping_json):
    mapperstorage.deserialise(monitor, mapping_json)

def init_monitor():
    monitor.db.add_device_callback(on_device)
    monitor.db.add_signal_callback(on_signal)
    monitor.db.add_link_callback(on_link)
    monitor.db.add_connection_callback(on_connection)
    monitor.request_devices()
    monitor.request_links_by_src_device_name("/*")

init_monitor()

server.add_command_handler("all_devices",
                           lambda x: ("all_devices",
                                      list(monitor.db.all_devices())))

def sync_device(name, is_src):
    device = monitor.db.get_device_by_name(name)
    if not device:
        return
    sigs_reported = 0
    sigs_recorded = 0
    if is_src:
        sigs_reported = device["n_outputs"]
        sigs_recorded = sum(1 for _ in monitor.db.outputs_by_device_name(name))
    else:
        sigs_reported = device["n_inputs"]
        sigs_recorded = sum(1 for _ in monitor.db.inputs_by_device_name(name))
    if sigs_reported != sigs_recorded:
        if is_src:
            monitor.request_output_signals_by_device_name(name)
        else:
            monitor.request_input_signals_by_device_name(name)
    monitor.request_device_info(name)

def get_signals_by_device_name(src_dev):
    monitor.request_signals_by_device_name(src_dev)

def select_tab(src_dev):
    if src_dev == "All Devices":
        monitor.request_devices()
        monitor.request_links_by_src_device_name("/*")
    else:
        links = monitor.db.links_by_src_device_name(src_dev)
        for i in links:
            sync_device(i["dest_name"], 0)
        sync_device(src_dev, 1)
        monitor.request_connections_by_src_device_name(src_dev)

server.add_command_handler("tab", lambda x: select_tab(x))

server.add_command_handler("get_signals_by_device_name", lambda x: get_signals_by_device_name(x))

server.add_command_handler("all_signals",
                           lambda x: ("all_signals",
                                      list(monitor.db.all_inputs())
                                      + list(monitor.db.all_outputs())))

server.add_command_handler("all_links",
                           lambda x: ("all_links",
                                      list(monitor.db.all_links())))

server.add_command_handler("all_connections",
                           lambda x: ("all_connections",
                                      list(monitor.db.all_connections())))

server.add_command_handler("set_connection", set_connection)

server.add_command_handler("link",
                           lambda x: monitor.link(*map(str,x)))

server.add_command_handler("unlink",
                           lambda x: monitor.unlink(*map(str,x)))

server.add_command_handler("connect",
                           lambda x: monitor.connect(*map(str,x)))

server.add_command_handler("disconnect",
                           lambda x: monitor.disconnect(*map(str,x)))

server.add_command_handler("refresh", on_refresh)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

try:
    port = int(sys.argv[sys.argv.index('--port'):][1])
except:
    #port = randint(49152,65535)
    port = 50000

on_open = lambda: ()
if not '--no-browser' in sys.argv and not '-n' in sys.argv:
    on_open = lambda: open_gui(port)

server.serve(port=port, poll=lambda: monitor.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)
