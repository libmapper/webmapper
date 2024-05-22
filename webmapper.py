#!/usr/bin/env python

import webmapper_http_server as server
import netifaces # a library to find available network interfaces
import sys, os, os.path, threading, json, re, pdb
from random import randint
if 'win32' in sys.platform:
    import winreg as wr

try:
    import libmapper as mpr
except:
    try:
        sys.path.append(
                        os.path.join(os.path.join(os.getcwd(),
                                                  os.path.dirname(sys.argv[0])),
                                     '../libmapper/bindings/python/'))
        import libmapper as mpr
        print('Using local libmapper repo')
    except:
        print('Error importing libmapper module!!.')
        sys.exit(1)

try:
    import mappersession as session
except:
    try:
        sys.path.append(
                        os.path.join(os.path.join(os.getcwd(),
                                                  os.path.dirname(sys.argv[0])),
                                     '../mappersession/src/mappersession'))
        import mappersession as session
        print('Using local mappersession repo')
    except:
        print('Error importing mappersession module.')
        sys.exit(1)

networkInterfaces = {'active': '', 'available': []}

dirname = os.path.dirname(__file__)
if dirname:
   os.chdir(os.path.dirname(__file__))

if 'tracing' in sys.argv[1:]:
    server.tracing = True

new_devs = {}
del_devs = {}
new_sigs = {}
del_sigs = {}
new_maps = {}
del_maps = {}

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
    launcher = threading.Thread(target=launch, daemon=True)
    launcher.start()

graph = mpr.Graph()
webmapper_dev = mpr.Device("webmapper", graph)
webmapper_dev['display'] = False

def monitor_handler(sig, event, id, val, timetag):
    server.send_command("update_sig_monitor", val)

monitor_sig = webmapper_dev.add_signal(mpr.Signal.Direction.INCOMING, "monitor", 1, mpr.Type.FLOAT,
                                       None, -100000, 100000, None, monitor_handler)
monitor_sig['display'] = False

if '--iface' in sys.argv:
    iface = sys.argv[sys.argv.index('--iface')+1]
    graph.set_interface(iface)

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    props['key'] = props['name']
    props['status'] = props['status'].name
    if 'is_local' in props:
        del props['is_local']
    if 'id' in props:
        del props['id']
    if 'linked' in props:
        linked = props['linked']
        if linked != None:
            # convert device list to names
            devnames = [d['name'] for d in props['linked']]
            props['linked'] = devnames
    if 'signal' in props:
        del props['signal']
    return props

def sig_props(sig):
    props = sig.properties.copy()
    dev = sig.device()
    props['device'] = dev['name']
    props['key'] = props['device'] + '/' + props['name']
    props['num_maps'] = len(sig.maps());
    if 'status' in props:
        props['status'] = props['status'].name
    del props['is_local']
    del props['id']
    props['direction'] = props['direction'].name
    props['steal'] = props['steal'].name
    props['type'] = props['type'].name
#    print(props)
    return props

def full_signame(sig):
    return sig.device()['name'] + '/' + sig['name']

def get_key(sig):
    return sig['key']

def map_props(map):
    props = map.properties.copy()
    # add source slot properties
    num_srcs = props['num_sigs_in']
    srcs = []
    src_names = []
    for sig in map.signals(mpr.Map.Location.SOURCE):
        src = sig_props(sig)
        src_names.append(src['key'])
        srcs.append(src)
    # need to sort sources alphabetically
    srcs.sort(key=get_key)
    props['srcs'] = srcs
    # add destination slot properties
    for sig in map.signals(mpr.Map.Location.DESTINATION):
        dst = sig_props(sig)
        dst_name = dst['key']
        props['dst'] = dst
    # generate key
    if num_srcs > 1:
        props['key'] = '['+','.join(src_names)+']' + '->' + '['+dst_name+']'
    else: props['key'] = src_names[0] + '->' + dst_name

    # translate some properties
    props['process_loc'] = props['process_loc'].name
    props['protocol'] = props['protocol'].name
    props['status'] = props['status'].name
    props['id'] = str(props['id']) # if left as int js will lose precision & invalidate
    del props['is_local']
    if 'mode' in props:
        del props['mode']
    if 'scope' in props and props['scope'] != None:
        # convert device list to names
        devnames = [d['name'] for d in props['scope']]
        props['scope'] = devnames
#    print("map_props", props)
    return props

def on_device(type, dev, event):
#    print('ON_DEVICE:', event, dev)
    dev = dev_props(dev)
    if event == mpr.Graph.Event.NEW or event == mpr.Graph.Event.MODIFIED:
        new_devs[dev['key']] = dev
    elif event == mpr.Graph.Event.REMOVED or event == mpr.Graph.Event.EXPIRED:
        # TODO: just send keys instead or entire object
        del_devs[dev['key']] = dev

def on_signal(type, sig, event):
#    print('ON_SIGNAL:', event)
    sig = sig_props(sig)
    if event == mpr.Graph.Event.NEW or event == mpr.Graph.Event.MODIFIED:
        new_sigs[sig['key']] = sig
    elif event == mpr.Graph.Event.REMOVED:
        del_sigs[sig['key']] = sig

def on_map(type, map, event):
#    print('ON_MAP:', event)
    map = map_props(map)
    if event == mpr.Graph.Event.NEW or event == mpr.Graph.Event.MODIFIED:
        new_maps[map['key']] = map
    elif event == mpr.Graph.Event.REMOVED:
        del_maps[map['key']] = map

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = graph.devices().filter(mpr.Property.NAME, names[0])
    if dev:
        sig = dev.next().signals().filter(mpr.Property.NAME, names[1])
        if not sig:
            print('error: could not find signal', names[1])
            return None
        return sig.next()
    else:
        print('error: could not find device', names[0])
        return None

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
#    print('set_map_properties:', props, map)
    if map == None:
        map = find_map(props['srcs'], props['dst'])
#        print('found map with', props['srcs'], props['dst'])
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
#        print('prop', key, props[key])
        val = props[key]
#        print('prop', key, val)
        if val == 'true' or val == 'True' or val == 't' or val == 'T':
            val = True
        elif val == 'false' or val == 'False' or val == 'f' or val == 'F':
            val = False
        elif val == 'null' or val == 'Null':
            val = None
        if key == 'expr':
            map[mpr.Property.EXPRESSION] = val
        elif key == 'muted':
            if val == True or val == False:
                map[mpr.Property.MUTED] = val
        elif key == 'process_loc':
            if val == 'src':
                map[mpr.Property.PROCESS_LOCATION] = mpr.Map.Location.SOURCE
            elif val == 'dst':
                map[mpr.Property.PROCESS_LOCATION] = mpr.Map.Location.DESTINATION
        elif key == 'protocol':
            if val == 'udp' or val == 'UDP':
                map[mpr.Property.PROTOCOL] = mpr.Map.Protocol.UDP
            elif val == 'tcp' or val == 'TCP':
                map[mpr.Property.PROTOCOL] = mpr.Map.Protocol.TCP
        elif key == 'scope':
            # skip for now
            print("skipping scope property for now")
        else:
            map[key] = val
    map.push()

def set_dev_properties(props):
    print('set_dev_properties()', props)

    # find dev by name
    dev = graph.devices().filter(mpr.Property.NAME, props['name'])
    if not dev:
        return
    dev = dev.next()

    print('found dev: ', dev)
    del props['name']

    pub = False
    if 'publish' in props:
        publish = props['publish']
        del props['publish']

    if 'hidden' in props:
        del props['hidden']

    # set metadata
    for key in props:
        dev.set_property(key, props[key], publish=pub)
    dev.push()

    if 'hidden' in props:
        # need to refresh session tags
        server.send_command("sessions", session.tags(graph=graph))

def set_sig_properties(props):
#    check how arbitrary metadata are set – can we use this instead?
    print('set_sig_properties()', props)

    # find sig by name
    sig = find_sig(props['name'])
    if not sig:
        return
    print('found sig: ', sig)
    del props['name']

    # set metadata
    for key in props:
        if key == 'value':
            print('trying to set remote signal value!')
            sig.set_value(props[key])
        else:
            sig[key] = props[key]

def on_save(args):
    global graph
    sessionJson = session.save("", "", [], [], graph=graph)
    server.send_command("save_session", sessionJson)
    # also need to tag maps with new session name

def start_monitor_sig(sig_name):
    global monitor_sig
    print("Monitoring signal: ", sig_name)
    stop_monitor_sig(None)
    webmapper_sig_name = (webmapper_dev[mpr.Property.NAME] + "/" + monitor_sig[mpr.Property.NAME])
    new_map([[sig_name], webmapper_sig_name, {"expr": "y=x"}])

def stop_monitor_sig(args):
    global monitor_sig
    # Clear any maps to the 'monitor_sig' signal
    for map in monitor_sig.maps():
        map.release()
        map.push()

def on_load(args):
    global graph
    views = session.load_json(args[0], args[1], graph=graph)

def on_unload(args):
    global graph
    session.unload(args[0], graph=graph)

# Returns a readable network interface name from a win32 guid
def win32_get_name_from_guid(iface_guid):
    reg = wr.ConnectRegistry(None, wr.HKEY_LOCAL_MACHINE)
    iface_name = ""
    reg_key = wr.OpenKey(reg, r'SYSTEM\CurrentControlSet\Control\Network\{4d36e972-e325-11ce-bfc1-08002be10318}')
    try:
        reg_subkey = wr.OpenKey(reg_key, iface_guid + r'\Connection')
        iface_name = wr.QueryValueEx(reg_subkey, 'Name')[0]
    except FileNotFoundError:
        pass
    return iface_name

def select_interface(iface):
    global graph
    graph.set_interface(iface)
    iface = graph.get_interface()
    networkInterfaces['active'] = iface
    server.send_command("active_interface", iface)

def get_interfaces(arg):
    global graph
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            if 'win32' in sys.platform:
                ifaceName = win32_get_name_from_guid(i)
                if ifaceName != "":
                    connectedInterfaces.append(ifaceName)
            else:
                connectedInterfaces.append(i)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("available_interfaces", connectedInterfaces)
    networkInterfaces['active'] = graph.get_interface()
    server.send_command("active_interface", networkInterfaces['active'])

def init_graph(arg):
    print('REFRESH!')
    global graph

    # remove old callbacks (if they are registered)
    graph.remove_callback(on_device)
    graph.remove_callback(on_signal)
    graph.remove_callback(on_map)

    # register callbacks
    graph.add_callback(on_device, mpr.Type.DEVICE)
    graph.add_callback(on_signal, mpr.Type.SIGNAL)
    graph.add_callback(on_map, mpr.Type.MAP)

    # (re)subscribe: currently this does nothing but could refresh graph database?
    graph.subscribe(None, mpr.Type.OBJECT, -1)

    for d in graph.devices():
        if 'display' in d and d['display'] == False:
            continue
        server.send_command("add_devices", [dev_props(d)])
    for s in graph.signals():
        if 'display' in s and s['display'] == False:
            continue
        server.send_command("add_signals", [sig_props(s)])
    for m in graph.maps():
        server.send_command("add_maps", [map_props(m)])
    server.send_command("sessions", session.tags(graph=graph))

init_graph(0)

server.add_command_handler("add_devices",
                           lambda x: ("add_devices", [dev_props(d) for d in graph.devices().filter('display', True, mpr.Operator.NOT_EQUAL)]))

def subscribe(device):
    if device == 'all_devices':
        graph.subscribe(None, mpr.Type.DEVICE, -1)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = graph.devices().filter(mpr.Property.NAME, device)
        if dev:
            graph.subscribe(dev.next(), mpr.Type.OBJECT, -1)
        else:
            print("no device matching name", device)

def new_map(args):
    srckeys, dstkey, props = args
    srcs = [find_sig(k) for k in srckeys]
    dst = find_sig(dstkey)
    if not (all(srcs) and dst): 
        print(srckeys, ' and ', dstkey, ' not found on network!')
        return

    map = mpr.Map(srcs, dst)
    if not map:
        print('error: failed to create map', srckeys, "->", dstkey)
        return;
    else:
        print('created map: ', srckeys, ' -> ', dstkey)
    if props and type(props) is dict:
        set_map_properties(props, map)
    else:
        map.push()

def release_map(args):
    srckeys, dstkey = args
    m = find_map(srckeys, dstkey)
    if m != None: m.release()

def poll_and_push():
    global graph
    graph.poll(40)
    webmapper_dev.poll(10)
    update_sessions = False
    if len(new_devs) > 0:
        server.send_command("add_devices", list(new_devs.values()))
        new_devs.clear()
    if len(del_devs) > 0:
        server.send_command("del_devices", list(del_devs.values()))
        del_devs.clear()
    if len(new_sigs) > 0:
        server.send_command("add_signals", list(new_sigs.values()))
        new_sigs.clear()
    if len(del_sigs) > 0:
        server.send_command("del_signals", list(del_sigs.values()))
        del_sigs.clear()
    if len(new_maps) > 0:
        server.send_command("add_maps", list(new_maps.values()))
        new_maps.clear()
        update_sessions = True
    if len(del_maps) > 0:
        server.send_command("del_maps", list(del_maps.values()))
        del_maps.clear()
        update_sessions = True
    if update_sessions:
        server.send_command("sessions", session.tags(graph=graph))

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("set_dev", lambda x: set_dev_properties(x))

server.add_command_handler("add_signals",
                           lambda x: ("add_signals", [sig_props(s) for s in graph.signals()]))

server.add_command_handler("set_sig", lambda x: set_sig_properties(x))
server.add_command_handler("monitor_sig", start_monitor_sig)
server.add_command_handler("stop_monitor_sig", stop_monitor_sig)

server.add_command_handler("add_maps",
                           lambda x: ("add_maps", [map_props(m) for m in graph.maps()]))

server.add_command_handler("set_map", lambda x: set_map_properties(x, None))

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

server.add_command_handler("refresh", init_graph)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)
server.add_command_handler("unload", on_unload)

server.add_command_handler("select_interface", select_interface)
server.add_command_handler("get_interfaces", get_interfaces)

get_interfaces(False)

try:
    port = int(sys.argv[sys.argv.index('--port'):][1])
except:
    #port = randint(49152,65535)
    port = 50000

on_open = lambda: ()
if not '--no-browser' in sys.argv and not '-n' in sys.argv:
    on_open = lambda: open_gui(port)

server.serve(port=port, poll=poll_and_push, on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

