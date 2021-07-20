function is_equal(one, two) {
    if (typeof(one) != typeof(two))
        return false;
    if (one == null || two == null)
        return one == two;
    if (typeof(one) == 'object') {
        if (one.key)
            return one.key == two.key;
        if (one.length != two.length)
            return false;
        let index;
        for (index in one) {
            if (typeof(one[index]) == 'object' || typeof(two[index]) == 'object')
                return is_equal(one[index], two[index]);
            if (one[index] != two[index])
                return false
        }
        return true;
    }
    return one == two
}

function NodeArray(obj_type, cb_func) {
    this.contents = {};
    this.obj_type = obj_type;
    this.cb_func = cb_func;
};

NodeArray.prototype = {
    filter : function(func) {
        let key, obj = new NodeArray(this.obj_type, null);
        for (key in this.contents) {
            if (func(this.contents[key]))
                obj.add(this.contents[key]);
        }
        return obj;
    },

    map : function(func) {
        let res = [];
        for (key in this.contents) {
            res.push(func(this.contents[key]));
        }
        return res;
    },

    reduce : function(func) {
        let key, total = null;
        for (key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    some : function(func) {
        let key;
        for (key in this.contents) {
            if (func(this.contents[key]))
                return true;
        }
        return false;
    },

    every : function(func) {
        let key;
        for (key in this.contents) {
            if (!func(this.contents[key]))
                return false;
        }
        return true;
    },

    forEach : function(func) {
        let key;
        for (key in this.contents) {
            func(this.contents[key]);
        }
    },

    size : function() {
        let size = 0, key;
        for (key in this.contents) {
            if (this.contents.hasOwnProperty(key))
                size++;
        }
        return size;
    },

    add : function(obj, last) {
//        console.log(this.obj_type+'s.add', obj);
        let key = obj.key;
        if (!key)
            return null;
        if (key in this.contents) {
            let prop, existing = this.contents[key];
            let updated = false;
            // copy properties from update
            for (prop in obj) {
                if (obj.hasOwnProperty(prop)
                    && !is_equal(existing[prop], obj[prop])) {
                    existing[prop] = obj[prop];
                    updated = true
                }
            }
            if (updated && this.cb_func)
                this.cb_func('modified', this.obj_type, existing, last);
        }
        else {
            if (this.obj_type == 'device') {
                obj.signals = new NodeArray('signal', this.cb_func);

                // create hue hash
                hueHash = function(str) {
                    var hash = 0, i, chr;
                    if (str.length === 0) return '#000000';
                    // separate name and ordinal
                    let ord_idx = str.lastIndexOf('.');
                    let ord = str.slice(ord_idx+1);
                    str = str.slice(0, ord_idx);
                    for (i = 0; i < str.length; i++) {
                        chr   = str.charCodeAt(i);
                        hash  = ((hash << 5) - hash) + (1 << chr);
                        hash &= 0xFFFFFF; // Constrain to 48bits
                    }
                    // add ordinal, multiplied to be visually discriminable
                    hash += parseInt(ord) * 600000;
                    // constrain and normalize
                    hash = (hash & 0xFFFFFF) / 0xFFFFFF;
                    // convert to hue
                    return hash;
                };
                obj.hue = hueHash(key);
            }
            this.contents[key] = obj;

            // sort by key
            let ordered = {};
            let contents = this.contents;
            Object.keys(contents).sort(namespaceSort).forEach(function(k) {
                ordered[k] = contents[k];
            });
            this.contents = ordered;

            if (this.cb_func)
                this.cb_func('added', this.obj_type, this.contents[key], last);
        }
        return this.contents[key];
    },

    remove : function(obj, last) {
        let key = obj.key;
        if (key && this.contents[key]) {
            if (this.signals)
                this.signals.forEach(function(sig) { this.signals.remove(sig); });
            if (this.cb_func)
                this.cb_func('removing', this.obj_type, this.contents[key], last);
            delete this.contents[key];
            if (this.cb_func)
                this.cb_func('removed', this.obj_type, {'key': key}, last);
        }
        return key;
    },

    find : function(key) {
        return this.contents[key];
    }
};

function EdgeArray(obj_type, cb_func) {
    this.contents = {};
    this.obj_type = obj_type;
    this.cb_func = cb_func;
};

EdgeArray.prototype = {
    filter : function(func) {
        let key, obj = new EdgeArray(this.obj_type, null);
        for (key in this.contents) {
            if (func(this.contents[key])) {
                obj.add(this.contents[key]);
            }
        }
        return obj;
    },

    map : function(func) {
        let res = [];
        for (key in this.contents) {
            res.push(func(this.contents[key]));
        }
        return res;
    },

    reduce : function(func) {
        let key, total = null;
        for (key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    some : function(func) {
        let key;
        for (key in this.contents) {
            if (func(this.contents[key]))
                return true;
        }
        return false;
    },

    every : function(func) {
        let key;
        for (key in this.contents) {
            if (!func(this.contents[key]))
                return false;
        }
        return true;
    },

    forEach : function(func) {
        let key;
        for (key in this.contents) {
            func(this.contents[key]);
        }
    },

    size : function() {
        let size = 0, key;
        for (key in this.contents) {
            if (this.contents.hasOwnProperty(key))
                size++;
        }
        return size;
    },

    add : function(obj, last) {
        // console.log(this.obj_type+'s.add', obj.key, obj);
        let key = obj.key;
        let id = obj.id;
        if (!key)
            return null;

        let existing = this.contents[key];
        if (typeof id !== 'undefined') {
            for (let i in this.contents) {
                let edge = this.contents[i];
                if (edge.id == id) {
                    if (!existing) {
                        existing = edge;
                        this.contents[key] = existing;
                        delete this.contents[existing.key]
                        break;
                    }
                    else if (existing !== edge) {
                        this._merge(existing, edge, last);
                        this.remove(this.contents[i]);
                    }
                }
            }
        }
        if (existing) {
            this._merge(existing, obj, last);
        }
        else {
            this.contents[key] = obj;
            if (this.cb_func)
                this.cb_func('added', this.obj_type, this.contents[key], last);
        }
        // console.log(this.obj_type+"s contents: ", this.contents);
        return this.contents[key];
    },

    _merge : function(existing, obj, last) {
        // copy properties from update
        let prop;
        let updated = false;
        for (prop in obj) {
            if (obj.hasOwnProperty(prop)
                && !is_equal(existing[prop], obj[prop])) {
                existing[prop] = obj[prop];
                updated = true;
            }
        }
        if (updated && this.cb_func) {
            this.cb_func('modified', this.obj_type, existing, last);
        }
    },

    remove : function(obj, last) {
        let key = obj.key;
        if (key && this.contents[key]) {
            if (this.cb_func)
                this.cb_func('removing', this.obj_type, this.contents[key], last);
            delete this.contents[key];
            if (this.cb_func)
                this.cb_func('removed', this.obj_type, {'key': key}, last);
        }
        return key;
    },

    find : function(key) {
        return key ? this.contents[key] : null;
    },
};

function Graph() {
    callbacks = [];
    this.add_callback = function(f) {
        callbacks.push(f);
    };
    this.cb_handler = function(event, type, obj, repaint) {
        for (var i in callbacks) {
            callbacks[i](event, type, obj, repaint);
        }
    };
    this.clear_callbacks = function() {
        callbacks = [];
    };

    this.devices = new NodeArray('device', this.cb_handler);
    this.links = new EdgeArray('link', this.cb_handler);
    this.maps = new EdgeArray('map', this.cb_handler);

    this.networkInterfaces = {'selected': null, 'available': []};

    this.fileCounter = 0;

    // config items
    this.pathToImages = "images/";

    this.clearAll = function() {
        this.maps.forEach(function(map) { this.maps.remove(map); });
        this.links.forEach(function(link) { this.links.remove(link); });
        this.devices.forEach(function(dev) { this.devices.remove(dev); });
    };

    this.add_devices = function(cmd, devs) {
        let hidden = this.devices.some(d => d.hidden == true);
        let last = devs.length - 1;
        for (var i in devs) {
            let dev = this.devices.add(devs[i], i == last);
            if (hidden)
                dev.hidden = true;
            console.log('subscribing to device', dev.name)
            command.send('subscribe', dev.name);
        }
    }
    this.del_devices = function(cmd, devs) {
        let last = devs.length - 1;
        for (var i in devs) {
            dev = this.devices.find(devs[i].name);
            if (!dev)
                return;
            let maps = this.maps;
            dev.signals.forEach(function(sig) {
                maps.forEach(function(map) {
                    if (map.srcs.indexOf(sig) >= 0 || sig == map.dst)
                        maps.remove(map);
                });
            });
            let links = this.links;
            links.forEach(function(link) {
                if (link.src == dev || link.dst == dev)
                    links.remove(link);
            });
            this.devices.remove(dev, i == last);
        }
    }
    this.add_signals = function(cmd, sigs) {
        let last = sigs.length - 1;
        for (var i in sigs) {
            let dev = this.devices.find(sigs[i].device);
            if (!dev) {
                console.log("error adding signal: couldn't find device", sigs[i].device);
                return;
            }
            sigs[i].device = dev;
            dev.signals.add(sigs[i], i == last);
        }
    }
    this.del_signals = function(cmd, sigs) {
        let last = sigs.length - 1;
        for (var i in sigs) {
            let dev = this.devices.find(sigs[i].device);
            if (dev)
                dev.signals.remove(sigs[i], i == last);
        }
    }
    this.find_signal = function(name) {
        name = name.split('/');
        if (name.length < 2) {
            console.log("error parsing signal name", name);
            return null;
        }
        let dev = this.devices.find(name[0]);
        return dev ? dev.signals.find(String(name.join('/'))) : null;
    }
    this.add_maps = function(cmd, maps) {
        // TODO: check for convergent maps and add appropriate links
        let self = this;
        let last = maps.length - 1;
        for (var i in maps) {
            for (j in maps[i].srcs) {
                maps[i].srcs[j] = self.find_signal(maps[i].srcs[j].key)
            }
            maps[i].dst = self.find_signal(maps[i].dst.key);
            if (!maps[i].srcs || !maps[i].dst) {
                console.log("error adding map: couldn't find signals", maps[i].srcs, maps[i].dst);
                return;
            }
            let map = this.maps.add(maps[i], i == last);
            if (!map) {
                console.log("error adding map:", maps[i]);
                return;
            }

            let dst = map.dst;
            for (var j in map.srcs) {
                let src = map.srcs[j];

                let link_key;
                let rev = false;
                if (src.device.name < dst.device.name)
                    link_key = src.device.name + '<->' + dst.device.name;
                else {
                    link_key = dst.device.name + '<->' + src.device.name;
                    rev = true;
                }
                let link = this.links.find(link_key);
                if (!link) {
                    link = this.links.add({'key': link_key,
                                           'src': rev ? dst.device : src.device,
                                           'dst': rev ? src.device : dst.device,
                                           'maps': [map.key],
                                           'status': map.status}, 1);
                    if (src.device.links)
                        src.device.links.push(link_key);
                    else
                        src.device.links = [link_key];
                    if (dst.device.links)
                        dst.device.links.push(link_key);
                    else
                        dst.device.links = [link_key];
                }
                else if (!link.maps.includes(map.key))
                    link.maps.push(map.key);
                if (link.status != 'active' && map.status == 'active') {
                    link.status = 'active';
                    this.links.cb_func('modified', 'link', link, i == last);
                }
            }
        }
    }
    this.del_maps = function(cmd, maps) {
        let last = maps.length - 1;
        for (var i in maps) {
            map = this.maps.find(maps[i].key);
            if (!map)
                return;
            for (var j in map.srcs) {
                let src = map.srcs[j];
                let link_key;
                if (src.device.name < map.dst.device.name)
                    link_key = src.device.name + '<->' + map.dst.device.name;
                else
                    link_key = map.dst.device.name + '<->' + src.device.name;
                let link = this.links.find(link_key);
                if (link) {
                    let index = link.maps.indexOf(map.key);
                    if (index > -1)
                        link.maps.splice(index, 1);
                    if (link.maps.length == 0) {
                        index = link.src.links.indexOf(link_key);
                        if (index > -1)
                            link.src.links.splice(index, 1);
                        index = link.dst.links.indexOf(link_key);
                        if (index > -1)
                            link.dst.links.splice(index, 1);
                        this.links.remove(link);
                    }
                }
            }
            this.maps.remove(map, i == last);
        }
    }

    this.exportFile = function() {
        let file = { "fileversion": "2.3",
                     "mapping": { "maps": [] },
                     "views": { "signals": []} };
        let numMaps = 0;

        this.maps.forEach(function(map) {
            // currently only includes maps with views
            if (!map.view)
                return;
            let m = {'sources': [], 'destinations': []};
            let obj;
            for (var i in map.srcs) {
                let src = map.srcs[i];
                obj = {'name': src.key};
                for (var attr in src) {
                    if (!src.hasOwnProperty(attr))
                        break;
                    switch (attr) {
                        case 'device':
                        case 'hidden':
                        case 'index':
                        case 'jitter':
                        case 'key':
                        case 'name':
                        case 'num_maps':
                        case 'num_maps_in':
                        case 'num_maps_out':
                        case 'period':
                        case 'position':
                        case 'signal':
                        case 'status':
                        case 'steal':
                        case 'version':
                        case 'view':
                            break;
                        case 'min':
                        case 'max':
                            obj[attr + 'imum'] = src[attr];
                            break;
                        default:
                            obj[attr] = src[attr];
                    }
                }
                m.sources.push(obj);
            }
            obj = {'name': map.dst.key};
            for (var attr in map.dst) {
                if (!map.dst.hasOwnProperty(attr))
                    continue;
                switch (attr) {
                    case 'device':
                    case 'hidden':
                    case 'index':
                    case 'jitter':
                    case 'key':
                    case 'name':
                    case 'num_maps':
                    case 'num_maps_in':
                    case 'num_maps_out':
                    case 'period':
                    case 'position':
                    case 'signal':
                    case 'status':
                    case 'steal':
                    case 'version':
                    case 'view':
                        break;
                    case 'min':
                    case 'max':
                        obj[attr + 'imum'] = map.dst[attr];
                        break;
                    default:
                        obj[attr] = map.dst[attr];
                }
            }
            m.destinations.push(obj);
            for (var attr in map) {
                switch (attr) {
                    // ignore a few properties used by webmapper
                    case 'hidden':
                    case 'id':
                    case 'key':
                    case 'num_sigs_in':
                    case 'selected':
                    case 'status':
                    case 'timeout':
                    case 'view':
                        break;
                    case 'src':
                    case 'srcs':
                    case 'dst':
                        break;
                    case 'expr':
                        // need to replace x and y variables with signal references
                        // TODO: better regexp to avoid conflicts with user vars
                        let expr = map.expr;
                        expr = expr.replace(/y\[/g, "dst[");
                        expr = expr.replace(/y\s*=/g, "dst=");
                        expr = expr.replace(/x([0-9]+)/g, "src[$1]");
                        expr = expr.replace(/\bx(?!\w)/g, "src[0]");
                        m.expression = expr;
                        break;
                    case 'process_location':
                        let loc = map[attr];
                        if (loc == 1)
                            m.process_location = 'source';
                        else if (loc == 2)
                            m.process_location = 'destination';
                        break;
                    default:
                        if (!map.hasOwnProperty(attr))
                            break;
                        m[attr] = map[attr];
                        break;
                }
            }
            file.mapping.maps.push(m);
            numMaps++;
        });
        if (!numMaps)
            alert("No maps to save!");
        this.devices.forEach(function(dev) {
            dev.signals.forEach(function(sig) {
                if (sig.canvasObject)
                    file.views.signals.push({'name': sig.key,
                                             'position': sig.canvasObject});
            });
        });
        return numMaps ? file : null;
    }
    
    //naively try to make whatever maps that
    //match source and destination names
    this.loadFileSimple = function(file) {
        this.fileCounter++;
        let self = this;

        upgradeFile = function(file) {
            // update to version 2.2
            console.log('updating file');
            if (file.mapping.maps === 'undefined')
                file.mapping.maps = [];
            for (var i in file.mapping.connections) {
                let c = file.mapping.connections[i];
                let map = {};
                let src = {'name': c.src[0].slice(1)};
                let dst = {'name': c.dest[0].slice(1)};
                if (c.mute != null)
                    map.muted = c.mute ? true : false;
                if (c.expression != null)
                    map.expr = c.expression.replace('s[', 'src[')
                                           .replace('d[', 'dst[')
                                           .replace('dest[', 'dst[');
                if (c.srcMin != null)
                    src.minimum = c.srcMin;
                if (c.srcMax != null)
                    src.maximum = c.srcMax;
                if (c.dstMin != null)
                    dst.minimum = c.dstMin;
                if (c.dstMax != null)
                    dst.maximum = c.dstMax;

                if (c.mode == 'reverse') {
                    map.mode = 'expression';
                    map.expr = 'y=x';
                    map.sources = [dst];
                    map.destinations = [src];
                }
                else {
                    if (c.mode == 'calibrate') {
                        map.mode = 'linear';
                        dst.calibrating = true;
                    }
                    else
                        map.mode = c.mode;
                    map.sources = [src];
                    map.destinations = [dst];
                }
                file.mapping.maps.push(map);
            }
            delete file.mapping.connections;
            file.fileversion = "2.2";

            // upgrade from v2.2 to v2.3
            for (var i in file.mapping.maps) {
                let m = file.mapping.maps[i];
                if (m.mode == 'linear') {
                    console.log('  updating map ', i, 'linear mode');
                    m.expression = 'y=linear(x,-,-,-,-)';
                }
                delete m.mode;
                if (m.destinations[0].calibrating == true) {
                    console.log('  updating map ', i, 'calibrating slot');
                    m.expression = 'y=linear(x,?,?,-,-)';
                }
                delete m.destinations[0].calibrating;
            }
            file.fileversion = "2.3";
        }

        if (file.fileversion != "2.3")
            upgradeFile(file);

        for (var i in file.mapping.maps) {
            let map = file.mapping.maps[i];
            let src_names = map.sources.map(s => s.name);
            let dst_name = map.destinations[0].name;
            console.log('Map from file:', src_names,'->',dst_name);
            if (!src_names || !dst_name) {
                console.log("error adding map from file:", map);
                continue;
            }
            map.srcs = map.sources;
            map.dst = map.destinations;
            if (Array.isArray(map.dst))
                map.dst = map.dst[0];
            delete map.sources;
            delete map.destinations;
            if (map.expression) {
                // fix expression
                // TODO: better regexp to avoid conflicts with user vars
                map.expr = map.expression.replace('src[0]', "x")
                                         .replace('dst[0]', "y")
                                         .replace('dst', "y");
                delete map.expression;
//                console.log(map.expr)
            }

            // fix extrema property names
            function fix_extrema(slot) {
                if (slot.maximum !== undefined) {
                    slot.max = slot.maximum;
                    delete slot.maximum;
                }
                if (slot.minimum !== undefined) {
                    slot.min = slot.minimum;
                    delete slot.minimum;
                }
            }
            map.srcs.forEach(s => fix_extrema(s));
            fix_extrema(map.dst);

            // remove device names
            src_names = src_names.map(s => s.slice(s.indexOf('/')));
            dst_name = dst_name.slice(dst_name.indexOf('/'));

            let self = this;
            this.devices.forEach(function(d1) {
                if (d1.hidden)
                    return;
                let srcsigs = src_names.map(s => {
                    if (typeof s !== 'string') return s;
                    let sig = d1.signals.find(d1.name+s)
                    if (sig) return sig;
                    else return s;
                });
                if (!srcsigs.every(s => typeof s.key === 'string'))
                    return;
                let dstsig = null;
                self.devices.forEach(function (d2) {
                    if (d2.hidden)
                        return;
                    dstsig = d2.signals.find(d2.name+dst_name);
                    if (!dstsig)
                        return;
                    console.log('  Creating map:', srcsigs.map(s => s.key), '->', dstsig.key);
                    mapper._map(srcsigs.map(s => s.key), dstsig.key, map);
                });
            });
        }
    }

    // delete handlers in case of refresh
    command.unregister("add_devices");
    command.unregister("del_devices");
    command.unregister("add_signals");
    command.unregister("del_signals");
    command.unregister("add_maps");
    command.unregister("del_maps");

    command.register("add_devices", this.add_devices.bind(this));
    command.register("del_devices", this.del_devices.bind(this));
    command.register("add_signals", this.add_signals.bind(this));
    command.register("del_signals", this.del_signals.bind(this));
    command.register("add_maps", this.add_maps.bind(this));
    command.register("del_maps", this.del_maps.bind(this));
};

var graph = new Graph();
