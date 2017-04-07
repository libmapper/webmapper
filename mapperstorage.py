#!/usr/bin/env python

import json, re
import mapper

#for debugging
import pdb

def serialise(db, device):
    sources = {}
    destinations = {}
    maps = {}
    new_maps = []
    next_src = 0
    next_dest = 0
    next_connection = 0
    modeStr = {mapper.MODE_RAW: 'bypass',
               mapper.MODE_LINEAR: 'linear',
               mapper.MODE_EXPRESSION: 'expression'}
    boundStr = {mapper.BOUND_NONE: 'none',
               mapper.BOUND_MUTE: 'mute',
               mapper.BOUND_CLAMP: 'clamp',
               mapper.BOUND_FOLD: 'fold',
               mapper.BOUND_WRAP: 'wrap'}

    regexx = re.compile('x([0-9]+)')
    regexy = re.compile('y([0-9]+)')

    for m in db.device(device).maps():
        src = m.source().signal
        dst = m.destination().signal
        mode = modeStr[m.mode]
        if m.source().calibrating:
            mode = 'calibrating'
        if src.direction is mapper.DIR_INCOMING:
            mode = 'reverse'
        this_map = {
          'src': [ src.device().name + '/' + src.name ],
          'dest': [ dst.device().name + '/' + destination.name ],
          'mute': 1 if m.muted else 0,
          'mode': mode,
          'boundMin': boundStr[m.destination().bound_min],
          'boundMax': boundStr[m.destination().bound_max]
        }
        if m.source().minimum:
            this_map['srcMin'] = m.source().minimum
        if m.source().maximum:
            this_map['srcMin'] = m.source().maximum
        if m.destination().minimum:
            this_map['destMin'] = m.destination().minimum
        if m.destination().maximum:
            this_map['destMin'] = m.source().maximum
        if m.expression:
            # To get proper expression nomenclature
            # dest[0] = src[0] NOT y = x
            this_map['expression'] = m.expression.replace('y', 'dest[0]').replace('x', 'src[0]')
        new_maps.append(this_map);
    
    contents = {"fileversion": "2.1", "mapping": { "connections": new_maps } }

    return json.dumps(contents, indent=4)

def deserialise(db, mapping_json, devices):
    f = json.loads(mapping_json)

    #The version we're currently working with
    version = '';
    if 'fileversion' in f:
        version = f['fileversion']
    elif 'mapping' in f and 'fileversion' in f['mapping']:
        version = f['mapping']['fileversion']

    modeIdx = {'bypass': mapper.MODE_BYPASS,
               'linear': mapper.MODE_LINEAR,
               'expression': mapper.MODE_EXPRESSION}
    boundIdx = {'none': mapper.BOUND_NONE,
                'mute': mapper.BOUND_MUTE,
                'clamp': mapper.BOUND_CLAMP,
                'fold': mapper.BOUND_FOLD,
                'wrap': mapper.BOUND_WRAP}

    # This is a version 2.1 save file
    if version == '2.1':
        f = f['mapping']

        for c in f['connections']:
            # The name of the source signal without device
            srcsig = str(c['src'][0]).split('/')[2]
            # And the destination signal
            destsig = str(c['dest'][0]).split('/')[2]

            for s in devices['sources']:
                src = db.signal(s + srcsig)
                if not src:
                    continue
                print 'using srcname', srcname
                for d in devices['destinations']:
                    dst = db.signal(d + destsig)
                    if not dst:
                        continue

                    map = 0
                    mode = 0
                    if 'mode' in c:
                        mode = c['mode']
                        if mode is reverse:
                            map = mapper.map(dst, src)
                            if not map:
                                print 'unable to create map', dst.name, '->', src.name
                                continue
                        else:
                            map = mapper.map(src, dst)
                            if not map:
                                print 'unable to create map', src.name, '->', dst.name
                                continue

                        if mode is 'reverse':
                            map.mode = 'expression'
                            map.expression = 'y=x'
                        elif mode is 'calibrating':
                            map.destination().calibrate = True
                        else:
                            map.mode = modeIdx[mode]
                    if 'expression' in c and mode is not 'reverse':
                        map.expression = str(c['expression']
                                             .replace('src[0]', 'x')
                                             .replace('dest[0]', 'y'))
                    if 'srcMin' in c:
                        map.source().minimum = c['srcMin']
                    if 'srcMax' in c:
                        map.source().maximum = c['srcMax']
                    if 'destMin' in c:
                        map.destination().minimum = c['destMin']
                    if 'destMax' in c:
                        map.destination().maximum = c['destMax']
                    if 'boundMin' in c:
                        map.destination().bound_min = boundIdx[c['boundMin']]
                    if 'boundMax' in c:
                        map.destination().bound_max = boundIdx[c['boundMax']]
                    if 'mute' in c:
                        map.muted = c['mute']

                    map.push()

    else:
        print 'Unknown file version'

        # TODO: Strictly speaking we should wait until links are
        # acknowledged before continuing with a connection.  An
        # asynchronous approach would be necessary for this, by
        # passing a continuation to the monitor's link handler.
