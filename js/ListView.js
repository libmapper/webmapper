//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

function ListView(frame, tables, canvas, model)
{
    let map_pane;
    let escaped = false;

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
    };

    this.resize();

    tables.left.filter_dir('output');
    tables.left.show_detail(true);

    tables.right.filter_dir('input');
    tables.right.show_detail(true);

    this.type = function() {
        return 'list';
    }

    get_sig_pos = function(sig, offset) {
        let s;
        if (sig.direction == 'output') {
            s = tables.left.row_from_name(sig.key);
            if (!s)
                return null;
            s.left = offset ? map_pane.left : 0;
        }
        else {
            s = tables.right.row_from_name(sig.key);
            if (!s)
                return null;
            s.left = map_pane.right;
        }
        s.width = map_pane.left;
        return s;
    }

    function redraw_signal(sig) {
        // remove associated svg elements
        remove_object_svg(sig);
    }

    function redraw_device(dev, duration) {
        dev.signals.each(redraw_signal);

        let src = tables.left.row_from_name(dev.name);
        if (src) {
            src.left = 0;
            src.width = map_pane.left;
        }
        let dst = tables.right.row_from_name(dev.name);
        if (dst) {
            dst.left = map_pane.right;
            dst.width = map_pane.left;
        }
        if (!src && !dst) {
            remove_object_svg(dev);
            return;
        }
        let path = list_path(src, dst, true, frame);
        if (!dev.view) {
            dev.view = canvas.path(path).attr({ 'fill-opacity': 0 });
        }
        else
            dev.view.stop();
        dev.view.toBack();
        dev.view.animate({'path': path,
                          'fill': dev.color,
                          'fill-opacity': 0.5,
                          'stroke-opacity': 0}, duration, '>');
        dev.view.unclick().click(function(e) {
            dev.collapsed ^= 3;
            redraw(200, true);
        });
    }

    function redraw_map(map, duration) {
        let src = get_sig_pos(map.src, true);
        let dst = get_sig_pos(map.dst, true);
        if (!src || !dst) {
            remove_object_svg(map, 500);
            return;
        }

        if (map.view) {
            map.view.stop();
        }
        else {
            map.view = canvas.path([['M', src.left, src.cy],
                                    ['c', 0, 0, 0, 0, 0, 0]])
            map.view.attr({'stroke-dasharray': map.muted ? '-' : '',
                           'stroke': map.view.selected ? 'red' : 'white',
                           'fill-opacity': 0,
                           'stroke-width': 2});;
            map.view.new = true;
        }

        let v_center = (src.cy + dst.cy) * 0.5;
        let h_center = map_pane.cx;
        let h_quarter = (h_center + src.left) * 0.5;

        let y3 = src.cy * 0.9 + v_center * 0.1;
        let y4 = dst.cy * 0.9 + v_center * 0.1;

        if (src.left == dst.left) {
            let mult = Math.abs(src.cy - dst.cy) * 0.25 + 35;
            h_center = (src.left < h_center
                        ? map_pane.left + mult
                        : map_pane.left + map_pane.width - mult);
        }

        let path = [['M', src.left, src.cy],
                    ['C', h_center, y3, h_center, y4, dst.left, dst.cy]];

        console.log("drawing ", map.view.new, map.status);

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
    }

    function redraw(duration, update_tables) {
        if (update_tables != false) {
            tables.left.update(frame.height);
            tables.right.update(frame.height);
        }
        model.devices.each(function(dev) { redraw_device(dev, duration); });
        model.maps.each(function(map) { redraw_map(map, duration); });
    }

    this.redraw = redraw;

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
        redraw(0, false);
    }

    this.zoom = function(x, y, delta) {
        if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                redraw(0, false);
        }
        else if (x > frame.left + map_pane.right) {
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
                redraw(200, true);
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
                }
                // clear table highlights
                tables.left.highlight_row(null, true);
                tables.right.highlight_row(null, true);

                model.maps.add({'src': model.find_signal(src.id),
                                'dst': model.find_signal(dst.id),
                                'key': src.id + '->' + dst.id,
                                'status': 'staged'});
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
    }
}
