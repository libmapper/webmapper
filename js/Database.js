function is_equal(one, two) {
    if (typeof(one) != typeof(two))
        return false;
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

function MapperNodeArray(obj_type, cb_func) {
    this.contents = {};
    this.obj_type = obj_type;
    this.cb_func = cb_func;
};

MapperNodeArray.prototype = {
    filter : function(func) {
        let key, obj = new MapperNodeArray(this.obj_type, null);
        for (key in this.contents) {
            if (func(this.contents[key]))
                obj.add(this.contents[key]);
        }
        return obj;
    },

    reduce : function(func) {
        let key, total = null;
        for (key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    each : function(func) {
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

    add : function(obj) {
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
                this.cb_func('modified', this.obj_type, existing);
        }
        else {
            if (this.obj_type == 'device') {
                obj.signals = new MapperNodeArray('signal', this.cb_func);
                obj.color = Raphael.getColor();
            }
            this.contents[key] = obj;
            if (this.cb_func)
                this.cb_func('added', this.obj_type, this.contents[key]);
        }
        return this.contents[key];
    },

    remove : function(obj) {
        let key = obj.key;
        if (key && this.contents[key]) {
            if (this.signals)
                this.signals.each(function(sig) { this.signals.remove(sig); });
            if (this.cb_func)
                this.cb_func('removing', this.obj_type, this.contents[key]);
            delete this.contents[key];
            if (this.cb_func)
                this.cb_func('removed', this.obj_type, {'key': key});
        }
        return key;
    },

    find : function(key) {
        return this.contents[key];
    }
};

function MapperEdgeArray(obj_type, cb_func) {
    this.contents = {};
    this.obj_type = obj_type;
    this.cb_func = cb_func;
};

MapperEdgeArray.prototype = {
    filter : function(func) {
        let key, obj = new MapperEdgeArray(this.obj_type, null);
        for (key in this.contents) {
            if (func(this.contents[key])) {
                obj.add(this.contents[key]);
            }
        }
        return obj;
    },

    reduce : function(func) {
        let key, total = null;
        for (key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    each : function(func) {
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

    add : function(obj) {
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
                    updated = true;
                }
            }
            if (updated && this.cb_func)
                this.cb_func('modified', this.obj_type, existing);
        }
        else {
            this.contents[key] = obj;
            if (this.cb_func)
                this.cb_func('added', this.obj_type, this.contents[key]);
        }
        return this.contents[key];
    },

    remove : function(obj) {
        let key = obj.key;
        if (key && this.contents[key]) {
            if (this.cb_func)
                this.cb_func('removing', this.obj_type, this.contents[key]);
            delete this.contents[key];
            if (this.cb_func)
                this.cb_func('removed', this.obj_type, {'key': key});
        }
        return key;
    },

    find : function(key) {
        return key ? this.contents[key] : null;
    },
};

function MapperDatabase() {
    callbacks = [];
    this.add_callback = function(f) {
        callbacks.push(f);
    };
    this.cb_handler = function(event, type, obj) {
        for (var i in callbacks) {
            callbacks[i](event, type, obj);
        }
    };
    this.clear_callbacks = function() {
        callbacks = [];
    };

    this.devices = new MapperNodeArray('device', this.cb_handler);
    this.links = new MapperEdgeArray('link', this.cb_handler);
    this.maps = new MapperEdgeArray('map', this.cb_handler);

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";

    this.clearAll = function() {
        this.maps.each(function(map) { this.maps.remove(map); });
        this.links.each(function(link) { this.links.remove(link); });
        this.devices.each(function(dev) { this.devices.remove(dev); });
    };

    this.add_devices = function(cmd, devs) {
//        console.log('add devices', devs);
        for (var i in devs) {
            this.devices.add(devs[i]);
            command.send('subscribe', devs[i].name);
        }
    }
    this.del_device = function(cmd, dev) {
//        console.log('remove device');
        dev = this.devices.find(dev.name);
        if (!dev)
            return;
        let maps = this.maps;
        dev.signals.each(function(sig) {
            maps.each(function(map) {
                if (sig == map.src || sig == map.dst)
                    maps.remove(map);
            });
        });
        let links = this.links;
        links.each(function(link) {
            if (link.src == dev.name || link.dst == dev.name)
                links.remove(link);
        });
        this.devices.remove(dev);
    }
    this.add_signals = function(cmd, sigs) {
//        console.log('add signals', sigs);
        for (var i in sigs) {
            let dev = this.devices.find(sigs[i].device);
            if (!dev) {
                console.log("error adding signal: couldn't find device",
                            sigs[i].device);
                return;
            }
            sigs[i].device = dev;
            dev.signals.add(sigs[i]);
        }
    }
    this.del_signal = function(cmd, sig) {
//        console.log('remove signal');
        let dev = this.devices.find(sig.device);
        if (dev)
            dev.signals.remove(sig);
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
//        console.log('add maps', cmd, maps);
        let self = this;
        findSig = function(name) {
            name = name.split('/');
            if (name.length < 2) {
                console.log("error parsing signal name", name);
                return null;
            }
            let dev = self.devices.find(name[0]);
            if (!dev) {
                console.log("error finding signal: couldn't find device",
                            name[0]);
                return null;
            }
//            name.shift();
            name = String(name.join('/'));
            return dev.signals.find(name);
        }
        for (var i in maps) {
            let src = findSig(maps[i].src);
            let dst = findSig(maps[i].dst);
            if (!src || !dst) {
                console.log("error adding map: couldn't find signals",
                            maps[i].src, maps[i].dst);
                return;
            }
            maps[i].src = src;
            maps[i].dst = dst;
            maps[i].status = 'active';
            let map = this.maps.add(maps[i]);
            if (!map) {
                console.log("error adding map:", maps[i]);
                return;
            }

            let link_key = src.device.name + '->' + dst.device.name;
            let link = this.links.find(link_key);
            if (!link) {
                link = this.links.add({'key': link_key,
                                       'src': src.device,
                                       'dst': dst.device,
                                       'maps': [map.key]});
                if (src.device.links_out)
                    src.device.links_out.push(link_key);
                else
                    src.device.links_out = [link_key];
                if (dst.device.links_in)
                    dst.device.links_in.push(link_key);
                else
                    dst.device.links_in = [link_key];
            }
            else if (!link.maps.includes(map.key))
                link.maps.push(map.key);
        }
    }
    this.del_map = function(cmd, map) {
        let record = this.maps.find(map.key);
        if (!record)
            return;
        let link_key = record.src.device.name + '->' + record.dst.device.name;
        let link = this.links.find(link_key);
        if (link) {
            let index = link.maps.indexOf(record.key);
            if (index > -1)
                link.maps.splice(index, 1);
            if (link.maps.length == 0) {
                index = link.src.links_out.indexOf(link_key);
                if (index > -1)
                    link.src.links_out.splice(index, 1);
                index = link.dst.links_in.indexOf(link_key);
                if (index > -1)
                    link.dst.links_in.splice(index, 1);
                this.links.remove(link);
            }
        }
        this.maps.remove(map);
    }
    this.loadFile = function(file) {
        let self = this;
        addSigDev = function(obj) {
            let name = obj.name.split('/');
            if (name.length < 2) {
                console.log("error parsing signal name", name);
                return null;
            }
            let dev = self.devices.add({'key': name[0]});
            obj.key = obj.name;
            return dev.signals.add(obj);
        }
        for (var i in file.maps) {
            let map = file.maps[i];
            // TODO: enable multiple sources and destinations
            let src = addSigDev(map.sources[0]);
            let dst = addSigDev(map.destinations[0]);
            if (!src || !dst) {
                console.log("error adding map from file:", map);
                continue;
            }
            map.sources = map.destinations = null;
            map.src = src;
            map.dst = dst;
            map.status = 'active';
            if (map.expression) {
                // fix expression
                // TODO: better regexp to avoid conflicts with user vars
                map.expression = map.expression.replace(/src/g, "x");
                map.expression = map.expression.replace(/dst/g, "y");
            }
            this.maps.add(map);
        }
    }

    // delete handlers in case of refresh
    command.unregister("add_devices");
    command.unregister("del_device");
    command.unregister("add_signals");
    command.unregister("del_signal");
    command.unregister("add_maps");
    command.unregister("del_map");

    command.register("add_devices", this.add_devices.bind(this));
    command.register("del_device", this.del_device.bind(this));
    command.register("add_signals", this.add_signals.bind(this));
    command.register("del_signal", this.del_signal.bind(this));
    command.register("add_maps", this.add_maps.bind(this));
    command.register("del_map", this.del_map.bind(this));
};
