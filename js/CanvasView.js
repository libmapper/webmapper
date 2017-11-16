//++++++++++++++++++++++++++++++++++++++//
//         Canvas View Class            //
//++++++++++++++++++++++++++++++++++++++//

function CanvasView(frame, tables, canvas, model)
{
    let map_pane;
    let dragging = null;
    let draggingFrom = null;
    let snappingTo = null;
    let escaped = false;
    let first_draw = true;

    let new_map = null;

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, frame.width * 0.25, 0, 0, 1000);
        map_pane = {'left': frame.width * 0.25,
                    'top': 0,
                    'width': frame.width * 0.75,
                    'height': frame.height};
    };
    this.resize();

    tables.left.filter_dir('both');
    tables.left.show_detail(true);

    this.type = function() {
        return 'canvas';
    }

    // remove device and unused signal svg
    model.devices.each(function(dev) {
        remove_object_svg(dev);
        dev.signals.each(function(sig) {
            if (!sig.canvas_object)
                remove_object_svg(sig);
            else {
                set_sig_hover(sig);
                set_sig_drag(sig);
            }
        });
    });

    function set_sig_hover(sig) {
        sig.view.hover(
            function() {
                if (draggingFrom == null)
                   return;
                if (sig == draggingFrom) {
                   // don't snap to self
                   return;
                }
                // snap to sig object
                let src = draggingFrom.canvas_object;
                let dst = sig.canvas_object;
                let src_offset = src.width * 0.5 + 10;
                let dst_offset = dst.width * 0.5 + 10;
                let path = null;
                if (dragging == 'left') {
                   path = [['M', src.left - src_offset, src.top],
                           ['C', src.left - src_offset * 3, src.top,
                            dst.left + dst_offset * 3, dst.top,
                            dst.left + dst_offset, dst.top]];
                }
                else {
                   path = [['M', src.left + src_offset, src.top],
                           ['C', src.left + src_offset * 3, src.top,
                            dst.left - dst_offset * 3, dst.top,
                            dst.left - dst_offset, dst.top]];
                }
                snappingTo = sig;
                new_map.attr({'path': path});
                return;
            },
            function() {
                snappingTo = null;
            }
        );
    }

    function set_sig_drag(sig) {
        sig.view.mouseup(function() {
            if (draggingFrom && snappingTo) {
                $('#container').trigger('map', [draggingFrom.key, snappingTo.key]);
                if (new_map) {
                    new_map.remove();
                    new_map = null;
                }
            }
            else if (trashing) {
                sig.view.label.remove();
                sig.view.remove();
                sig.view = null;
                sig.canvas_object = null;
                trashing = false;
                redraw(0, false);
            }
        });
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (escaped) {
                    draggingFrom = null;
                    delete sig.canvas_object.drag_offset;
                    dragging = null;
                    trashing = false;
                    if (new_map) {
                        new_map.remove();
                        new_map = null;
                    }
                    return;
                }
                let obj = sig.canvas_object;
                if (dragging == 'obj') {
                    obj.left = x + obj.drag_offset.x;
                    obj.top = y + obj.drag_offset.y;
                    constrain(obj, map_pane, 5);

                    sig.view.stop()
                    sig.view.attr({'path': canvas_rect_path(obj)});
                    sig.view.label.attr({'x': obj.left,
                                         'y': obj.top,
                                         'opacity': 1}).toFront();

                    x -= map_pane.width + map_pane.left;
                    y -= map_pane.height + frame.top;
                    let dist = Math.sqrt(x * x + y * y)
                    if (dist < 100) {
                        sig.view.attr({'stroke': 'gray'});
                        trashing = true;
                    }
                    else {
                        sig.view.attr({'stroke': sig.device.color});
                        trashing = false;
                    }
                    redraw(0, false);
                    return;
                }
                else if (!snappingTo) {
                    let offset = obj.width * 0.5 + 10;
                    let arrow_start = 'none';
                    let arrow_end = 'none';
                    if (dragging == 'left') {
                        offset *= -1;
                        arrow_start = 'block-wide-long';
                    }
                    else
                        arrow_end = 'block-wide-long';
                    x -= frame.left;
                    y -= frame.top;
                    let path = [['M', obj.left + offset, obj.top],
                                ['C', obj.left + offset * 3, obj.top,
                                 x - offset * 3, y, x, y]];
                    new_map.attr({'path': path,
                                  'stroke': 'white',
                                  'stroke-opacity': 1,
                                  'arrow-start': arrow_start,
                                  'arrow-end': arrow_end});
                }
            },
            function(x, y, event) {
                escaped = false;
                draggingFrom = sig;
                let obj = sig.canvas_object;
                obj.drag_offset = position(obj.left - x, obj.top - y);
                if (x < obj.left - obj.width * 0.5 + 5)
                    dragging = 'left';
                else if (x > obj.left + obj.width * 0.5 - 5)
                    dragging = 'right';
                else
                    dragging = 'obj';
                new_map = canvas.path();
            },
            function(x, y, event) {
                draggingFrom = null;
                if (sig.canvas_object)
                    delete sig.canvas_object.drag_offset;
                dragging = null;
                if (new_map) {
                    new_map.remove();
                    new_map = null;
                }
            }
        );
    }

    function draw_signal(sig, duration) {
        if (!sig.canvas_object) {
            // remove associated svg element
            remove_object_svg(sig);
            return;
        }
        let path = canvas_rect_path(sig.canvas_object);

        let attrs = {'path': path,
                     'stroke': sig.device.color,
                     'stroke-opacity': 0.75,
                     'stroke-width': 20,
                     'fill': 'white',
                     'fill-opacity': 1};
        if (!sig.view) {
            sig.view = canvas.path(path);
            set_sig_hover(sig);
            set_sig_drag(sig);
        }
        else {
            sig.view.stop();
            if (first_draw) {
                set_sig_hover(sig);
                set_sig_drag(sig);
            }
        }
        sig.view.attr({'stroke-linecap': 'round'});
        sig.view.animate(attrs, duration, '>');
        if (!sig.view.label) {
            let key = (sig.direction == 'input') ? '→ ' + sig.key : sig.key + ' →';
            sig.view.label = canvas.text(sig.position.x, sig.position.y, key);
            sig.view.label.node.setAttribute('pointer-events', 'none');
        }
        else
            sig.view.label.stop();
        sig.view.label.attr({'font-size': 16});
        sig.view.label.animate({'x': sig.canvas_object.left,
                                'y': sig.canvas_object.top,
                                'opacity': 1,
                                'fill': 'white'},
                               duration, '>').toFront();
    }

    function update_devices() {
        // update left table
        tables.left.update(frame.height);
        model.devices.each(function(dev) {
            let row = tables.left.row_from_name(dev.key);
            if (!row) {
                remove_object_svg(dev);
                return;
            }
            if (!dev.view) {
                dev.view = canvas.path().attr({'fill': dev.color,
                                               'fill-opacity': 0.5,
                                               'stroke-opacity': 0});
                dev.view.index = row.index;
            }
            dev.signals.each(function(sig) {
                let row = tables.left.row_from_name(sig.key);
                sig.view = row ? row.index : null;
            });
        });
    }

    function draw_devices(duration) {
        let h = tables.left.row_height;
        let o = 20 - tables.left.scrolled;
        let w = map_pane.left;

        model.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop()
            let path = [['M', 0, h * dev.index + o],
                        ['l', w, 0],
                        ['l', 0, h],
                        ['l', -w, 0],
                        ['Z']];
            dev.view.toBack();
            dev.view.animate({'path': path,
                              'fill': dev.color,
                              'fill-opacity': 0.5,
                              'stroke-opacity': 0}, duration, '>');
            dev.signals.each(function(sig) { draw_signal(sig, duration); });
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
        model.maps.each(function(map) {
            if (!map.view)
                return;
            map.view.stop();
            let path = canvas_bezier(map, tables.left, map_pane.left);
            let color;
            let len = Raphael.getTotalLength(path) * 0.5;
            if (map.src.canvas_object && map.dst.canvas_object)
                color = 'white';
            else
                color = 'lightgray';
            if (map.view.new) {
                map.view.attr({'path': [['M', path[0][1], path[0][2]],
                                        ['l', 0, 0]],
                               'stroke-opacity': 1,
                               'fill-opacity': 0});
                let path_mid = Raphael.getSubpath(path, 0, len);
                map.view.animate({'path': path_mid}, duration * 0.5, '>',
                                 function() {
                    map.view.animate({'path': path}, duration * 0.5, '>');
                });
                map.view.new = false;
            }
            else {
                map.view.animate({'path': path,
                                  'stroke-opacity': 1,
                                  'fill-opacity': 0}, duration, '>');
            }
            map.view.attr({'stroke-width': 2,
                           'arrow-end': 'block-wide-long',
                           'stroke': color});
        });
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

    function draw(duration) {
        draw_devices(duration);
        draw_maps(duration);
    }

    this.pan = function(x, y, delta_x, delta_y) {
        if (x < frame.left + map_pane.left) {
            tables.left.pan(delta_y);
            redraw(0, false);
        }
        else {
            svgposx += delta_x * svgzoom;
            svgposy += delta_y * svgzoom;

            canvas.setViewBox(svgposx, svgposy,
                              map_pane.width * svgzoom,
                              map_pane.height * svgzoom, false);
            $('#status').text('pan: ['+svgposx.toFixed(2)+', '+svgposy.toFixed(2)+']');
        }
    }

    this.zoom = function(x, y, delta) {
        if (x < frame.left + map_pane.left) {
            if (tables.left.zoom(y - frame.top - map_pane.top, delta))
                redraw(0, false);
        }
        else {
            let newzoom = svgzoom + delta * 0.01;
            if (newzoom < 0.1)
                newzoom = 0.1;
            else if (newzoom > 20)
                newzoom = 20;
            if (newzoom == svgzoom)
                return;
            let zoomdiff = svgzoom - newzoom;
            svgposx += x * zoomdiff;
            svgposy += (y - frame.top - map_pane.top) * zoomdiff;
            canvas.setViewBox(svgposx, svgposy,
                              map_pane.width * newzoom,
                              map_pane.height * newzoom, false);

            $('#status').text('zoom: '+(100/newzoom).toFixed(2)+'%');

            svgzoom = newzoom;
        }
    }

    this.filter_signals = function(signal_direction, text) {
        tables.left.filter_text(text);
        redraw(1000);
    }

    $('.tableDiv').on('mousedown', 'tr', function(e) {
        escaped = false;
        var src_row = this;
        if ($(src_row).hasClass('device')) {
            let dev = model.devices.find(src_row.id);
            if (dev) {
                dev.collapsed ^= 1;
                redraw(200, true);
            }
            return;
        }

        $('svg').one('mouseenter.drawing', function() {
            deselect_all_maps();

            var src = tables.left.row_from_name(src_row.id.replace('\\/', '\/'));
            src.left += src.width;
            src.cx += src.width;
            var dst = null;
            var width = labelwidth(src.id);

            // add object to canvas
            let sig = model.find_signal(src.id);
            if (!sig)
                return;

            let x = e.pageX - frame.left;
            let y = e.pageY - frame.top;

            if (!sig.view) {
                sig.view = canvas.path().attr({'stroke-width': 20,
                                               'stroke-opacity': 0.75,
                                               'stroke': sig.device.color,
                                               'stroke-linecap': 'round'});
                sig.view.label = canvas.text(x, y, sig.key)
                                       .attr({'fill': 'white',
                                              'opacity': 1,
                                              'font-size': 16})
                                       .toFront();
                sig.view.label.node.setAttribute('pointer-events', 'none');
            }

            // draw canvas object
            let temp = { 'left': x, 'top': y, 'width': width, 'height': 20 };
            constrain(temp, map_pane, 5);
            sig.view.attr({'path': canvas_rect_path(temp)});

            $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                if (escaped) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    return;
                }
                let x = e.pageX - frame.left;
                let y = e.pageY - frame.top;

                // draw canvas object
                let temp = { 'left': x, 'top': y, 'width': width, 'height': 20 };
                constrain(temp, map_pane, 5);
                sig.view.attr({'path': canvas_rect_path(temp)});
                sig.view.label.attr({'x': temp.x, 'y': temp.y}).toFront();
            });
            $(document).on('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                $('svg, .displayTable tbody tr').off('.drawing');

                let obj = { 'left': e.pageX - frame.left,
                            'top': e.pageY - frame.top,
                            'width': labelwidth(sig.key),
                            'height': 20 };
                constrain(obj, map_pane, 5);
                sig.canvas_object = obj;

                set_sig_drag(sig);
                set_sig_hover(sig);
                redraw(1000, false);
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
                if (sig.view)
                    sig.view.undrag();
            });
        });
        if (trash)
            trash.remove();
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
    }
}
