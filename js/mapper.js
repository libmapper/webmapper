//++++++++++++++++++++++++++++++++++++++//
//            Mapper Class              //
//++++++++++++++++++++++++++++++++++++++//

// This class provides the functionality for creating and removing maps

class Mapper
{
    constructor() {}

    // make a one to one mapping
    map(srckeys, dstkey, props)
    {
        let mapkey = this._mapKey(srckeys, dstkey);
        if (database.maps.find(mapkey)) return; // map already exists

        let overlap = this._overlapWithExistingConvergentMap(srckeys, dstkey, props)
        if (overlap !== null)
        {
            // ignore it if the user tries to make a one to one map where the same src
            // and dst are already involved in a convergent map
            if (srckeys.length === 1) return;

            // otherwise delete the old convergent map so it can be replaced
            this._unmap(overlap.srcs, overlap.dst);
        }

        command.send('map', [srckeys, dstkey, props])
        let m = { 'src': database.find_signal(srckeys[0]), 
                  'srcs': [],
                  'dst': database.find_signal(dstkey),
                  'key': mapkey,
                  'status': 'staged'
                };
        for (let src of srckeys) m.srcs.push(database.find_signal(src))
        database.maps.add(m);
    }

    unmap(srckeys, dstkey)
    {
        command.send('unmap', [srckeys, dstkey]);
    }

    _mapKey(srckeys, dstkey)
    {
        if (srckeys.length === 1) return srckeys[0] + '->' + dstkey;
        else
        {
            let key = '[';
            for (src of srckeys) key += src+',';
            return key+']' + '->' + dstkey;
        }
    }

    _overlapWithExistingConvergentMap(srckeys, dstkey, props)
    {
        let overlapmap = this._findOverlap(srckeys, dstkey);
        if (overlapmap === null) return null;
        let overlap = { srcs: [], dst: overlapmap.dst.key };
        for (let src of overlapmap.srcs) overlap.srcs.push(src.key);
        return overlap;
    }
    
    _findOverlap(srckeys, dstkey)
    {
        let overlapmap = null;
        database.maps.each(function(map) {
            if (overlapmap !== null && map.srcs.length == 1) return;
            for (let src1 of map.srcs)
            {
                for (let src2 of srckeys)
                {
                    if (map.dst.key == dstkey && src1.key == src2) 
                    {
                        overlapmap = map;
                        break;
                    }
                    else if (dstkey == src1.key && src2 == map.dst.key)
                    {
                        overlapmap = map;
                        break;
                    }
                }
            }
        });
        return overlapmap;
    }
}

var mapper = new Mapper(); // make global instance
