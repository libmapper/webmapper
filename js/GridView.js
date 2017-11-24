//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

function GridView(frame, tables, canvas, model)
{
    let map_pane;
    let escaped = false;

    // table settings
    tables.left.filter_dir('output');
    tables.left.show_detail(false);
    tables.top.filter_dir('input');
    tables.top.show_detail(false);

    // change device click
    model.devices.each(function(dev) {
        dev.view.unclick().click(function(e) {
            dev.collapsed ^= 5;
            update_devices();
            draw(200);
        });
    });

    // remove signal svg
    model.devices.each(function(dev) {
        dev.signals.each(remove_object_svg);
    });

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, 200, 0, 200, 1000);
        map_pane = {'left': 200,
            'right': frame.width,
            'top': 200,
            'width': frame.width - 200,
            'height': frame.height - 200,
            'cx': (frame.width - 200) * 0.5,
            'cy': (frame.height - 200) * 0.5};
    };
    this.resize();

    this.type = function() {
        return 'grid';
    }

    get_sig_pos = function(sig) {
        let s;
        if (sig.direction == 'output') {
            s = tables.left.row_from_name(sig.key);
            return s ? {'table': 'left', 'index': s.index} : null;
        }
        else {
            s = tables.top.row_from_name(sig.key);
            return s ? {'table': 'top', 'index': s.index} : null;
        }
        return s;
    }

    function update_devices() {
        // update left and top tables
        tables.left.update(map_pane.height);
        tables.top.update(map_pane.width);

        model.devices.each(function(dev) {
            let src = tables.left.row_from_name(dev.key);
            let dst = tables.top.row_from_name(dev.key);
            if (!src && !dst) {
                remove_object_svg(dev);
                return;
            }
            if (!dev.view) {
                dev.view = canvas.path().attr({'fill': dev.color,
                                               'fill-opacity': 0});
                dev.view.click(function(e) {
                    dev.collapsed ^= 5;
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
        let tw = Math.round(tables.top.row_height);

        let lo = map_pane.top - tables.left.scrolled;
        let to = map_pane.left - tables.top.scrolled;

        model.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            dev.view.toBack();
            let row = dev.view.src_index;
            let col = dev.view.dst_index;
            if (row == null && col == null) {
                remove_object_svg(dev);
                return;
            }
            let path;
            if (row != null && col != null) {
                let row_top = row * lh + lo;
                let col_left = col * tw + to;
                path = [['M', col_left, 0],
                        ['l', tw, 0],
                        ['L', col_left + tw, row_top],
                        ['L', map_pane.right, row_top],
                        ['l', 0, lh],
                        ['L', col_left + tw, row_top + lh],
                        ['L', col_left + tw, frame.height],
                        ['l', -tw, 0],
                        ['L', col_left, row_top + lh],
                        ['L', 0, row_top + lh],
                        ['l', 0, -lh],
                        ['L', col_left, row_top],
                        ['z']];
            }
            else if (row != null) {
                let row_top = row * lh + lo;
                path = [['M', 0, row_top],
                        ['l', frame.width, 0],
                        ['l', 0, lh],
                        ['l', -frame.width, 0],
                        ['Z']];
            }
            else if (col != null) {
                let col_left = col * tw + to;
                path = [['M', col_left, 0],
                        ['l', tw, 0],
                        ['l', 0, frame.height],
                        ['l', -tw, 0],
                        ['Z']];
            }
            dev.view.animate({'path': path,
                              'fill': dev.color,
                              'fill-opacity': 0.5,
                              'stroke-opacity': 0}, duration, '>');
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
                map.view.click(function(e) {
                    if (select_obj(map))
                        $('#container').trigger("updateMapProperties");
                });
                map.view.new = true;
            }
        });
    }

    function draw_maps(duration) {
        let lh = Math.round(tables.left.row_height);
        let tw = Math.round(tables.top.row_height);
        let ls = tables.left.scrolled;
        let ts = tables.top.scrolled;

        let lo = map_pane.top - tables.left.scrolled;
        let loc = lo + 0.5 * lh;
        let to = map_pane.left - tables.top.scrolled;
        let toc = to + 0.5 * tw

        model.maps.each(function(map) {
            if (!map.view) {
                return;
            }
            src = map.src.view;
            dst = map.dst.view;

            let path, curve = false;
            if (src.table == dst.table) {
                // draw a curve from table to self
                if (src.table == 'left') {
                    let y1 = src.index * lh + loc;
                    let y2 = dst.index * lh + loc;
                    let d = Math.abs(y1 - y2);
                    if (d > map_pane.cx)
                        d = map_pane.cx;
                    return [['M', map_pane.left, y1],
                            ['C', d, y1, d, y2, map_pane.left, y2]];
                }
                else {
                    let x1 = src.index * tw + toc;
                    let x2 = dst.index * tw + toc;
                    let d = Math.abs(x1 - x2);
                    if (d > map_pane.cy)
                        d = map_pane.cy;
                    return [['M', x1, map_pane.top],
                            ['C', x1, -d, x2, -d, x2, map_pane.top]];
                }
                curve = true;
            }
            else if (src.table == 'left') {
                let x = dst.index * tw + to;
                let y = src.index * lh + lo;
                path = [['M', x, y + lh],
                        ['l', tw * 0.5, -lh],
                        ['l', tw * 0.5, lh],
                        ['Z']];
            }
            else {
                let x = src.index * tw + to;
                let y = dst.index * lh + lo;
                path = [['M', x + tw, y],
                        ['l', -tw, lh * 0.5],
                        ['l', tw, lh * 0.5],
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
        });
    }

    function update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'maps'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('devices') >= 0) {
            update_devices();
        }
        if (elements.indexOf('maps') >= 0)
            update_maps();
        draw(1000);
    }
    this.update = update;

    function draw(duration) {
        draw_devices(duration);
        draw_maps(duration);
    }

    this.pan = function(x, y, delta_x, delta_y) {
        if (y < frame.top + map_pane.top) {
            if (x > frame.left + map_pane.left) {
                tables.top.pan(delta_x);
                draw(0);
            }
        }
        else if (x < frame.left + map_pane.left) {
            tables.left.pan(delta_y);
            draw(0);
        }
        else {
            // send to both left and top tables
            tables.left.pan(delta_y);
            tables.top.pan(delta_x);
            // TODO: should pan svg canvas instead
            draw(0);
        }
    }

    this.zoom = function(x, y, delta) {
        if (y < frame.top + map_pane.top) {
            if (x > frame.left + map_pane.left) {
                if (tables.top.zoom(x - frame.left - map_pane.left, delta))
                    draw(0);
            }
        }
        else if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                draw(0);
        }
        else {
            // send to both left and top tables
            let update = tables.left.zoom(y - frame.top - map_pane.top, delta);
            update |= tables.top.zoom(x - frame.left - map_pane.left, delta);
            if (update)
                draw(0);
        }
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            tables.top.filter_text(text);
        else
            tables.left.filter_text(text);
        draw(1000);
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
                update_devices();
                draw(200);
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
        model.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });
        model.maps.each(function(map) {
            if (map.view)
                map.view.unclick();
        });
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
    }
}
