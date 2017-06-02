//+++++++++++++++++++++++++++++++++++++++++++ //
//              Hive View Class               //
//+++++++++++++++++++++++++++++++++++++++++++ //

/*
 TODO:
 – display hive axes & device names
 – display signals & signal names (mouseover?)
 – draw maps
 – select-by-crossing for maps
 – selecting signals
 */

function HivePlotView(container, model)
{
    var _self = this;
    this.svgArea = null;
    var frame = null;
    var width = null;
    var height = null;
    var origin = null;
    var alternate = false;
    var device_shape = null;

    function circle_path(x, y, radius) {
        return [['M', x + radius - 3, y - radius + 2],
                ['a', radius, radius, 0, 1, 0, 0.001, 0.001],
                ['z']];
    }

    function switch_view(view) {
        switch (view) {
            case 'hive':
                redraw = function() {
                    let dev_index = 0;
                    let dev_num = model.devices.size();
                    if (dev_num && dev_num > 1)
                        dev_num -= 1;
                    else
                        dev_num = 1;
                    let angleInc = (Math.PI * 0.5) / dev_num;
                    model.devices.each(function(dev) {
                        if (!dev.view)
                            return;
                        angle = dev_index * -angleInc;
                        let path = [['M', origin.x, origin.y],
                                    ['l', width * Math.cos(angle), height * Math.sin(angle)]];
                        dev.view.animate({'path': path}, 500, 'linear');
                        dev.view.angle = angle;
                        dev_index += 1;
                        let sig_index = 1;
                        let sig_num = dev.signals.size();
                        let inc = sig_num ? 1 / sig_num : 1;
                        dev.signals.each(function(sig) {
                            if (!sig.view)
                                return;
                            let x = origin.x + width * inc * sig_index * Math.cos(angle);
                            let y = origin.y + height * inc * sig_index * Math.sin(angle);
                            let path = circle_path(x, y, 3);
                            sig.view.animate({'path': path}, 500, 'linear');
                            sig.view.position = new_pos(x, y);
                            sig_index += 1;
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let path = [['M', src.x, src.y],
                                    ['S', frame.cx, frame.cy, dst.x, dst.y]];
                        map.view.attr({'arrow-end': 'block-wide-long'});
                        map.view.animate({'path': path, 'fill-opacity': '0'}, 500, 'linear');
                    });
                }
                break;
            case 'grid':
                redraw = function() {
                    let num_devs = model.devices.size();
                    let num_sigs = 0;
                    model.devices.each(function(dev) {
                        num_sigs += dev.signals.size();
                    });
                    let sig_index = 1;
                    let inc = num_sigs ? 1 / num_sigs : 1;
                    model.devices.each(function(dev) {
                        let path = [['M', origin.x + width * inc * sig_index, origin.y],
                                    ['l', width * inc * (dev.signals.size()-1), 0],
                                    ['M', origin.x, origin.y - height * inc * sig_index],
                                    ['l', 0, -height * inc * (dev.signals.size()-1)]];
                        dev.view.animate({'path': path});
                        dev.signals.each(function(sig) {
                            let mult = inc * sig_index;
                            let path = circle_path(origin.x + width * mult, origin.y, 10);
                            path.push(circle_path(origin.x, origin.y - height * mult, 10));
                            path.push([['M', origin.x + width * mult, origin.y],
                                       ['l', 0, -height]]);
                            path.push([['M', origin.x, origin.y - height * mult],
                                       ['l', width, 0]]);
                            sig.view.animate({'path': path,
                                              'stroke-opacity': 0.5});
                            // todo: only store mult to make resize draws more efficient?
                            sig.view.position = new_pos(origin.x + width * mult, origin.y - height * mult);
                            sig_index += 1;
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let path = circle_path(dst.x, src.y, 10);
                        map.view.attr({'arrow-end': 'none'});
                        map.view.animate({'path': path, 'fill': 'black', 'fill-opacity': '1'}, 500, 'linear');
                    });
                }
                break;
        }
        redraw();
    }

    switch_view('hive');

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(obj_type, event, key) {
            switch (obj_type) {
                case 'device':
                    update_devices(obj, event);
                    break;
                case 'signal':
                    update_signals(obj, event, true);
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
        frame.cx = frame.width * 0.5;
        frame.cy = frame.height * 0.5;
        width = frame.width - 200;
        height = frame.height - 200;
        origin = {"x": 100, "y": frame.height - 50};
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

        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function update_devices(dev, event) {
        if (event == 'removing' && dev.view) {
            if (!dev.view)
                return;
            dev.signals.each(function(sig) { sig.view.remove(); });
            dev.view.remove();
            return;
        }
        else if (event == 'added' && !dev.view) {
            let color = Raphael.getColor();
            dev.view = svgArea.path().attr({
                "path": [['M', origin.x, origin.y], ['L',10, 0]],
                "stroke": color});
            dev.view.color = color;
            dev.view.angle = 0;
            dev.view.signals = {};
            dev.signals.each(function(sig) {
                update_signals(sig, 'added', false);
            });
            redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    function new_pos(x, y) {
        let frame = fullOffset($('#svgDivFull')[0]);
        return {'x': x ? x : Math.random() * frame.width + frame.left,
            'y': y ? y : Math.random() * frame.height + frame.top};
    }

    function update_signals(sig, event, repaint) {
        if (event == 'removing' && sig.view)
            sig.view.remove();
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let path = circle_path(origin.x, origin.y, 3);
            sig.view = svgArea.path()
                            .attr({ 'path': path,
                                    'fill': dev.view.color,
                                    'stroke': dev.view.color });
            sig.view.position = new_pos(origin.x, origin.y);
            if (repaint)
                redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    function update_maps(map, event) {
        console.log('map event', event, map);
        if (event == 'removing' && map.view) {
            map.view.remove();
            return;
        }
        else if (event == 'added' && !map.view) {
            let src = map.src.view.position;
            let dst = map.dst.view.position;
            let path = [['M', src.x, src.y],
                        ['L', dst.x, dst.y]];
            map.view = svgArea.path().attr({'path': path,
                                            'arrow-end': 'block-wide-long'});
            redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    $('body').on('keydown.list', function(e) {
        if (e.which == 32) {
            alternate = !alternate;
            switch_view(alternate ? 'grid' : 'hive');
            redraw();
        }
    })
}

HivePlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
