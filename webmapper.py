#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import mapperstorage
import netifaces # a library to find available network interfaces
import sys, os, os.path, threading, json, re, pdb
from random import randint

networkInterfaces = {'active': '', 'available': []}   

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

monitor = mapper.monitor(autosubscribe_flags=mapper.SUB_DEVICE | mapper.SUB_DEVICE_LINKS_OUT)

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
    admin = mapper.admin(networkInterfaces['active'])
    monitor = mapper.monitor(admin, autosubscribe_flags=mapper.SUB_DEVICE | mapper.SUB_DEVICE_LINKS_OUT)
    init_monitor()

def on_save(arg):
    ds = list(monitor.db.match_devices_by_name(arg['dev']))
    fn = '/'.join(ds[0]['name'].split('/')[1:])
    fn.replace('/','_')
    fn = '.'.join(fn.split('.')[:-1]+['json'])
    return fn, mapperstorage.serialise(monitor, arg['dev'])

def on_load(mapping_json, devices):
    # pdb.set_trace()
    mapperstorage.deserialise(monitor, mapping_json, devices)

def select_network(newNetwork):
    # print 'select_network', newNetwork
    networkInterfaces['active'] = newNetwork
    server.send_command('set_network', newNetwork)

def get_networks(arg):
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            connectedInterfaces.append(i)
    server.send_command("available_networks", connectedInterfaces)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("active_network", networkInterfaces['active'])

def get_active_network(arg):
    print networkInterfaces['active']
    server.send_command("active_network", networkInterfaces['active'])


def init_monitor():
    monitor.db.add_device_callback(on_device)
    monitor.db.add_signal_callback(on_signal)
    monitor.db.add_link_callback(on_link)
    monitor.db.add_connection_callback(on_connection)

init_monitor()

server.add_command_handler("all_devices",
                           lambda x: ("all_devices",
                                      list(monitor.db.all_devices())))

def select_tab(src_dev):
    # TODO:
    # if src_dev != focus_dev and focus_dev != "All Devices":
    #     # revert device subscription back to only device and link metadata
    #     monitor.subscribe(focus_dev, mapper.SUB_DEVICE | mapper.SUB_DEVICE_LINKS_OUT, -1)
    if src_dev != "All Devices":
        monitor.subscribe(src_dev, mapper.SUB_DEVICE_OUTPUTS | mapper.SUB_DEVICE_CONNECTIONS_OUT, -1)
        links = monitor.db.links_by_src_device_name(src_dev)
        for i in links:
            monitor.subscribe(i["dest_name"], mapper.SUB_DEVICE_INPUTS, -1)

def new_connection(args):
    source = str(args[0])
    dest = str(args[1])
    options = {}
    if( len(args) > 2 ): # See if the connection message has been supplied with options
        if( type(args[2]) is dict ): # Make sure they are the proper format
            options = args[2]  
    monitor.connect(source, dest, options)

server.add_command_handler("tab", lambda x: select_tab(x))

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

server.add_command_handler("connect", lambda x: new_connection(x))

server.add_command_handler("disconnect",
                           lambda x: monitor.disconnect(*map(str,x)))

server.add_command_handler("refresh", on_refresh)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

server.add_command_handler("select_network", select_network)
server.add_command_handler("get_networks", get_networks)

get_networks(False)
if ( 'en1' in networkInterfaces['available'] ) :
    networkInterfaces['active'] = 'en1'
elif ( 'en0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'en0'
elif ( 'lo0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'lo0'

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

