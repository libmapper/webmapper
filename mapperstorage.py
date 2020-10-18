#!/usr/bin/env python

import json, re
import mapper as mpr

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
    locStr = { mpr.LOC_UNDEFINED: 'undefined',
               mpr.LOC_SRC: 'src',
               mpr.LOC_DST: 'dst' }

    regexx = re.compile('x([0-9]+)')
    regexy = re.compile('y([0-9]+)')

    for m in db.device(device).maps():
        this_map = m.properties.copy()
        this_map['sources'] = []
        this_map['destinations'] = []
        if 'expression' in this_map:
            # To get proper expression nomenclature
            # dest[0] = src[0] NOT y = x
            this_map['expression'] = m.expression.replace('y', 'dst[0]').replace('x', 'src[0]')
        if 'process_loc' in this_map:
            this_map['process_loc'] = locStr[m.process_loc]
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

        for i in range(m.num_signals(mpr.LOC_SRC)):
            src = m.signal(mpr.LOC_SRC, i)
            slot_props = {}
            slot_props['name'] = src.device().name + '/' + src.name
            this_map['sources'].append(slot_props)
        for i in range(m.num_signals(mpr.LOC_DST)):
            dst = m.signal(mpr.LOC_DST)
            slot_props = {}
            slot_props['name'] = dst.device().name + '/' + dst.name
            this_map['destinations'].append(slot_props)

        new_maps.append(this_map);
    
    contents = {"fileversion": "2.2", "mapping": { "maps": new_maps } }

    return json.dumps(contents, indent=4)


# TODO: read file and tally devices, calculate match ratio for each device
# if have 100% match, go ahead and create maps
# otherwise prompt for user interaction

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
        print('malformed file')

    locIdx = { 'undefined': mpr.LOC_UNDEFINED,
               'source': mpr.LOC_SRC,
               'destination': mpr.LOC_DST }

    src_dev = db.device(src_dev_names[0])
    if not src_dev:
        print("error loading file: couldn't find device ", src_dev_names[0], " in graph")
        return

    dst_dev = db.device(dst_dev_names[0])
    if not dst_dev:
        print("error loading file: couldn't find device ", dst_dev_names[0], " in graph")
        return

    if version == '2.1':
        print("converting version 2.1 mapping file...")
        # we need to modify a few things for compatibility
        f['maps'] = []
        for connection in f['connections']:
            if not connection.has_key('mode'):
                continue;
            map = {}
            src = { 'name': connection['source'][0].split('/', 1)[1] }
            dst = { 'name': connection['destination'][0].split('/', 1)[1] }
            if connection.has_key('mute'):
                map['muted'] = connection['mute']
            if connection.has_key('expression'):
                map['expression'] = str(connection['expression']
                                        .replace('s[', 'src[')
                                        .replace('d[', 'dst['))
            if connection.has_key('srcMin'):
                src['minimum'] = connection['srcMin']
            if connection.has_key('srcMax'):
                src['maximum'] = connection['srcMax']
            if connection.has_key('destMin'):
                dst['minimum'] = connection['destMin']
            if connection.has_key('destMax'):
                dst['maximum'] = connection['destMax']

            mode = connection['mode']
            if mode == 'reverse':
                map['expression'] = 'y=x'
                map['sources'] = [ dst ]
                map['destinations'] = [ src ]
            else:
                if mode == 'calibrate':
                    map['expression'] = 'y=linear(x,?,?,-,-)'
                map['sources'] = [ src ]
                map['destinations'] = [ dst ]

            f['maps'].append(map)

        del f['connections']
        # "upgrade" version to 2.2
        version = '2.2'

    # This is a version 2.2 save file
    if version == '2.2':
        print("loading version 2.2 mapping file...")
        # todo: we need to enable users to explictly define device matching
        # for now we will just choose the first device...

        for map_props in f['maps']:
            sigs_found = True
            # The name of the source signals without device name
            src_sigs = []
            for slot_props in map_props['sources']:
                name = slot_props['name']
                name = name.split('/', 1)[1]
                sig = src_dev.signal(name)
                if not sig:
                    sigs_found = False
                    continue
                src_sigs.append(sig)
            if not sigs_found:
                continue

            # And the destination signals
            dst_sigs = []
            for slot_props in map_props['destinations']:
                name = slot_props['name']
                name = name.split('/', 1)[1]
                sig = dst_dev.signal(name)
                if not sig:
                    sigs_found = False
                    continue
                dst_sigs.append(sig)
            if not sigs_found:
                continue

            map = mpr.map(src_sigs[0], dst_sigs[0])
            if not map:
                print("error creating map")
                continue

            # set slot properties first
            index = 0
            for slot_props in map_props['sources']:
                slot = map.signal(mpr.LOC_SRC, index)
                for prop in slot_props:
                    if prop == 'name':
                        # do nothing
                        pass
                    elif prop == 'minimum':
                        t = type(slot_props['minimum'])
                        if t is int or t is float:
                            slot.minimum = float(slot_props['minimum'])
                        else:
                            if t is str:
                                slot_props['minimum'] = slot_props['minimum'].replace(',',' ').split()
                            numargs = len(slot_props['minimum'])
                            for i in range(numargs):
                                slot_props['minimum'][i] = float(slot_props['minimum'][i])
                            if numargs == 1:
                                slot_props['minimum'] = slot_props['minimum'][0]
                            slot.minimum = slot_props['minimum']
                    elif prop == 'maximum':
                        t = type(slot_props['maximum'])
                        if t is int or t is float:
                            slot.maximum = float(slot_props['maximum'])
                        else:
                            if t is str:
                                slot_props['maximum'] = slot_props['maximum'].replace(',',' ').split()
                            numargs = len(slot_props['maximum'])
                            for i in range(numargs):
                                slot_props['maximum'][i] = float(slot_props['maximum'][i])
                            if numargs == 1:
                                slot_props['maximum'] = slot_props['maximum'][0]
                            slot.maximum = slot_props['maximum']
                    else:
                        slot.set_property(prop, slot_props[prop])
                index += 1
            index = 0
            for slot_props in map_props['destinations']:
                slot = map.signal(mpr.LOC_DST, index)
                for prop in slot_props:
                    if prop == 'name':
                        # do nothing
                        pass
                    elif prop == 'minimum':
                        t = type(slot_props['minimum'])
                        if t is int or t is float:
                            slot.minimum = float(slot_props['minimum'])
                        else:
                            if t is str:
                                slot_props['minimum'] = slot_props['minimum'].replace(',',' ').split()
                            numargs = len(slot_props['minimum'])
                            for i in range(numargs):
                                slot_props['minimum'][i] = float(slot_props['minimum'][i])
                            if numargs == 1:
                                slot_props['minimum'] = slot_props['minimum'][0]
                            slot.minimum = slot_props['minimum']
                    elif prop == 'maximum':
                        t = type(slot_props['maximum'])
                        if t is int or t is float:
                            slot.maximum = float(slot_props['maximum'])
                        else:
                            if t is str:
                                slot_props['maximum'] = slot_props['maximum'].replace(',',' ').split()
                            numargs = len(slot_props['maximum'])
                            for i in range(numargs):
                                slot_props['maximum'][i] = float(slot_props['maximum'][i])
                            if numargs == 1:
                                slot_props['maximum'] = slot_props['maximum'][0]
                            slot.maximum = slot_props['maximum']
                    else:
                        slot.set_property(prop, slot_props[prop])
                index += 1

            # set map properties
            for prop in map_props:
                if prop == 'sources' or prop == 'destinations':
                    # do nothing
                    pass
                elif prop == 'expression':
                    expression = map_props['expression']
                    expression = re.sub(r'src\[(\d*)\]', 'x\g<1>', expression)
                    expression = re.sub(r'dst\[(\d*)\]', 'y\g<1>', expression)
                    expression = re.sub(r'(x|y)0', '\g<1>', expression)
                    map.expression = expression
                elif prop == 'muted':
                    map.muted = map_props['muted']
                elif prop == 'mode':
                    # do nothing
                    print('skipping mode property')
                else:
                    map.properties[prop] = map_props[prop]

            map.push()

    else:
        print('Unknown file version')

        # TODO: Strictly speaking we should wait until links are
        # acknowledged before continuing with a connection.  An
        # asynchronous approach would be necessary for this, by
        # passing a continuation to the monitor's link handler.
