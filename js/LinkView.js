//++++++++++++++++++++++++++++++++++++++//
//           Link View Class            //
//++++++++++++++++++++++++++++++++++++++//

function LinkView(frame, tables, canvas, model)
{
    tables.left.collapseAll = true;
    tables.left.filter_dir('output');
    tables.left.show_detail(false);

    tables.right.collapseAll = true;
    tables.right.filter_dir('input');
    tables.right.show_detail(false);

    var fileRep = {};
    fileRep.devices = [];
    let maps = null;
    let links = {};

    let map_pane = null;
    let first_draw = true;

    this.type = function() {
        return 'link';
    }

    function set_device_target(dev_idx, table, name) {
        fileRep.devices[dev_idx].target_table = table;
        fileRep.devices[dev_idx].target_name = name;
    }

    this.parse_file = function(file) {
        if (!file.fileversion || !file.mapping) {
            console.log("unknown file type");
            return;
        }
        if (file.fileversion != "2.2") {
            console.log("unsupported fileversion", file.fileversion);
            return;
        }
        if (!file.mapping.maps || !file.mapping.maps.length) {
            console.log("no maps in file");
            return;
        }
        maps = file.mapping.maps;
        let devs = {};
        let num_devs = 0;
        for (var i in maps) {
            let map = maps[i];
            for (var j in map.sources) {
                let dev = map.sources[j].name.split('/')[0];
                if (dev in devs)
                    devs[dev].src += 1;
                else {
                    devs[dev] = {"src": 1, "dst": 0};
                    num_devs += 1;
                }
            }
            for (var j in map.destinations) {
                let dev = map.destinations[j].name.split('/')[0];
                if (dev in devs)
                    devs[dev].dst += 1;
                else {
                    devs[dev] = {"src": 0, "dst": 1};
                    num_devs += 1;
                }
            }
        }
        if (num_devs == 0) {
            console.log("no devices found in file!");
            return;
        }
        let angleInc = Math.PI * 2.0 / num_devs;
        let count = 0;
        for (key in devs) {
            let device = {};
            device.view = canvas.path([['M', frame.cx, frame.cy],
                                       ['l', 0, 0]])
                                .attr({'stroke-width': '200px',
                                       'stroke-opacity': 0.5})
                                .toBack();
            let pos_x = frame.cx + 200 * Math.sin(count * angleInc);
            let pos_y = frame.cy + 200 * Math.cos(count * angleInc);
            device.view.animate({'path': [['M', frame.cx, frame.cy],
                                          ['L', pos_x, pos_y]]},
                                1000, 'linear');
            device.view.index = count;

            // enable dragging to a different target device
            device.view.drag(function(dx, dy, x, y, event) {
                if (x < frame.cx) {
                    set_device_target(this.index, 'left',
                                      tables.left.row_from_position(x, y).id);
                }
                else {
                    set_device_target(this.index, 'right',
                                      tables.right.row_from_position(x, y).id);
                }
                redraw(0, false);
            });

            pos_x = frame.cx + 180 * Math.sin(count * angleInc);
            pos_y = frame.cy + 180 * Math.cos(count * angleInc);
            device.label = canvas.text(pos_x, pos_y,
                                       key+' ('+ devs[key].src+' src, '+
                                       devs[key].dst+' dst)');
            device.label.attr({'font-size': 16, 'fill': 'white'});
            device.label.node.setAttribute('pointer-events', 'none');

            device.source_name = key;

            fileRep.devices.push(device);
            count += 1;
        }
        fileRep.label.attr({'text': 'Drag handles\nto devices\n\nclick to load'});
        var loaded = true;
    }

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, frame.width * 0.4, frame.width * 0.4, 0, 1000);
        map_pane = {'left': frame.width * 0.4,
            'right': frame.width * 0.6,
            'top': 0,
            'width': frame.width * 0.2,
            'height': frame.height,
            'cx': frame.width * 0.5};
    }

    this.resize();

    function redraw_signal(sig) {
        // remove associated svg elements
        remove_object_svg(sig);
    }

    function redraw_device(dev, duration) {
        dev.signals.each(redraw_signal);
        // TODO: use color to represent device compatibility?
        // each device in file to be loaded gets unique color
        // present devices are grey if no match, color if match
        // may need to represent high compatibility with multiple devices
        // perhaps we could create a color namespace hash instead?

        // TODO: enable dragging device connections
        // TODO: fix pan & zoom
        // TODO: enable file picker
        // TODO: parse file for devices
        // TODO: generate labeled arrows for each device
        // TODO: add 'click to load button?'
        // TODO later: namespace matching
        // TODO: filter out devices with 0 matches
        // TODO later: represent match ratio with color
        // TODO later: show recent files
        // TODO later: discuss versioning, equivalent save view
        let src = tables.left.row_from_name(dev.name);
        if (src) {
            src.left = 0;
            src.width = map_pane.left;
        }
        let dst = tables.right.row_from_name(dev.name);
        if (dst) {
            dst.left = frame.width - map_pane.left;
            dst.width = map_pane.left;
        }
        if (!src && !dst) {
            if (dev.view) {
                dev.view.stop();
                dev.view.animate({'fill-opacity': 0}, duration, '>', function() {
                    this.remove();
                    dev.view = null;
                });
            }
            return;
        }
        let path = list_path(src, dst, false, frame);
        if (!dev.view) {
            dev.view = canvas.path(path).attr({'fill-opacity': 0});
        }
        else
            dev.view.stop();
        dev.view.toBack();
        dev.view.animate({'path': path,
                          'fill': dev.color,
                          'fill-opacity': 0.5,
                          'stroke-opacity': 0}, duration, '>');
    }

    function redraw_map(map, duration) {
            // remove associated svg elements
        remove_object_svg(map);
            // generate link key
            // TODO: extend to complex maps
        let srctab = map.src.direction == 'output' ? 'l' : 'r';
        let dsttab = map.dst.direction == 'output' ? 'l' : 'r';
        let key = (srctab + '.' + map.src.device.name
                   + '->'
                   + dsttab + '.' + map.dst.device.name);
        let src, dst;
        if (map.src.direction == 'output') {
            src = tables.left.row_from_name(map.src.device.name);
            src.left += map_pane.left;
        }
        else {
            src = tables.right.row_from_name(map.src.device.name);
            src.left = map_pane.right;
        }
        if (!src)
            return;
        if (map.dst.direction == 'output') {
            dst = tables.left.row_from_name(map.dst.device.name);
            dst.left += map_pane.left;
        }
        else {
            dst = tables.right.row_from_name(map.dst.device.name);
            dst.left = map_pane.rigth;
        }
        if (!dst)
            return;
        let path;
        let angle = src.left < dst.left ? '0' : '180';
        if (srctab == dsttab) {
            if (src.top == dst.top) {
                    // same row
                let offset = src.left > frame.cx ? -src.height : src.height;
                path = [['M', src.left, src.top],
                        ['C', src.left + offset, src.top,
                         src.left + offset, src.top + src.height,
                         src.left, src.top + src.height],
                        'Z'];
            }
            else {
                if (src.top > dst.top) {
                    let temp = src;
                    src = dst;
                    dst = temp;
                    angle = '90';
                }
                else
                    angle = '270';
                let qp = src.left > frame.cx ? frame.cx + src.height : frame.cx - src.height;
                path = [['M', src.left, src.top],
                        ['C', frame.cx, src.top,
                         frame.cx, dst.top + dst.height,
                         dst.left, dst.top + dst.height],
                        ['l', 0, -dst.height],
                        ['C', qp, dst.top,
                         qp, src.top + src.height,
                         src.left, src.top + src.height],
                        ['Z']];
            }
        }
        else {
            path = [['M', src.left, src.top],
                    ['C', frame.cx, src.top, frame.cx, dst.top, dst.left, dst.top],
                    ['l', 0, dst.height],
                    ['C', frame.cx, dst.top + dst.height, frame.cx,
                     src.top + src.height, src.left, src.top + src.height],
                    ['Z']];
        }
        let rgb = Raphael.getRGB(map.src.device.color);
        let gradient = angle+'-';
        gradient += 'rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.25)-';
        rgb = Raphael.getRGB(map.dst.device.color);
        gradient += 'rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.25)';

        let link;
        if (key in links)
            link = links[key];
        else {
            link = canvas.path([['M', src.left, src.top],
                                 ['l', 0, src.height],
                                 ['Z']]).toBack();
            link.node.setAttribute('pointer-events', 'none');
            links[key] = link;
        }
        link.attr({'fill': gradient, 'stroke-opacity': 0});
        link.animate({'path': path}, duration, 'linear');
    }

    function redraw(duration, update_tables) {
        if (update_tables != false) {
            tables.left.update(frame.height);
            tables.right.update(frame.height);
        }

        model.devices.each(function(dev) { redraw_device(dev, duration); });
        model.maps.each(function(map) { redraw_map(map, duration); });

        if (first_draw) {
            // load file representation
            fileRep.view = canvas.circle(frame.cx, frame.cy, 0)
                                 .attr({'fill': 'black', 'stroke': 'white'})
                                 .animate({'r': 100}, duration, 'linear');
            fileRep.view.hover(
                function() {
                    this.animate({'stroke': 'red',
                                  'stroke-width': 10}, duration, 'linear');
                },
                function() {
                    this.animate({'stroke': 'black',
                                  'stroke-width': 0}, duration, 'linear');
            });
            fileRep.view.click(function() {
                if (maps) {
                    // load file using chosen device mapping
                    for (var i in maps) {
                        let map = maps[i];
                        // fix expression
                        if (map.expression) {
                            // TODO: better regexp to avoid conflicts with user vars
                            map.expression = map.expression.replace(/src/g, "x");
                            map.expression = map.expression.replace(/dst/g, "y");
                        }

                        // TODO: extend to support convergent maps
                        let src = map.sources[0].name.split('/');
                        delete map.sources;
                        let dst = map.destinations[0].name.split('/');
                        delete map.destinations;

                        // find device correspondence
                        for (var i in fileRep.devices) {
                            let d = fileRep.devices[i];
                            if (d.source_name == src[0]) {
                                src[0] = d.target_name;
                                break;
                            }
                        }
                        for (var i in fileRep.devices) {
                            let d = fileRep.devices[i];
                            if (d.source_name == dst[0]) {
                                dst[0] = d.target_name;
                                break;
                            }
                        }
                        src = src.join('/');
                        dst = dst.join('/');
                        $('#container').trigger('map', [src, dst, map]);
                    }
                }
                // remove any existing device reps
                for (var i in fileRep.devices) {
                    let dev = fileRep.devices[i];
                    if (dev.label)
                        dev.label.animate({'stroke-opacity': 0}, duration * 0.5,
                                           'linear', function() {
                        this.remove();
                    });
                    if (dev.view)
                        dev.view.animate({'fill-opacity': 0}, duration * 0.5,
                                          'linear', function() {
                            this.remove();
                        });
                    delete fileRep.devices[i];
                }
                fileRep.label.animate({'fill-opacity': 0}, duration,
                                       'linear', function() {
                    this.remove();
                    fileRep.label = null;
                });
                fileRep.view.animate({'r': 0}, duration, 'linear', function() {
                    this.remove();
                    fileRep.view = null;
                });
                if (maps) {
                    maps = null;
                    return;
                }
                return false; // avoiding navigation
            });

            fileRep.label = canvas.text(frame.cx, frame.cy, 'select file');
            fileRep.label.attr({'font-size': 24,
                                'fill': 'white'});
            fileRep.label.node.setAttribute('pointer-events', 'none');
            first_draw = false;
        }

        for (var i in fileRep.devices) {
            let dev = fileRep.devices[i];
            let target_table = dev.target_table;
            let target_name = dev.target_name;
            if (!target_table || !target_name) {
                continue;
            }
            let color = model.devices.find(target_name).color;
            let target;
            if (target_table == 'left')
                target = tables.left.row_from_name(target_name);
            else if (target_table == 'right')
                target = tables.right.row_from_name(target_name);
            else
                continue;
            if (!target)
                continue;
            let path;

            if (target_table == 'left') {
                let qx = (map_pane.left + frame.cx) * 0.5;
                let top_angle = Math.atan2(target.top - frame.cy, qx - frame.cx);
                let bot_angle = Math.atan2(target.top + target.height - frame.cy,
                                           qx - frame.cx);
                top_angle += Math.PI * 0.5;
                bot_angle -= Math.PI * 0.5;
                let top_isect = [frame.cx + Math.cos(top_angle) * 100,
                                 frame.cy + Math.sin(top_angle) * 100];
                let bot_isect = [frame.cx + Math.cos(bot_angle) * 100,
                                 frame.cy + Math.sin(bot_angle) * 100];
                path = [['M', map_pane.left, target.top],
                        ['S', qx, target.top, top_isect[0], top_isect[1]],
                        ['L', bot_isect[0], bot_isect[1]],
                        ['S', qx, target.top + target.height, map_pane.left,
                         target.top + target.height],
                        ['Z']];
                dev.label.attr({'x': map_pane.left + 10,
                                'y': target.cy,
                                'text-anchor': 'start'});
            }
            else {
                let x = map_pane.right;
                let qx = (map_pane.right + frame.cx) * 0.5;
                let top_angle = Math.atan2(target.top - frame.cy, qx - frame.cx);
                let bot_angle = Math.atan2(target.top + target.height - frame.cy,
                                           qx - frame.cx);
                top_angle -= Math.PI * 0.5;
                bot_angle += Math.PI * 0.5;
                let top_isect = [frame.cx + Math.cos(top_angle) * 100,
                                 frame.cy + Math.sin(top_angle) * 100];
                let bot_isect = [frame.cx + Math.cos(bot_angle) * 100,
                                 frame.cy + Math.sin(bot_angle) * 100];
                path = [['M', map_pane.right, target.top],
                        ['S', qx, target.top, top_isect[0], top_isect[1]],
                        ['L', bot_isect[0], bot_isect[1]],
                        ['S', qx, target.top + target.height, x,
                         target.top + target.height],
                        ['Z']];
                dev.label.attr({'x': map_pane.right - 10,
                                'y': target.cy,
                                'text-anchor': 'end'});
            }
            dev.view.attr({'path': path,
                           'stroke-width': 0,
                           'stroke-opacity': 0,
                           'fill': color,
                           'fill-opacity': 0.5}).toFront();
            dev.label.toFront();
        }
        if (fileRep.view)
            fileRep.view.toFront();
        if (fileRep.label)
            fileRep.label.toFront();
    };

    this.redraw = redraw;

    this.pan = function(x, y, delta_x, delta_y) {
        if (x < frame.left + map_pane.left) {
            tables.left.pan(delta_y);
            redraw(0, false);
        }
        else if (x > (frame.left + map_pane.right)) {
            tables.right.pan(delta_y);
            redraw(0, false);
        }
        else {
            // send to both left and right tables
            tables.left.pan(delta_y);
            tables.right.pan(delta_y);
            redraw(0, false);
        }
    }

    this.zoom = function(x, y, delta) {
        if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                redraw(0, false);
        }
        else if (x > (frame.left + map_pane.right)) {
            if (tables.right.zoom(y - frame.top - map_pane.top, delta))
                redraw(0, false);
        }
        else {
            // send to both left and right tables
            let update = tables.left.zoom(y - frame.top - map_pane.top, delta);
            update |= tables.right.zoom(y - frame.top - map_pane.top, delta);
            if (update)
                redraw(0, false);
        }
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            tables.left.filter_text(text);
        else
            tables.right.filter_text(text);
        redraw(1000, true);
    }

    this.cleanup = function() {
        // clean up any objects created only for this view
        tables.left.collapseAll = false;
        tables.right.collapseAll = false;
        if (!fileRep)
            return
        for (var i in fileRep.devices) {
            let dev = fileRep.devices[i];
            if (dev.label)
                dev.label.remove();
            if (dev.view)
                dev.view.remove();
        }
        if (fileRep.label)
            fileRep.label.remove();
        if (fileRep.view)
            fileRep.view.remove();
        for (var i in links) {
            links[i].animate({'fill-opacity': 0}, 1000, 'linear',
                             function() { this.remove(); });
        }
        links = null;
        parse_file = null;
    }
}
