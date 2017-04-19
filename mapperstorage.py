#!/usr/bin/env python

import json, re
import mapper

#for debugging
import pdb

def deunicode(o):
    d = dir(o)
    if 'items' in d:
        p = dict([(deunicode(x),deunicode(y)) for (x,y) in o.items()])
    elif '__dict__' in d:
        p = o.copy()
        p.__dict__ = dict([(deunicode(x),deunicode(y))
                           for (x,y) in o.__dict__.items()])
    elif '__iter__' in d:
        p = [deunicode(x) for x in o]
    elif o.__class__==unicode:
        p = o.encode('ascii','replace')
    else:
        p = o
    return p

def serialise(db, device):
    new_maps = []
    modeStr = { mapper.MODE_UNDEFINED: 'undefined',
                mapper.MODE_RAW: 'raw',
                mapper.MODE_LINEAR: 'linear',
                mapper.MODE_EXPRESSION: 'expression' }
    boundStr = { mapper.BOUND_UNDEFINED: 'undefined',
                 mapper.BOUND_NONE: 'none',
                 mapper.BOUND_MUTE: 'mute',
                 mapper.BOUND_CLAMP: 'clamp',
                 mapper.BOUND_FOLD: 'fold',
                 mapper.BOUND_WRAP: 'wrap' }
    locStr = { mapper.LOC_UNDEFINED: 'undefined',
               mapper.LOC_SOURCE: 'source',
               mapper.LOC_DESTINATION: 'destination' }

    regexx = re.compile('x([0-9]+)')
    regexy = re.compile('y([0-9]+)')

    for m in db.device(device).maps():
        this_map = m.properties.copy()
        this_map['sources'] = []
        this_map['destinations'] = []
        if 'mode' in this_map:
            this_map['mode'] = modeStr[m.mode]
        if 'expression' in this_map:
            # To get proper expression nomenclature
            # dest[0] = src[0] NOT y = x
            this_map['expression'] = m.expression.replace('y', 'dst[0]').replace('x', 'src[0]')
        if 'process_location' in this_map:
            this_map['process_location'] = locStr[m.process_location]
        if 'is_local' in this_map:
            del this_map['is_local']
        if 'status' in this_map:
            del this_map['status']
        if 'version' in this_map:
            del this_map['version']
        if 'num_inputs' in this_map:
            del this_map['num_inputs']
        if 'num_outputs' in this_map:
            del this_map['num_outputs']

        for i in range(m.num_sources):
            slot = m.source(i)
            sig = slot.signal()
            slot_props = slot.properties.copy()
            slot_props['name'] = sig.device().name + '/' + sig.name
            if 'bound_min' in slot_props:
                slot_props['bound_min'] = boundStr[slot_props['bound_min']]
            if 'bound_max' in slot_props:
                slot_props['bound_max'] = boundStr[slot_props['bound_max']]
            this_map['sources'].append(slot_props)
        for i in range(m.num_destinations):
            slot = m.destination(i)
            sig = slot.signal()
            slot_props = slot.properties.copy()
            slot_props['name'] = sig.device().name + '/' + sig.name
            if 'bound_min' in slot_props:
                slot_props['bound_min'] = boundStr[slot_props['bound_min']]
            if 'bound_max' in slot_props:
                slot_props['bound_max'] = boundStr[slot_props['bound_max']]
            this_map['destinations'].append(slot_props)

        new_maps.append(this_map);
    
    contents = {"fileversion": "2.2", "mapping": { "maps": new_maps } }

    return json.dumps(contents, indent=4)

def deserialise(db, src_dev_names, dst_dev_names, mapping_json):
    f = json.loads(mapping_json)
    f = deunicode(f)

    #The version we're currently working with
    version = '';
    if 'fileversion' in f:
        version = f['fileversion']
    elif 'mapping' in f and 'fileversion' in f['mapping']:
        version = f['mapping']['fileversion']

    if 'mapping' in f:
        f = f['mapping']
    else:
        print 'malformed file'

    modeIdx = { 'undefined': mapper.MODE_UNDEFINED,
                'raw': mapper.MODE_RAW,
                'linear': mapper.MODE_LINEAR,
                'expression': mapper.MODE_EXPRESSION }
    boundIdx = { 'none': mapper.BOUND_NONE,
                 'mute': mapper.BOUND_MUTE,
                 'clamp': mapper.BOUND_CLAMP,
                 'fold': mapper.BOUND_FOLD,
                 'wrap': mapper.BOUND_WRAP }
    locIdx = { 'undefined': mapper.LOC_UNDEFINED,
               'source': mapper.LOC_SOURCE,
               'destination': mapper.LOC_DESTINATION }

    src_dev = db.device(src_dev_names[0])
    dst_dev = db.device(dst_dev_names[0])
    if not src_dev or not dst_dev:
        print "error loading file: couldn't find devices in database"
        return

    # This is a version 2.2 save file
    if version == '2.2':
        # todo: we need to enable users to explictly define device matching
        # for now we will just choose the first device...

        for map_props in f['maps']:
            sigs_found = True
            # The name of the source signals without device name
            src_sigs = []
            for slot_props in map_props['sources']:
                sig = src_dev.signal(slot_props['name'].split('/')[1])
                if not sig:
                    sigs_found = False
                    continue
                src_sigs.append(sig)
            if not sigs_found:
                continue

            # And the destination signals
            dst_sigs = []
            for slot_props in map_props['destinations']:
                sig = dst_dev.signal(slot_props['name'].split('/')[1])
                if not sig:
                    sigs_found = False
                    continue
                dst_sigs.append(sig)
            if not sigs_found:
                continue

            map = mapper.map(src_sigs[0], dst_sigs[0])
            if not map:
                print "error creating map"
                continue

            # set slot properties first
            index = 0
            for slot_props in map_props['sources']:
                slot = map.source(index)
                for prop in slot_props:
                    if prop == 'name':
                        # do nothing
                        pass
                    elif prop == 'bound_min':
                        slot.bound_min = boundIdx[slot_props['bound_min']]
                    elif prop == 'bound_min':
                        slot.bound_max = boundIdx[slot_props['bound_max']]
                    else:
                        slot.properties[prop] = slot_props[prop]
                index += 1
            index = 0
            for slot_props in map_props['destinations']:
                slot = map.destination(index)
                for prop in slot_props:
                    if prop == 'name':
                        # do nothing
                        pass
                    elif prop == 'bound_min':
                        slot.bound_min = boundIdx[slot_props['bound_min']]
                    elif prop == 'bound_min':
                        slot.bound_max = boundIdx[slot_props['bound_max']]
                    else:
                        slot.properties[prop] = slot_props[prop]
                index += 1

            # set map properties
            for prop in map_props:
                if prop == 'sources' or prop == 'destinations':
                    # do nothing
                    pass
                elif prop == 'expression':
                    map.expression = str(map_props['expression']
                                         .replace('src', 'x')
                                         .replace('dst', 'y'))
                elif prop == 'muted':
                    map.muted = map_props['muted']
                elif prop == 'mode':
                    mode = map_props['mode']
                    if mode == 'linear':
                        map.mode = mapper.MODE_LINEAR
                    elif mode == 'expression':
                        map.mode = mapper.MODE_EXPRESSION
                else:
                    map.properties[prop] = map_props[prop]

            map.push()

    # This is a version 2.1 save file
#    elif version == '2.1':
#        f = f['mapping']
#
#        for c in f['connections']:
#            # The name of the source signal without device
#            srcsig = str(c['src'][0]).split('/')[2]
#            # And the destination signal
#            destsig = str(c['dest'][0]).split('/')[2]
#
#            for s in devices['sources']:
#                src = db.signal(s + srcsig)
#                if not src:
#                    continue
#                for d in devices['destinations']:
#                    dst = db.signal(d + destsig)
#                    if not dst:
#                        continue
#
#                    map = 0
#                    mode = 0
#                    if 'mode' in c:
#                        mode = c['mode']
#                        if mode is reverse:
#                            map = mapper.map(dst, src)
#                            if not map:
#                                print 'unable to create map', dst.name, '->', src.name
#                                continue
#                        else:
#                            map = mapper.map(src, dst)
#                            if not map:
#                                print 'unable to create map', src.name, '->', dst.name
#                                continue
#
#                        if mode is 'reverse':
#                            map.mode = 'expression'
#                            map.expression = 'y=x'
#                        elif mode is 'calibrating':
#                            map.destination().calibrate = True
#                        else:
#                            map.mode = modeIdx[mode]
#                    if 'expression' in c and mode is not 'reverse':
#                        map.expression = str(c['expression']
#                                             .replace('src[0]', 'x')
#                                             .replace('dest[0]', 'y'))
#                    if 'srcMin' in c:
#                        map.source().minimum = c['srcMin']
#                    if 'srcMax' in c:
#                        map.source().maximum = c['srcMax']
#                    if 'destMin' in c:
#                        map.destination().minimum = c['destMin']
#                    if 'destMax' in c:
#                        map.destination().maximum = c['destMax']
#                    if 'boundMin' in c:
#                        map.destination().bound_min = boundIdx[c['boundMin']]
#                    if 'boundMax' in c:
#                        map.destination().bound_max = boundIdx[c['boundMax']]
#                    if 'mute' in c:
#                        map.muted = c['mute']
#
#                    map.push()

    else:
        print 'Unknown file version'

        # TODO: Strictly speaking we should wait until links are
        # acknowledged before continuing with a connection.  An
        # asynchronous approach would be necessary for this, by
        # passing a continuation to the monitor's link handler.
