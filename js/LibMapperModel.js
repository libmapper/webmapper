function LibMapperModel() {
    this.devices = new Assoc();
    this.signals = new Assoc();
    this.links = new Assoc();
    this.connections = new Assoc();
    this.selectedConnections = new Assoc();

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";
};

LibMapperModel.prototype = {
    // returns an ARRAY with the selected connections
    getSelectedConnections : function() {
        var result = new Array();
        var k = this.selectedConnections.keys();
        for (var key in k)
            result.push(this.selectedConnections.get(k));
        return result;
    },

    selectedConnections_addConnection : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var conn = this.connections.get(key);
        if (conn) {
            if (!this.selectedConnections.get(key)) {
                this.selectedConnections.add(key, conn);
                console.log(this.selectedConnections.keys());
            }
        }
    },

    selectedConnections_removeConnection : function(src, dst) {
        var key = src + ">" + dst;
        if (this.selectedConnections.get(key)) {
            this.selectedConnections.remove(key);
            console.log(this.selectedConnections.keys());
        }
    },

    selectedConnections_isSelected : function(src, dst) {
        var key = src + ">" + dst;
        var conn = this.selectedConnections.get(key);
        if (conn)
            return true;
        else
            return false;
    },

    selectedConnections_clearAll : function() {
        this.selectedConnections = new Assoc();
        console.log(this.selectedConnections.keys());
    },

    getConnection : function(src, dst) {
        var key = src + ">" + dst;
        return this.connections.get(key);
    },

    isConnected : function(src, dst) {
        var conn = this.getConnection(src, dst);
        if (conn)
            return true;
        return false;
    },

    getLink : function(src, dst) {
        var key = src + ">" + dst;
        var link = this.links.get(key);
        if (!link) {
            key = dst + ">" + src;
            link = this.links.get(key);
        }
        return link;
    },

    isLinked : function(src, dst) {
        if (src && dst) {
            var link = this.getLink(src, dst);
            if (link)
                return true;
        }
        else if (src) {
            // check all links
            var keypart1 = src + ">";
            var keypart2 = ">" + src;
            var keys = this.links.keys();
            for (var k in keys) {
                if (keys[k].startsWith(keypart1) || keys[k].endsWith(keypart2))
                    return true;
            }
        }
        return false;
    },

    getLinked : function(dev) {
        var dst = [];
        var keys = this.links.keys();
        for (var k in keys) {
            var devNames = keys[k].split(">");
            if (dev == devNames[0] && dst.indexOf(devNames[1]) == -1)
                dst.push(devNames[1]);
            else if (dev == devNames[1] && dst.indexOf(devNames[0]) == -1)
                dst.push(devNames[0]);
        }
        return dst;
    },

    // returns devices split into sources and destinations
    getDevices : function() {
        var srcDevs = new Array();
        var dstDevs = new Array();

        var keys = this.devices.keys();
        for (var d in keys) {
            var k = keys[d];
            var dev = this.devices.get(k);

            if (dev.num_outputs)
                srcDevs.push(dev);
            if (dev.num_inputs)
                dstDevs.push(dev);
        }
        return [srcDevs, dstDevs];
    }
};
