function LibMapperModel() {
    this.devices = new Assoc();
    this.signals = new Assoc();
    this.links = new Assoc();
    this.maps = new Assoc();
    this.selectedLinks = [];
    this.selectedMaps = [];

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";
};

LibMapperModel.prototype = {

    removeDevice : function(name) {
        this.devices.remove(name);
    },

    removeLink : function(key) {
        this.links.remove(key);
        // also remove from selectedLinks
        var index = this.selectedLinks.indexOf(key);
        if (index > -1)
            this.selectedLinks.splice(index, 1);
    },

    removeMap : function(key) {
        this.maps.remove(key);
        // also remove from selectedMaps
        var index = this.selectedMaps.indexOf(key);
        if (index > -1)
            this.selectedMaps.splice(index, 1);
    },

    selectedMaps_toggleMap : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var map = this.maps.get(key);
        if (map) {
            var index = this.selectedMaps.indexOf(key);
            if (index == -1) {
                this.selectedMaps.push(key);
                return 1;
            }
            else
                this.selectedMaps.splice(index, 1);
        }
        return 0;
    },

    selectedMaps_isSelected : function(src, dst) {
        var key = src + ">" + dst;
        var index = this.selectedMaps.indexOf(key);
        if (index > -1)
            return true;
        else
            return false;
    },

    selectedMaps_clearAll : function() {
        this.selectedMaps = [];
    },

    getMap : function(src, dst) {
        var key = src + ">" + dst;
        return this.maps.get(key);
    },

    isMapped : function(src, dst) {
        var map = this.getMap(src, dst);
        if (map)
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
            var index = this.selectedLinks.indexOf(key);
            if (index == -1) {
                this.selectedLinks.push(key);
                return 1;
            }
            else
                this.selectedLinks.splice(index, 1);
        }
        return 0;
    },

    selectedLinks_clearAll : function() {
        this.selectedLinks = [];
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
    },

    removeSignal : function(name) {
        model.signals.remove(name);
    }
};
