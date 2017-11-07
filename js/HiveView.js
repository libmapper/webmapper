//++++++++++++++++++++++++++++++++++++++//
//           Hive View Class            //
//++++++++++++++++++++++++++++++++++++++//

function HiveView(frame, canvas, model)
{
    let map_pane;
    let draggingFrom = null;
    let snappingTo = null;
    let escaped = false;
    let first_draw = true;

    let dev_index;
    let sig_index;
    let angleInc;
    let inc;
    let dev_start_path = null;
    let dev_target_path = null;

    let srcregexp;
    let dstregexp;

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, 0, 0, 0, 1000);
        map_pane = {'left': 50,
                    'bottom': frame.height - 50,
                    'width': frame.width - 100,
                    'height': frame.height - 100};
    };

    this.resize();

    this.type = function() {
        return 'hive';
    }

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
                            ['S', (src.x + x) * 0.6, (src.y + y) * 0.4, x, y]];
            },
            function(x, y, event) {
                escaped = false;
                draggingFrom = sig;
            },
            function(x, y, event) {
                draggingFrom = null;
            }
        );
    }

    function redraw_signal(sig, duration) {
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

        let is_output = sig.direction == 'output';
        if (!sig.view) {
            sig.view = canvas.path(circle_path(sig.position.x,
                                               sig.position.y,
                                               is_output ? 7 : 10));
            set_sig_hover(sig);
            set_sig_drag(sig);
        }
        else if (first_draw) {
            set_sig_hover(sig);
            set_sig_drag(sig);
        }

        sig_index += 1;
        let x = map_pane.left + map_pane.width * inc * sig_index * Math.cos(angle);
        let y = map_pane.bottom + map_pane.height * inc * sig_index * Math.sin(angle);
        if (dev_start_path) {
            dev_start_path.push(['L', sig.position.x, sig.position.y]);
            dev_target_path.push(['L', x, y]);
        }
        else {
            dev_start_path = [['M', sig.position.x, sig.position.y]];
            dev_target_path = [['M', x, y]];
        }
        let path = circle_path(x, y, is_output ? 7 : 10);
        sig.view.stop();
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : sig.device.color,
                          'fill-opacity': 1,
                          'stroke': sig.device.color,
                          'stroke-width': 6,
                          'stroke-opacity': sig.direction == 'output' ? 1 : 0},
                         duration, '>');
        sig.position = position(x, y);
        if (sig.view.label) {
            sig.view.label.animate({'x': x, 'y': y, 'opacity': 0},
                                   duration, '>', function() {
                this.remove();
                sig.view.label = null;
            });
        }
    }

    function redraw_device(dev, duration) {
        angle = dev_index * -angleInc;
        dev_index += 1;
        sig_index = 0;
        dev_start_path = null;
        dev_target_path = null;
        let vis_sigs = dev.signals.reduce(function(count, sig) {
            let found = 0;
            if (sig.direction == 'output') {
                if (!srcregexp || srcregexp.test(sig.key))
                    found = 1;
            }
            else if (!dstregexp || dstregexp.test(sig.key))
                found = 1;
            return count ? count + found : found;
        });
        inc = vis_sigs ? 1 / vis_sigs : 1;
        dev.signals.each(function(sig) { redraw_signal(sig, duration); });

        if (!dev.view) {
            dev.view = canvas.path(dev_start_path)
                             .attr({'stroke': dev.color,
                                    'stroke-width': 20,
                                    'stroke-opacity': 0,
                                    'fill': dev.color,
                                    'fill-opacity': 0,
                                    'stroke-linecap': 'round'});
        }
        else
            dev.view.stop();
        dev.view.toBack();
        dev.view.animate({'path': dev_target_path,
                          'stroke': dev.color,
                          'stroke-width': 20,
                          'stroke-opacity': 0.5,
                          'fill': dev.color,
                          'fill-opacity': 0,
                          'stroke-linecap': 'round'}, duration, '>');
    }

    function redraw_map(map, duration) {
        let src = map.src.position;
        let dst = map.dst.position;
        if (!map.view) {
            map.view = canvas.path([['M', src.x, src.y], ['l', 0, 0]])
                             .attr({'stroke-width': 2,
                                    'arrow-end': 'block-wide-long' });
        }
        let path = [['M', src.x, src.y],
                    ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
                     dst.x, dst.y]];
        let len = Raphael.getTotalLength(path);
        path = Raphael.getSubpath(path, 10, len - 10);
        map.view.animate({'path': path,
                          'fill-opacity': '0',
                          'stroke-opacity': 1,
                          'stroke-width': 2},
                         duration, '>', function() {
            map.view.attr({'arrow-end': 'block-wide-long'}).toFront();
        });
    }

    this.redraw = function(duration) {
        dev_index = 0;
        let dev_num = model.devices.size();
        if (dev_num && dev_num > 1)
            dev_num -= 1;
        else
            dev_num = 1;
        angleInc = (Math.PI * 0.5) / dev_num;

        model.devices.each(function(dev) { redraw_device(dev, duration); });
        model.maps.each(function(map) { redraw_map(map, duration); });
        first_draw = false;
    }

    this.pan = function(x, y, delta_x, delta_y)  {
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
