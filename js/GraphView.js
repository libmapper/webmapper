//++++++++++++++++++++++++++++++++++++++//
//          Graph View Class            //
//++++++++++++++++++++++++++++++++++++++//

function GraphView(frame, canvas, model)
{
    let draggingFrom = null;
    let snappingTo = null;
    let escaped = false;
    let first_draw = true;

    let srcregexp = null;
    let dstregexp = null;

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, 0, 0, 0, 1000);
    };
    this.resize()

    this.type = function() {
        return 'graph';
    }

    // remove associated svg elements for devices
    // set hover and drag for existing signal objects
    model.devices.each(function(dev) {
        remove_object_svg(dev);
        dev.signals.each(function(sig) {
            if (sig.view) {
                set_sig_drag(sig);
                set_sig_hover(sig);
            }
        });
    });

    function set_sig_hover(sig) {
        sig.view.hover(
            function() {
                let pos = labeloffset(sig.position, sig.key);
                if (!sig.view.label) {
                    sig.view.label = canvas.text(pos.x, pos.y, sig.key);
                    sig.view.label.node.setAttribute('pointer-events', 'none');
                }
                else
                    sig.view.label.stop();
                sig.view.label.attr({'x': pos.x,
                                     'y': pos.y,
                                     'opacity': 1,
                                     'font-size': 16,}).toFront();
                if (draggingFrom == null)
                    return;
                else if (sig == draggingFrom) {
                    // don't snap to self
                    return;
                }
                snappingTo = sig;
                let src = draggingFrom.position;
                let dst = sig.position;
                let path = [['M', src.x, src.y],
                            ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
                             dst.x, dst.y]];
                let len = Raphael.getTotalLength(path);
                path = Raphael.getSubpath(path, 10, len - 10);
                staged_map.attr({'path': path});
            },
            function() {
                snappingTo = null;
                if (sig.view.label) {
                    sig.view.label.stop();
                    sig.view.label.animate({'opacity': 0}, 1000, '>',
                                           function() {
                        this.remove();
                        sig.view.label = null;
                    });
                }
            }
        );
    }

    function set_sig_drag(sig) {
        sig.view.mouseup(function() {
            if (draggingFrom && snappingTo)
                $('#container').trigger('map', [draggingFrom.key, snappingTo.key]);
        });
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (snappingTo)
                    return;
                x -= frame.left;
                y -= frame.top;
                let src = draggingFrom.position;
                let path = [['M', src.x, src.y],
                            ['S', (src.x + x) * 0.6, (src.y + y) * 0.4,
                             x, y]];
                if (!new_map) {
                    new_map = canvas.path(path).attr({'stroke': 'black',
                                                      'stroke-opacity': 1,
                                                      'arrow-start': 'none',
                                                      'arrow-end': 'block-wide-long'});
                }
            },
            function(x, y, event) {
                escaped = false;
                draggingFrom = sig;
            },
            function(x, y, event) {
                draggingFrom = null;
                cursor.attr({'stroke-opacity': 0,
                             'arrow-start': 'none',
                             'arrow-end': 'none'});
            }
        );
    }

    function draw_signal(sig, duration) {
        if (!sig.view)
            return;
        sig.view.stop();
        let remove = false;
        if (sig.direction == 'output') {
            if (srcregexp && !srcregexp.test(sig.key))
                remove = true;
        }
        else if (dstregexp && !dstregexp.test(sig.key)) {
            remove = true;
        }
        if (remove) {
            remove_object_svg(sig);
            return;
        }

        let pos = sig.view.position;
        let is_output = sig.direction == 'output';

        let path = circle_path(pos.x, pos.y, is_output ? 7 : 10);
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : sig.device.color,
                          'fill-opacity': 1,
                          'stroke': sig.device.color,
                          'stroke-width': 6,
                          'stroke-opacity': sig.direction == 'output' ? 1 : 0},
                         duration, '>');
    }

    function update_devices() {
        model.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (!sig.view) {
                    let is_output = sig.direction == 'output';
                    let pos = position(null, null, frame);
                    sig.view = canvas.path(circle_path(pos.x, pos.y, 0));
                    sig.view.position = pos;
                    set_sig_drag(sig);
                    set_sig_hover(sig);
                }
            });
        });
    }

    function draw_devices(duration) {
        model.devices.each(function(dev) {
            // draw signals
            dev.signals.each(function(sig) { draw_signal(sig, duration); });
        });
    }

    function update_maps() {
        model.maps.each(function(map) {
            if (!map.view && map.src.view) {
                let pos = map.src.view.position;
                map.view = canvas.path([['M', pos.x, pos.y], ['l', 0, 0]]);
                map.view.attr({'stroke-dasharray': map.muted ? '-' : '',
                               'stroke': map.view.selected ? 'red' : 'white',
                               'fill-opacity': 0,
                               'stroke-width': 2});
            }
        });
    }

    function draw_maps(duration) {
        model.maps.each(function(map) {
            if (!map.view)
                return;
            if (!map.src.view || !map.dst.view) {
                remove_object_svg(map);
                return;
            }
            map.view.stop();
            let src = map.src.view.position;
            let dst = map.dst.view.position;

            let mp = position((src.x + dst.x) * 0.5, (src.y + dst.y) * 0.5);
            mp.x += (mp.x - frame.cx) * 0.2;
            mp.y += (mp.y - frame.cy) * 0.2;
            let path = [['M', src.x, src.y],
                        ['S', mp.x, mp.y, dst.x, dst.y]];
            // truncate path to allow for signal rep radius
            let len = Raphael.getTotalLength(path);
            path = Raphael.getSubpath(path, 10, len - 10);
            map.view.animate({'path': path,
                              'stroke-opacity': 1,
                              'fill-opacity': 0}, duration, '>', function() {
                map.view.attr({'arrow-end': 'block-wide-long'});
            });
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
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0) {
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
        // placeholder
    }

    this.zoom = function(x, y, delta) {
        // placeholder
    }

    this.filter_signals = function(signal_direction, text) {
        if (signal_direction == 'src')
            srcregexp = text ? new RegExp(text, 'i') : null;
        else
            dstregexp = text ? new RegExp(text, 'i') : null;
        redraw(1000);
    }

    this.cleanup = function() {
        // clean up any objects created only for this view
    }
}
