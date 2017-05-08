function MapperNodeArray() {
    this.contents = {};
};

MapperNodeArray.prototype = {
    filter : function(func) {
        let obj = new MapperNodeArray();
        for (var key in this.contents) {
            if (func(this.contents[key]))
                obj.add(this.contents[key]);
        }
        return obj;
    },

    reduce : function(func) {
        let total = null;
        for (var key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    each : function(func) {
        for (var key in this.contents) {
            func(this.contents[key]);
        }
    },

    size : function() {
        var size = 0, key;
        for (key in this.contents) {
            if (this.contents.hasOwnProperty(key))
                size++;
        }
        return size;
    },

    getkey : function(arg) {
        if (typeof(arg) == 'object')
            return arg.name;
        else if (typeof(arg) == 'string')
            return arg;
        return null;
    },

    add : function(obj) {
        let key = this.getkey(obj);
        if (this.contents[key])
            obj.selected = this.contents[key].selected;
        obj['key'] = key;
        this.contents[key] = obj;
        return key;
    },

    remove : function(arg) {
        let key = this.getkey(arg);
        delete this.contents[key];
        return key;
    },

    find : function(key) {
        return this.contents[key];
    }
};

function MapperEdgeArray() {
    this.contents = {};
};

MapperEdgeArray.prototype = {
    filter : function(func) {
        let obj = new MapperEdgeArray();
        obj.keygen = this.keygen;
        for (var key in this.contents) {
            if (func(this.contents[key]))
                obj.add(this.contents[key]);
        }
        return obj;
    },

    reduce : function(func) {
        let total = null;
        for (var key in this.contents) {
            total = func(total, this.contents[key]);
        }
        return total;
    },

    each : function(func) {
        for (var key in this.contents) {
            func(this.contents[key]);
        }
    },

    size : function() {
        var size = 0, key;
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
        if (key) {
            if (this.contents[key])
                obj.selected = this.contents[key].selected;
            obj['key'] = key;
            this.contents[key] = obj;
        }
        return key;
    },

    remove : function(arg) {
        let key = this.getkey(arg);
        if (key)
            delete this.contents[key];
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
    this.devices = new MapperNodeArray();
    this.signals = new MapperNodeArray();
    this.links = new MapperEdgeArray();
    this.maps = new MapperEdgeArray();
    this.maps.keygen = function(first, second) { return first + '->' + second };

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";
};

//MapperModel.prototype = {
//
//};
