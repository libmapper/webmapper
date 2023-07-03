//++++++++++++++++++++++++++++++++++++++//
//            Mapper Class              //
//++++++++++++++++++++++++++++++++++++++//

// This class provides the functionality for creating and removing maps
// A global instance of it is instantiated at the bottom of this file, and that
// ought to be the only instance anyone should need.

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
        if (srckey === dstkey) return;
        if (this._mapExists(srckey, dstkey)) return;
        else
        {
            this._map([srckey], dstkey, props);
            this._stage([srckey], dstkey);
        }
    }

    set(srckeys, dstkey, props)
    {
        props['srcs'] = srckeys;
        props['dst'] = dstkey;
        console.log("sending command: ", 'set_map', props);
        command.send('set_map', props);
    }

    converge(srckey, dstmap, method)
    {
        if (srckey === dstmap.dst.key || dstmap.srcs.map(s => s.key).indexOf(srckey) >= 0)
            return;
        this.convergent.converge(srckey, dstmap, method);
    }

    _map(srckeys, dstkey, props)
    {
        command.send('map', [srckeys, dstkey, props])
    }

    _stage(srckeys, dstkey)
    {
        srckeys.sort();
        let m = { 'srcs': srckeys.map(s => graph.find_signal(s)),
                  'dst': graph.find_signal(dstkey),
                  'key': this.mapKey(srckeys, dstkey),
                  'status': 'staged',
                  'selected': true
                };
        graph.maps.add(m, 1);
    }

    unmap(srckeys, dstkey)
    {
        srckeys.sort();
        let m = { 'srcs': srckeys.map(s => graph.find_signal(s)),
                  'dst': graph.find_signal(dstkey),
                  'key': this.mapKey(srckeys, dstkey),
                  'status': 'staged',
                  'selected': true
                };
        command.send('unmap', [srckeys, dstkey]);
        graph.del_maps("del_maps", [m]);
    }

    mapKey(srckeys, dstkey)
    {
        if (srckeys.length === 1) return srckeys[0] + '->' + dstkey;
        else return '['+String(srckeys)+']->['+dstkey+']';
    }

    // check if a map exists with the given source and destination
    _mapExists(srckey, dstkey)
    {
        let exists = false;
        graph.maps.forEach(function(map) {
            if (exists) return;
            if (map.dst.key != dstkey) return;
            for (let src of map.srcs)  {
                if (src.key == srckey) {
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
                       average: 'average', 
                       default: 'default'};
        this.icon = {sum:     {black: 'images/convergent_add_icon_black.png', white: 'images/convergent_add_icon_white.png'},
                     product: {black: 'images/convergent_mul_icon_black.png', white: 'images/convergent_mul_icon_white.png'},
                     average: {black: 'images/convergent_avg_icon_black.png', white: 'images/convergent_avg_icon_white.png'},
                     default: {black: 'images/convergent_default_icon_black.png', white: 'images/convergent_default_icon_white.png'}};
    }

    valid_method(method)
    {
        for (let i in this.method) {
            if (method === this.method[i])
                return true;
        }
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

        if (graph.maps.find(this.mapper.mapKey(srckeys, dstkey)))
            return; // map exists
        let overlap = this._overlapWithExistingMaps(srckeys, dstkey, props);
        if (overlap !== null) {
            // unmap the existing convergent map to make way for the new one
            this.mapper.unmap(overlap.srcs, overlap.dst);
        }
    }

    converge(srckey, dstmap, method)
    {
        if (dstmap.srcs.length >= 8) {
            console.log("warning: maps are limited to 8 sources.");
            return;
        }
        if (!this.valid_method(method)) {
            console.log("error: unexpected convergent method", method);
        }
        let expr = null;
        switch (method) {
            case this.method.sum:
                expr = this._sum(srckey, dstmap);
                break;
            case this.method.product:
                expr = this._product(srckey, dstmap);
                break;
            case this.method.average:
                expr = this._average(srckey, dstmap);
                break;
            case this.method.default:
            default:
        }
        if (expr !== null)
            this._converge(srckey, dstmap, {expr: expr});
        else
            this._converge(srckey, dstmap);
    }

    _insert_after_assignment_expr(expr, insert)
    {
        expr = expr.replace(/(y\s*=)([^;]+);*/g, "$1($2)"+insert+";");
        return expr;
    }

    // (the existing expression) + (src scaled to dst range)
    _sum(srckey, dstmap)
    {
        let [src, dst, expr] = this._prep(srckey, dstmap);
        let newx;
        if (this._signals_have_bounds([src, dst]))
            newx = ConvExpr.scaled(src.min, src.max, dst.min, dst.max, 'new');
        else
            newx = 'new'
        newx = ConvExpr.paren_wrap(newx);
        expr = this._insert_after_assignment_expr(expr, '+'+newx);
        return ConvExpr.reindex(expr, src, dstmap);
    }

    // (the existing expression) * (src scaled to [0,1] range)
    _product(srckey, dstmap)
    {
        let [src, dst, expr] = this._prep(srckey, dstmap);
        let newx;
        if (this._signals_have_bounds([src, dst]))
            newx = ConvExpr.zero_to_one_scaled(src.min, src.max, 'new');
        else
            newx = 'new'
        newx = ConvExpr.paren_wrap(newx);
        expr = this._insert_after_assignment_expr(expr, '*'+newx);
        return ConvExpr.reindex(expr, src, dstmap);
    }

    // average of the normalized signals scaled to dst range
    _average(srckey, dstmap)
    {
        let [src, dst, expr] = this._prep(srckey, dstmap);
        let srcs = dstmap.srcs.concat([src]).sort();

        // at time of writing, the default expression assigned by libmapper is a simple
        // average of the src signals not taking their bounds into account. If any of
        // the signals in the map are missing min and max properties, default to that
        if (!this._signals_have_bounds(srcs.concat([dst]))) return null; 

        expr = 'y=(';
        let srcmaxlen = srcs[0].length;
        for (let i = 1; i < srcs.length; i++) {
            if (srcs[i].length > srcmaxlen)
            srcmaxlen = srcs[i].length
        }
        let offset = (new Array(srcmaxlen).fill(0));
        for (let i in srcs)
        {
            let src = srcs[i];
            let x = 'x$'+i;
            let [b, m] = ConvExpr.zero_to_one_params(src.min, src.max);
            if (b.length == undefined)
                offset[0] += b;
            else {
                for (let j = 0; j < srcmaxlen; j++)
                    offset[j] += b[j % b.length];
            }
            if (m.length == undefined)
                expr += m.toString()+'*'+x+'+';
            else
                expr += '[' + m.toString()+']*'+x+'+';
        }
        if (offset.length == undefined)
            expr += offset.toString() + ')';
        else
            expr += '[' + offset.toString() + '])';

        expr += '*';
        if (dst.min.length == undefined) {
            expr += (dst.max - dst.min).toString() + '/' + srcs.length;
            expr += dst.min.toString();
        }
        else {
            expr += "[";
            for (let i = 0; i < dst.min.length; i++) {
                let comma = i < (dst.min.length - 1) ? "," : "";
                expr += humanize(dst.max[i] - dst.min[i]) + comma;
            }
            expr += "]/" + srcs.length;
        }
        return expr;
    }

    _converge(srckey, dstmap, props)
    {
        let srckeys = dstmap.srcs.map(src => src.key);
        this.mapper.unmap(srckeys, dstmap.dst.key);
        srckeys.push(srckey);
        this.mapper._stage(srckeys, dstmap.dst.key);

        // at the time of writing, the python server will not successfully create the
        // following map unless there is a time delay to give the network time to unmap
        // the existing one

        setTimeout(function() {
            this.mapper._map(srckeys, dstmap.dst.key, props);
        }, 200);
    }

    _prep(srckey, dstmap)
    {
        let src = graph.find_signal(srckey);
        let dst = dstmap.dst;
        if (!src) {
            console.log('error creating convergent map, no src matching', srckey);
            return;
        }

        let expr = dstmap.expr;
        if (dstmap.srcs.length == 1) {
            expr = expr.replace(/\bx(?!\w)/g, "x$0");
        }
        return [src, dst, expr];
    }

    _signals_have_bounds(signals)
    {
        return signals.every(sig => typeof sig.min !== 'undefined' && typeof sig.max !== 'undefined');
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
        graph.maps.forEach(function(map) {
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

// helper class for composing expressions for convergent maps
class ConvExpr
{
    constructor() {}

    static scaled(xmin, xmax, ymin, ymax, x)
    {
        let [inneroffset, innerslope] = ConvExpr.zero_to_one_params(xmin, xmax);
        let outerslope;
        if (ymax.length == undefined) {
            outerslope = ymax - ymin;
        }
        else {
            outerslope = [];
            for (let i = 0; i < ymax.length; i++) {
                outerslope[i] = ymax[i] - ymin[i];
            }
        }
        let outeroffset = ymin;

        let xlen = xmin.length == undefined ? 1 : xmin.length;
        let ylen = ymin.length == undefined ? 1 : ymin.length;
        let maxlen = xlen > ylen ? xlen : ylen;
        if (maxlen == 1) {
            let offset = inneroffset * outerslope + outeroffset;
            let slope = innerslope * outerslope;
            return ConvExpr.offset_slope(offset, slope, x);
        }
        let offset = [];
        let slope = [];
        if (xmin.length == undefined) {
            inneroffset = [inneroffset];
            innerslope = [innerslope];
        }
        if (ymin.length == undefined) {
            outeroffset = [outeroffset];
            outerslope = [outerslope];
        }
        for (let i = 0; i < maxlen; i++) {
            offset[i] = (  inneroffset[i % inneroffset.length]
                         * outerslope[i % outerslope.length]
                         + outeroffset[i % outeroffset.length]);
            slope[i] = (innerslope[i % innerslope.length] * outerslope[i % outerslope.length]);
        }
        return ConvExpr.offset_slope(offset, slope, x);
    }

    // returns a string in the for m*x+b so that an x with domain [min, max] will be
    // scaled to a y with the range [0,1]
    static zero_to_one_scaled(min, max, x)
    {
        let [offset, slope] = ConvExpr.zero_to_one_params(min, max);
        if (isNaN(offset) || isNaN(slope)) {
            console.log('NaN error');
            return x;
        }
        return ConvExpr.offset_slope(offset, slope, x);
    }

    static zero_to_one_params(min, max)
    {
        if (min.length == undefined)
            return [min / (max - min), 1 / (max - min)];
        let offset = [];
        let slope = [];
        for (let i = 0; i < min.length; i++) {
            offset[i] = humanize(min[i] / (max[i] - min[i]));
            slope[i] = humanize(1 / (max[i] - min[i]));
        }
        return [offset, slope];
    }

    static offset_slope(offset, slope, x)
    {
        if (offset.length > 1 || slope.length > 1)
            return '[' + slope.toString() + ']*' + x + '+[' + offset.toString() + ']';
        return slope.toString() + '*' + x + '+' + offset.toString();
    }

    static paren_wrap(str)
    {
        return '('+str+')';
    }

    static reindex(expr, src, dstmap, srcexprname = 'new')
    {
        let srckey = src.key;
        let srcs = dstmap.srcs.map(s => s.key).concat([srckey]).sort();
        let idx = srcs.indexOf(srckey);
        for (let i = 0; i < dstmap.srcs.length; ++i)
        {
            if (i < idx)
                continue;
            let re = new RegExp("x$"+i, "g");
            expr = expr.replace(re, "x$"+(i+1));
        }
        let re = new RegExp(srcexprname);
        expr = expr.replace(re, 'x$'+idx);
        return expr;
    }

    static replace(expr, key, newkey)
    {
        let idxs = [];
        let idx = expr.indexOf(key);
        while(idx !== -1)  {
            idxs.push(idx);
            idx = expr.indexOf(key,idx+1);
        }
        for (let idx of idxs) {
            expr = expr.substring(0,idx) + newkey + expr.substring(idx+key.length);
        }
        return expr;
    }

}

var mapper = new Mapper(); // make global instance
