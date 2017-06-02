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

function GraphPlotView(container, model)
{
    var _self = this;
    this.svgArea = null;
    var frame = null;
    var width = null;
    var height = null;
    var origin = null;

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(obj_type, event, key) {
            switch (obj_type) {
                case 'device':
                    update_devices(key, event);
                    break;
                case 'signal':
                    update_signals(key, event);
                    break;
//                case 'map':
//                    if (event == 'added') {
//                        let map = model.maps.find(key);
//                        map.view = svgArea.path();
//                        map.new = true;
//                    }
//                    update_maps(key, event);
//                    break;
            }
        });
    };

    function add_svg_area() {
        $('#container').append(
            "<div id='svgDivGraph' class='links'>"+
                "<div id='svgTop'>hide unmapped</div>"+
            "</div>");

        svgArea = Raphael($('#svgDivGraph')[0], '100%', '100%');
        frame = fullOffset($('#svgDivGraph')[0]);
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

        model.devices.each(function(dev) { update_devices(dev.key, "added"); });
//        model.signals.each(function(sig) { update_signals(sig.key, "added"); });
    }

    function update_devices(key, event) {
        if (event == 'removing') {
            let dev = model.devices.find(key);
            if (!dev || !dev.view)
                return;
            for (var i in dev.view.signals)
                dev.view.signals[i].remove();
            dev.view.remove();
            return;
        }
        
        let index = 0;
        let num = model.devices.size();
        if (num && num > 1)
            num -= 1;
        else
            num = 1;
        let angleInc = (Math.PI * 0.5) / num;
        console.log("angleInc", angleInc, num);
        model.devices.each(function(dev) {
            if (!dev.view) {
                dev.view = svgArea.path();
                dev.view.attr({"path": "M"+origin.x+","+origin.y+"l0,0"});
                dev.view.angle = 0;
                dev.view.signals = {};
                let devsigs = model.signals.filter(function(sig) {
                    return sig.device == dev.name;
                });
                devsigs.each(function(sig) {
                    if (!sig.painted) {
                        dev.view.signals[sig.name] = svgArea.circle(origin.x,
                                                                    origin.y, 3);
                        sig.painted = true;
                    }
                });
            }
            dev.view.angle = index * -angleInc;
            console.log("angle", dev.view.angle);
            let path = [["M", origin.x, origin.y],
                        ["l", width * Math.cos(dev.view.angle),
                         height * Math.sin(dev.view.angle)]];
            dev.view.animate({"path": path}, 500, "linear");
            repaint_device_signals(dev);
            index += 1;
        });
    }

    function repaint_device_signals(dev) {
        if (!dev || !dev.view) {
            console.log("can't repaint, null device or no view");
            return;
        }
        // repaint all device signals
        let index = 1;
        let devsigs = model.signals.filter(function(sig) {
                                           return sig.device == dev.name;
                                           });
        let inc = devsigs.size() ? 1 / devsigs.size() : 1;
        devsigs.each(function(sig) {
            dev.view.signals[sig.name].animate({
                "cx": origin.x + width * inc * index * Math.cos(dev.view.angle),
                "cy": origin.y + height * inc * index * Math.sin(dev.view.angle),
                "fill": "black"}, 500, "linear");
            index += 1;
        });
    }

    function update_signals(key, event) {
        if (key) {
            let sig = model.signals.find(key);
            if (!sig) {
                console.log("error: signal", key, "not found");
                return;
            }
            if (event == 'removed' && sig.painted)
                sig.remove("painted");
            else if (event == 'added' && !sig.painted) {
                let dev = model.devices.find(sig.device);
                if (!dev) {
                    console.log("error: device", sig.device, "not found");
                    return;
                }
                // add circle for signal
                dev.view.signals[sig.name] = svgArea.circle(origin.x, origin.y, 3);
                sig.painted = true;
                repaint_device_signals(dev);
            }
        }
        else {
            model.devices.each(function(dev) {repaint_device_signals(dev); });
        }
    }
}

GraphPlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
