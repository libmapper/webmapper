//+++++++++++++++++++++++++++++++++++++++++++ //
//             Graph View Class               //
//+++++++++++++++++++++++++++++++++++++++++++ //

/*
 TODO:
 – display signals
 – add forces
 – add maps
 – enable selection
 – enable sorting along axes
 – fork 3D version?
 */

function GraphView(container, model)
{
    var _self = this;
    this.svgArea = null;
    var frame = null;
    var width = null;
    var height = null;
    var origin = null;
    var updated = 0;
    this.timer = null;
    var delta_t = 100;
    var MAX_DISPLACEMENT_SQ = 16;

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(event, type, obj) {
            switch (obj_type) {
                case 'device':
                    update_devices(obj, event);
                    break;
                case 'signal':
                    update_signals(obj, event);
                    break;
                case 'map':
                    update_maps(obj, event);
                    break;
            }
        });
    };

    function add_svg_area() {
        $('#container').append(
            "<div id='svgDivFull' class='links'>"+
                "<div id='svgTop'>hide unmapped</div>"+
            "</div>");

        svgArea = Raphael($('#svgDivFull')[0], '100%', '100%');
        frame = fullOffset($('#svgDivFull')[0]);
        width = frame.width - 200;
        height = frame.height - 200;
        origin = {"x": 100, "y": height + 150};
    };

    this.init = function() {
        // remove all previous DOM elements
        $(container).empty();
        add_svg_area();
//        this.add_handlers();
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 86px)'
        });
        add_model_callbacks();

        model.devices.each(function(dev) {
            update_devices(dev, "added");
            dev.signals.each(function(sig) { update_signals(sig); });
        });
        model.maps.each(function(map) { update_maps(map, "added"); });
    }

    function new_pos(x, y) {
        let frame = fullOffset($('#svgDivFull')[0]);
        return {'x': x ? x : Math.random() * frame.width + frame.left,
                'y': y ? y : Math.random() * frame.height + frame.top};
    }

    function update_maps(map, event) {
        if (event == 'removing') {
            if (!map.view)
                return;
            map.view.remove();
        }
        else if (event == 'removed')
            return;

        if (!map.view) {
            let pos = map.src.view.position;
            let path = [['M', pos.x, pos.y], ['S', pos.x, pos.y, pos.x, pos.y]];
            map.view = svgArea.path().attr({'path': path,
                                            'arrow-end': 'block-wide-long'});
        }
    }

//    function update_hierarchy(trunk, leaf) {
//        let path = leaf.name.split('/');
//        for (var i in path) {
//            if (!trunk.includes(path[i]))
//                trunk[path[i]] = {'position': };
//            trunk = trunk[path[i]];
//        }
//        trunk[path[i]] = leaf;
//    }

    function update_devices(dev, event) {
        if (event == 'removing') {
            if (!dev.view)
                return;
            for (var i in dev.view.signals)
                dev.view.signals[i].remove();
            dev.view.remove();
            return;
        }
        else if (event == 'removed')
            return;

        if (!dev.view) {
            let color = Raphael.getColor();
            let pos = new_pos();
            dev.view = (svgArea.circle(pos.x, pos.y, 20)
                        .attr({"fill": color,
                               "stroke": color}));
            dev.view.angle = 0;
            dev.view.signals = {};
            dev.view.color = color;
            dev.view.position = pos;
            dev.view.velocity = {'x': 0, 'y': 0};
            dev.view.force = {'x': 0, 'y': 0};
            dev.view.showVector = svgArea.path().attr({"path": [['M', pos.x, pos.y],
                                                                ['l', 0, 0]],
                                                       "stroke": "black"});
            dev.signals.each(function(sig) {
                update_signals(sig, "added");
            });
        }

        if (!this.timer)
            this.timer = setInterval(update_positions, delta_t);
    }

    function update_signals(sig, event) {
        console.log("update_signals", sig, event);
        if (event == 'removing' && sig.view) {
            sig.view.line.remove();
            sig.view.remove();
        }
        else if (event == 'removed')
            return;
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let pos = new_pos();
            sig.view = (svgArea.circle(pos.x, pos.y, 8)
                        .attr({"fill": dev.view.color,
                              "stroke": dev.view.color}));
            sig.view.position = pos;
            sig.view.velocity = {'x': 0, 'y': 0};
            sig.view.force = {'x': 0, 'y': 0};
            let path = [['M', pos.x, pos.y],
                        ['L', dev.view.position.x, dev.view.position.y]];
            sig.view.line = svgArea.path().attr({"path": path,
                                                 "stroke": dev.view.color});
        }
        if (!this.timer)
            this.timer = setInterval(update_positions, delta_t);
    }

    // update device and signal node forces/velocities/positions
    function update_positions() {
        let frame = fullOffset($('#svgDivFull')[0]);
        frame.cx = frame.width * 0.5;
        frame.cy = frame.height * 0.5;
        let border = 20;

        let L_s_sig = 100; // edge rest length
        let L_s_map = 150; // edge rest length

        let K_s_sig = 0.1; // spring constant
        let K_s_map = 0.05; // spring constant

        let K_r_sig = 10; // repulsive force constant
        let K_r_dev = 2000; // repulsive force constant
        let K_r_border = 100; // repulsive force constant

        let epsilon = 0.1;

        this.avoid_frame = function(node) {
            if (node.position.x < border) {
                node.force.x += K_r_border / (border - node.position.x);
            }
            else if (node.position.x > frame.width - border) {
                node.force.x -= K_r_border / (node.position.x - frame.width + border);
            }
            if (node.position.y < border) {
                node.force.y += K_r_border / (border - node.position.y);
            }
            else if (node.position.y > frame.height - border) {
                node.force.y -= K_r_border / (node.position.y - frame.height + border);
            }
        }

        this.compute_repulsive_forces = function(node1, node2, K) {
            if (!node1 || !node2)
                return;
            let dx = node1.position.x - node2.position.x;
            let dy = node1.position.y - node2.position.y;
            if (dx == 0 && dy == 0) {
                // apply small random force
                let fx = Math.random() * 2.0 - 0.5;
                let fy = Math.random() * 2.0 - 0.5;
                node1.force.x += fx;
                node1.force.y += fy;
                node2.force.x -= fx;
                node2.force.y -= fy;
            }
            else {
                let dist_sq = dx * dx + dy * dy;
                let dist = Math.sqrt(dist_sq);
                let force = K / dist_sq;
//                console.log("dist", dist, "force:", force);
                let fx = force * dx / dist;
                let fy = force * dy / dist;
//                console.log("fx, fy", fx, fy);
                node1.force.x += fx;
                node1.force.y += fy;
                node2.force.x -= fx;
                node2.force.x -= fy;
            }

            // also avoid frame
            avoid_frame(node1);
            avoid_frame(node2);
        }

        this.compute_attractive_forces = function(node1, node2, L, K) {
            if (!node1)
                return;
            if (!node2)
                node2 = {'position': {'x': frame.cx, 'y': frame.cy},
                         'force': {'x': 0, 'y': 0}};
            let dx = node1.position.x - node2.position.x;
            let dy = node1.position.y - node2.position.y;
            if (dx != 0 || dy != 0) {
                let dist = Math.sqrt(dx * dx + dy * dy);
                let force = K * (dist - L);
                let fx = force * dx / dist;
                let fy = force * dy / dist;
                node1.force.x -= fx;
                node1.force.y -= fy;
                node2.force.x += fx;
                node2.force.y += fy;
            }
        }

        // devices repel each other
        model.devices.each(function(dev1) {
            let start = false;
            model.devices.each(function(dev2) {
                if (start)
                    compute_repulsive_forces(dev1.view, dev2.view, K_r_dev);
                else if (dev1 == dev2)
                    start = true;
            });
            // device signals repel each other
            dev1.signals.each(function(sig1) {
                let start = false;
                dev1.signals.each(function(sig2) {
                    if (start)
                        compute_repulsive_forces(sig1.view, sig2.view, K_r_sig);
                    else if (sig1 == sig2)
                        start = true;
                });
                // devices attract their own signals
                compute_attractive_forces(dev1.view, sig1.view, L_s_sig, K_s_sig);
            });
        });

        // maps need to attract each endpoint
        model.maps.each(function(map) {
            compute_attractive_forces(map.src.view, map.dst.view, L_s_map, K_s_map);
        });

        this.compute_position = function(node, mass) {
            if (!node)
                return 0;
            if (   Math.abs(node.force.x) > epsilon
                || Math.abs(node.force.y) > epsilon) {
                let dx = delta_t * node.force.x;
                let dy = delta_t * node.force.y;
                let displacement_sq = dx * dx + dy * dy;
                if (displacement_sq > MAX_DISPLACEMENT_SQ) {
                    let s = Math.sqrt(MAX_DISPLACEMENT_SQ / displacement_sq);
                    dx *= s;
                    dy *= s;
                }
                let mass_inv = 1/mass;
                node.velocity.x = node.velocity.x * 0.9 * mass + dx * mass_inv;
                node.velocity.y = node.velocity.y * 0.9 * mass + dy * mass_inv;
                node.position.x += node.velocity.x;
                node.position.y += node.velocity.y;
//                node.animate({'cx': node.position.x,
//                              'cy': node.position.y}, delta_t, 'linear');
                node.attr({'cx': node.position.x, 'cy': node.position.y});
                if (node.showVector)
                    node.showVector.attr({"path": [['M', node.position.x, node.position.y],
                                                   ['l', node.force.x, node.force.y]]});
                node.force.x = node.force.y = 0;
                return 1;
            }
            return 0;
        }

        // now update positions
        updated = 0;
        model.devices.each(function(dev) {
//                           dev.view.position.x = frame.cx;
//                           dev.view.position.y = frame.cy;
            updated += compute_position(dev.view, 0.999999999);
            dev.signals.each(function(sig) {
                updated += compute_position(sig.view, 0.999999);
                let dev = sig.device;
                let path = [['M', sig.view.position.x, sig.view.position.y],
                            ['L', dev.view.position.x, dev.view.position.y]];
                sig.view.line.attr({"path": path});
            });
        });
        model.maps.each(function(map) {
            if (map.view) {
                let sig1 = map.src;
                let sig2 = map.dst;
                let cx = (sig1.view.position.x + sig2.view.position.x) * 0.5;
                let cy = (sig1.view.position.y + sig2.view.position.y) * 0.5;
                cx = (cx - frame.cx) * 1.1 + frame.cx;
                cy = (cy - frame.cy) * 1.1 + frame.cy;
                let path = [['M', sig1.view.position.x, sig1.view.position.y],
                            ['S', cx, cy, sig2.view.position.x, sig2.view.position.y]];
                map.view.attr({"path": path});
            }
        });
        if (updated == 0) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }
}

GraphView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
        window.clearInterval(this.timer);
    }
};
