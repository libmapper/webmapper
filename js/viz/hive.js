//++++++++++++++++++++++++++++++++++++++//
//              View Class              //
//++++++++++++++++++++++++++++++++++++++//

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
    var first_transition;
    var allow_hover = false;

    function constrain(obj, bounds, border) {
        if (obj.left < (obj.width * 0.5 + border))
            obj.left = obj.width * 0.5 + border;
        else if (obj.left > (bounds.width - obj.width * 0.5 - border))
            obj.left = frame.width - obj.width * 0.5 - border;
        if (obj.top < (obj.height * 0.5 + border))
            obj.top = obj.height * 0.5 + border;
        else if (obj.top > (frame.height - obj.height * 0.5 - border))
            obj.top = frame.height - obj.height * 0.5 - border;
    }

    this.redraw = function(duration) {
        if (redraw)
            redraw(duration);
    };

    function labelwidth(label) {
        return label.length * 5;
    }

    function labeloffset(start, label) {
        return {'x': start.x + label.length * 2.4 + 3,
                'y': start.y - 7 };
    }

    function circle_path(x, y, radius) {
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

    function canvas_rect_path(dim, dir) {
        let path = [['M', dim.left - dim.width * 0.5, dim.top - dim.height * 0.5],
                    ['l', dim.width, 0],
                    ['l', 0, dim.height],
                    ['l', -dim.width, 0],
                    ['z']];
        let offset = (dim.width * 0.5 + 4) * (dir == 'input' ? -1 : 1);
        path.push(circle_path(dim.left + offset, dim.top, 3));
        return path;
    }

    function canvas_bezier(map) {
        let obj1 = map.src.view.canvas_object;
        let obj2 = map.dst.view.canvas_object;
        let offset1 = (obj1.width * 0.5 + 6) * (map.src.direction == 'input' ? -1 : 1);
        let offset2 = (obj2.width * 0.5 + 6) * (map.dst.direction == 'input' ? -1 : 1);
        return [['M', obj1.left + offset1, obj1.top],
                ['C', obj1.left + offset1 * 3, obj1.top,
                      obj2.left + offset2 * 3, obj2.top,
                      obj2.left + offset2, obj2.top]];
    }

    function findSig(name) {
        name = name.split('/');
        if (name.length < 2) {
            console.log("error parsing signal name", name);
            return null;
        }
        let dev = model.devices.find(name[0]);
        if (!dev) {
            console.log("error finding signal: couldn't find device",
                        name[0]);
            return null;
        }
        name = String(name.join('/'));
        return dev.signals.find(name);
    }

    function deselect_all() {
        leftTable.highlight(null, null);
        rightTable.highlight(null, null);
        topTable.highlight(null, null);

        let updated = false;
        model.devices.each(function(dev) {
            if (dev.view.selected) {
                dev.view.animate({'stroke': 'black',
                                  'fill': 'lightgray' }, 50);
                dev.view.selected = false;
                updated = true;
            }
            dev.signals.each(function(sig) {
                if (sig.view.selected) {
                    sig.view.animate({'stroke': 'black',
                                      'fill': dev.view.color }, 50);
                    sig.view.selected = false;
                    updated = true;
                }
            });
        });
        model.maps.each(function(map) {
            if (map.view.selected) {
                map.view.animate({'stroke': 'black',
                                  'fill': 'rgb(104,202,255)' }, 50);
                map.view.selected = false;
                updated = true;
            }
        });
        if (updated)
            $('#container').trigger("updateMapProperties");
    }

    this.switch_view = function(view) {
//        if (view == currentView)
//            return;
        currentView = view;
        first_transition = true;

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
        let left_sh, right_sh, right_st, right_sl;
        let searchHeight = 41;

        switch (view) {
            case 'list':
                left_tw = frame.width * 0.4;
                left_sw = frame.width * 0.4;
                left_th = frame.height;
                right_tw = frame.width * 0.4;
                right_sw = frame.width * 0.4;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                searchHeight = 41;
                break;
            case 'canvas':
                left_tw = frame.width * 0.25;
                left_sw = frame.width;
                left_th = frame.height;
                right_tw = 0;
                right_sw = 0;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                searchHeight = 41;
                break;
            case 'grid':
                left_tw = 200;
                left_sw = 200;
                left_th = frame.height - 200;
                right_tw = 0;
                right_sw = 0;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 200;
                searchHeight = 0;
                break;
            default:
                left_tw = 0;
                left_sw = frame.width * 0.5;
                left_th = frame.height;
                right_tw = 0;
                right_sw = frame.width * 0.5;
                right_th = frame.height;
                top_tw = frame.width - 200;
                top_th = 0;
                searchHeight = 41;
                break;
        }

        if (left_tw != leftTableWidth)
            $('#leftTable').animate({'width': left_tw + 'px'},
                                    {duration: default_speed, step: function(now, fx) {
                                        leftTableWidth = now;
                                        $('#leftSearchDiv').css({'width': now});
                                        $('#svgDiv, #topTable').css({
                                            'width': (frame.width - leftTableWidth
                                                      - rightTableWidth) + 'px',
                                            'left': leftTableWidth + 'px'});
                                    }});
        if (right_tw != rightTableWidth)
            $('#rightTable').animate({'width': right_tw + 'px'},
                                     {duration: default_speed, step: function(now, fx) {
                                        rightTableWidth = now;
                                        $('#rightSearchDiv').css({'width': now});
                                        $('#rightTable, #rightSearchDiv').css({
                                            'left': frame.width - now + 'px'});
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
                                            'top': topTableHeight + searchHeight + 'px'});
                                        let h = topTableHeight;
                                        if (h < 41) h = 41;
                                        $('#leftSearchDiv').css({
                                            'height': h + 'px'});
                                     }});
        $('#leftSearchDiv').animate({'width': left_sw + 'px'},
                                   {duration: default_speed});
        $('#rightSearchDiv').animate({'width': right_sw + 'px'},
                                     {duration: default_speed, step: function(now, fx) {
                                        $('#rightSearchDiv').css({'left': frame.width - now});
                                     }});

        switch (view) {
            case 'hive':
                allow_hover = true;
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

                        dev_index += 1;
                        let sig_index = 1;
                        let sig_num = dev.signals.size();
                        let inc = sig_num ? 1 / sig_num : 1;
                        dev.signals.each(function(sig) {
                            if (!sig.view)
                                return;
                            let x = origin.x + width * inc * sig_index * Math.cos(angle);
                            let y = origin.y + height * inc * sig_index * Math.sin(angle);
                            let path = circle_path(x, y, 10);
                            sig.view.animate({'path': path,
                                              'fill': dev.view.color,
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
                    first_transition = false;
                }
                break;
            case 'grid':
                allow_hover = false;
                leftTable.filter('input', null);
                leftTable.show_detail(false);
                leftTable.border_mode(true);

                topTable.filter('output', null);
                topTable.show_detail(false);
                topTable.border_mode(true);

                cursor.attr({'stroke-opacity': 0,
                             'fill': 'rgb(104,202,255)',
                             'fill-opacity': 0.5,
                             'arrow-end': 'none'}).toBack();

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;

                    leftTable.update(left_th);
                    topTable.update(top_tw);

                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            sig.view.animate({'fill-opacity': 0,
                                              'stroke-opacity': 0}, speed, 'linear');
                        });
                        let pos = leftTable.rowPos(dev.name);
                        if (pos) {
                            pos.width = frame.width;
                        }
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
                        map.view.click(function(e) {
                            if (select_obj(map))
                                $('#container').trigger("updateMapProperties");
                        });
                        let path, curve = false;
                        src = topTable.rowPos(map.src.key);
                        dst = leftTable.rowPos(map.dst.key);
                        if (src) {
                            if (dst) {
                                path = [['M', src.left + src.width, dst.top],
                                        ['L', src.left, dst.cy],
                                        ['L', src.left + src.width, dst.top + dst.height],
                                        ['Z']];
                            }
                            else {
                                dst = topTable.rowPos(map.dst.key);
                                if (!dst)
                                    return
                                // both endpoints are 'output' signals
                                path = smooth_path(src.cx, 0, dst.cx, 0);
                                curve = true;
                            }
                        }
                        else if (dst) {
                            src = leftTable.rowPos(map.src.key);
                            if (!src)
                                return
                            // both enpoints are 'input' signals
                            path = smooth_path(0, src.cy, 0, dst.cy);
                            curve = true;
                        }
                        else {
                            // could be 'reversed' map
                            src = leftTable.rowPos(map.src.key);
                            dst = topTable.rowPos(map.dst.key);
                            if (!src || !dst)
                                return;
                            path = [['M', dst.left, src.top + src.height],
                                    ['L', dst.cx, src.top],
                                    ['L', dst.left + dst.width, src.top + src.height],
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
                            if (map.view.new)
                                map.view.attr({'path': (src.cx > dst.cx)
                                              ? [['M', src.left + src.width, dst.top],
                                                 ['L', src.left + src.width, dst.cy],
                                                 ['L', src.left + src.width, dst.top + dst.height],
                                                 ['Z']]
                                              : [['M', dst.left, src.top + src.height],
                                                 ['L', dst.cx, src.top + src.height],
                                                 ['L', dst.left + dst.width, src.top + src.height],
                                                 ['Z']]});
                            map.view.animate({'path': path,
                                              'fill-opacity': 1,
                                              'stroke-opacity': 0}, speed, 'linear');
                        }
                    });
                    first_transition = false;
                }
                let tableFrom = null;
                let tableTo = null;
                let src, dst;
                $('.tableDiv').on('mousedown', 'tr', function(e) {
                    var sourceRow = this;
                    var table = null;
                    if ($(sourceRow).parents('.tableDiv').attr('id') == "leftTable") {
                        tableFrom = 'left';
                    }
                    else if ($(sourceRow).parents('.tableDiv').attr('id') == "topTable") {
                        tableFrom = 'top';
                    }
                    $(document).one('mouseup.drawing', function(e) {
                        $(document).off('.drawing');
                        cursor.attr({'fill': 'rgb(104,202,255)'});
                        $('#container').trigger('map', [src, dst]);
                        tableFrom = tableTo = null;
                    });
                });
                $('#svgDiv').on('mouseenter', function(e) {
                    $('#svgDiv').on('mousemove', function(e) {
                        let h = null, v = null;
                        h = leftTable.highlight(e.clientX, e.clientY);
                        v = topTable.highlight(e.clientX, e.clientY);
                        if (h == null || v == null) {
                            cursor.attr({'fill-opacity': 0});
                            tableTo = null;
                            return;
                        }
                        if (tableFrom != null) {
                            src = (tableFrom == 'left') ? h.id : v.id;
                            dst = (tableFrom == 'left') ? v.id : h.id;
                            tableTo = (tableFrom == 'left') ? 'top' : 'left';
                            cursor.attr({'fill': 'red'});
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
                        cursor.attr({'fill-opacity': 0});
                    });
                });
                cleanup = function() {
                    // remove mousehandlers
                    $('#svgDiv').off('mouseenter');
                    $('#svgDiv').off('mousemove');
                    $('#svgDiv').off('mouseleave');
                    $('.tableDiv').off('mousedown');
                    cursor.attr({'fill-opacity': 0});
                    model.maps.each(function(map) {
                        if (map.view)
                            map.view.unclick();
                    });
                }
                break;
            case 'list':
                allow_hover = false;
                /* to do
                 * sorting (move to top bar)
                 * searching (move to top bar)
                 */
                leftTable.filter('output', null);
                leftTable.show_detail(true);

                rightTable.filter('input', null);
                rightTable.show_detail(true);

                cursor.attr({'stroke-opacity': 0,
                             'fill-opacity': 0,
                             'arrow-end': 'none'}).toBack();

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;

                    leftTable.update(left_th);
                    rightTable.update(right_th);

                    let svg_tw = frame.width - left_tw - right_tw;
                    let svg_tc = svg_tw * 0.5;
                    if (first_transition) {
                        model.devices.each(function(dev) {
                            if (!dev.view)
                                return;
                            dev.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                            dev.signals.each(function(sig) {
                                let s;
                                if (sig.direction == 'output') {
                                    s = leftTable.rowPos(sig.key);
                                    if (!s)
                                        return;
                                    s.left = left_tw * -0.5;
                                }
                                else {
                                    s = rightTable.rowPos(sig.key);
                                    if (!s)
                                        return;
                                    s.left = frame.width - left_tw - right_tw;
                                }
                                sig.view.animate({'path': rect_path(s),
                                                  'fill-opacity': 1,
                                                  'fill': s.even ? '#EDF5FF' : 'white',
                                                  'stroke-opacity': 0}, speed, 'linear',
                                    function() {
                                        sig.view.attr({'fill-opacity': 0});
                                });
                            });
                        });
                    }
                    let invisible = false;
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;

                        let src, dst;
                        if (map.src.direction == 'output')
                            src = leftTable.rowPos(map.src.key);
                        else
                            src = rightTable.rowPos(map.src.key);
                        if (map.dst.direction == 'output')
                            dst = leftTable.rowPos(map.dst.key);
                        else
                            dst = rightTable.rowPos(map.dst.key);
                        if (!src || !dst)
                            return;

                        src.left = map.src.direction == 'output' ? 0 : svg_tw;
                        dst.left = map.dst.direction == 'output' ? 0 : svg_tw;
                        src.center = src.top + src.height * 0.5;
                        dst.center = dst.top + dst.height * 0.5;
                        let v_center = (src.center + dst.center) * 0.5;
                        let h_center = svg_tc;
                        let h_quarter = (svg_tc + src.left) * 0.5;

                        let y3 = src.center * 0.9 + v_center * 0.1;
                        let y4 = dst.center * 0.9 + v_center * 0.1;

                        if (src.left == dst.left) {
                            let mult = Math.abs(src.center - dst.center) * 0.25 + 35;
                            h_center = src.left < h_center ? mult : svg_tw - mult;
                        }

                        let path = [['M', src.left, src.center],
                                    ['C', h_center, y3, h_center, y4,
                                     dst.left, dst.center]];
                        let opacity = invisible ? 0 : map.status == "staged" ? 0.5 : 1.0;

                        if (map.view.new) {
                            let path_start = [['M', src.left, src.center],
                                              ['C', src.left, src.center, src.left,
                                               src.center, src.left, src.center]];
                            let path_mid = [['M', src.left, src.center],
                                            ['C', h_quarter, src.center,
                                             h_center, v_center, h_center, v_center]];
                            map.view.attr({'path': path_start,
                                           'stroke-dasharray': map.muted ? '--' : '',
                                           'arrow-end': 'block-wide-long'});
                            map.view.animate({'path': path_mid,
                                              'stroke-opacity': opacity}, speed * 0.5, 'linear',
                                             function() {
                                map.view.animate({'path': path}, speed * 0.5, 'linear');
                            });
                            map.view.new = false;
                        }
                        else {
                            map.view.animate({'path': path,
                                              'stroke-opacity': opacity,
                                              'fill-opacity': '0'}, speed, 'linear', function() {
                                map.view.attr({'arrow-end': 'block-wide-long',
                                               'stroke-dasharray': map.muted ? '--' : '' });
                            });
                        }
                    });
                    first_transition = false;
                }
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
                        deselect_all();
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
                                $('#container').trigger('map', [sourceRow.id, dst]);
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
                        dev.signals.each(function(sig) {
                            let s;
                            if (sig.direction == 'output') {
                                s = leftTable.rowPos(sig.key);
                                if (!s)
                                    return;
                                s.left = -left_tw;
                            }
                            else {
                                s = rightTable.rowPos(sig.key);
                                if (!s)
                                    return;
                                s.left = frame.width - left_tw - right_tw;
                            }
                            let color = s.even ? '#EDF5FF' : 'white';
                            sig.view.attr({'path': rect_path(s),
                                           'fill-opacity': 1,
                                           'fill': s.even ? '#EDF5FF' : 'white'});
                        });
                    });
                }
                break;
            case 'canvas':
                allow_hover = false;
                leftTable.filter(null, null);
                leftTable.show_detail(true);

                cursor.attr({'arrow-end': 'none'});

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;

                    leftTable.update(left_th);

                    // hide devices and signals
                    model.devices.each(function(dev) {
                        if (!dev.view)
                            return;
                        if (first_transition) {
                            dev.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                        }

                        dev.signals.each(function(sig) {
                            if (!sig.view)
                                return;
                            if (!sig.view.canvas_object) {
                                sig.view.animate({'stroke-opacity': 0,
                                                  'fill-opacity': 0}, speed, 'linear');
                                return;
                            }
                            let path = canvas_rect_path(sig.view.canvas_object,
                                                        sig.direction);

                            let attrs = {'path': path,
                                         'stroke': 'black',
                                         'stroke-opacity': 1,
                                         'fill': 'white',
                                         'fill-opacity': 1};
                            if (first_transition) {
                                sig.view.animate(attrs, speed, 'linear');
                                sig.view.label.animate({'x': sig.view.canvas_object.left,
                                                        'y': sig.view.canvas_object.top,
                                                        'opacity': 1},
                                                       speed, 'linear');
                            }
                            else {
                                sig.view.attr(attrs);
                                sig.view.label.attr({'x': sig.view.canvas_object.left,
                                                     'y': sig.view.canvas_object.top,
                                                     'opacity': 1},
                                                    speed, 'linear');
                            }
                            if (first_transition) {
                                sig.view.drag(function(dx, dy, x, y, event) {
                                    x -= (frame.left + left_tw);
                                    y -= frame.top;
                                    let obj = sig.view.canvas_object
                                    obj.left = x;
                                    obj.top = y;
                                    constrain(obj, frame, 5);
                                    sig.view.attr({'path': canvas_rect_path(obj,
                                                                            sig.direction)});
                                    sig.view.label.attr({'x': obj.left, 'y': obj.top});
                                    redraw(0);
                                });
                            }
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        if (   !map.src.view.canvas_object
                            || !map.dst.view.canvas_object) {
                            map.view.attr({'arrow-end': 'none'});
                            map.view.animate({'path': [['M', frame.cx, frame.cy],
                                                       ['l', 0, 0]],
                                              'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                            return;
                        }
                        if (!map.view.canvas_object) {
                            let pos = map.src.view.canvas_object;
                            let x = (pos.left + (pos.width * 0.5 + 6)
                                     * (map.src.direction == 'input' ? -1 : 1));
                            let y = pos.top + pos.height * 0.5;
                            map.view.attr({'path': [['M', x, y], ['l', 0, 0]]});
                            map.view.canvas_object = true;
                        }
                        let path = canvas_bezier(map);
                        map.view.attr({'arrow-end': 'block-wide-long'});
                        map.view.animate({'path': path,
                                          'stroke-opacity': 1,
                                          'fill-opacity': 0}, speed, 'linear');
                    });
                    first_transition = false;
                }
                $('.tableDiv').on('mousedown', 'tr', function(e) {
                    var id = this.id;
                    if (id.indexOf('/') == -1)
                        return;
                    var sig = findSig(id);
                    if (!sig || sig.view.canvas_object)
                        return;
                    var x, y, width = labelwidth(id);

                    $('svg').one('mouseenter.drawing', function() {
                        // TODO: deselect all objects
                        var cursorLabel = svgArea.text(0, 0, id);

                        $('svg').on('mousemove.drawing', function(e) {
                            x = e.pageX - frame.left - left_tw;
                            y = e.pageY - frame.top - top_th;
                            let temp = {'left': x, 'top': y,
                                        'width': width, 'height': 20 };
                            constrain(temp, frame, 5);

                            let path = canvas_rect_path(temp, sig.direction);
                            cursor.attr({'path': path, 'stroke-opacity': 1});
                            cursorLabel.attr({'x': temp.left, 'y': temp.top,
                                              'fontweight': '12pt'});
                        });
                        $(document).on('mouseup.drawing', function(e) {
                            $(document).off('.drawing');
                            $('svg, .displayTable tbody tr').off('.drawing');
                            cursor.attr({'stroke-opacity': 0});
                            if (cursorLabel)
                                cursorLabel.remove();

                            // add object to canvas
                            sig.view.canvas_object = {'left': x, 'top': y,
                                                      'width': width,
                                                      'height': 20};
                            sig.view.attr({'path': canvas_rect_path(sig.view.canvas_object,
                                                                    sig.direction)});
                            sig.view.drag(function(dx, dy, x, y, event) {
                                x -= (frame.left + left_tw);
                                y -= frame.top;
                                let obj = sig.view.canvas_object
                                obj.left = x;
                                obj.top = y;
                                constrain(obj, frame, 5);
                                sig.view.attr({'path': canvas_rect_path(obj,
                                                                        sig.direction)});
                                sig.view.label.attr({'x': obj.left, 'y': obj.top});
                                redraw(0);
                            });
                            redraw();
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
                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            if (sig.view)
                                sig.view.undrag();
                        });
                    });
                }

                break;
            case 'graph':
                allow_hover = true;
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
                                              'fill': dev.view.color,
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
                    first_transition = false;
                }
                break;
            case 'balloon':
                allow_hover = false;
                let outline;
                if (first_transition)
                    outline = outline = svgArea.path().toBack()
                        .attr({'path': circle_path(frame.cx, frame.cy, 1),
                               'stroke-opacity': 0,
                               'fill': 'lightgray',
                               'fill-opacity': 0});
                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
                    let path = circle_path(frame.left + frame.width * 0.33,
                                           frame.top + frame.height * 0.5,
                                           frame.height * 0.4);
                    outline.animate({'path': path,
                                     'fill-opacity': 1}, speed, 'linear');
                }
                cleanup = function() {
                    if (outline) {
                        outline.remove();
                        outline = null;
                    }
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

    function add_title_bars() {
        $('#container').append("<div id='leftSearchDiv'>"+
                                   "<h2 id='leftTitle' class='searchBar'>Sources</h2>"+
                                   "<input type='text' id='leftSearch' class='searchBar'></input>"+
                               "</div>");
        $('#container').append("<div id='rightSearchDiv'>"+
                               "<h2 id='rightTitle' class='searchBar'>Destinations</h2>"+
                               "<input type='text' id='rightSearch' class='searchBar'></input>"+
                               "</div>");
        $('#container').append("<div id='animator' class='hidden'>");
//        var $titleSearchDiv = $('<div id="titleSearchDiv"></div>');
    }

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
        add_title_bars();
        add_display_tables();
        add_svg_area();
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 86px)'
        });

        cursor = svgArea.path();
        this.switch_view('list');

        selection_handlers();

        add_model_callbacks();
        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function update_devices(dev, event) {
        if (event == 'removing' && dev.view) {
//            dev.signals.each(function(sig) { sig.view.remove(); });
            dev.view.remove();
            return;
        }
        else if (event == 'added' && !dev.view) {
            let color = Raphael.getColor();
            dev.view = svgArea.path()
                            .attr({'path': [['M', origin.x, origin.y], ['L',10, 0]],
                                   'stroke': color,
                                   'fill': 'lightgray',
                                   'stroke-opacity': 0,
                                   'fill-opacity': 0});
            dev.view.color = color;
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
        if (event == 'removing' && sig.view) {
            sig.view.label.remove();
            sig.view.remove();
        }
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let path = circle_path(origin.x, origin.y, 3);
            sig.view = svgArea.path()
                            .attr({ 'path': path,
                                    'stroke': 'black',
                                    'fill': dev.view.color,
                                    'stroke-opacity': 0,
                                    'fill-opacity': 0 });
            sig.view.position = new_pos(origin.x, origin.y);
            sig.view.label = svgArea.text(origin.x, origin.y, sig.key)
                            .attr({'opacity': 0});;
            sig.view.hover(function() {
                    if (!allow_hover)
                        return;
                    let pos = labeloffset(sig.view.position, sig.key);
                    sig.view.label.attr({'x': pos.x,
                                         'y': pos.y,
                                         'opacity': 1,
                                         'font-size': 18}).toFront();
                },
                function() {
                    if (!allow_hover)
                        return;
                    sig.view.label.attr({'opacity': 0});
            });
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
            map.view = svgArea.path().attr({'stroke': 'black',
                                            'fill': 'rgb(104,202,255)',
                                            'stroke-opacity': 0,
                                            'fill-opacity': 0});
            map.view.data('mapperObj', map);
            map.view.new = true;
            redraw();
            map.view.new = false;
        }
        else if (event == 'removed')
            redraw();
    }

    $('body').on('keydown.list', function(e) {
        if (e.which == 8 || e.which == 46) {
            /* delete */
            model.maps.each(function(map) {
                if (map.view && map.view.selected)
                    $('#container').trigger('unmap', [map.src.key, map.dst.key]);
            });
        }
    });

    function select_obj(obj) {
        if (obj.view.selected)
            return false;
        obj.view.selected = true;
        obj.view.animate({'stroke': 'red', 'fill': 'red'}, 50);
        return true;
    }

    function selection_handlers() {
        $('svg').on('mousedown', function(e) {
            if (e.shiftKey == false) {
                deselect_all();
            }

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            let updated = false;
            model.maps.each(function(map) {
                if (map.view.selected)
                    return;
                if (   edge_intersection(map.view, x1-3, y1-3, x1+3, y1+3)
                    || edge_intersection(map.view, x1-3, y1+3, x1+3, y1-3)) {
                    updated = select_obj(map);
                }
            });
            if (updated)
                $('#container').trigger("updateMapProperties");

            let stop = false;
            // Moving about the canvas
            $('svg').on('mousemove.drawing', function(moveEvent) {
                if (stop == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                update = false;
                model.maps.each(function(map) {
                    if (map.view.selected)
                        return;
                    if (   edge_intersection(map.view, x1-3, y1-3, x1+3, y1+3)
                        || edge_intersection(map.view, x1-3, y1+3, x1+3, y1-3)) {
                        updated |= select_obj(map);
                    }
                });

                e.stopPropagation();

                if (updated)
                    $('#container').trigger("updateMapProperties");

                x1 = x2;
                y1 = y2;
            });
            $('svg').one('mouseup.drawing', function(mouseUpEvent) {
                stop = true;
            });
        });
    }
}

HivePlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {

    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
