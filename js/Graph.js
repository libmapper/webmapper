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

                if ('color.rgb' in obj && 3 == obj['color.rgb'].length) {
                    let rgb = obj['color.rgb'];
                    let hsl = Raphael.rgb2hsl({r:rgb[0], g:rgb[1], b:rgb[2]});
                    obj.hue = hsl.h;
                }
                else if ('color.hue' in obj) {
                    let hue = obj['color.hue'];
                    if (1 == hue.length)
                        obj.hue = hue;
                    else
                        obj.hue = hue[0];
                    if (obj.hue > 1) {
                        // constrain and normalize
                        obj.hue = (obj.hue & 0xFFFFFF) / 0xFFFFFF;
                    }
                }
                else {
                    // create hue hash
                    hueHash = function(str) {
                        var hash = 0, i, chr;
                        if (str.length === 0) return 0x000000;
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
//         console.log(this.obj_type+'s.add', obj.key, obj);
        let key = obj.key;
        let id = obj.id;
        if (!key)
            return null;

        let existing = this.contents[key];
        if (typeof id !== 'undefined' && id != 0) {
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
        // may need to remove some properties
        for (prop in existing) {
            if (!existing.hasOwnProperty(prop) || obj[prop] != undefined)
                continue;
            switch (prop) {
                case 'hidden':
                case 'view':
                case 'selected':
                    break;
                default:
                    delete existing[prop];
                    updated = true;
            }
        }
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
    this.active_sessions = [];

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
            if (hidden)
                devs[i].hidden = true;
            let dev = this.devices.add(devs[i], i == last);
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
    this.update_sessions = function(cmd, sessions) {
        this.active_sessions = sessions;
        this.cb_handler('modified', 'session');
    }

    // delete handlers in case of refresh
    command.unregister("add_devices");
    command.unregister("del_devices");
    command.unregister("add_signals");
    command.unregister("del_signals");
    command.unregister("add_maps");
    command.unregister("del_maps");
    command.unregister("sessions");

    command.register("add_devices", this.add_devices.bind(this));
    command.register("del_devices", this.del_devices.bind(this));
    command.register("add_signals", this.add_signals.bind(this));
    command.register("del_signals", this.del_signals.bind(this));
    command.register("add_maps", this.add_maps.bind(this));
    command.register("del_maps", this.del_maps.bind(this));
    command.register("sessions", this.update_sessions.bind(this));
};

var graph = new Graph();
