//++++++++++++++++++++++++++++++++++++++//
//           Link View Class            //
//++++++++++++++++++++++++++++++++++++++//

function LinkView(frame, tables, canvas, model)
{
    tables.left.collapseAll = true;
    tables.left.filter_dir('both');
    tables.left.show_detail(false);

    tables.right.collapseAll = true;
    tables.right.filter_dir('both');
    tables.right.show_detail(false);

    var staged_file = null;
    let maps = null;
    let links = {};

    let link_pane = null;

    this.type = function() {
        return 'link';
    }

    // remove associated svg elements for signals and maps
    model.devices.each(function(dev) {
        dev.signals.each(function(sig) { remove_object_svg(sig); });
    });
    model.maps.each(function(map) { remove_object_svg(map); });

    function set_device_target(dev_idx, table, row) {
        console.log('set_device_target', dev_idx, tables, row);
        staged_file.devices[dev_idx].target_table = table;
        staged_file.devices[dev_idx].target_name = row.id;
        staged_file.devices[dev_idx].target_index = row.index;
    }

    function upgrade_file(file) {
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

    this.stage_file = function(file) {
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

        if (staged_file) {
            // remove canvas elements for devices
            for (var i in staged_file.devices) {
                remove_object_svg(staged_file.devices[i]);
            }
            remove_object_svg(staged_file);
            delete staged_file;
        }
        staged_file = file;

        // find devices referenced in file
        staged_file.devices = {};
        staged_file.num_devices = 0;
        maps = staged_file.mapping.maps;
        for (var i in maps) {
            let map = maps[i];
            for (var j in map.sources) {
                let dev = map.sources[j].name.split('/')[0];
                if (dev in staged_file.devices)
                    staged_file.devices[dev].src += 1;
                else {
                    staged_file.devices[dev] = {"src": 1, "dst": 0};
                    ++staged_file.num_devices;
                }
            }
            for (var j in map.destinations) {
                let dev = map.destinations[j].name.split('/')[0];
                if (dev in staged_file.devices)
                    staged_file.devices[dev].dst += 1;
                else {
                    staged_file.devices[dev] = {"src": 0, "dst": 1};
                    ++staged_file.num_devices;
                }
            }
        }
        if (!staged_file.num_devices) {
            console.log("no devices found in file!");
            return;
        }

        let count = 0;
        let angleInc = Math.PI * 2.0 / staged_file.num_devices;
        for (key in staged_file.devices) {
            let dev = staged_file.devices[key];
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
                                      tables.left.row_from_position(x, y));
                }
                else {
                    set_device_target(this.index, 'right',
                                      tables.right.row_from_position(x, y));
                }
                draw_file(0);
            });
            console.log('dev:', dev);

            dev.source_name = key;

        }
        staged_file.view = canvas.circle(frame.cx, frame.cy, 0)
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

    function draw_file() {
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

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, frame.width * 0.25, frame.width * 0.25, 0, 1000);
        link_pane = {'left': frame.width * 0.25,
                     'right': frame.width * 0.75,
                     'top': 0,
                     'width': frame.width * 0.5,
                     'height': frame.height,
                     'cx': frame.width * 0.5};
        draw(0);
    }
    this.resize();

    function matrix(x, y) {
        var M = new Array(x);
        var i = x;
        while (i--) {
            M[x-i-1] = new Array(y);
            M[x-i-1].fill(0);
        }
        return M;
    }

    function update_devices() {
        model.devices.each(function(dev) {
            if (!dev.view)
                dev.view = canvas.path().attr({'fill': dev.color,
                                               'fill-opacity': 0});
            let row = tables.left.row_from_name(dev.name);
            dev.view.src_index = row ? row.index : null;
            row = tables.right.row_from_name(dev.name);
            dev.view.dst_index = row ? row.index : null;
        });
    }

    function draw_devices(duration) {
        let lh = tables.left.row_height;
        let rh = tables.right.row_height;
        let ls = tables.left.scrolled;
        let rs = tables.right.scrolled;
        let w = link_pane.left;
        let cx = link_pane.cx;

        model.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let path = [];
            if (dev.view.src_index != null) {
                path.push(['M', 0, lh * dev.view.src_index - ls + 20],
                          ['l', w, 0],
                          ['l', 0, lh],
                          ['l', -w, 0],
                          ['Z']);
            }
            if (dev.view.dst_index != null) {
                path.push(['M', link_pane.right, rh * dev.view.dst_index - rs + 20],
                          ['l', w, 0],
                          ['l', 0, rh],
                          ['l', -w, 0],
                          ['Z']);
            }
            dev.view.toBack();
            dev.view.animate({'path': path,
                              'fill-opacity': 0.5,
                              'stroke-opacity': 0}, duration, '>');
        });
    }

    function update_links() {
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

    function ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    function draw_links(duration) {
        let lh = tables.left.row_height;
        let rh = tables.right.row_height;
        let ls = tables.left.scrolled;
        let rs = tables.right.scrolled;
        let cx = frame.cx;

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

    function load_file() {
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

    function update() {
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
            tables.left.update(frame.height);
            tables.right.update(frame.height);
            update_devices();
        }
        if (elements.indexOf('links') >= 0)
            update_links();
        draw(1000);
    }
    this.update = update;

    function draw(duration) {
        draw_devices(duration);
        draw_links(duration);
        if (staged_file)
            draw_file(duration);
    };

    this.pan = function(x, y, delta_x, delta_y) {
        if (x < frame.left + link_pane.left) {
            tables.left.pan(delta_y);
            draw(0, false);
        }
        else if (x > (frame.left + link_pane.right)) {
            tables.right.pan(delta_y);
            draw(0, false);
        }
        else {
            // send to both left and right tables
            tables.left.pan(delta_y);
            tables.right.pan(delta_y);
            draw(0, false);
        }
    }

    this.zoom = function(x, y, delta) {
        if (x < frame.left + link_pane.left) {
            if (tables.left.zoom(y - frame.top - link_pane.top, delta))
                draw(0, false);
        }
        else if (x > (frame.left + link_pane.right)) {
            if (tables.right.zoom(y - frame.top - link_pane.top, delta))
                draw(0, false);
        }
        else {
            // send to both left and right tables
            let update = tables.left.zoom(y - frame.top - link_pane.top, delta);
            update |= tables.right.zoom(y - frame.top - link_pane.top, delta);
            if (update)
                draw(0, false);
        }
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            tables.left.filter_text(text);
        else
            tables.right.filter_text(text);
        update();
        draw(1000, true);
    }

    this.cleanup = function() {
        console.log('cleaning up Link View');
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
