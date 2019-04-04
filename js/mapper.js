//++++++++++++++++++++++++++++++++++++++//
//            Mapper Class              //
//++++++++++++++++++++++++++++++++++++++//

// This class provides the functionality for creating and removing maps
// A global instance of it is instantiated at the bottom of this file, and that ought to
// be the only instance anyone should need.

class Mapper
{
    constructor() 
    {
        this.convergent = new ConvergentMapper();
        this.convergent.mapper = this;
    }

    // make a one to one map
    map(srckey, dstkey, props)
    {
        if (this._mapExists(srckey, dstkey)) return;
        else
        {
            this._stage([srckey], dstkey);
            this._map([srckey], dstkey, props);
        }
    }

    converge(srckey, dstmap, method)
    {
        this.convergent.converge(srckey, dstmap, method);
    }

    _map(srckeys, dstkey, props)
    {
        command.send('map', [srckeys, dstkey, props])
    }

    _stage(srckeys, dstkey)
    {
        if (srckeys.length > 1) dstkey = [dstkey];
        let m = { 'src': database.find_signal(srckeys[0]), 
                  'srcs': [],
                  'dst': database.find_signal(dstkey),
                  'key': this.mapKey(srckeys, dstkey),
                  'status': 'staged',
                  'selected': true
                };
        for (let src of srckeys) m.srcs.push(database.find_signal(src))
        database.maps.add(m);
    }

    unmap(srckeys, dstkey)
    {
        command.send('unmap', [srckeys, dstkey]);
    }

    mapKey(srckeys, dstkey)
    {
        if (srckeys.length === 1) return srckeys[0] + '->' + dstkey;
        else
        {
            let key = '[';
            for (let src of srckeys) key += src+',';
            return key+']' + '->' + dstkey;
        }
    }

    // check if a map exists with the given source and destination
    _mapExists(srckey, dstkey)
    {
        let exists = false;
        database.maps.each(function(map) 
        {
            if (exists) return;
            if (map.dst.key != dstkey) return;
            for (let src of map.srcs) 
            {
                if (src.key == srckey) 
                {
                    exists = true;
                    return;
                }
            }
        });
        return exists;
    }

}

// This helper class handles the complexities of preparing the arguments for making a
// convergent map, as well as defining the supported methods of convergent mapping

// The global Mapper instance owns an instance of ConvergentMapper

class ConvergentMapper
{
    constructor()
    {
        // note: the global instance also gives ConvergentMapper a reference to itself
        // i.e. this.mapper in ConvergentMapper's methods refers to the global Mapper

        // define the supported methods of convergent mapping here
        this.method = {sum: 'sum', 
                       product: 'product', 
                       switchoid: 'switchoid', 
                       'default': 'default'};
    }

    valid_method(method)
    {
        for (let i in this.method) if (method === this.method[i]) return true;
        return false;
    }

    // make a many to one map
    map(srckeys, dstkey, props)
    {
        if (!(srckeys instanceof Array)) 
        {
            console.log("error: convergent.map must be given an array of srckeys");
            return;
        }
        else if (srckeys.length == 1)
        {
            this.mapper.map(srckeys[0], dstkey, props);
            return;
        }
        else if (srckeys.length == 0)
        {
            console.log("error: convergent.map must be given a non-empty array of srckeys");
            return;
        }

        if (database.maps.find(this.mapper.mapKey(srckeys, dstkey))) return; // map exists
        let overlap = this._overlapWithExistingMaps(srckeys, dstkey, props);
        if (overlap !== null)
        {
            // unmap the existing convergent map to make way for the new one
            this.mapper.unmap(overlap.srcs, overlap.dst);
        }
    }

    converge(srckey, dstmap, method)
    {
        if (!this.valid_method(method)) {
            console.log("error: unexpected convergent method", method);
        }
        switch (method) 
        {
            case this.method.sum:

            case this.method.product:
            case this.method.switchoid:
            case this.method.default:
            default:
                this._sum(srckey, dstmap);
                return;
                break;
        }
    }

    _sum(srckey, dstmap)
    {
        let expr = dstmap.expression;
        expr += '+x' + dstmap.srcs.length;
        this._converge(srckey, dstmap, {expression: expr});
    }

    _converge(srckey, dstmap, props)
    {
        let srckeys = dstmap.srcs.map(src => src.key);
        this.mapper.unmap(srckeys, dstmap.dst.key);
        this.mapper._stage(srckeys, dstmap.dst.key);

        // at the time of writing, the python server will not successfully create the
        // following map unless there is a time delay to give the network time to unmap
        // the existing one

        setTimeout(function() {
            srckeys.push(srckey);
            this.mapper._map(srckeys, dstmap.dst.key);
        }, 750);
    }

    _overlapWithExistingMap(srckeys, dstkey, props)
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
