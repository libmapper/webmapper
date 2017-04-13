function LibMapperModel() {
    this.devices = new Assoc();
    this.signals = new Assoc();
    this.links = new Assoc();
    this.connections = new Assoc();
    this.selectedLinks = new Assoc();
    this.selectedConnections = new Assoc();

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";
};

LibMapperModel.prototype = {

    selectedConnections_toggleConnection : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var conn = this.connections.get(key);
        if (conn) {
            if (!this.selectedConnections.get(key)) {
                this.selectedConnections.add(key, conn);
                return 1;
            }
            else
                this.selectedConnections.remove(key);
        }
        return 0;
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

    selectedLinks_toggleLink : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var link = this.links.get(key);
        if (link) {
            if (!this.selectedLinks.get(key)) {
                this.selectedLinks.add(key, link);
                return 1;
            }
            else
                this.selectedLinks.remove(key);
        }
        return 0;
    },

    selectedLinks_clearAll : function() {
        this.selectedLinks = new Assoc();
    },

    getLink : function(dev1, dev2) {
        var key = 0;
        if (dev1 < dev2)
            key = dev1 + ">" + dev2;
        else
            key = dev2 + ">" + dev1;
        return this.links.get(key);
    },

    isLinked : function(dev1, dev2) {
        if (dev1 && dev2) {
            var link = this.getLink(dev1, dev2);
            if (link)
                return true;
        }
        else if (dev1) {
            // check all links
            var keypart1 = dev1 + ">";
            var keypart2 = ">" + dev1;
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
