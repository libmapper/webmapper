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

db = mapper.database(subscribe_flags=mapper.OBJ_DEVICES | mapper.OBJ_LINKS)

def dev_props(dev):
    props = dev.properties.copy()
    props['synced'] = props['synced'].get_double()
    return props

def link_props(link):
    return {'src' : link.device(0).name, 'dst' : link.device(1).name}

def sig_props(sig):
    props = sig.properties.copy()
    props['device_id'] = sig.device().id
    props['device_name'] = sig.device().name
    return props

def full_signame(sig):
    return sig.device().name + '/' + sig.name

def map_props(map):
    props = map.properties.copy()
    props['src'] = full_signame(map.source().signal())
    props['dst'] = full_signame(map.destination().signal())
    return props

def on_device(dev, action):
    if action == mapper.REMOVED:
        server.send_command("del_device", dev.id)
    else:
        if action == mapper.ADDED:
            server.send_command("new_device", dev_props(dev))
        elif action == mapper.MODIFIED:
            server.send_command("mod_device", dev_props(dev))

def on_link(link, action):
    if action == mapper.REMOVED:
        server.send_command("del_link", link.id)
    else:
        if action == mapper.ADDED:
            server.send_command("new_link", link_props(link))
        elif action == mapper.MODIFIED:
            server.send_command("mod_link", link_props(link))

def on_signal(sig, action):
    if action == mapper.REMOVED:
        server.send_command("del_signal", sig.id)
    else:
        if action == mapper.ADDED:
            server.send_command("new_signal", sig_props(sig))
        elif action == mapper.MODIFIED:
            server.send_command("mod_signal", sig_props(sig))

def on_map(map, action):
    if action == mapper.REMOVED:
        server.send_command("del_connection", map_props(map))
    else:
        if action == mapper.ADDED:
            server.send_command("new_connection", map_props(map))
        elif action == mapper.MODIFIED:
            server.send_command("mod_connection", map_props(map))

def set_map_properties(props):
    if not props.has_key('id'):
        return
    map = database.map(props['id'])
    if not map:
        return
    if props.has_key('mode'):
        mode = props['mode']
        if mode == 'bypass':
            map.mode = mapper.MODE_EXPRESSION
            map.expression = "y=x"
        elif mode == 'reverse':
            src = map.source().signal()
            dst = map.destination().signal()
            map.release()
            map = mapper.map(dst, src).push()
        elif mode == 'linear':
            map.mode = mapper.MODE_LINEAR
        elif mode == 'calibrate':
            map.source().calibrating = True
        elif mode == 'expression':
            map.mode = mapper.MODE_EXPRESSION
    if (props.has_key('src_min')):
        if (type(props['src_min']) is int or type(props['src_min']) is float):
            map.source().minimum = float(props['src_min'])
        else:
            if (type(props['src_min']) is str):
                props['src_min'] = props['src_min'].replace(',',' ').split()
            numargs = len(props['src_max'])
            for i in range(numargs):
                props['src_min'][i] = float(props['src_min'][i])
            map.source().minimum = props['src_min']
    if (props.has_key('src_max')):
        if (type(props['src_max']) is int or type(props['src_max']) is float):
            map.source().maximum = float(props['src_max'])
        else:
            if (type(props['src_max']) is str):
                props['src_max'] = props['src_max'].replace(',',' ').split()
            numargs = len(props['src_max'])
            for i in range(numargs):
                props['src_max'][i] = float(props['src_max'][i])
            map.source().maximum = props['src_max']
    if (props.has_key('dest_min')):
        if (type(props['dest_min']) is int or type(props['dest_min']) is float):
            map.destination().minimum = float(props['dest_min'])
        else:
            if (type(props['dest_min']) is str):
                props['dest_min'] = props['dest_min'].replace(',',' ').split()
            numargs = len(props['dest_min'])
            for i in range(numargs):
                props['dest_min'][i] = float(props['dest_min'][i])
            map.destination().minimum = props['dest_min']
    if (props.has_key('dest_max')):
        if (type(props['dest_max']) is int or type(props['dest_max']) is float):
            map.destination().maximum = float(props['dest_max'])
        else:
            if (type(props['dest_max']) is str):
                props['dest_max'] = props['dest_max'].replace(',',' ').split()
            numargs = len(props['dest_max'])
            for i in range(numargs):
                props['dest_max'][i] = float(props['dest_max'][i])
            map.destination().maximum = props['dest_max']
    map.push()

def on_refresh(arg):
    global db
    del db
    net = mapper.network(networkInterfaces['active'])
    db = mapper.database(net, subscribe_flags=mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
    init_database()

def on_save(arg):
    ds = list(db.devices(arg['dev']))
    fn = '/'.join(ds[0].name.split('/')[1:])
    fn.replace('/','_')
    fn = '.'.join(fn.split('.')[:-1]+['json'])
    return fn, mapperstorage.serialise(db, arg['dev'])

def on_load(mapping_json, devices):
    # pdb.set_trace()
    mapperstorage.deserialise(db, mapping_json, devices)

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


def init_database():
    db.add_device_callback(on_device)
    db.add_link_callback(on_link)
    db.add_signal_callback(on_signal)
    db.add_map_callback(on_map)

init_database()

server.add_command_handler("all_devices",
                           lambda x: ("all_devices",
                                      map(dev_props, db.devices())))

def subscribe(device):
    # cancel current subscriptions
    db.unsubscribe()

    if device == "All Devices":
        db.subscribe(mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = db.device(device)
        if dev:
            db.subscribe(dev, mapper.OBJ_OUTPUT_SIGNALS | mapper.OBJ_OUTGOING_MAPS)

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = db.device(names[0])
    if not dev:
        return null
    return dev.signal(names[1])

def new_map(args):
    map = mapper.map(find_sig(args[0]), find_sig(args[1]))
    if (len(args) > 2 and type(args[2]) is dict):
        print "setting map props with dict: ", args[2]
        map.set_properties(args[2])
    map.push()

def release_map(args):
    print 'release map!'
#    src = find_sig(args[0])
#    dst = find_sig(args[1])
#    if src and dst:
#        src.map(dst).release()
    find_sig(args[0]).maps().intersect(find_sig(args[1]).maps()).release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("all_signals",
                           lambda x: ("all_signals", map(sig_props, db.signals())))

server.add_command_handler("all_links",
                           lambda x: ("all_links", map(link_props, db.links())))

server.add_command_handler("all_connections",
                           lambda x: ("all_connections", map(map_props, db.maps())))

server.add_command_handler("set_map", set_map_properties)

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

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



server.serve(port=port, poll=lambda: db.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

