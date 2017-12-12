//++++++++++++++++++++++++++++++++++++++//
//           Link View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class LinkView extends View {
    constructor(frame, tables, canvas, model) {
        super('link', frame, {'left': tables.left, 'right': tables.right},
              canvas, model);

        // set left table properties
        this.tables.left.collapseAll = true;
        this.tables.left.filterByDirection('both');
        this.tables.left.showDetail(false);

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.collapseAll = true;
        this.tables.right.filterByDirection('both');
        this.tables.right.showDetail(false);

        // remove associated svg elements for signals
        model.devices.each(function(dev) {
            dev.signals.each(function(sig) { remove_object_svg(sig); });
        });
        // remove associated svg elements for maps
        model.maps.each(function(map) { remove_object_svg(map); });

        this.stagedFile = null;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, 0, this.frame.width * 0.4,
                                this.frame.height, 0, duration);
        this.tables.right.adjust(this.frame.width * 0.6, 0, this.frame.width * 0.4,
                                 this.frame.height, 0, duration,
                                 function() {self.draw()});
        this.mapPane.left = this.frame.width * 0.4;
        this.mapPane.width = this.frame.width * 0.2;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
        this.draw();
    }

    setDeviceTarget(dev_idx, table, row) {
        console.log('set_device_target', dev_idx, this.tables, row);
        this.stagedFile.devices[dev_idx].target_table = table;
        this.stagedFile.devices[dev_idx].target_name = row.id;
        this.stagedFile.devices[dev_idx].target_index = row.index;
    }

    upgradeFile(file) {
        // update to version 2.2
        file.mapping.maps = [];
        for (var i in file.mapping.connections) {
            let c = file.mapping.connections[i];
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
            file.mapping.maps.push(map);
        }
        delete file.mapping.connections;
        file.fileversion = "2.2";
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

    drawFile() {
        let angleInc = Math.PI * 2.0 / staged_file.num_devices;
        for (var key in staged_file.devices) {
            let dev = staged_file.devices[key];
            let pos_x = Math.sin(dev.view.index * angleInc);
            let pos_y = Math.cos(dev.view.index * angleInc);
            let path;
            let color = 'gray';
            if (!dev.target_table) {
                dev.view.animate({'path': [['M', frame.cx, frame.cy],
                                           ['l', pos_x * 200, pos_y * 200]]},
                                 1000, 'linear');
//                dev.view.label.animate({'x': frame.cx + pos_x * 180,
//                                        'y': frame.cy + pos_y * 180 });
                continue;
            }
            else if (target_table == 'left') {
                let qx = (link_pane.left + frame.cx) * 0.5;
                let top_angle = Math.atan2(target.top - frame.cy, qx - frame.cx);
                let bot_angle = Math.atan2(target.top + target.height - frame.cy,
                                           qx - frame.cx);
                top_angle += Math.PI * 0.5;
                bot_angle -= Math.PI * 0.5;
                let top_isect = [frame.cx + Math.cos(top_angle) * 100,
                                 frame.cy + Math.sin(top_angle) * 100];
                let bot_isect = [frame.cx + Math.cos(bot_angle) * 100,
                                 frame.cy + Math.sin(bot_angle) * 100];
                path = [['M', link_pane.left, target.top],
                        ['S', qx, target.top, top_isect[0], top_isect[1]],
                        ['L', bot_isect[0], bot_isect[1]],
                        ['S', qx, target.top + target.height, link_pane.left,
                         target.top + target.height],
                        ['Z']];
//                dev.label.attr({'x': link_pane.left + 10,
//                                'y': target.cy,
//                                'text-anchor': 'start'});
            }
            else {
                let x = link_pane.right;
                let qx = (link_pane.right + frame.cx) * 0.5;
                let top_angle = Math.atan2(target.top - frame.cy, qx - frame.cx);
                let bot_angle = Math.atan2(target.top + target.height - frame.cy,
                                           qx - frame.cx);
                top_angle -= Math.PI * 0.5;
                bot_angle += Math.PI * 0.5;
                let top_isect = [frame.cx + Math.cos(top_angle) * 100,
                                 frame.cy + Math.sin(top_angle) * 100];
                let bot_isect = [frame.cx + Math.cos(bot_angle) * 100,
                                 frame.cy + Math.sin(bot_angle) * 100];
                path = [['M', link_pane.right, target.top],
                        ['S', qx, target.top, top_isect[0], top_isect[1]],
                        ['L', bot_isect[0], bot_isect[1]],
                        ['S', qx, target.top + target.height, x,
                         target.top + target.height],
                        ['Z']];
                dev.label.attr({'x': link_pane.right - 10,
                                'y': target.cy,
                                'text-anchor': 'end'});
            }
            dev.view.attr({'path': path,
                           'stroke-width': 0,
                           'stroke-opacity': 0,
                           'fill': model.devices.find(target_name).color,
                           'fill-opacity': 0.5}).toFront();
            dev.label.toFront();
        }
    }

    matrix(x, y) {
        var M = new Array(x);
        var i = x;
        while (i--) {
            M[x-i-1] = new Array(y);
            M[x-i-1].fill(0);
        }
        return M;
    }

    updateLinks() {
        model.devices.each(function(dev) {
            dev.view.src_indices = [];
            dev.view.dst_indices = [];
        });
        model.links.each(function(link) {
            let src = link.src.view;
            let dst = link.dst.view;
            if (!src.dst_indices.includes(dst.dst_index)) {
                src.dst_indices.push(dst.dst_index);
                src.dst_indices.sort();
            }
            if (!dst.src_indices.includes(src.src_index)) {
                dst.src_indices.push(src.src_index);
                dst.src_indices.sort();
            }
            if (link.view)
                return;
            link.view = canvas.path();
            let rgb = Raphael.getRGB(link.src.color);
            let gradient = [];
            gradient[0] = '0-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
            rgb = Raphael.getRGB(link.dst.color);
            gradient[1] = ')-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';

            link.view.attr({'fill': gradient[0]+0.25+gradient[1]+0.25+')',
                            'stroke-opacity': 0});
            link.view.setAlpha = function(alpha1, alpha2) {
                if (!alpha2)
                    alpha2 = alpha1;
                this.attr({'fill': gradient[0]+alpha1+gradient[1]+alpha2+')'});
            }
            link.view.hover(
                function() {
                    link.view.toFront();
                    link.view.setAlpha(0.5);
                    this.mousemove(function (e, x) {
                        let ratio = (x - link_pane.left) / link_pane.width;
                        ratio = ratio * 0.25;
                        link.view.setAlpha(0.5-ratio, 0.25+ratio);
                    });
                },
                function() {
                    this.unmousemove();
                    this.setAlpha(0.25);
            });
            link.view.unclick().click(function(e, x) {
                console.log('click');
                // check if close to table
                // enable dragging to new device
            });
        });
    }

    ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    drawLinks(duration) {
        let lh = this.tables.left.row_height;
        let rh = this.tables.right.row_height;
        let ls = this.tables.left.scrolled;
        let rs = this.tables.right.scrolled;
        let cx = this.frame.cx;

        model.links.each(function(link) {
            if (!link.view)
                return;
            link.view.stop();

            let src = link.src.view;
            let dst = link.dst.view;
            let lh_frac = lh / src.dst_indices.length;
            let lt = ((src.src_index + ratio(src.dst_indices, dst.dst_index)) * lh
                      - tables.left.scrolled + 20);
            let rh_frac = rh / dst.src_indices.length;
            let rt = ((dst.dst_index + ratio(dst.src_indices, src.src_index)) * rh
                      - tables.right.scrolled + 20);
            let path = [['M', link_pane.left, lt],
                        ['C', cx, lt, cx, rt, link_pane.right, rt],
                        ['l', 0, rh_frac],
                        ['C', cx, rt + rh_frac, cx, lt + lh_frac, link_pane.left, lt + lh_frac],
                        ['Z']];
            link.view.animate({'path': path}, duration, '>');
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
            $('#container').trigger('map', [src, dst, map]);
        }

        // remove any existing device reps
        for (var i in staged_file.devices) {
            remove_object_svg(staged_file.devices[i], 500);
            delete staged_file.devices[i];
        }
        remove_object_svg(staged_file, 1000);
        staged_file = null;
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'links'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('devices') >= 0) {
            this.updateDevices();
        }
        if (elements.indexOf('links') >= 0)
            this.updateLinks();
        this.draw(1000);
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawLinks(duration);
        if (staged_file)
            this.drawFile(duration);
    };

    cleanup() {
        console.log('cleaning up Link View');

        super.cleanup();

        // clean up any objects created only for this view
        tables.left.collapseAll = false;
        tables.right.collapseAll = false;
        if (staged_file) {
            for (var i in staged_file.devices) {
                remove_object_svg(staged_file.devices[i]);
            }
            remove_object_svg(staged_file);
            staged_file = null;
        }
        model.devices.each(function(dev) {
            delete dev.view.src_offset;
            delete dev.view.dst_offset;
        });
        model.links.each(remove_object_svg);
    }
}
