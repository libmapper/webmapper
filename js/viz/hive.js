//++++++++++++++++++++++++++++++++++++++ //
//              View Class               //
//++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
    var _self = this;
    this.svgArea = null;
    var frame = null;
    var width = null;
    var height = null;
    var origin = null;
    var view_counter = 0;
    var device_shape = null;
    var leftTable = null;
    var leftTableWidth = -1;
    var leftTableHeight = -1;
    var rightTableWidth = -1;
    var topTableWidth = -1;
    var topTableHeight = -1;
    var currentView = null;
    var cleanup = null;

    var default_speed = 1000;

    var cursor = null;

    function circle_path(x, y, radius) {
        radius = 10;
        return [['M', x + radius * 0.65, y - radius * 0.65],
                ['a', radius, radius, 0, 1, 0, 0.001, 0.001],
                ['z']];
    }

    function rect_path(dim) {
        return [['M', dim.left, dim.top],
                ['l', dim.width, 0],
                ['l', 0, dim.height],
                ['l', -dim.width, 0],
                ['z']];
    }

    function smooth_path(x1, y1, x2, y2) {
        let mp = [(x1 + x2) * 0.5, (y1 + y2) * 0.5]
        if (x1 == 0) {
            mp[0] += Math.abs(y1 - y2);
        }
        if (y1 == 0) {
            mp[1] += Math.abs(x1 - x2);
        }
        return [['M', x1, y1],
                ['S', mp[0], mp[1], x2, y2]];
    }

    function switch_view(view) {
//        if (view == currentView)
//            return;

        // call view cleanup
        if (cleanup) {
            cleanup();
            cleanup = null;
        }

        // stop current animations
        $('#leftTable').stop(true, false);
        $('#rightTable').stop(true, false);
        $('#topTable').stop(true, false);
        $('#svgDiv').stop(true, false);

        let left_tw, left_th, right_tw, right_th, top_tw, top_th;

        switch (view) {
            case 'list':
                left_tw = frame.width * 0.4;
                left_th = frame.height;
                right_tw = frame.width * 0.4;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                break;
            case 'canvas':
                left_tw = frame.width * 0.25;
                left_th = frame.height;
                right_tw = 0;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                break;
            case 'grid':
                left_tw = 200;
                left_th = frame.height - 200;
                right_tw = 0;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 200;
                break;
            default:
                left_tw = 0;
                left_th = frame.height;
                right_tw = 0;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                break;
        }

        if (left_tw != leftTableWidth)
            $('#leftTable').animate({'width': left_tw + 'px'},
                                    {duration: default_speed, step: function(now, fx) {
                                        leftTableWidth = now;
                                        $('#svgDiv, #topTable').css({
                                            'width': (frame.width - leftTableWidth
                                                      - rightTableWidth) + 'px',
                                            'left': leftTableWidth + 'px'});
                                    }});
        if (right_tw != rightTableWidth)
            $('#rightTable').animate({'width': right_tw + 'px'},
                                     {duration: default_speed, step: function(now, fx) {
                                        rightTableWidth = now;
                                        $('#rightTable').css({'left': frame.width - now + 'px'});
                                        $('#svgDiv, #topTable').css({
                                            'width': (frame.width - leftTableWidth
                                                      - rightTableWidth) + 'px'});
                                     }});
        if (top_th != topTableHeight)
            $('#topTable').animate({'height': top_th + 'px'},
                                     {duration: default_speed, step: function(now, fx) {
                                        topTableHeight = now;
                                        $('#svgDiv, #leftTable, #rightTable').css({
                                            'height': (frame.height - topTableHeight) + 'px',
                                            'top': topTableHeight + 'px'});
                                     }});

        switch (view) {
            case 'hive':
                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
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
                        dev.view.animate({'path': path,
                                          'stroke-opacity': 1,
                                          'fill-opacity': 0}, speed, 'linear');
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
                            sig.view.animate({'path': path,
                                              'fill-opacity': 1,
                                              'stroke-opacity': 0}, speed, 'linear');
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
                                    ['S', (src.x+dst.x)*0.6, (src.y+dst.y)*0.4,
                                     dst.x, dst.y]];
                        map.view.animate({'path': path,
                                          'fill-opacity': '0',
                                          'stroke-opacity': 1},
                                         speed, 'linear', function() {
                            map.view.attr({'arrow-end': 'block-wide-long'});
                        });
                    });
                }
                break;
            case 'grid':
                leftTable.filter('input', null);
                leftTable.show_detail(false);
                leftTable.border_mode(true);
                leftTable.update(left_th);

                topTable.filter('output', null);
                topTable.show_detail(false);
                topTable.border_mode(true);
                topTable.update(top_tw);

                cursor.attr({'stroke-opacity': 0,
                             'fill': 'rgb(104,202,255)',
                             'fill-opacity': 0.5,
                             'arrow-end': 'none'}).toBack();

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;

                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            sig.view.animate({'fill-opacity': 0,
                                              'stroke-opacity': 0}, speed, 'linear');
                        });
                        let pos = leftTable.rowPos(dev.name);
                        if (pos)
                            pos.width = frame.width;
                        else {
                            pos = topTable.rowPos(dev.name);
                            if (!pos)
                                return;
                            pos.height = frame.height;
                        }
                        let path = rect_path(pos);
                        dev.view.toBack();
                        dev.view.animate({'path': path,
                                          'fill-opacity': 1,
                                          'stroke-opacity': 0}, speed, 'linear');
                        dev.view.attr({'fill': 'lightgray'});
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let path, curve = false;
                        h = topTable.rowPos(map.src.key);
                        v = leftTable.rowPos(map.dst.key);
                        if (h) {
                            if (v) {
                                path = [['M', h.left, v.cy],
                                        ['l', h.width, v.height * -0.5],
                                        ['l', 0, v.height],
                                        ['Z']];
                            }
                            else {
                                v = topTable.rowPos(map.dst.key);
                                if (!v)
                                    return
                                // both endpoints are 'output' signals
                                path = smooth_path(h.cx, 0, v.cx, 0);
                                curve = true;
                            }
                        }
                        else if (v) {
                            h = leftTable.rowPos(map.src.key);
                            if (!h)
                                return
                            // both enpoints are 'input' signals
                            path = smooth_path(0, h.cy, 0, v.cy);
                            curve = true;
                        }
                        else {
                            // could be 'reversed' map
                            h = topTable.rowPos(map.dst.key);
                            v = leftTable.rowPos(map.src.key);
                            if (!h || !v)
                                return;
                            path = [['M', h.left, v.top + v.height],
                                    ['l', h.width, 0],
                                    ['L', h.cx, v.top],
                                    ['Z']];
                        }

                        if (curve) {
                            map.view.attr({'arrow-end': 'block-wide-long'});
                            map.view.animate({'path': path,
                                              'fill-opacity': 0,
                                              'stroke': 'black',
                                              'stroke-opacity': 1}, speed, 'linear');
                        }
                        else {
                            map.view.attr({'arrow-end': 'none'});
                            map.view.animate({'path': path,
                                              'fill-opacity': '1',
                                              'stroke-opacity': 0}, speed, 'linear');
                        }
                    });
                }
                $('#container').on('mouseenter', function(e) {
                    $('#container').on('mousemove', function(e) {
                        let h = null, v = null;
                        if (e.clientY > (frame.top + top_th))
                            h = leftTable.highlight(e.clientX, e.clientY);
                        if (e.clientX > (frame.left + left_tw))
                            v = topTable.highlight(e.clientX, e.clientY);
                        if (h == null || v == null) {
                            cursor.attr({'fill-opacity': 0});
                            return;
                        }

                        h.width = v.left + v.width
                        h.center = h.top +h.height * 0.5;
                        v.height = h.top + h.height;
                        v.center = v.left +v.width * 0.5;
                        let path = [['M', v.center, h.center],
                                    ['L', 0, h.top],
                                    ['L', 0, h.top + h.height],
                                    ['Z'],
                                    ['M', v.center, h.center],
                                    ['L', v.left, 0],
                                    ['L', v.left + v.width, 0],
                                    ['Z']];
                        cursor.attr({'path': path,
                                     'fill-opacity': 0.75});
                    });
                    $('#svgDiv').on('mouseleave', function(e) {
                        leftTable.highlight(null, null);
                        topTable.highlight(null, null);
                        cursor.attr({'fill-opacity': 0});
                    });
                });
                $('.tableDiv').on('scroll', function(e) {
                    redraw(0);
                });
                cleanup = function() {
                    // remove mousehandlers
                    $('.tableDiv').off('scroll');
                    $('#container').off('mouseenter');
                    $('#container').off('mousemove');
                    $('#svgDiv').off('mouseleave');
                    cursor.attr({'fill-opacity': 0});
                }
                break;
            case 'list':
                /* to do
                 * sorting (move to top bar)
                 * searching (move to top bar)
                 */
                leftTable.filter('output', null);
                leftTable.show_detail(true);
                leftTable.update(left_th);

                rightTable.filter('input', null);
                rightTable.show_detail(true);
                rightTable.update(right_th);

                cursor.attr({'stroke-opacity': 0,
                             'fill-opacity': 0,
                             'arrow-end': 'none'}).toBack();

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
                    model.devices.each(function(dev) {
                        dev.view.animate({'stroke-opacity': 0,
                                          'fill-opacity': 0}, speed, 'linear');
                        dev.signals.each(function(sig) {
                            sig.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                        });
                    });
                    let svg_tw = frame.width - left_tw - right_tw;
                    let svg_tc = svg_tw * 0.5;
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;

                        let l, r;
                        if ((l = leftTable.rowPos(map.src.key)))
                            l.left = 0;
                        else if ((l = rightTable.rowPos(map.src.key)))
                            l.left = svg_tw;
                        else
                            return;
                        if ((r = rightTable.rowPos(map.dst.key)))
                            r.left = svg_tw;
                        else if ((r = leftTable.rowPos(map.dst.key)))
                            r.left = 0;
                        else
                            return;

                        l.center = l.top + l.height * 0.5;
                        r.center = r.top + r.height * 0.5;

                    let path = [['M', l.left, l.center],
                                ['C', svg_tc, l.center, svg_tc, r.center, r.left, r.center]];
                    map.view.animate({'path': path,
                                      'stroke-opacity': 1,
                                      'fill-opacity': '0'}, speed, 'linear', function() {
                            map.view.attr({'arrow-end': 'block-wide-long'});
                        });
                    });
                }
                $('.tableDiv').on('scroll', function(e) {
                    redraw(0);
                });
                $('.tableDiv').on('mousedown', 'tr', function(e) {
                    var sourceRow = this;
                    var table = null;
                    var ppos = fullOffset(sourceRow);
                    ppos.left -= frame.left;
                    ppos.top = ppos.top - frame.top + ppos.height * 0.5;
                    if ($(sourceRow).parents('.tableDiv').attr('id') == "leftTable") {
                        table = leftTable;
                    }
                    else if ($(sourceRow).parents('.tableDiv').attr('id') == "rightTable") {
                        table = rightTable;
                        ppos.left -= right_tw;
                    }

                    $('svg').one('mouseenter.drawing', function() {
                        // TODO: deselect all maps
                        let svg_tw = frame.width - left_tw - right_tw;
                        let mpx = svg_tw * 0.5;
                        let path = [['M', ppos.left, ppos.top],
                                    ['C', mpx, ppos.top, mpx, 0, 0, 0]];

                        let leftAttract = svg_tw * 0.3;
                        let rightAttract = svg_tw * 0.7;
                        let dst = null;
                        $('svg, .displayTable tbody tr').on('mousemove.drawing',
                                                            function(e) {
                            dst = null;
                            let x = e.pageX - frame.left - left_tw;
                            let y = e.pageY - frame.top - top_th;
                            let pos;
                            if (x < leftAttract) {
                                rightTable.highlight(null, null);
                                pos = leftTable.highlight(e.pageX, e.pageY);
                                if (pos) {
                                    x = 0;
                                    y = pos.cy;
                                    dst = pos.id;
                                }
                                path[1][4] = path[1][6] = y;
                            }
                            else if (x > rightAttract) {
                                leftTable.highlight(null, null);
                                pos = rightTable.highlight(e.pageX, e.pageY);
                                if (pos) {
                                    x = svg_tw;
                                    y = pos.cy;
                                    dst = pos.id;
                                }
                                path[1][4] = path[1][6] = y;
                            }
                            else {
                                path[1][4] = path[1][2];
                                path[1][6] = y;
                            }

                            path[1][5] = x;
                            cursor.attr({'path': path,
                                         'stroke-opacity': 1,
                                         'arrow-end': 'block-wide-long'});
                        });
                        $(document).on('mouseup.drawing', function(e) {
                            $(document).off('.drawing');
                            $('svg, .displayTable tbody tr').off('.drawing');
                            cursor.attr({'stroke-opacity': 0,
                                         'arrow-end': 'none'});
                            if (dst) {
                                console.log('sending map cmd', sourceRow.id, dst);
                                $('#container').trigger("map", [sourceRow.id, dst]);
                            }
                        });
                    });
                    $(document).one('mouseup.drawing', function(e) {
//                        $("*").off('.drawing').removeClass('incompatible');
                        $(document).off('.drawing');
                        cursor.attr({'stroke-opacity': 0,
                                     'arrow-end': 'none'});
                    });
                });
                cleanup = function() {
                    $('.tableDiv').off('scroll');
                    $('.tableDiv').off('mousedown');
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    // for animations, place signal and device objects under tables
                    model.devices.each(function(dev) {
                        let d = (leftTable.rowPos(dev.name) || rightTable.rowPos(dev.name))
                        if (!d)
                            return;
                        dev.view.attr({'path': rect_path(d),
                                       'fill-opacity': 1});
                    });
                }
                break;
            case 'canvas':
                leftTable.filter(null, null);
                leftTable.show_detail(true);
                leftTable.update(left_th);

                cursor.attr({'arrow-end': 'none'});

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
                    model.devices.each(function(dev) {
                        dev.view.animate({'stroke-opacity': 0,
                                          'fill-opacity': 0}, speed, 'linear');
                        dev.signals.each(function(sig) {
                            let dim = {'left': Math.random() * frame.width,
                                       'top': Math.random() * frame.height,
                                       'width': 50,
                                       'height': 15 };
                            let path = rect_path(dim);
                            sig.view.animate({'path': path,
                                              'fill-opacity': 1,
                                              'stroke-opacity': 1}, speed, 'linear');
                        });
                    });
                }
                $('.tableDiv').on('mousedown', 'tr', function(e) {
                    var id = this.id;

                    $('svg').one('mouseenter.drawing', function() {
                        // TODO: deselect all objects
                        var cursorLabel = svgArea.text(0, 0, id);

                        $('svg, .displayTable tbody tr').on('mousemove.drawing',
                                                            function(e) {
                            let x = e.pageX - frame.left - left_tw;
                            let y = e.pageY - frame.top - top_th;
                            let path = rect_path({'left': x-30, 'top': y-10,
                                                  'width': 60, 'height': 20 });
                            cursor.attr({'path': path, 'stroke-opacity': 1});
                            cursorLabel.attr({'x': x, 'y': y,
                                              'fontweight': '12pt'});
                        });
                        $(document).on('mouseup.drawing', function(e) {
                            $(document).off('.drawing');
                            $('svg, .displayTable tbody tr').off('.drawing');
                            cursor.attr({'stroke-opacity': 0});
                            if (cursorLabel)
                                cursorLabel.remove();
                        });
                    });
                    $(document).one('mouseup.drawing', function(e) {
//                        $("*").off('.drawing').removeClass('incompatible');
                        $(document).off('.drawing');
                        cursor.attr({'stroke-opacity': 0});
                    });
                });
                cleanup = function() {
                    $('.tableDiv').off('mousedown');
                    $(document).off('.drawing');
                    $('svg').off('.drawing');
                }

                break;
            case 'graph':
                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
                    model.devices.each(function(dev) {
                        dev.view.animate({'stroke-opacity': 0,
                                          'fill-opacity': 0}, speed, 'linear');
                        dev.signals.each(function(sig) {
                            let pos = new_pos();
                            let path = circle_path(pos.x, pos.y, 10);
                            sig.view.animate({'path': path,
                                              'fill-opacity': 1,
                                              'stroke-opacity': 0}, speed, 'linear');
                            sig.view.position = pos;
                        });
                    });
                    frame.cx = frame.width * 0.5;
                    frame.cy = frame.height * 0.5;
                    model.maps.each(function(map) {
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let mp = new_pos((src.x + dst.x) * 0.5, (src.y + dst.y) * 0.5);
                        mp.x += (mp.x - frame.cx) * 0.2;
                        mp.y += (mp.y - frame.cy) * 0.2;
                        let path = [['M', src.x, src.y],
                                    ['S', mp.x, mp.y, dst.x, dst.y]];
                        map.view.animate({'path': path,
                                          'stroke-opacity': 1,
                                          'fill-opacity': 0}, speed, 'linear',
                                         function() {
                            map.view.attr({'arrow-end': 'block-wide-long'});
                        });
                    });
                }
                break;
        }
        redraw();
    }

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(event, type, obj) {
            switch (type) {
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

    function add_display_tables() {
        leftTable = new mapperTable(model, 'leftTable', 'left', true);
        rightTable = new mapperTable(model, 'rightTable', 'right', true);
        topTable = new mapperTable(model, 'topTable', 'top', false);

        // Put the tables in the DOM
        leftTable.create_within($('#container')[0]);
        rightTable.create_within($('#container')[0]);
        topTable.create_within($('#container')[0]);
    }

    function add_svg_area() {
        $('#container').append(
            "<div id='svgDiv' class='links'>"+
            "</div>");

        svgArea = Raphael($('#svgDiv')[0], '100%', '100%');
        frame = fullOffset($('#svgDiv')[0]);
        frame.cx = frame.width * 0.5;
        frame.cy = frame.height * 0.5;
        width = frame.width - 100;
        height = frame.height - 100;
        origin = {"x": 50, "y": frame.height - 25};
    };

    this.init = function() {
        // remove all previous DOM elements
        $(container).empty();
        add_display_tables();
        add_svg_area();
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 86px)'
        });

        switch_view('hive');
        cursor = svgArea.path();

        add_model_callbacks();
        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function update_devices(dev, event) {
        console.log('update_devices', dev, event);
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
                'path': [['M', origin.x, origin.y], ['L',10, 0]],
                'stroke': color,
                'fill': 'lighgray' });
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
        let frame = fullOffset($('#svgDiv')[0]);
        return {'x': x ? x : Math.random() * frame.width + frame.left,
            'y': y ? y : Math.random() * frame.height + frame.top};
    }

    function update_signals(sig, event, repaint) {
        console.log('update_sigs', sig, event);
        if (event == 'removing' && sig.view)
            sig.view.remove();
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let path = circle_path(origin.x, origin.y, 3);
            sig.view = svgArea.path()
                            .attr({ 'path': path,
                                    'stroke': 'black',
                                    'fill': dev.view.color });
            sig.view.position = new_pos(origin.x, origin.y);
            if (repaint)
                redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    function update_maps(map, event) {
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
                                            'stroke': 'black',
                                            'stroke-opacity': 1,
                                            'fill': 'rgb(104,202,255)',
                                            'fill-opacity': 0});
            redraw();
        }
        else if (event == 'removed')
            redraw();
    }

    $('body').on('keydown.list', function(e) {
        if (e.which == 49) {
            /* 1 */
            switch_view('list');
        }
        else if (e.which == 50) {
            /* 2 */
            switch_view('graph');
        }
        else if (e.which == 51) {
            /* 3 */
            switch_view('canvas');
        }
        else if (e.which == 52) {
            /* 4 */
            switch_view('grid');
        }
        else if (e.which == 53) {
            /* 5 */
            switch_view('hive');
        }
        else if (e.which == 54) {
            /* 6 */
            switch_view('balloon');
        }
    });
}

HivePlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
