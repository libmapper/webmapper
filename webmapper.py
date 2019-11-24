#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import mapperstorage
import netifaces # a library to find available network interfaces
import sys, os, os.path, threading, json, re, pdb
from random import randint

initialized = False
db = None
iface = None

networkInterfaces = {'active': '', 'available': []}

boundaryModes = ['undefined', 'none', 'mute', 'clamp', 'fold', 'wrap']
boundaryStrings = { 'undefined': mapper.BOUND_UNDEFINED,
                    'none': mapper.BOUND_NONE,
                    'mute': mapper.BOUND_MUTE,
                    'clamp': mapper.BOUND_CLAMP,
                    'fold': mapper.BOUND_FOLD,
                    'wrap': mapper.BOUND_WRAP }

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

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    props['key'] = dev.name
    props['status'] = 'active'
    if 'is_local' in props:
        del props['is_local']
    if 'id' in props:
        del props['id']
    return props

def link_props(link):
    props = link.properties.copy()
    props['src'] = link.device(0).name
    props['dst'] = link.device(1).name
    props['key'] = link.device(0).name + '<->' + link.device(1).name
    props['status'] = 'active'
    del props['is_local']
    props['id'] = str(props['id'])
    return props

def sig_props(sig):
    props = sig.properties.copy()
    props['device'] = sig.device().name
    props['key'] = props['device'] + '/' + props['name']
    props['num_maps'] = sig.num_maps;
    props['status'] = 'active'
    del props['is_local']
    del props['id']
    if props['direction'] == mapper.DIR_INCOMING:
        props['direction'] = 'input'
    else:
        props['direction'] = 'output'
    return props

def full_signame(sig):
    return sig.device().name + '/' + sig.name

def translate_bound(bound):
    if bound < mapper.BOUND_UNDEFINED or bound > mapper.BOUND_WRAP:
        bound = mapper.BOUND_UNDEFINED
    return boundaryModes[bound]

def map_props(map):
    props = map.properties.copy()

    # add source slot properties
    num_srcs = props['num_inputs']
    srcs = []
    src_names = []
    for i in range(0, num_srcs):
        src = map.source(i).properties.copy()
        src_name = full_signame(map.source(i).signal())
        src['key'] = src_name
        if 'bound_min' in src:
            src['bound_min'] = translate_bound(src['bound_min'])
        if 'bound_max' in src:
            src['bound_max'] = translate_bound(src['bound_max'])
        src_names.append(src_name)
        srcs.append(src)
    props['srcs'] = srcs

    # add destination slot properties
    dst_name = full_signame(map.destination().signal())
    dst = map.destination().properties.copy()
    dst['key'] = dst_name
    if 'bound_min' in dst:
        dst['bound_min'] = translate_bound(dst['bound_min'])
    if 'bound_max' in dst:
        dst['bound_max'] = translate_bound(dst['bound_max'])
    props['dst'] = dst

    # generate key
    if num_srcs > 1: 
        props['key'] = '['+','.join(src_names)+']' + '->' + '['+dst_name+']'
    else: props['key'] = src_names[0] + '->' + dst_name

    # translate some properties
    if props['process_location'] == mapper.LOC_SOURCE:
        props['process_location'] = 'source'
    else:
        props['process_location'] = 'destination'
    if props['protocol'] == mapper.PROTO_UDP:
        props['protocol'] = 'UDP'
    elif props['protocol'] == mapper.PROTO_TCP:
        props['protocol'] = 'TCP'
    else:
        del props['protocol']
    props['status'] = 'active'
    props['id'] = str(props['id']) # if left as int js will lose precision & invalidate
    del props['is_local']

    # translate some other properties
    if props['mode'] == mapper.MODE_LINEAR:
        props['mode'] = 'linear'
    elif props['mode'] == mapper.MODE_EXPRESSION:
        props['mode'] = 'expression'

    return props

def on_device(dev, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_DEVICE (added or modified)', dev_props(dev)
        server.send_command("add_devices", [dev_props(dev)])
    elif action == mapper.REMOVED:
#        print 'ON_DEVICE (removed)', dev_props(dev)
        server.send_command("del_device", dev_props(dev))
    elif action == mapper.EXPIRED:
#        print 'ON_DEVICE (expired)', dev_props(dev)
        db.flush()

def on_link(link, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_LINK (added or modified)', link_props(link)
        server.send_command("add_links", [link_props(link)])
    elif action == mapper.REMOVED:
#        print 'ON_LINK (removed)', link_props(link)
        server.send_command("del_link", link_props(link))

def on_signal(sig, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_SIGNAL (added or modified)', sig_props(sig)
        server.send_command("add_signals", [sig_props(sig)])
    elif action == mapper.REMOVED:
#        print 'ON_SIGNAL (removed)', sig_props(sig)
        server.send_command("del_signal", sig_props(sig))

def on_map(map, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_MAP', '(added)' if action == mapper.ADDED else '(modified)', map_props(map)
        server.send_command("add_maps", [map_props(map)])
    elif action == mapper.REMOVED:
#        print 'ON_MAP (removed)', map_props(map)
        server.send_command("del_map", map_props(map))

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = db.device(names[0])
    if dev:
        sig = dev.signal(names[1])
        return sig
    else:
        print 'error: could not find device', names[0]

def find_map(srckeys, dstkey):
    srcs = [find_sig(k) for k in srckeys]
    dst = find_sig(dstkey)
    if not (all(srcs) and dst): 
        print srckeys, ' and ', dstkey, ' not found on network!'
        return
    intersect = dst.maps()
    for s in srcs:
        intersect = intersect.intersect(s.maps())
    for m in intersect:
        match = True
        match = match and m.slot(dst)
        if match:
            for s in srcs:
                match = match and m.slot(s)
        if match: 
            return m
    return None

def as_number(value):
    if type(value) is int or type(value) is float:
        return value
    else:
        if type(value) is str:
            value = value.replace(',',' ').split()
        numargs = len(value)
        for i in range(numargs):
            value[i] = float(value[i])
        if numargs == 1:
            value = value[0]
        return value

def set_map_properties(args, map):
    srckeys, dstkey, props = args
    if not map:
        map = find_map(srckeys, dstkey)
        if not map:
            print "error: couldn't retrieve map ", srckeys, " -> ", dstkey
            return
    for key in props:
        if key in ['version']:
            continue;
        elif key == 'srcs':
            srcs = props[key]
            srcidx = 0
            for src in srcs:
                for subkey in src:
                    value = src[subkey]
                    if subkey == 'min' or subkey == 'max':
                        value = as_number(value)
                    elif subkey == 'bound_min' or subkey == 'bound_max':
                        value = boundaryStrings[value]
                map.source(srcidx).set_property(subkey, value)
                srcidx += 1
        elif key.startswith('src'):
            srcidx = -1
            argidx = -1
            if key[3] == '[' and key[5:6] == '].':
                srcidx = int(key[4])
                argidx = 7
            elif key[3] == '.':
                srcidx = 0
                argidx = 4
            else:
                continue
            subkey = key[argidx:]
            value = props[key]
            if subkey == 'min' or subkey == 'max':
                value = as_number(value)
            elif subkey == 'bound_min' or subkey == 'bound_max':
                value = boundaryStrings[value]
            map.source(srcidx).set_property(subkey, value)
        elif key == 'dst':
            dst = props[key]
            for subkey in dst:
                value = dst[subkey]
                if subkey == 'min' or subkey == 'max':
                    value = as_number(value)
                elif subkey == 'bound_min' or subkey == 'bound_max':
                    value = boundaryStrings[value]
                map.destination().set_property(subkey, value)
        elif key.startswith('dst.'):
            subkey = key[4:]
            value = props[key]
            if subkey == 'min' or subkey == 'max':
                value = as_number(value)
            elif subkey == 'bound_min' or subkey == 'bound_max':
                value = boundaryStrings[value]
            map.destination().set_property(subkey, value)
        elif key == 'mode':
            if props['mode'] == 'linear':
                map.mode = mapper.MODE_LINEAR
            elif props['mode'] == 'expression':
                map.mode = mapper.MODE_EXPRESSION
            else:
                print 'error: unknown mode ', props['mode']
        elif key == 'protocol':
            if props['protocol'] == 'UDP':
                map.protocol = mapper.PROTO_UDP
            elif props['protocol'] == 'TCP':
                map.protocol = mapper.PROTO_TCP
            else:
                print 'error: unknown protocol ', props['protocol']
        else:
            map.set_property(key, props[key])
    map.push()

def on_save(arg):
    d = db.device(arg['dev'])
    fn = d.name+'.json'
    return fn, mapperstorage.serialise(db, arg['dev'])

def on_load(arg):
    mapperstorage.deserialise(db, arg['sources'], arg['destinations'], arg['loading'])

def get_networks(arg):
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            connectedInterfaces.append(i)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("available_networks", networkInterfaces['available'])
    server.send_command("active_network", networkInterfaces['active'])

def select_network(newNetwork):
    global db
    global initialized
    if db:
        if networkInterfaces['active'] == newNetwork:
            # no change
            return
        db.flush(0)
    net = mapper.network(newNetwork)
    networkInterfaces['active'] = net.interface
    db = mapper.database(net)
    get_networks(False)
    initialized = False

def init_database(arg):
    global db
    global initialized
    if initialized == False:
        db.subscribe(mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
        db.add_device_callback(on_device)
        db.add_link_callback(on_link)
        db.add_signal_callback(on_signal)
        db.add_map_callback(on_map)
        initialized = True
    else:
        server.send_command("add_devices", map(dev_props, db.devices()))
        server.send_command("add_links", map(link_props, db.links()))
        server.send_command("add_signals", map(sig_props, db.signals()))
        server.send_command("add_maps", map(map_props, db.maps()))

server.add_command_handler("add_devices",
                           lambda x: ("add_devices", map(dev_props, db.devices())))

def subscribe(name):
    if name == "all_devices":
        db.subscribe(mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = db.device(name)
        if dev:
            db.subscribe(dev, mapper.OBJ_ALL)

def new_map(args):
    srckeys, dstkey, props = args
    srcs = [find_sig(k) for k in srckeys]
    dst = find_sig(dstkey)
    if not (all(srcs) and dst): 
        print srckeys, ' and ', dstkey, ' not found on network!'
        return

    map = mapper.map(srcs, dst)
    if not map:
        print 'error: failed to create map', srckeys, "->", dstkey
        return;
    else:
        print 'created map: ', srckeys, ' -> ', dstkey
    if props and type(props) is dict:
        set_map_properties(args, map)
    map.push()

def release_map(args):
    srckeys, dstkey = args
    m = find_map(srckeys, dstkey)
    if m != None: m.release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("add_signals",
                           lambda x: ("add_signals", map(sig_props, db.signals())))

server.add_command_handler("add_links",
                           lambda x: ("add_links", map(link_props, db.links())))

server.add_command_handler("add_maps",
                           lambda x: ("add_maps", map(map_props, db.maps())))

server.add_command_handler("set_map", lambda x: set_map_properties(x, None))

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

server.add_command_handler("refresh", init_database)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

server.add_command_handler("select_network", select_network)
server.add_command_handler("get_networks", get_networks)

if '--iface' in sys.argv:
    idx = sys.argv.index('--iface')
    iface = sys.argv[idx+1]
select_network(iface)

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

