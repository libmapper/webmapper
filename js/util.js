"use strict";

/* Make an asynchronous HTTP request to the browser. */
function http_request(path, args, ok_responder, error_responder) {
    var client = new XMLHttpRequest();
    client.onreadystatechange = function() {
        if (this.readyState == 4)
            ok_responder(this.responseText);
        else if (error_responder)
            error_responder(this.responseText);
    }
    var a = '';
    var n = 0;
    for (var i in args) {
        if (n == 0)
            a += '?';
        else
            a += '&';
        a += encodeURIComponent(i) + '=' + encodeURIComponent(args[i]);
        n++;
    }
    client.open("GET", path+a);
    client.send("");
}

/* A simple object class to represent a bucket of things that can be
 * put in or taken out. */
function Bucket() {
    this.contents = [];
    this.put = function(a) {
        this.contents.push(a);
    }
    this.take = function(a) {
        for (i in this.contents) {
            if (this.contents[i] == a) {
                this.contents.splice(i, 1);
                return;
            }
        }
    }
}

/* Helper function to trace debug output. */
function trace(text) {
    var out = document.getElementById('output');
    if (out)
        out.innerHTML += '<p>' + text + '</p>\n'
}

/* Class to wrap an association list. */
function Assoc() {
    this.contents = {};
    this.add = function(key, value) {
        this.contents[key] = value;
    },
    this.remove = function(name) {
        delete this.contents[name];
    },
    this.get = function(name) {
        return this.contents[name];
    },
    this.keys = function() {
        var keys = [];
        for (var k in this.contents)
            keys.push(k);
        return keys;
    }
    this.length = function() {
        return this.keys().length;
    }
}

/* Split a full signal name into device and signal parts. */
function splitSigName(signame) {
    var i = signame.indexOf("/", 1);
    if (i < 0)
        return null;

    return [signame.substring(0, i),
            signame.substring(i)];
}

/* Get the full offset and size of an element. */
function fullOffset(e) {
    var o = { left: 0, top: 0, width: 0, height: 0 };
    if (e.offsetParent)
        o = fullOffset(e.offsetParent);
    let o2 = { left: e.offsetLeft - e.scrollLeft + o.left,
               top: e.offsetTop - e.scrollTop + o.top,
               width: e.offsetWidth,
               height: e.offsetHeight};
    o2.right = o2.left + o2.width;
    o2.bottom = o2.top + o2.height;
    o2.cx = o2.left + o2.width * 0.5;
    o2.cy = o2.top + o2.height * 0.5;
    return o2;
}

function offset(e) {
    return { left: e.offsetLeft - e.scrollLeft,
             top: e.offsetTop - e.scrollTop,
             width: e.offsetWidth,
             height: e.offsetHeight };
}

/* add an item to an array only if it is unique */
function arrPushIfUnique(item, arr){
	if (arrIsUnique(item, arr))
		arr.push(item);
}

/* check if an item is unique in an array */
function arrIsUnique(item, arr){
	for (var i = 0; i < arr.length; i++){
		if (arr[i] == item)
			return false;
	}	
	return true;
}

// calculate intersections
// adapted from https://bl.ocks.org/bricof/f1f5b4d4bc02cad4dea454a3c5ff8ad7
function is_between(a, b1, b2, fudge) {
    if ((a + fudge >= b1) && (a - fudge <= b2)) {
        return true;
    }
    if ((a + fudge >= b2) && (a - fudge <= b1)) {
        return true;
    }
    return false;
}

function line_line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    let m1 = (x1 == x2) ? 1000000 : (y1 - y2) / (x1 - x2);
    let m2 = (x3 == x4) ? 1000000 : (y3 - y4) / (x3 - x4);
    if (m1 == m2) {
            // lines are parallel - todo check if same b, overlap
        return false;
    }
    let b1 = y1 - x1 * m1;
    let b2 = y3 - x3 * m2;
    let isect_x = (b2 - b1) / (m1 - m2);
    let isect_y = isect_x * m1 + b1;
    return (   is_between(isect_x, x1, x2, 0.1)
            && is_between(isect_x, x3, x4, 0.1)
            && is_between(isect_y, y1, y2, 0.1)
            && is_between(isect_y, y3, y4, 0.1));
}

function edge_intersection(edge, x1, y1, x2, y2) {
    let len = edge.getTotalLength();
    let isect = false;
    for (var j = 0; j < 10; j++) {
        let p1 = edge.getPointAtLength(len * j * 0.1);
        let p2 = edge.getPointAtLength(len * (j + 1) * 0.1);

        if (line_line_intersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
            isect = true;
            break;
        }
    }
    return isect ? true : false;
}

// from https://stackoverflow.com/a/20392392
function tryParseJSON (jsonString){
    try {
        var o = JSON.parse(jsonString);

            // Handle non-exception-throwing cases:
            // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
            // but... JSON.parse(null) returns null, and typeof null === "object",
            // so we must check for that, too. Thankfully, null is falsey, so this suffices:
        if (o && typeof o === "object") {
            return o;
        }
    }
    catch (e) { }
    return false;
}

function constrain(obj, bounds, border) {
    if (obj.left < (bounds.left + obj.width * 0.5 + border))
        obj.left = bounds.left + obj.width * 0.5 + border;
    else if (obj.left > (bounds.left + bounds.width - obj.width * 0.5 - border))
        obj.left = bounds.left + bounds.width - obj.width * 0.5 - border;
    if (obj.top < (bounds.top + obj.height * 0.5 + border))
        obj.top = obj.height * 0.5 + border;
    else if (obj.top > (bounds.top + bounds.height - obj.height * 0.5 - border))
        obj.top = bounds.top + bounds.height - obj.height * 0.5 - border;
}

function labelwidth(label) {
    return label.length * 8;
}

function labeloffset(start, label) {
    return {'x': start.x + label.length * 4 + 3,
        'y': start.y - 10 };
}

function circle_path(cx, cy, radius) {
    return [['M', cx + radius * 0.65, cy - radius * 0.65],
            ['a', radius, radius, 0, 1, 0, 0.001, 0.001],
            ['z']];
}

function rect_path(dim) {
    return [['M', dim.left, dim.top],
            ['l', dim.width, 0],
            ['l', 0, dim.height],
            ['l', -dim.width, 0],
            ['z']];
}

function self_path(x1, y1, x2, y2, frame) {
    let mp = [(x1 + x2) * 0.5, (y1 + y2) * 0.5]
    if (x1 == x2) {
        let d = Math.abs(y1 - y2);
        let thresh = frame.width * 0.5;
        if (d > thresh)
            d = thresh;
        mp[0] += (x1 > thresh) ? -d : d;
        return [['M', x1, y1],
                ['C', mp[0], y1, mp[0], y2, x2, y2]];
    }
    if (y1 == y2) {
        let d = Math.abs(x1 - x2);
        let thresh = frame.height * 0.5;
        if (d > thresh)
            d = thresh;
        mp[1] += (y1 > thresh) ? -d : d;
        return [['M', x1, y1],
                ['C', x1, mp[1], x2, mp[1], x2, y2]];
    }
    return [['M', x1, y1],
            ['S', mp[0], mp[1], x2, y2]];
}

function canvas_rect_path(dim) {
    let path = [['M', dim.left - dim.width * 0.5, dim.top],
                ['l', dim.width, 0]];
    return path;
}

function canvas_bezier(map, table, table_x) {
    let src_x, src_y, dst_x, dst_y;
    let src_cx = null, dst_cx = null;
    if (map.src.canvas_object) {
        let o = map.src.canvas_object
        let offset = o.width * 0.5 + 10;
        src_x = o.left + offset;
        src_cx = o.left + offset * 3;
        src_y = o.top;
    }
    else {
        let o = table.getRowFromName(map.src.key);
        if (!o)
            return;
        src_x = table_x;
        src_y = o.cy;
    }
    if (map.dst.canvas_object) {
        let o = map.dst.canvas_object
        let offset = o.width * -0.5 - 10;
        dst_x = o.left + offset;
        dst_cx = o.left + offset * 3;
        dst_y = o.top;
    }
    else {
        let o = table.getRowFromName(map.dst.key);
        if (!o)
            return;
        dst_x = table_x;
        dst_y = o.cy;
    }
    if (!src_cx && !dst_cx)
        src_cx = dst_cx = Math.sqrt(Math.abs(src_y - dst_y)) * 2 + table_x;
    else if (!src_cx)
        src_cx = (src_x + dst_x) * 0.5;
    else if (!dst_cx)
        dst_cx = (src_x + dst_x) * 0.5;

    return [['M', src_x, src_y],
            ['C', src_cx, src_y, dst_cx, dst_y, dst_x, dst_y]];
}

function grid_path(row, col, frame) {
    if (row && col) {
        return [['M', col.left, col.top],
                ['l', col.width, 0],
                ['L', col.left + col.width, row.top],
                ['L', row.left + row.width, row.top],
                ['l', 0, row.height],
                ['L', col.left + col.width, row.top + row.height],
                ['L', col.left + col.width, col.top + col.height],
                ['l', -col.width, 0],
                ['L', col.left, row.top + row.height],
                ['L', row.left, row.top + row.height],
                ['l', 0, -row.height],
                ['L', col.left, row.top],
                ['z']];
    }
    else if (row)
        return [['M', 0, row.top],
                ['l', frame.width, 0],
                ['l', 0, row.height],
                ['l', -frame.width, 0],
                ['Z']];
    else if (col)
        return [['M', col.left, 0],
                ['l', col.width, 0],
                ['l', 0, frame.height],
                ['l', -col.width, 0],
                ['Z']];
    return null;
}

function list_path(src, dst, connect, frame) {
    if (src && dst && connect) {
        let mp = frame.width * 0.5;
        return [['M', src.left, src.top],
                ['l', src.width, 0],
                ['C', mp, src.top, mp, dst.top, dst.left, dst.top],
                ['l', dst.width, 0],
                ['l', 0, dst.height],
                ['l', -dst.width, 0],
                ['C', mp, dst.top + dst.height, mp, src.top + src.height,
                 src.left + src.width, src.top + src.height],
                ['l', -src.width, 0],
                ['Z']];
    }
    let path = [];
    if (src) {
        path.push(['M', src.left, src.top],
                  ['l', src.width, 0],
                  ['l', 0, src.height],
                  ['l', -src.width, 0],
                  ['Z']);
    }
    if (dst) {
        path.push(['M', dst.left, dst.top],
                  ['l', dst.width, 0],
                  ['l', 0, dst.height],
                  ['l', -dst.width, 0],
                  ['Z']);
    }
    return path;
}

function remove_object_svg(obj, duration) {
    if (!obj.view)
        return;
    if (!duration)
        duration = 1000;
    if (obj.view.label) {
        obj.view.label.stop();
        obj.view.label.animate({'stroke-opacity': 0, 'fill-opacity': 0},
                               duration, 'linear', function() { this.remove(); });
        obj.view.label = null;
    }
    if (obj.view.startPoint) {
        obj.view.startPoint.stop();
        obj.view.startPoint.unhover();
        obj.view.startPoint.undrag();
        obj.view.startPoint.animate({'opacity': 0},
                                    duration, 'linear', function() { this.remove(); });
        obj.view.startPoint = null;
    }
    if (obj.view.stopPoint) {
        obj.view.stopPoint.stop();
        obj.view.stopPoint.unhover();
        obj.view.stopPoint.undrag();
        obj.view.stopPoint.animate({'opacity': 0},
                                   duration, 'linear', function() { this.remove(); });
        obj.view.stopPoint = null;
    }
    obj.view.stop();
    obj.view.unhover();
    obj.view.undrag();
    obj.view.animate({'stroke-opacity': 0, 'fill-opacity': 0},
                     duration, 'linear', function() { this.remove(); });
    obj.view = null;
}

function position(x, y, frame) {
    return { 'x': x != null ? x : Math.random() * frame.width,
             'y': y != null ? y : Math.random() * frame.height };
}

function select_all_maps() {
    let updated = false;
    database.maps.each(function(map) {
        if (!map.selected)
            return;
        if (map.view && !map.selected) {
            if (map.view.attr('stroke-opacity') > 0) {
                map.view.animate({'stroke': 'red'}, 50);
                updated = true;
            }
            if (map.view.attr('fill-opacity') > 0) {
                map.view.animate({'fill': 'red'}, 50);
                updated = true;
            }
        }
        map.selected = true;
    });
    if (updated)
        $('#container').trigger("updateMapProperties");
}

function deselectAllMaps(tables) {
    if (tables) {
        if (tables.left)
            tables.left.highlightRow(null, true);
        if (tables.right)
            tables.right.highlightRow(null, true);
    }

    let updated = false;
    database.maps.each(function(map) {
        if (map.view && map.selected) {
            map.view.animate({'stroke': 'white', 'fill': 'white'}, 50);
            updated = true;
        }
        map.selected = false;
    });
    if (updated)
        $('#container').trigger("updateMapProperties");
}

function polarDiff(angle1, angle2, fullscale = Math.PI * 2.0) {
    let halfscale = fullscale * 0.5;
    let diff = angle1 - angle2;
    while (diff > halfscale)
        diff -= fullscale;
    while (diff < -halfscale)
        diff += fullscale;
    return diff;
}

function polarMean(angle1, angle2, fullscale = Math.PI * 2.0) {
    let halfscale = fullscale * 0.5;
    let mean = (angle1 + angle2) * 0.5;
    if (Math.abs(angle1 - angle2) > halfscale)
        mean += halfscale;
    return mean;
}
