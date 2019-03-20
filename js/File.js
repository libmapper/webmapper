//++++++++++++++++++++++++++++++++++++++//
//              File Class              //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class File {
    constructor(file) {
        this.file = file;
    }

    upgrade() {
        if (this.file.fileversion == "2.2")
            return;

        // update to version 2.2
        this.file.mapping.maps = [];
        for (var i in this.file.mapping.connections) {
            let c = this.file.mapping.connections[i];
            let map = {};
            let src = {'name': c.source[0].slice(1)};
            let dst = {'name': c.destination[0].slice(1)};
            if (c.mute != null)
                map.muted = c.mute ? true : false;
            if (c.expression != null)
                map.expression = c.expression.replace('s[', 'src[')
                                             .replace('d[', 'dst[');
            if (c.srcMin != null)
                src.minimum = c.srcMin;
            if (c.srcMax != null)
                src.maximum = c.srcMax;
            if (c.dstMin != null)
                dst.minimum = c.dstMin;
            if (c.dstMax != null)
                dst.maximum = c.dstMax;
            if (c.boundMin != null)
                dst.bound_min = c.boundMin;
            if (c.boundMax != null)
                dst.bound_max = c.boundMax;

            if (c.mode == 'reverse') {
                map.mode = 'expression';
                map.expression = 'y=x';
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
            this.file.mapping.maps.push(map);
        }
        delete this.file.mapping.connections;
        this.file.fileversion = "2.2";
    }

    stageFile(file) {
        let self = this;
        if (!file.fileversion || !file.mapping) {
            console.log("unknown file type");
            return;
        }
        if (file.fileversion == "2.1") {
            upgrade_file(file);
        }
        if (file.fileversion != "2.2") {
            console.log("unsupported fileversion", file.fileversion);
            return;
        }
        if (!file.mapping.maps || !file.mapping.maps.length) {
            console.log("no maps in file");
            return;
        }

        if (this.stagedFile) {
            // remove canvas elements for devices
            for (var i in this.stagedFile.devices) {
                remove_object_svg(this.stagedFile.devices[i]);
            }
            remove_object_svg(this.stagedFile);
        }
        this.stagedFile = file;

        // find devices referenced in file
        this.stagedFile.devices = {};
        this.stagedFile.num_devices = 0;
        maps = this.stagedFile.mapping.maps;
        for (var i in maps) {
            let map = maps[i];
            for (var j in map.sources) {
                let dev = map.sources[j].name.split('/')[0];
                if (dev in this.stagedFile.devices)
                    this.stagedFile.devices[dev].src += 1;
                else {
                    this.stagedFile.devices[dev] = {"src": 1, "dst": 0};
                    ++this.stagedFile.num_devices;
                }
            }
            for (var j in map.destinations) {
                let dev = map.destinations[j].name.split('/')[0];
                if (dev in this.stagedFile.devices)
                    this.stagedFile.devices[dev].dst += 1;
                else {
                    this.stagedFile.devices[dev] = {"src": 0, "dst": 1};
                    ++this.stagedFile.num_devices;
                }
            }
        }
        if (!this.stagedFile.num_devices) {
            console.log("no devices found in file!");
            return;
        }

        let count = 0;
        let angleInc = Math.PI * 2.0 / this.stagedFile.num_devices;
        for (key in this.stagedFile.devices) {
            let dev = this.stagedFile.devices[key];
            let pos_x = Math.sin(count * angleInc);
            let pos_y = Math.cos(count * angleInc);
            dev.view = canvas.path([['M', frame.cx, frame.cy],
                                    ['l', 0, 0]])
                .attr({'stroke-width': '200px',
                       'stroke-opacity': 0.5})
                .animate({'path': [['M', frame.cx, frame.cy],
                                   ['l', pos_x * 200, pos_y * 200]]},
                         1000, 'linear', function() {
//                    this.label = canvas.text(frame.cx + pos_x * 180, frame.cy + pos_y * 180,
//                                             dev.source_name+' ('+dev.src+' src, '+dev.dst+' dst)')
//                         .attr({'font-size': 16, 'fill': 'white'})
//                         .node.setAttribute('pointer-events', 'none');
                })
                .toFront();

            dev.view.index = count++;
            dev.view.drag(function(dx, dy, x, y, event) {
                // enable dragging to a different target device
                if (x < frame.cx) {
                    set_device_target(this.index, 'left',
                                      self.tables.left.getRowFromPosition(x, y));
                }
                else {
                    set_device_target(this.index, 'right',
                                      self.tables.right.getRowFromPosition(x, y));
                }
                this.drawFile(0);
            });
            console.log('dev:', dev);

            dev.source_name = key;

        }
        let self = this;
        this.stagedFile.view = canvas.circle(frame.cx, frame.cy, 0)
            .attr({'fill': 'black', 'stroke': 'white'})
            .animate({'r': 100}, 1000, 'linear', function() {
                this.label = canvas.text(frame.cx, frame.cy,
                                         'Drag handles\nto devices\n\nclick to load')
                    .attr({'font-size': 24, 'fill': 'white'})
                    .node.setAttribute('pointer-events', 'none');
            })
            .hover(
                function() {
                    this.animate({'stroke': 'red', 'stroke-width': 10}, 1000, 'linear');
                },
                function() {
                    this.animate({'stroke': 'black', 'stroke-width': 0}, 1000, 'linear');
            })
            .click(function() {
                load_file();
            });
    }

    loadFile() {
        if (!staged_file || !staged_file.maps)
            return;

        // load file using chosen device mapping
        for (var i in staged_file.maps) {
            let map = staged_file[i];
            // fix expression
            if (map.expression) {
                // TODO: better regexp to avoid conflicts with user vars
                map.expression = map.expression.replace(/src/g, "x");
                map.expression = map.expression.replace(/dst/g, "y");
            }

            // TODO: extend to support convergent maps
            let src = map.sources[0].name.split('/');
            let dst = map.destinations[0].name.split('/');

            // find device correspondence
            for (var i in staged_file.devices) {
                let dev = staged_file.devices[i];
                if (dev.source_name == src[0]) {
                    src[0] = dev.target_name;
                    break;
                }
            }
            for (var i in staged_file.devices) {
                let dev = staged_file.devices[i];
                if (dev.source_name == dst[0]) {
                    dst[0] = dev.target_name;
                    break;
                }
            }
            src = src.join('/');
            dst = dst.join('/');
            mapper.map(src, dst, map);
        }
    }
}
