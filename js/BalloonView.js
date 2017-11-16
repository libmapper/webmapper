//++++++++++++++++++++++++++++++++++++++//
//         Balloon View Class           //
//++++++++++++++++++++++++++++++++++++++//

function BalloonView(frame, canvas, model)
{
    let draggingFrom = null;
    let snappingTo = null;
    let escaped = false;

    let path = circle_path(frame.left + frame.width * 0.33, frame.cy, 0);
    path.push(circle_path(frame.left + frame.width * 0.67, frame.cy, 0));
    let outline = canvas.path().attr({'path': path,
                                      'stroke-opacity': 0,
                                      'fill': 'lightgray',
                                      'fill-opacity': 0.1}).toBack();
    let src_nodes = {};
    let dst_nodes = {};

    let srcregexp;
    let dstregexp;

    this.type = function() {
        return 'balloon';
    }

    function adjust_nodes(nodes, px, py, pr, depth, rev) {
        let count = Object.keys(nodes).length;
        if (count == 0)
            return;
//        if (depth > 1)
//            return;
        console.log('adjusting');
        let angleInc = Math.PI / count * (rev ? -1 : 1);
        let offset = angleInc * (count - 1) * 0.5;
        if (!rev)
            offset += Math.PI;
        let r = pr / count * 1.2;
        let key, idx = 0;
        for (key in nodes) {
            let node = nodes[key];
            console.log('node', key, node);
            let angle = offset - angleInc * idx;
            let x = px + Math.cos(angle) * (pr - r);
            let y = py + Math.sin(angle) * (pr - r);
            console.log('moving node', key, 'by', Math.cos(angle) * r,
                        Math.sin(angle) * r, ', radius:', r, ', angle:', angle,
                        ', offset:', offset);
            node.view.animate({'cx': x, 'cy': y, 'r': r}, 1000, 'linear');
            node.label.animate({'x': x + r + 5, 'y': y}, 1000, 'linear');
            if (node.children)
                adjust_nodes(node.children, x, y, r, depth + 1, rev);
            idx += 1;
        }
    }

    function remove_node_svg(root) {
        if (root.view)
            root.view.remove();
        if (root.label)
            root.label.remove();
        for (var i in root.children)
            remove_node_svg(root.children[i]);  // recurse
    }

    this.resize = function(new_frame) {
        if (new_frame)
            frame = new_frame;
        animate_tables(frame, 0, 0, 0, 1000);
        let path = circle_path(frame.left + frame.width * 0.33, frame.cy, 0);
        path.push(circle_path(frame.left + frame.width * 0.67, frame.cy, 0));
        outline.attr({'path': path}).toBack();
    }
    this.resize();

    function draw_signal(sig, duration) {
        // remove associated svg elements
        remove_object_svg(sig);

        if (sig.direction == 'output') {
            if (srcregexp && !srcregexp.test(sig.key))
                return;
        }
        else if (dstregexp && !dstregexp.test(sig.key)) {
            return;
        }
        let namespace = sig.key.split('/');
        let ptr = sig.direction == 'output' ? src_nodes : dst_nodes;
        let x, y, r, ns_idx = 1;
        for (var i in namespace) {
            let name = namespace[i];
            if (name in ptr) {
                ptr = ptr[name].children;
            }
            else {
                x = ns_idx * 50;
                y = line_count * 20;
                line_count += 1;
                let r = 20 / ns_idx;
                let new_node = {'view': canvas.circle(x, y, r)
                                              .attr({'fill': sig.device.color,
                                                     'fill-opacity': 0.5,
                                                     'stroke-opacity': 0}),
                    'label': canvas.text(x + r + 5, y, name)
                                   .attr({'font-size': 16,
                                          'text-anchor': 'start'}),
                    'children': {}};
                ptr[name] = new_node;
                ptr = new_node.children;
            }
            ns_idx += 1;
        }
    }

    function update_devices() {
        // build/rebuild signal namespace heirarchy
        // label signals with final position
    }

    function draw_devices(duration) {
        model.devices.each(function(dev) {
            // remove associated svg elements
            remove_object_svg(dev);
            let line_count = 0;
            dev.signals.each(function(sig) { draw_signal(sig, duration); });
        });
    }

    function draw_maps(duration) {
        // draw arcs for maps
    }

    this.draw = function(duration) {
        let path = circle_path(frame.left + frame.width * 0.33, frame.cy,
                               frame.height * 0.46);
        path.push(circle_path(frame.left + frame.width * 0.67, frame.cy,
                              frame.height * 0.46));
        outline.animate({'path': path, 'fill-opacity': 0.5}, duration, '>');

        model.devices.each(function(dev) { redraw_device(dev, duration); });

        console.log('srcs', src_nodes);
        console.log('dsts', dst_nodes);

        // arrange hierarchical view
        adjust_nodes(src_nodes, frame.left + frame.width * 0.33, frame.cy,
                     frame.height * 0.46, 0, false);
        adjust_nodes(dst_nodes, frame.left + frame.width * 0.67, frame.cy,
                     frame.height * 0.46, 0, true);
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
        if (outline) {
            outline.remove();
            outline = null;
        }
        for (var i in src_nodes)
            remove_node_svg(src_nodes[i]);
        delete src_nodes;
        for (var i in dst_nodes)
            remove_node_svg(dst_nodes[i]);
        delete dst_nodes;
    }
}
