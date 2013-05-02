#!/usr/bin/env python

import json, re
import mapper

#for debugging
import pdb

def serialise(monitor, device):
    sources = {}
    destinations = {}
    connections = {}
    new_connections = []
    next_src = 0
    next_dest = 0
    next_connection = 0
    modeStr = {mapper.MO_BYPASS: 'bypass',
               mapper.MO_LINEAR: 'linear',
               mapper.MO_CALIBRATE: 'calibrate',
               mapper.MO_EXPRESSION: 'expression'}
    clipStr = {mapper.CT_NONE: 'none',
               mapper.CT_MUTE: 'mute',
               mapper.CT_CLAMP: 'clamp',
               mapper.CT_FOLD: 'fold',
               mapper.CT_WRAP: 'wrap'}

    for c in monitor.db.connections_by_device_name(device):

        this_connection = {
          'src': [ c['src_name'] ],
          'dest': [ c['dest_name'] ],
          'mute': c['muted'],
          'mode': c['mode'],
          'range': c['range'],
          'expression': c['expression'],
          'bound_min': c['clip_min'],
          'bound_max': c['clip_max'] 
        }
        new_connections.append(this_connection);

        # does the following source already have something in the string?
        if not sources.has_key(c['src_name']):
            sources[c['src_name']] = {
                'id': 's%d'%next_src,
                'device': c['src_name'].split('/')[1],
                'parameter': '/'+'/'.join(c['src_name'].split('/')[2:])
                }
            next_src += 1
        # does the following destination already have something in the string?
        if not destinations.has_key(c['dest_name']):
            destinations[c['dest_name']] = {
                'id': 'd%s'%next_dest,
                'device': c['dest_name'].split('/')[1],
                'parameter': '/'+'/'.join(c['dest_name'].split('/')[2:])
                }
            next_dest += 1
        connections[(c['src_name'],c['dest_name'])] = {
            'scaling': modeStr[c['mode']],
            'range': ' '.join(map(lambda x: '-' if x==None else str(x),
                                  c['range'])),
            'expression': (c['expression'].
                           replace('x', sources[c['src_name']]['id']).
                           replace('y', destinations[c['dest_name']]['id'])),
            'clipMin': clipStr[c['clip_min']],
            'clipMax': clipStr[c['clip_max']],
            'muted': c['muted'],
            }
    contents = {"fileversion": "2.0", "mapping": {
                            "connections": new_connections
                            }
                }
    return json.dumps(contents, indent=4)

def deserialise(monitor, mapping_json):
    js = json.loads(mapping_json)
    pdb.set_trace();

    modeIdx = {'bypass': mapper.MO_BYPASS,
               'linear': mapper.MO_LINEAR,
               'calibrate': mapper.MO_CALIBRATE,
               'expression': mapper.MO_EXPRESSION}
    clipIdx = {'none': mapper.CT_NONE,
               'mute': mapper.CT_MUTE,
               'clamp': mapper.CT_CLAMP,
               'fold': mapper.CT_FOLD,
               'wrap': mapper.CT_WRAP}

    m = js['mapping']
    srcs = {}
    dests = {}
    for s in m['sources']:
        srcs[s['id']] = s
    for d in m['destinations']:
        dests[d['id']] = d
    for c in m['connections']:
        s = [srcs[s] for s in srcs.keys()
             if (s in re.findall('(s\\d+)', c['expression']))]
        d = [dests[d] for d in dests.keys()
             if (d in re.findall('(d\\d+)', c['expression']))]
        links = [(x,y) for x in s for y in d]
        if len(links)>1:
            print 'Error, multiple links specified for connection', c
            continue
        if len(links)<1:
            # If not enough sources or destinations are specified in the
            # expression string, ignore this connection.
            # This can happen e.g. if expression is a constant: "d1=1"
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
                 'range': map(lambda x: None if x=='-' else float(x),
                              c['range'].split()),
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
