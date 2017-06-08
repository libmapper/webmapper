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
    return { left: e.offsetLeft - e.scrollLeft + o.left,
             top: e.offsetTop - e.scrollTop + o.top,
             width: e.offsetWidth,
             height: e.offsetHeight };
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
