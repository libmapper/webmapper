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
    boundStr = {mapper.BA_NONE: 'none',
               mapper.BA_MUTE: 'mute',
               mapper.BA_CLAMP: 'clamp',
               mapper.BA_FOLD: 'fold',
               mapper.BA_WRAP: 'wrap'}

    for c in monitor.db.connections_by_device_name(device):
      
        this_connection = {
          'src': [ c['src_name'] ],
          'dest': [ c['dest_name'] ],
          'mute': c['muted'],
          'mode': modeStr[c['mode']],
          'range': c['range'],
          'expression': c['expression'],
          'bound_min': boundStr[c['bound_min']],
          'bound_max': boundStr[c['bound_max']] 
        }
        # To get proper expression nomenclature
        # dest[0] = src[0] NOT y = x
        this_connection['expression'] = this_connection['expression'].replace('y', 'dest[0]').replace('x', 'src[0]')
        new_connections.append(this_connection);

        """
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
            'boundMin': boundStr[c['bound_min']],
            'boundMax': boundStr[c['bound_max']],
            'muted': c['muted'],
            }"""
    
    contents = {"fileversion": "2.0", "mapping": {
                            "connections": new_connections
                            }
                }
    """
    contents = {"mapping": {"fileversion": "dot-1",
                                "sources": sources.values(),
                                "destinations": destinations.values(),
                                "connections": connections.values()}}"""

    return json.dumps(contents, indent=4)

def deserialise(monitor, mapping_json, devices):
    js = json.loads(mapping_json)

    #The version we're currently working with
    version = '';
    if 'fileversion' in js:
        version = js['fileversion']
    elif 'fileversion' in  js['mapping']:
        version = js['mapping']['fileversion']

    modeIdx = {'bypass': mapper.MO_BYPASS,
               'linear': mapper.MO_LINEAR,
               'calibrate': mapper.MO_CALIBRATE,
               'expression': mapper.MO_EXPRESSION}
    boundIdx = {'none': mapper.BA_NONE,
               'mute': mapper.BA_MUTE,
               'clamp': mapper.BA_CLAMP,
               'fold': mapper.BA_FOLD,
               'wrap': mapper.BA_WRAP}

    m = js['mapping']

    # This is a version 2.0 save file
    if version == '2.0':
        for c in m['connections']:
            # First, make certain to create necessary links
            # Since we're accomodating many-to-many connections, etc.
            # sources and destinations are lists, devices are split from the second '/' character
            srcdevs = devices['sources']
            destdevs = devices['destinations']
            links = [( str(x), str(y) ) for x in srcdevs for y in destdevs]
            # Don't want to explicitly create links now
            """
            for l in links:
                # Only make a link if it does not already exist
                if not monitor.db.link_by_src_dest_names(l[0], l[1]):
                    monitor.link(l[0], l[1])"""

            #The name of the source signal (without device, assuming 1 to 1 for now)
            srcsig = str(c['src'][0]).split('/')[2]
            #And the destination
            destsig = str(c['dest'][0]).split('/')[2]

            # The expression, agian we're simply replacing based on an assumption of 1 to 1 connections
            e = str(c['expression'].replace('src[0]', 'x')
                                   .replace('dest[0]', 'y'))

            for l in links:
                if monitor.db.link_by_src_dest_names(l[0], l[1]):
                    args = (str(l[0]+'/'+srcsig),
                            str(l[1]+'/'+destsig),
                            {'mode': modeIdx[c['mode']],
                             'range': c['range'],
                             'expression': e,
                             'bound_min': boundIdx[c['bound_min']],
                             'bound_max': boundIdx[c['bound_max']],
                             'muted': c['mute']})

                    # If connection already exists, use 'modify', otherwise 'connect'.
                    # Assumes 1 to 1, again
                    cs = list(monitor.db.connections_by_device_and_signal_names(
                        (l[0]).split('/')[1], srcsig,
                        (l[1]).split('/')[1], destsig) )
                    if len(cs) > 0:
                        args[2]['src_name'] = args[0]
                        args[2]['dest_name'] = args[1]
                        monitor.modify(args[2])
                    else:
                        monitor.connect(*args)

    # This is a version 1 save file
    # As of now, version 1 explicitly save devices
    # So it can create links, whereas v2.0 cannot
    if version == 'dot-1':
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

            # The expression itself
            e = str(c['expression'].replace(link[0]['id'], 'x')
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

            srcsig = srcdev + str(link[0]['parameter'])
            destsig = destdev + str(link[1]['parameter'])

        
            args = (srcdev + str(link[0]['parameter']),
                    destdev + str(link[1]['parameter']),
                    {'mode': modeIdx[c['scaling']],
                     'range': map(lambda x: None if x=='-' else float(x),
                                  c['range'].split()),
                     'expression': e,
                     'bound_min': boundIdx[c['boundMin']],
                     'bound_max': boundIdx[c['boundMax']],
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
