#!/usr/bin/env python

import webmapper_http_server as server
import mapper as mpr
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
            print('Error opening web browser, continuing anyway.')
    launcher = threading.Thread(target=launch)
    launcher.start()

g = mpr.graph()

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    props['key'] = dev['name']
    props['status'] = 'active'
    if 'is_local' in props:
        del props['is_local']
    if 'id' in props:
        del props['id']
    return props

def sig_props(sig):
    props = sig.properties.copy()
    props['device'] = sig.device()['name']
    props['key'] = props['device'] + '/' + props['name']
    props['num_maps'] = len(sig.maps());
    props['status'] = 'active'
    del props['is_local']
    del props['id']
    if props['direction'] == mpr.DIR_IN:
        props['direction'] = 'input'
    else:
        props['direction'] = 'output'
    if props['type'] == mpr.INT32:
        props['type'] = 'i'
    elif props['type'] == mpr.FLT:
        props['type'] = 'f'
    elif props['type'] == mpr.DBL:
        props['type'] = 'd'
    print(props)
    return props

def full_signame(sig):
    return sig.device()['name'] + '/' + sig['name']

def map_props(map):
    props = map.properties.copy()

    # add source slot properties
    num_srcs = props['num_sigs_in']
    srcs = []
    src_names = []
    for sig in map.signals(mpr.LOC_SRC):
        src = sig.properties.copy()
        src_name = full_signame(sig)
        src['key'] = src_name
        src_names.append(src_name)
        srcs.append(src)
    props['srcs'] = srcs

    # add destination slot properties
    for sig in map.signals(mpr.LOC_DST):
        dst = sig.properties.copy()
        dst_name = full_signame(sig)
        dst['key'] = dst_name
        props['dst'] = dst

    # generate key
    if num_srcs > 1:
        props['key'] = '['+','.join(src_names)+']' + '->' + '['+dst_name+']'
    else: props['key'] = src_names[0] + '->' + dst_name

    # translate some properties
    if props['process_loc'] == mpr.LOC_SRC:
        props['process_loc'] = 'src'
    else:
        props['process_loc'] = 'dst'
    if props['protocol'] == mpr.PROTO_UDP:
        props['protocol'] = 'UDP'
    elif props['protocol'] == mpr.PROTO_TCP:
        props['protocol'] = 'TCP'
    else:
        del props['protocol']
    props['status'] = 'active'
    props['id'] = str(props['id']) # if left as int js will lose precision & invalidate
    del props['is_local']
    if 'mode' in props:
        del props['mode']

    print("map_props", props)
    return props

def on_device(type, dev, action):
    print('ON_DEVICE')
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
        print('NEW DEVICE')
        server.send_command("add_devices", [dev_props(dev)])
    elif action == mpr.OBJ_REM:
        server.send_command("del_device", dev_props(dev))
    elif action == mpr.OBJ_EXP:
        server.send_command("del_device", dev_props(dev))

def on_signal(type, sig, action):
    print('ON_SIGNAL')
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
        print('NEW SIGNAL')
        server.send_command("add_signals", [sig_props(sig)])
    elif action == mpr.OBJ_REM:
        server.send_command("del_signal", sig_props(sig))

def on_map(type, map, action):
    print('ON_MAP')
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
        print('NEW MAP')
        server.send_command("add_maps", [map_props(map)])
    elif action == mpr.OBJ_REM:
        server.send_command("del_map", map_props(map))

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = g.devices().filter(mpr.PROP_NAME, names[0]).next()
    if dev:
        sig = dev.signals().filter(mpr.PROP_NAME, names[1]).next()
        print('found sig', sig, 'at', names);
        return sig
    else:
        print('error: could not find device', names[0])

def find_map(srckeys, dstkey):
    srcs = [find_sig(k) for k in srckeys]
    dst = find_sig(dstkey)
    if not (all(srcs) and dst): 
        print(srckeys, ' and ', dstkey, ' not found on network!')
        return
    intersect = dst.maps()
    for s in srcs:
        intersect = intersect.intersect(s.maps())
    for m in intersect:
        match = True
        match = match and (m.index(dst) >= 0)
        if match:
            for s in srcs:
                match = match and (m.index(s) >= 0)
        if match: 
            return m
    return None

def set_map_properties(props, map):
    print('set_map_properties:', props, map)
    if map == None:
        map = find_map(props['srcs'], props['dst'])
        print('found map with', props['srcs'], props['dst'])
        if not map:
            print("error: couldn't retrieve map ", props['src'], " -> ", props['dst'])
            return
    if 'src' in props:
        del props['src']
    if 'srcs' in props:
        del props['srcs']
    if 'dst' in props:
        del props['dst']
    for key in props:
        print('prop', key, props[key])
        val = props[key]
        print('prop', key, val)
        if val == 'true' or val == 'True' or val == 't' or val == 'T':
            val = True
        elif val == 'false' or val == 'False' or val == 'f' or val == 'F':
            val = False
        elif val == 'null' or val == 'Null':
            val = None
        if key == 'expr':
            map[mpr.PROP_EXPR] = val
        elif key == 'muted':
            if val == True or val == False:
                map[mpr.PROP_MUTED] = val
        elif key == 'protocol':
            if val == 'udp' or val == 'UDP':
                map[mpr.PROP_PROTOCOL] = mpr.PROTO_UDP
            elif val == 'tcp' or val == 'TCP':
                map[mpr.PROP_PROTOCOL] = mpr.PROTO_TCP
        else:
            map[key] = val
    map.push()

def on_save(arg):
    d = g.devices().filter(mpr.PROP_NAME, arg['dev']).next()
    fn = d.name+'.json'
    return fn, mprstorage.serialise(g, arg['dev'])

def on_load(arg):
    mprstorage.deserialise(g, arg['sources'], arg['destinations'], arg['loading'])

def select_interface(iface):
    print('switching interface to', iface)
    global g
    g.set_interface(iface)
    networkInterfaces['active'] = iface
    server.send_command("active_interface", iface)

def get_interfaces(arg):
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            connectedInterfaces.append(i)
    server.send_command("available_interfaces", connectedInterfaces)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("active_interface", networkInterfaces['active'])

def init_graph(arg):
    print('REFRESH!')
    global g
    g.subscribe(mpr.OBJ)

    # remove old callbacks (if they are registered)
    g.remove_callback(on_device)
    g.remove_callback(on_signal)
    g.remove_callback(on_map)

    # register callbacks
    g.add_callback(on_device, mpr.DEV)
    g.add_callback(on_signal, mpr.SIG)
    g.add_callback(on_map, mpr.MAP)

server.add_command_handler("add_devices",
                           lambda x: ("add_devices", [dev_props(d) for d in g.devices()]))

def subscribe(device):
    print('subscribe', device)
    if device == 'all_devices':
        g.subscribe(mpr.DEV)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = g.devices().filter(mpr.PROP_NAME, device).next()
        print('found dev:', dev)
        if dev:
            g.subscribe(dev, mpr.OBJ)

def new_map(args):
    srckeys, dstkey, props = args
    srcs = [find_sig(k) for k in srckeys]
    dst = find_sig(dstkey)
    if not (all(srcs) and dst): 
        print(srckeys, ' and ', dstkey, ' not found on network!')
        return

    map = mpr.map(srcs, dst)
    if not map:
        print('error: failed to create map', srckeys, "->", dstkey)
        return;
    else:
        print('created map: ', srckeys, ' -> ', dstkey)
    if props and type(props) is dict:
        set_map_properties(props, map)
    map.push()

def release_map(args):
    srckeys, dstkey = args
    m = find_map(srckeys, dstkey)
    if m != None: m.release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("add_signals",
                           lambda x: ("add_signals", [sig_props(s) for s in g.signals()]))

server.add_command_handler("add_maps",
                           lambda x: ("add_maps", [map_props(m) for m in g.maps()]))

server.add_command_handler("set_map", lambda x: set_map_properties(x, None))

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

server.add_command_handler("refresh", init_graph)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

server.add_command_handler("select_interface", select_interface)
server.add_command_handler("get_interfaces", get_interfaces)

get_interfaces(False)
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

server.serve(port=port, poll=lambda: g.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

