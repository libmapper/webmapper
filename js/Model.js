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
            if (this.obj_type == 'device')
                obj.signals = new MapperNodeArray('signal', this.cb_func);
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
                this.cb_func('removed', this.obj_type, this.contents[key]);
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
                this.cb_func('removed', this.obj_type, this.contents[key]);
        }
        return key;
    },

    find : function(key) {
        return key ? this.contents[key] : null;
    },
};

function MapperModel() {
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
        console.log('remove device');
        dev = model.devices.find(dev.name);
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
        let dev = model.devices.find(name[0]);
        return dev ? dev.signals.find(String(name.join('/'))) : null;
    }
    this.add_links = function(cmd, links) {
//        console.log('add links', links);
        for (var i in links) {
            let src = this.devices.find(links[i].src);
            let dst = this.devices.find(links[i].dst);
            if (!src || !dst) {
                console.log("error adding link: couldn't find devices",
                            links[i].src, links[i].dst);
                return;
            }
            links[i].src = src
            links[i].dst = dst;
            this.links.add(links[i]);
        }
    }
    this.del_link = function(cmd, link) {
//        console.log('remove link');
        if (link && !link.local)
            this.links.remove(link);
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
            this.maps.add(maps[i]);
        }
    }
    this.del_map = function(cmd, map) {
//        console.log('remove map', map);
        var key = this.maps.remove(map);
//        $('#mapPropsDiv').updateMapPropertiesFor(key);
    }

    // delete handlers in case of refresh
    command.unregister("add_devices");
    command.unregister("del_device");
    command.unregister("add_signals");
    command.unregister("del_signal");
    command.unregister("add_links");
    command.unregister("del_link");
    command.unregister("add_maps");
    command.unregister("del_map");

    command.register("add_devices", this.add_devices.bind(this));
    command.register("del_device", this.del_device.bind(this));
    command.register("add_signals", this.add_signals.bind(this));
    command.register("del_signal", this.del_signal.bind(this));
    command.register("add_links", this.add_links.bind(this));
    command.register("del_link", this.del_link.bind(this));
    command.register("add_maps", this.add_maps.bind(this));
    command.register("del_map", this.del_map.bind(this));
};

//MapperModel.prototype = {
//
//};
