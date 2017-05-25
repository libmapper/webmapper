function is_equal(one, two) {
    if (typeof(one) != typeof(two))
        return false;
    if (typeof(one) == 'object') {
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
        let key, obj = new MapperNodeArray();
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

    getkey : function(arg) {
        if (typeof(arg) == 'object') {
            if ('device' in arg)
                return arg.device + ':' + arg.name
            return arg.name;
        }
        else if (typeof(arg) == 'string')
            return arg;
        return null;
    },

    add : function(obj) {
        let key = this.getkey(obj);
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
                this.cb_func(this.obj_type, 'modified', key);
        }
        else {
            obj['key'] = key;
            this.contents[key] = obj;
            if (this.cb_func)
                this.cb_func(this.obj_type, 'added', key);
        }
        return key;
    },

    remove : function(arg) {
        let key = this.getkey(arg);
        if (key && this.contents[key]) {
            if (this.cb_func)
                this.cb_func(this.obj_type, 'removed', key);
            delete this.contents[key];
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
        let key, obj = new MapperEdgeArray();
        obj.keygen = this.keygen;
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

    keygen : function(first, second) {
        if (first > second)
            return second + '<->' + first;
        return first + '<->' + second;
    },

    getprop : function(maybeobj, propname) {
        if (typeof(maybeobj) == 'object')
            return maybeobj[propname];
        else if (typeof(maybeobj) == 'string')
            return maybeobj;
        return null;
    },

    getkey : function() {
        let src = null;
        let dst = null;
        if (arguments.length == 1) {
            if (typeof(arguments[0]) == 'object') {
                src = arguments[0].src;
                dst = arguments[0].dst;
            }
            else if (typeof(arguments[0]) == 'string')
                return arguments[0];
        }
        else if (arguments.length == 2) {
            src = this.getprop(arguments[0], 'name');
            dst = this.getprop(arguments[1], 'name');
        }
        if (src && dst) {
            return this.keygen(src, dst);
        }
        return null;
    },

    add : function(obj) {
        let key = this.getkey(obj);
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
                this.cb_func(this.obj_type, 'modified', key);
        }
        else {
            obj['key'] = key;
            this.contents[key] = obj;
            if (this.cb_func)
                this.cb_func(this.obj_type, 'added', key);
        }
        return key;
    },

    remove : function(arg) {
        let key = this.getkey(arg);
        if (key && this.contents[key]) {
            if (this.cb_func)
                this.cb_func(this.obj_type, 'removed', key);
            delete this.contents[key];
        }
        return key;
    },

    find : function() {
        let key = null;
        if (arguments.length == 1)
            key = this.getkey(arguments[0]);
        else if (arguments.length == 2)
            key = this.getkey(arguments[0], arguments[1])
        return key ? this.contents[key] : null;
    },
};

function MapperModel() {
    callbacks = [];
    this.add_callback = function(f) {
        callbacks.push(f);
    };
    this.cb_handler = function(obj_type, event, key) {
//        console.log("model.cb_handler", obj_type, event, key);
        for (var i in callbacks) {
            callbacks[i](obj_type, event, key);
        }
    };
    this.clear_callbacks = function() {
        callbacks = [];
    };

    this.devices = new MapperNodeArray('device', this.cb_handler);
    this.signals = new MapperNodeArray('signal', this.cb_handler);
    this.links = new MapperEdgeArray('link', this.cb_handler);
    this.maps = new MapperEdgeArray('map', this.cb_handler);
    this.maps.keygen = function(first, second) { return first + '->' + second };

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";

    this.clearAll = function() {
        this.maps.each(function(map) {this.maps.remove(map); });
        this.links.each(function(link) {this.links.remove(link); });
        this.signals.each(function(sig) {this.signals.remove(sig); });
        this.devices.each(function(dev) {this.devices.remove(dev); });
    };
};

//MapperModel.prototype = {
//
//};
