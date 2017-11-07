//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

function GridView(frame, tables, canvas, model)
{
    let map_pane;
    let escaped = false;

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, 200, 0, 200, 1000);
        map_pane = {'left': 200,
                    'right': frame.width,
                    'top': 200,
                    'width': frame.width - 200,
                    'height': frame.height - 200};
    };

    this.resize();

    tables.left.filter_dir('output');
    tables.left.show_detail(false);

    tables.top.filter_dir('input');
    tables.top.show_detail(false);

    this.type = function() {
        return 'grid';
    }

    function redraw_signal(sig) {
        remove_object_svg(sig);
    }

    function redraw_device(dev, duration) {
        dev.signals.each(redraw_signal);

        let row = tables.left.row_from_name(dev.name);
        if (row) {
            row.left = 0;
            row.top += map_pane.top - 20;
            row.width = frame.width;
            row.cy += map_pane.top - 20;
        }
        let col = tables.top.row_from_name(dev.name);
        if (col) {
            col.left += map_pane.left;
            col.cx += map_pane.left;
            col.top = 0;
            col.height = frame.height;
        }
        if (!row && !col) {
            if (dev.view) {
                dev.view.stop();
                dev.view.animate({'fill-opacity': 0}, duration, '>', function() {
                    this.remove();
                    dev.view = null;
                });
            }
            return;
        }
        let path = grid_path(row, col, frame);
        if (!dev.view) {
            dev.view = canvas.path(path).attr({'fill-opacity': 0});
        }
        dev.view.stop();
        dev.view.toBack();
        dev.view.animate({'path': path,
                          'fill': dev.color,
                          'fill-opacity': 0.5,
                          'stroke-opacity': 0}, duration, '>');
        dev.view.unclick().click(function(e) {
            dev.collapsed ^= 5;
            redraw(200, true);
        });
    }

    canvas_offset_left = function(rect) {
        rect.left = map_pane.left;
        rect.cx = map_pane.left;
        rect.top += map_pane.top - 20;
        rect.cy += map_pane.top - 20;
    }

    canvas_offset_top = function(rect) {
        rect.left += map_pane.left;
        rect.cx += map_pane.left;
        rect.top = map_pane.top;
        rect.cy = map_pane.top;
    }

    function redraw_map(map, duration) {
        if (!map.view) {
            map.view = canvas.path();
            map.view.new = true;
        }
        map.view.click(function(e) {
            if (select_obj(map))
                $('#container').trigger("updateMapProperties");
        });
        let path, curve = false;
        src = tables.top.row_from_name(map.src.key);
        dst = tables.left.row_from_name(map.dst.key);
        if (src) {
            canvas_offset_top(src);
            if (dst) {
                canvas_offset_left(dst);
                path = [['M', src.left + src.width, dst.top],
                        ['L', src.left, dst.cy],
                        ['L', src.left + src.width, dst.top + dst.height],
                        ['Z']];
            }
            else {
                dst = tables.top.row_from_name(map.dst.key);
                if (!dst)
                    return
                canvas_offset_top(dst);
                // both endpoints are 'input' signals
                path = self_path(src.cx, map_pane.top, dst.cx, map_pane.top, frame);
                curve = true;
            }
        }
        else if (dst) {
            canvas_offset_left(dst);
            src = tables.left.row_from_name(map.src.key);
            if (!src)
                return
            canvas_offset_left(src);
            // both endpoints are 'output' signals
            path = self_path(map_pane.left, src.cy, map_pane.left, dst.cy, frame);
            curve = true;
        }
        else {
            // could be 'reversed' map
            src = tables.left.row_from_name(map.src.key);
            dst = tables.top.row_from_name(map.dst.key);
            if (!src || !dst)
                return;
            canvas_offset_left(src);
            canvas_offset_top(dst);
            path = [['M', dst.left, src.top + src.height],
                    ['L', dst.cx, src.top],
                    ['L', dst.left + dst.width, src.top + src.height],
                    ['Z']];
        }

        if (curve) {
            map.view.attr({'stroke-width': 2,
                           'arrow-end': 'block-wide-long'});
            if (map.view.new) {
                map.view.attr({'path': self_path(src.cx, src.cy, src.cx, src.cy,
                                                 frame),
                               'fill-opacity': 0,
                               'stroke': map.view.selected ? 'red' : 'white',
                               'stroke-opacity': 1});
                let len = Raphael.getTotalLength(path);
                let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                map.view.animate({'path': path_mid}, duration * 0.5, '>',
                                 function() {
                    map.view.animate({'path': path}, duration * 0.5, '>');
                }).toFront();
                map.view.new = false;
            }
            else {
                map.view.animate({'path': path,
                                  'fill-opacity': 0,
                                 'stroke': map.view.selected ? 'red' : 'white',
                                  'stroke-opacity': 1}, duration, '>').toFront();
            }
        }
        else {
            map.view.attr({'arrow-end': 'none',
                           'stroke-width': 2});
            if (map.view.new) {
                map.view.attr({'path': (src.cx > dst.cx)
                              ? [['M', src.left + src.width, dst.top],
                                 ['L', src.left + src.width, dst.cy],
                                 ['L', src.left + src.width, dst.top + dst.height],
                                 ['Z']]
                              : [['M', dst.left, src.top + src.height],
                                 ['L', dst.cx, src.top + src.height],
                                 ['L', dst.left + dst.width, src.top + src.height],
                                 ['Z']]});
                map.view.new = false;
            }
            map.view.animate({'path': path,
                              'fill-opacity': 0,
                              'fill': map.view.selected ? 'red' : 'white',
                              'stroke-opacity': 1}, duration, '>');
        }
    }

    function redraw(duration, update_tables) {
        if (update_tables != false) {
            tables.left.update(map_pane.height);
            tables.top.update(map_pane.width);
        }

        model.devices.each(function(dev) { redraw_device(dev, duration); });
        model.maps.each(function(map) { redraw_map(map, duration); });
    }

    this.redraw = redraw;

    this.pan = function(x, y, delta_x, delta_y) {
        if (y < frame.top + map_pane.top) {
            if (x > frame.left + map_pane.left) {
                tables.top.pan(delta_x);
                redraw(0, false);
            }
        }
        else if (x < frame.left + map_pane.left) {
            tables.left.pan(delta_y);
            redraw(0, false);
        }
        else {
            // send to both left and top tables
            tables.left.pan(delta_y);
            tables.top.pan(delta_x);
            // TODO: should pan svg canvas instead
            redraw(0, false);
        }
    }

    this.zoom = function(x, y, delta) {
        if (y < frame.top + map_pane.top) {
            if (x > frame.left + map_pane.left) {
                if (tables.top.zoom(x - frame.left - map_pane.left, delta))
                    redraw(0, false);
            }
        }
        else if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                redraw(0, false);
        }
        else {
            // send to both left and top tables
            let update = tables.left.zoom(y - frame.top - map_pane.top, delta);
            update |= tables.top.zoom(x - frame.left - map_pane.left, delta);
            if (update)
                redraw(0, false);
        }
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            tables.top.filter_text(text);
        else
            tables.left.filter_text(text);
        redraw(1000, true);
    }

    $('.tableDiv').on('mousedown', 'tr', function(e) {
        escaped = false;
        let left_attract = map_pane.left;
        let top_attract = map_pane.top;
        let draw_edge = 'same';

        var src_row = this;
        var src_table = null;
        switch ($(src_row).parents('.tableDiv').attr('id')) {
            case "leftTable":
                src_table = tables.left;
                break;
            case "topTable":
                src_table = tables.top;
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
                    dev.collapsed ^= 4;
                redraw(200, true);
            }
            return;
        }

        $('svg').one('mouseenter.drawing', function() {
            deselect_all_maps(tables);

            let new_map = canvas.path();

            var src = src_table.row_from_name(src_row.id.replace('\\/', '\/'));
            switch (src_table) {
                case tables.left:
                    src.left += src.width;
                    src.cx += src.width;
                    break;
                case tables.top:
                    src.top += src.height;
                    src.cy += src.height;
                    break;
            }
            let dst = null;
            let dst_table = null;
            var width = labelwidth(src.id);

            $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
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
                dst_table = null;
                let path;
                dst = null;

                if (left_attract != null && x < left_attract) {
                    // snap to left table
                    tables.top.highlight_row(null, true);
                    dst_table = tables.left;
                    dst = dst_table.row_from_position(e.pageX, e.pageY);
                    if (!dst || dst.id == src.id || $(dst).hasClass('device'))
                        return;
                    x = dst.width;
                    y = dst.cy;
                }
                else if (top_attract != null && y < top_attract) {
                    // snap to top table
                    tables.left.highlight_row(null, true);
                    dst_table = tables.top;
                    dst = dst_table.row_from_position(e.pageX, e.pageY);
                    if (!dst || dst.id == src.id || $(dst).hasClass('device'))
                        return;
                    x = dst.cx;
                    y = map_pane.top;
                }
                else {
                    // get dst from offset
                    dst_table = (src_table == tables.left) ? tables.left : tables.left;
                    dst = dst_table.row_from_position(e.pageX, e.pageY);
                }

                if (src_table == dst_table) {
                    // draw smooth path from table to self
                    if (src_table == tables.top)
                        path = self_path(src.cx + 200, 200,
                                         dst.cx + 200, 200,
                                         frame);
                    else
                        path = self_path(src.left, src.cy + 180,
                                         src.left, y + 180,
                                         frame);
                    new_map.attr({'path': path,
                                  'fill-opacity': 0,
                                  'stroke': 'white',
                                  'stroke-opacity': 1,
                                  'arrow-end': 'block-wide-long',
                                  'stroke-width': 2});
                }
                else {
                    // draw crosshairs and triangle pointing from src to dst
                    if (src_table == tables.left) {
                        let dstHalfWidth = dst.width * 0.5;
                        path = [['M', 200, src.top + 180],
                                ['l', dst.left, 0],
                                ['l', dstHalfWidth, 20 - src.top],
                                ['l', dstHalfWidth, src.top + src.height - 20],
                                ['l', -dst.left - dst.width, 0],
                                ['Z']];
                    }
                    else {
                        let dstHalfHeight = dst.height * 0.5;
                        path = [['M', src.left + 200, 200],
                                ['l', 0, dst.top - 20],
                                ['l', -src.left, dstHalfHeight],
                                ['l', src.left + src.width, dstHalfHeight],
                                ['l', 0, -dst.top - dst.height],
                                ['Z']];
                    }
                    new_map.attr({'path': path,
                                  'fill': 'white',
                                  'fill-opacity': 0.5,
                                  'stroke-opacity': 0,
                                  'arrow-end': 'none',
                                  'stroke-width': 2 });
                }
                src_table.highlight_row(src, true);
                dst_table.highlight_row(dst, true);
            });
            $(document).on('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                $('svg, .displayTable tbody tr').off('.drawing');
                if (dst && dst.id) {
                    $('#container').trigger('map', [src.id, dst.id]);
                    dst_table.highlight_row(null, false);
                }
                src_table.highlight_row(null, false);
                if (new_map) {
                    new_map.animate({'opacity': 0}, 1000, 'linear', function() {
                        new_map.remove();
                        new_map = null;
                    });
                }
            });
        });
        $(document).one('mouseup.drawing', function(e) {
            $(document).off('.drawing');
        });
    });

    this.cleanup = function() {
            // clean up any objects created only for this view
        model.maps.each(function(map) {
                        if (map.view)
                        map.view.unclick();
                        });
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
    }
}
