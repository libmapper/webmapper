//++++++++++++++++++++++++++++++++++++++//
//         Balloon View Class           //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class BalloonView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super(frame, tables, canvas, database, tooltip, pie);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 500);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500);

        // draw background
        let path = circle_path(frame.left + frame.width * 0.33, frame.cy, 0);
        path.push(circle_path(frame.left + frame.width * 0.67, frame.cy, 0));
        this.background = this.canvas.path().attr({'path': path,
                                                   'stroke-opacity': 0,
                                                   'fill': 'lightgray',
                                                   'fill-opacity': 0.1}).toBack();
        this.srcNodes = {};
        this.dstNodes = {};

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.resize();
    }

    adjustNodes(nodes, px, py, pr, depth, rev) {
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
            node.view.animate({'cx': x, 'cy': y, 'r': r}, 500, 'linear');
            node.label.animate({'x': x + r + 5, 'y': y}, 500, 'linear');
            if (node.children)
                adjust_nodes(node.children, x, y, r, depth + 1, rev);
            idx += 1;
        }
    }

    removeNodeSVG(root) {
        if (root.view)
            root.view.remove();
        if (root.label)
            root.label.remove();
        for (var i in root.children)
            remove_node_svg(root.children[i]);  // recurse
    }

    _resize(duration) {
        super._resize(newFrame);

        let path = circle_path(this.frame.left + this.frame.width * 0.33, this.frame.cy, 0);
        path.push(circle_path(this.frame.left + this.frame.width * 0.67, this.frame.cy, 0));
        this.background.attr({'path': path}).toBack();
    }

    drawSignal(sig, duration) {
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

    updateDevices() {
        // build/rebuild signal namespace heirarchy
        // label signals with final position
    }

    drawDevices(duration) {
        this.database.devices.each(function(dev) {
            // remove associated svg elements
            remove_object_svg(dev);
            let line_count = 0;
            dev.signals.each(function(sig) { draw_signal(sig, duration); });
        });
    }

    draw(duration) {
        let path = circle_path(frame.left + frame.width * 0.33, frame.cy,
                               frame.height * 0.46);
        path.push(circle_path(frame.left + frame.width * 0.67, frame.cy,
                              frame.height * 0.46));
        this.background.animate({'path': path, 'fill-opacity': 0.5}, duration, '>');

        let self = this;
        this.database.devices.each(function(dev) {
            self.redrawDevice(dev, duration);
        });

        console.log('srcs', this.srcNodes);
        console.log('dsts', this.dstNodes);

        // arrange hierarchical view
        this.adjustNodes(this.srcNodes, this.frame.left + this.frame.width * 0.33, this.frame.cy,
            frame.height * 0.46, 0, false);
        this.adjustNodes(this.dstNodes, this.frame.left + this.frame.width * 0.67, this.frame.cy,
            frame.height * 0.46, 0, true);
    }

    update() {
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
        let updated = false;
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0) {
            this.updateDevices();
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    cleanup() {
        super.cleanup();

        if (outline) {
            outline.remove();
            outline = null;
        }
        for (var i in this.srcNodes)
            remove_node_svg(this.srcNodes[i]);
        delete this.srcNodes;
        for (var i in this.dstNodes)
            remove_node_svg(this.dstNodes[i]);
        delete this.dstNodes;
    }
}
