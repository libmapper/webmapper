//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

// public functions
// resize() // called when window size changes
// update() // called on changes to the model/database
// draw() // called on pan/scroll events
// cleanup() // called when view is destroyed
// type() // returns view type

function ListView(frame, tables, canvas, model)
{
    let map_pane;
    let escaped = false;

    // table settings
    tables.left.filter_dir('output');
    tables.left.show_detail(true);
    tables.right.filter_dir('input');
    tables.right.show_detail(true);

    // change device click
    model.devices.each(function(dev) {
        if (!dev.view)
            return;
        dev.view.unclick().click(function(e) {
            dev.collapsed ^= 3;
            update_devices();
            draw(200);
        });
    });

    // remove signal svg
    model.devices.each(function(dev) {
        dev.signals.each(function(sig) {
            remove_object_svg(sig);
        });
    });

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
        draw(0);
    };
    this.resize();

    this.type = function() {
        return 'list';
    }

    get_sig_pos = function(sig) {
        let s;
        if (sig.direction == 'output') {
            s = tables.left.row_from_name(sig.key);
            return s ? {'table': 'left', 'index': s.index} : null;
        }
        else {
            s = tables.right.row_from_name(sig.key);
            return s ? {'table': 'right', 'index': s.index} : null;
        }
    }

    function update_devices() {
        // update left and right tables
        tables.left.update(frame.height);
        tables.right.update(frame.height);

        model.devices.each(function(dev) {
            let src = tables.left.row_from_name(dev.key);
            let dst = tables.right.row_from_name(dev.key);
            if (!src && !dst) {
                remove_object_svg(dev);
                return;
            }
            if (!dev.view) {
                dev.view = canvas.path().attr({'fill': dev.color,
                                               'fill-opacity': 0});
                dev.view.click(function(e) {
                    dev.collapsed ^= 3;
                    update_devices();
                    draw(200);
                });
            }
            // cache table indexes
            dev.view.src_index = src ? src.index : null;
            dev.view.dst_index = dst ? dst.index : null;

            dev.signals.each(function(sig) {
                sig.view = get_sig_pos(sig);
            });
        });
    }

    function draw_devices(duration) {
        let lh = Math.round(tables.left.row_height);
        let rh = Math.round(tables.right.row_height);
        let lo = 20 - tables.left.scrolled;
        let ro = 20 - tables.right.scrolled;
        let w = map_pane.left;
        let cx = map_pane.cx;

        model.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let path = null;
            if (dev.view.src_index != null) {
                let ltop = lh * dev.view.src_index + lo;
                if (dev.view.dst_index != null) {
                    let rtop = rh * dev.view.dst_index + ro;
                    path = [['M', 0, ltop],
                            ['l', w, 0],
                            ['C', cx, ltop, cx, rtop, map_pane.right, rtop],
                            ['l', w, 0],
                            ['l', 0, rh],
                            ['l', -w, 0],
                            ['C', cx, rtop + rh, cx, ltop + lh, w, ltop + lh],
                            ['l', -w, 0],
                            ['Z']];
                }
                else {
                    path = [['M', 0, ltop],
                            ['l', w, 0],
                            ['l', 0, lh],
                            ['l', -w, 0],
                            ['Z']];
                }
            }
            else if (dev.view.dst_index != null) {
                let rtop = rh * dev.view.dst_index + ro;
                path = [['M', map_pane.right, rtop],
                        ['l', w, 0],
                        ['l', 0, rh],
                        ['l', -w, 0],
                        ['Z']];
            }
            if (path) {
                dev.view.toBack();
                dev.view.animate({'path': path,
                                  'fill': dev.color,
                                  'fill-opacity': 0.5,
                                  'stroke-opacity': 0}, duration, '>');
            }
        });
    }

    function update_maps() {
        model.maps.each(function(map) {
            if (!map.view) {
                map.view = canvas.path();
                map.view.attr({'stroke-dasharray': map.muted ? '-' : '',
                               'stroke': map.view.selected ? 'red' : 'white',
                               'fill-opacity': 0,
                               'stroke-width': 2});
                map.view.new = true;
            }
        });
    }

    function draw_maps(duration) {
        let lh = Math.round(tables.left.row_height);
        let rh = Math.round(tables.right.row_height);
        let lo = 20 - tables.left.scrolled;
        let ro = 20 - tables.right.scrolled;

        model.maps.each(function(map) {
            if (!map.view)
                return;
            if (map.hidden) {
                map.view.attr({'stroke-opacity': 0}, duration, '>');
                return;
            }
            map.view.stop();
            let src = map.src.view;
            let dst = map.dst.view;
            if (!src || !dst) {
                console.log('missing endpoint for map', map);
                return;
            }
            let x1, y1, x2, y2;
            if (src.table == 'left') {
                // left table
                x1 = map_pane.left;
                y1 = (src.index + 0.5) * lh + lo;
            }
            else {
                // right table
                x1 = map_pane.right;
                y1 = (src.index + 0.5) * rh + ro;
            }
            if (dst.table == 'left') {
                // left table
                x2 = map_pane.left;
                y2 = (dst.index + 0.5) * lh + lo;
            }
            else {
                // right table
                x2 = map_pane.right;
                y2 = (dst.index + 0.5) * rh + ro;
            }

            let cy = (y1 + y2) * 0.5;
            let cx = map_pane.cx;
            let h_quarter = (cx + x1) * 0.5;
            let y3 = y1 * 0.9 + cy * 0.1;
            let y4 = y2 * 0.9 + cy * 0.1;

            if (x1 == x2) {
                let mult = Math.abs(y1 - y2) * 0.25 + 35;
                cx = x1 < cx ? map_pane.left + mult : map_pane.right - mult;
            }

            let path = [['M', x1, y1], ['C', cx, y3, cx, y4, x2, y2]];

            if (map.view.new) {
                map.view.new = false;
                if (map.status == "staged") {
                    // draw map directly
                    map.view.attr({'path': path,
                                   'stroke-opacity': 0.5,
                                   'stroke': map.view.selected ? 'red' : 'white',
                                   'arrow-end': 'block-wide-long',
                                   'stroke-dasharray': map.muted ? '-' : ''});
                    return;
                }
                // draw animation following arrow path
                let len = Raphael.getTotalLength(path);
                let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                map.view.animate({'path': path_mid,
                                  'stroke-opacity': 1.0},
                                 duration * 0.5, '>', function() {
                    this.animate({'path': path}, duration * 0.5, '>', function() {
                        this.attr({'arrow-end': 'block-wide-long'});
                    });
                });
            }
            else {
                map.view.animate({'path': path,
                                  'stroke-opacity': 1.0,
                                  'fill-opacity': 0,
                                  'stroke-width': 2,
                                  'stroke': map.view.selected ? 'red' : 'white'},
                                 duration, '>', function() {
                    this.attr({'arrow-end': 'block-wide-long',
                               'stroke-dasharray': map.muted ? '-' : ''});
                });
            }
        });
    }

    function draw(duration) {
        draw_devices(duration);
        draw_maps(duration);
    }

    function update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'signals', 'maps'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0)
            update_devices();
        if (elements.indexOf('maps') >= 0)
            update_maps();
        draw(1000);
    }
    this.update = update;

    this.pan = function(x, y, delta_x, delta_y) {
        if (x < frame.left + map_pane.left) {
            tables.left.pan(delta_y);
        }
        else if (x > frame.left + map_pane.right) {
            tables.right.pan(delta_y);
        }
        else {
            // send to both left and right tables
            tables.left.pan(delta_y);
            tables.right.pan(delta_y);
        }
        draw(0);
    }

    this.zoom = function(x, y, delta) {
        if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                draw(0);
        }
        else if (x > frame.left + map_pane.right) {
            if (tables.right.zoom(y - frame.top - map_pane.top, delta))
                draw(0);
        }
        else {
            // send to both left and right tables
            let update = tables.left.zoom(y - frame.top - map_pane.top, delta);
            update |= tables.right.zoom(y - frame.top - map_pane.top, delta);
            if (update)
                draw(0);
        }
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            tables.left.filter_text(text);
        else
            tables.right.filter_text(text);
        update();
        draw(1000);
    }

    // dragging maps from table
    $('.tableDiv').on('mousedown', 'tr', function(e) {
        escaped = false;
        let left_attract = map_pane.left + map_pane.width * 0.3;
        let right_attract = map_pane.left + map_pane.width * 0.7;
        let draw_edge = 'any';

        var src_row = this;
        var src_table = null;
        switch ($(src_row).parents('.tableDiv').attr('id')) {
            case "leftTable":
                src_table = tables.left;
                break;
            case "rightTable":
                src_table = tables.right;
                break;
            default:
                console.log('unknown source row');
                return;
        }
        if ($(src_row).hasClass('device')) {
            let dev = model.devices.find(src_row.id);
            if (dev) {
                if (src_table == tables.left)
                    dev.collapsed ^= 1;
                else
                    dev.collapsed ^= 2;
                update_devices();
                draw(200);
            }
            return;
        }

        $('svg').one('mouseenter.drawing', function() {
            deselect_all_maps(tables);

            var src = src_table.row_from_name(src_row.id.replace('\\/', '\/'));
            switch (src_table) {
                case tables.left:
                    src.left += src.width;
                    src.cx += src.width;
                    break;
                case tables.right:
                    src.left = frame.width - src.width;
                    src.cx = frame.width - src.cx;
                    break;
            }
            var dst = null;
            var width = labelwidth(src.id);

            let new_map = canvas.path([['M', src.left, src.cy],
                                       ['l', 0, 0]])
                                .attr({'fill-opacity': 0,
                                       'stroke': 'white',
                                       'stroke-opacity': 1,
                                       'stroke-width': 2});

            $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                // clear table highlights
                tables.left.highlight_row(null, true);
                tables.right.highlight_row(null, true);

                if (escaped) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    if (new_map) {
                        new_map.remove();
                        new_map = null;
                    }
                    return;
                }

                let x = e.pageX - frame.left;
                let y = e.pageY - frame.top;
                let path = null;
                dst = null;
                let dst_table = null;

                if (x < left_attract) {
                    // snap to left table
                    dst_table = tables.left;
                    dst = dst_table.row_from_position(e.pageX, e.pageY);
                    if (!dst || dst.id == src.id || dst.type == 'device') {
                        dst = null;
                        dst_table = null;
                    }
                    else {
                        dst_table.highlight_row(dst, true);
                        x = dst.width;
                        y = dst.cy;
                    }
                }
                else if (x > right_attract) {
                    // snap to right table
                    dst_table = tables.right;
                    dst = dst_table.row_from_position(e.pageX, e.pageY);
                    if (!dst || dst.id == src.id || dst.type == 'device') {
                        dst = null;
                        dst_table = null;
                    }
                    else {
                        dst_table.highlight_row(dst, true);
                        x = frame.width - dst.width;
                        y = dst.cy;
                    }
                }

                if (src_table == dst_table) {
                    // draw smooth path from table to self
                    path = self_path(src.left, src.cy, src.left, y, frame);
                }
                else if (dst) {
                    // draw bezier curve connecting src and dst
                    path = [['M', src.left, src.cy],
                            ['C', frame.cx, src.cy, frame.cx, dst.cy, x, dst.cy]];
                }
                else {
                    // draw bezier connecting src to cursor
                    path = [['M', src.left, src.cy],
                            ['C', frame.cx, src.cy, frame.cx, y, x, y]];
                }
                src_table.highlight_row(src, false);
                if (dst_table)
                    dst_table.highlight_row(dst, false);

                new_map.attr({'path': path});
            });
            $(document).on('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                $('svg, .displayTable tbody tr').off('.drawing');
                if (dst && dst.id) {
                    $('#container').trigger('map', [src.id, dst.id]);

                    model.maps.add({
                        'src': model.find_signal(src.id),
                        'dst': model.find_signal(dst.id),
                        'key': src.id + '->' + dst.id,
                        'status': 'staged'
                    });
                }
                // clear table highlights
                tables.left.highlight_row(null, true);
                tables.right.highlight_row(null, true);

                new_map.remove();
                new_map = null;
            });
        });
        $(document).one('mouseup.drawing', function(e) {
            $(document).off('.drawing');
        });
    });

    this.cleanup = function() {
        // clean up any objects created only for this view
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');

        model.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });
    }
}
