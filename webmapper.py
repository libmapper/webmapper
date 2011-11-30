#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import sys, os, threading, json
from random import randint

if 'tracing' in sys.argv[1:]:
    server.tracing = True

def open_gui(port):
    url = 'http://localhost:%d'%port
    apps = ['~\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe --app=%s',
            'open -n -a "Google Chrome" --args --app=%s',
            '/usr/bin/chromium-browser --app=%s',
            ]
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

def on_refresh(arg):
    global monitor
    del monitor
    monitor = mapper.monitor()
    init_monitor()

def on_save(arg):
    d = arg['dev']
    ds = list(monitor.db.match_devices_by_name(arg['dev']))
    fn = '/'.join(ds[0]['name'].split('/')[1:])
    fn.replace('/','_')
    fn = '.'.join(fn.split('.')[:-1]+['json'])
    sources = {}
    destinations = {}
    connections = {}
    next_src = 0
    next_dest = 0
    modeStr = {mapper.MO_BYPASS: 'bypass',
               mapper.MO_LINEAR: 'linear',
               mapper.MO_CALIBRATE: 'calibrate',
               mapper.MO_EXPRESSION: 'expression'}
    clipStr = {mapper.CT_NONE: 'none',
               mapper.CT_MUTE: 'mute',
               mapper.CT_CLAMP: 'clamp',
               mapper.CT_FOLD: 'fold',
               mapper.CT_WRAP: 'wrap'}
    for c in monitor.db.connections_by_device_name(arg['dev']):
        if not sources.has_key(c['src_name']):
            sources[c['src_name']] = {
                'id': 's%d'%next_src,
                'device': c['src_name'].split('/')[1],
                'parameter': '/'+'/'.join(c['src_name'].split('/')[2:])
                }
            next_src += 1
        if not destinations.has_key(c['dest_name']):
            destinations[c['dest_name']] = {
                'id': 'd%s'%next_dest,
                'device': c['dest_name'].split('/')[1],
                'parameter': '/'+'/'.join(c['dest_name'].split('/')[2:])
                }
            next_dest += 1
        connections[(c['src_name'],c['dest_name'])] = {
            'scaling': modeStr[c['mode']],
            'range': ' '.join(map(str,c['range'])),
            'expression': (c['expression'].
                           replace('x', sources[c['src_name']]['id']).
                           replace('y', destinations[c['dest_name']]['id'])),
            'clipMin': clipStr[c['clip_min']],
            'clipMax': clipStr[c['clip_max']],
            'muted': c['muted'],
            }
    contents = {"mapping": {"fileversion": "dot-1",
                            "sources": sources.values(),
                            "destinations": destinations.values(),
                            "connections": connections.values()}}
    return fn, json.dumps(contents, indent=4)

def on_load(mapping_json):
    modeIdx = {'bypass': mapper.MO_BYPASS,
               'linear': mapper.MO_LINEAR,
               'calibrate': mapper.MO_CALIBRATE,
               'expression': mapper.MO_EXPRESSION}
    clipIdx = {'none': mapper.CT_NONE,
               'mute': mapper.CT_MUTE,
               'clamp': mapper.CT_CLAMP,
               'fold': mapper.CT_FOLD,
               'wrap': mapper.CT_WRAP}

    m = mapping_json['mapping']
    srcs = {}
    dests = {}
    for s in m['sources']:
        srcs[s['id']] = s
    for d in m['destinations']:
        dests[d['id']] = d
    for c in m['connections']:
        s = [srcs[s] for s in srcs.keys() if (s in c['expression'])]
        d = [dests[d] for d in dests.keys() if (d in c['expression'])]
        links = [(x,y) for x in s for y in d]
        if len(links)>1:
            print 'Error, multiple links specified for connection', c
            continue
        link = links[0]

        srcdev = str('/'+link[0]['device'])
        destdev = str('/'+link[1]['device'])

        # Only make a link if it doesn't already exist.
        if not monitor.db.link_by_src_dest_names(srcdev, destdev):
            monitor.link(srcdev, destdev)

        e = (c['expression'].replace(link[0]['id'], 'x')
                            .replace(link[1]['id'], 'y'))

        # Range may have integers, floats, or '-' strings. When
        # converting to a list of floats, pass through anything that
        # doesn't parse as a float or int.
        rng = []
        for r in c['range'].split():
            try:
                rng.append(int(r))
            except:
                try:
                    rng.append(float(r))
                except:
                    rng.append(r)

        args = (srcdev + str(link[0]['parameter']),
                destdev + str(link[1]['parameter']),
                {'mode': modeIdx[c['scaling']],
                 'range': map(float,c['range'].split()),
                 'expression': e,
                 'clip_min': clipIdx[c['clipMin']],
                 'clip_max': clipIdx[c['clipMax']],
                 'muted': c['muted']})

        # If connection already exists, use 'modify', otherwise 'connect'.
        cs = list(monitor.db.connections_by_device_and_signal_names(
                str(link[0]['device']), str(link[0]['parameter']),
                str(link[1]['device']), str(link[1]['parameter'])))
        if len(cs)>0:
            args[2]['src_name'] = args[0]
            args[2]['dest_name'] = args[1]
            monitor.modify(args[2])
        else:
            monitor.connect(*args)

        # TODO: Strictly speaking we should wait until links are
        # acknowledged before continuing with a connection.  An
        # asynchronous approach would be necessary for this, by
        # passing a continuation to the monitor's link handler.

def init_monitor():
    monitor.request_devices()
    monitor.db.add_device_callback(on_device)
    monitor.db.add_signal_callback(on_signal)
    monitor.db.add_link_callback(on_link)
    monitor.db.add_connection_callback(on_connection)

init_monitor()

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
    port = randint(1025,65535)

on_open = lambda: ()
if not '--no-browser' in sys.argv and not '-n' in sys.argv:
    on_open = lambda: open_gui(port)

server.serve(port=port, poll=lambda: monitor.poll(100), on_open=on_open)
