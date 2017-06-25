//++++++++++++++++++++++++++++++++++++++//
//              View Class              //
//++++++++++++++++++++++++++++++++++++++//

function HivePlotView(container, model)
{
    var _self = this;
    var container_frame = null;
    this.svgArea = null;
    var svg_frame = null;
    var width = null;
    var height = null;
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

    var svgzoom = 1;
    var svgposx = 0;
    var svgposy = 0;

    var srcregexp = null;
    var dstregexp = null;
    var mapfill = 'rgb(104,202,255)';

    function constrain(obj, bounds, border) {
        if (obj.left < (bounds.left + obj.width * 0.5 + border))
            obj.left = bounds.left + obj.width * 0.5 + border;
        else if (obj.left > (bounds.left + bounds.width - obj.width * 0.5 - border))
            obj.left = bounds.left + bounds.width - obj.width * 0.5 - border;
        if (obj.top < (bounds.top + obj.height * 0.5 + border))
            obj.top = obj.height * 0.5 + border;
        else if (obj.top > (bounds.top + bounds.height - obj.height * 0.5 - border))
            obj.top = bounds.top + bounds.height - obj.height * 0.5 - border;
    }

    this.redraw = function(duration, update_tables) {
        if (redraw)
            redraw(duration, update_tables);
    };

    function labelwidth(label) {
        return label.length * 8;
    }

    function labeloffset(start, label) {
        return {'x': start.x + label.length * 4 + 3,
                'y': start.y - 10 };
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

    function self_path(x1, y1, x2, y2) {
        let mp = [(x1 + x2) * 0.5, (y1 + y2) * 0.5]
        if (x1 == x2) {
            let d = Math.abs(y1 - y2);
            let thresh = container_frame.width * 0.5;
            if (d > thresh)
                d = thresh;
            mp[0] += (x1 > thresh) ? -d : d;
            return [['M', x1, y1],
                    ['C', mp[0], y1, mp[0], y2, x2, y2]];
        }
        if (y1 == y2) {
            let d = Math.abs(x1 - x2);
            let thresh = container_frame.height * 0.5;
            if (d > thresh)
                d = thresh;
            mp[1] += (y1 > thresh) ? -d : d;
            return [['M', x1, y1],
                    ['C', x1, mp[1], x2, mp[1], x2, y2]];
        }
        return [['M', x1, y1],
                ['S', mp[0], mp[1], x2, y2]];
    }

    function canvas_rect_path(dim, dir) {
        let path = [['M', dim.left - dim.width * 0.5, dim.top],
                    ['l', dim.width, 0]];
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

    function select_all() {
        // TODO: check if map is visible
        let updated = false;
        model.maps.each(function(map) {
            if (!map.view || map.view.selected)
                return;
            if (map.view.attr('stroke-opacity') > 0) {
                map.view.animate({'stroke': 'red'}, 50);
                map.view.selected = true;
                updated = true;
            }
            if (map.view.attr('fill-opacity') > 0) {
                map.view.animate({'fill': 'red'}, 50);
                map.view.selected = true;
                updated = true;
            }
        });
        if (updated)
            $('#container').trigger("updateMapProperties");
    }

    function deselect_all() {
        leftTable.highlight_row(null, true);
        rightTable.highlight_row(null, true);
        topTable.highlight_row(null, true);

        let updated = false;
        model.devices.each(function(dev) {
            if (dev.view.selected) {
                dev.view.animate({'stroke': 'white',
                                  'fill': 'lightgray' }, 50);
                dev.view.selected = false;
                updated = true;
            }
            dev.signals.each(function(sig) {
                if (sig.view.selected) {
                    sig.view.animate({'stroke': 'white',
                                      'fill': dev.view.color }, 50);
                    sig.view.selected = false;
                    updated = true;
                }
            });
        });
        model.maps.each(function(map) {
            if (map.view.selected) {
                map.view.animate({'stroke': 'white',
                                  'fill': mapfill }, 50);
                map.view.selected = false;
                updated = true;
            }
        });
        if (updated)
            $('#container').trigger("updateMapProperties");
    }

    function set_cursor_attributes(view) {
        switch (view) {
            case 'grid':
                cursor.attr({'fill': mapfill,
                             'fill-opacity': 1,
                             'stroke-opacity': 0,
                             'arrow-end': 'none',
                             'stroke-width': 2 });
                break;
            case 'none':
                cursor.attr({'fill-opacity': 0,
                             'stroke-opacity': 0,
                             'arrow-end': 'none',
                             'stroke-width': 2 });
                break;
            case 'canvas':
                cursor.attr({'fill': 'white',
                             'fill-opacity': 1,
                             'stroke-opacity': 1,
                             'arrow-end': 'none',
                             'stroke-width': 20 });
                break;
            default:
                cursor.attr({'fill-opacity': 0,
                             'stroke': 'white',
                             'stroke-opacity': 1,
                             'arrow-end': 'block-wide-long',
                             'stroke-width': 2 });
                break;
        }
    }

    this.switch_view = function(view) {
        if (view == currentView)
            return;
        if (view)
            currentView = view;
        else
            view = currentView;

        // call view cleanup
        if (cleanup) {
            cleanup();
            cleanup = null;
        }

        first_transition = true;

        // stop current animations
        $('#leftTable').stop(true, false);
        $('#rightTable').stop(true, false);
        $('#topTable').stop(true, false);

        let left_tw, left_th, right_tw, right_th, top_tw, top_th;

        switch (view) {
            case 'list':
                left_tw = container_frame.width * 0.4;
                left_th = container_frame.height;
                right_tw = container_frame.width * 0.4;
                right_th = container_frame.height;
                top_tw = container_frame.width - left_tw - right_tw;
                top_th = 0;
                svg_frame.left = left_tw;
                svg_frame.top = 0;
                svg_frame.height = container_frame.height;
                svg_frame.width = container_frame.width - left_tw - right_tw;
                svg_frame.cx = svg_frame.left + svg_frame.width * 0.5;
                svg_frame.cy = svg_frame.top + svg_frame.height * 0.5;
                break;
            case 'canvas':
                left_tw = container_frame.width * 0.25;
                left_th = container_frame.height;
                right_tw = 0;
                right_th = container_frame.height;
                top_tw = container_frame.width - left_tw - right_tw;
                top_th = 0;
                svg_frame.left = left_tw;
                svg_frame.top = 0;
                svg_frame.height = container_frame.height;
                svg_frame.width = container_frame.width - left_tw;
                svg_frame.cx = svg_frame.left + svg_frame.width * 0.5;
                svg_frame.cy = svg_frame.top + svg_frame.height * 0.5;
                break;
            case 'grid':
                left_tw = 200;
                left_th = container_frame.height - 200;
                right_tw = 0;
                right_th = container_frame.height - 200;
                top_tw = container_frame.width - 180;
                top_th = 200;
                svg_frame.left = left_tw;
                svg_frame.top = top_th;
                svg_frame.height = container_frame.height - top_th;
                svg_frame.width = container_frame.width - left_tw;
                svg_frame.cx = svg_frame.left + svg_frame.width * 0.5;
                svg_frame.cy = svg_frame.top + svg_frame.height * 0.5;
                break;
            default:
                left_tw = 0;
                left_th = container_frame.height;
                right_tw = 0;
                right_th = container_frame.height;
                top_tw = container_frame.width - left_tw - right_tw;
                top_th = 0;
                svg_frame.left = 0;
                svg_frame.top = 0;
                svg_frame.width = container_frame.width;
                svg_frame.height = container_frame.height;
                svg_frame.cx = svg_frame.left + svg_frame.width * 0.5;
                svg_frame.cy = svg_frame.top + svg_frame.height * 0.5;
                break;
        }

        svgzoom = 1;
        svgArea.setViewBox(0, 0,
                           container_frame.width * svgzoom,
                           container_frame.height * svgzoom, false);

        svg_offset = function(rect) {
            rect.left += left_tw;
            rect.cx += left_tw;
            rect.top += top_th - 20;
            rect.cy += top_th - 20;
        }

        animate_leftTable = function() {
            $('#leftTable').animate({'width': left_tw + 'px'},
                                    {duration: default_speed * 0.33,
                                     step: function(now, fx) {
                                        leftTableWidth = now;
                                        $('#topTable').css({
                                            'width': (container_frame.width - leftTableWidth
                                                      - rightTableWidth + 20) + 'px',
                                            'left': leftTableWidth - 20 + 'px'});
                                     },
                                     complete: animate_rightTable
                                    });
        }

        animate_rightTable = function() {
            $('#rightTable').animate({'width': right_tw + 'px'},
                                     {duration: default_speed * 0.33,
                                     step: function(now, fx) {
                                        rightTableWidth = now;
                                        $('#rightTable').css({'left': container_frame.width - now});
                                        $('#topTable').css({
                                            'width': (container_frame.width - leftTableWidth
                                                      - rightTableWidth) + 20 + 'px'});
                                     }});
        }

        arrange_tables = function() {
            $('#topTable').animate({'height': top_th + 'px'},
                                   {duration: default_speed * 0.33,
                                    step: function(now, fx) {
                                        topTableHeight = now;
                                        $('#leftTable, #rightTable').css({
                                            'height': (container_frame.height
                                                       - topTableHeight / 200 * 180) + 'px',
                                            'top': topTableHeight / 200 * 180 + 'px'});
                                    },
                                    complete: animate_leftTable
                                   });
        }

        switch (view) {
            case 'hive':
                redraw = function(speed) {
                    let origin = {'x': 50,
                                  'y': svg_frame.height - 50};
                    let width = svg_frame.width - 100;
                    let height = svg_frame.height - 100;
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
                        dev.view.stop().animate({'path': path,
                                                 'stroke-opacity': 1,
                                                 'fill-opacity': 0}, speed, 'linear');

                        dev_index += 1;
                        let sig_index = 0;
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
                        let inc = vis_sigs ? 1 / vis_sigs : 1;
                        dev.signals.each(function(sig) {
                            if (!sig.view)
                                return;
                            if (srcregexp && sig.direction == 'output') {
                                if (!srcregexp.test(sig.key)) {
                                    sig.view.attr({'fill-opacity': 0,
                                                   'stroke-opacity': 0});
                                    return;
                                }
                            }
                            else if (dstregexp && !dstregexp.test(sig.key)) {
                                sig.view.attr({'fill-opacity': 0,
                                               'stroke-opacity': 0});
                                return;
                            }
                            sig_index += 1;
                            let x = origin.x + width * inc * sig_index * Math.cos(angle);
                            let y = origin.y + height * inc * sig_index * Math.sin(angle);
                            let path = circle_path(x, y, 10);
                            sig.view.stop().animate({'path': path,
                                                     'fill': dev.view.color,
                                                     'fill-opacity': 1,
                                                     'stroke-width': 1,
                                                     'stroke-opacity': sig.direction == 'output' ? 1 : 0}, speed);
                            sig.view.position = new_pos(x, y);
                            sig.view.label.animate({'x': x, 'y': y, 'opacity': 0}, speed);
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
                        let len = Raphael.getTotalLength(path);
                        path = Raphael.getSubpath(path, 10, len - 10);
                        map.view.animate({'path': path,
                                          'fill-opacity': '0',
                                          'stroke-opacity': 1},
                                         speed, 'linear', function() {
                            map.view.attr({'arrow-end': 'block-wide-long'}).toFront();
                        });
                    });
                    first_transition = false;
                }
                break;
            case 'grid':
                leftTable.filter('input', null);
                leftTable.show_detail(false);
                topTable.filter('output', null);
                topTable.show_detail(false);

                redraw = function(speed, update_tables) {
                    if (speed == null)
                        speed = default_speed;

                    if (update_tables) {
                        leftTable.update(left_th);
                        topTable.update(top_tw);
                    }

                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            sig.view.animate({'fill-opacity': 0,
                                              'stroke-opacity': 0}, speed, 'linear');
                            sig.view.label.animate({'opacity': 0}, speed);
                        });
                        let path = [];
                        let pos = leftTable.row_from_name(dev.name);
                        if (pos) {
                            pos.left = left_tw;
                            pos.top += top_th - 20;
                            pos.width = top_tw;
                            path.push(rect_path(pos));
                        }
                        pos = topTable.row_from_name(dev.name);
                        if (pos) {
                            pos.left += left_tw;
                            pos.top = top_th;
                            pos.height = left_th;
                            path.push(rect_path(pos));
                        }
                        if (!path.length)
                            return;
                        dev.view.toBack();
                        dev.view.animate({'path': path,
                                          'fill-opacity': 0.5,
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
                        src = topTable.row_from_name(map.src.key);
                        dst = leftTable.row_from_name(map.dst.key);
                        if (src) {
                            svg_offset(src);
                            if (dst) {
                                svg_offset(dst);
                                path = [['M', src.left + src.width, dst.top],
                                        ['L', src.left, dst.cy],
                                        ['L', src.left + src.width, dst.top + dst.height],
                                        ['Z']];
                            }
                            else {
                                dst = topTable.row_from_name(map.dst.key);
                                if (!dst)
                                    return
                                svg_offset(dst);
                                // both endpoints are 'input' signals
                                path = self_path(src.cx, top_th, dst.cx, top_th);
                                curve = true;
                            }
                        }
                        else if (dst) {
                            svg_offset(dst);
                            src = leftTable.row_from_name(map.src.key);
                            if (!src)
                                return
                            svg_offset(src);
                            // both endpoints are 'output' signals
                            path = self_path(left_tw, src.cy, left_tw, dst.cy);
                            curve = true;
                        }
                        else {
                            // could be 'reversed' map
                            src = leftTable.row_from_name(map.src.key);
                            dst = topTable.row_from_name(map.dst.key);
                            if (!src || !dst)
                                return;
                            svg_offset(src);
                            svg_offset(dst);
                            path = [['M', dst.left, src.top + src.height],
                                    ['L', dst.cx, src.top],
                                    ['L', dst.left + dst.width, src.top + src.height],
                                    ['Z']];
                        }

                        if (curve) {
                            map.view.attr({'arrow-end': 'block-wide-long'});
                            if (map.view.new) {
                                map.view.attr({'path': self_path(src.cx, src.cy, src.cx, src.cy),
                                               'fill-opacity': 0,
                                               'stroke': map.view.selected ? 'red' : 'white',
                                               'stroke-opacity': 1});
                                let len = Raphael.getTotalLength(path);
                                let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                                map.view.animate({'path': path_mid}, speed * 0.5, 'linear',
                                                 function() {
                                    map.view.animate({'path': path}, speed * 0.5, 'linear');
                                }).toFront();
                            }
                            else {
                                map.view.animate({'path': path,
                                                  'fill-opacity': 0,
                                                  'stroke': 'white',
                                                  'stroke-opacity': 1}, speed, 'linear').toFront();
                            }
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
                                              'fill': map.view.selected ? 'red' : mapfill,
                                              'stroke-opacity': 0}, speed, 'linear');
                        }
                    });
                    first_transition = false;
                }
                cleanup = function() {
                    model.maps.each(function(map) {
                        if (map.view)
                            map.view.unclick();
                    });
                }
                break;
            case 'list':
                /* to do
                 * sorting (move to top bar)
                 * searching (move to top bar)
                 */
                leftTable.filter('output', null);
                leftTable.show_detail(true);

                rightTable.filter('input', null);
                rightTable.show_detail(true);

                get_sig_pos = function(sig, offset) {
                    let s;
                    if (sig.direction == 'output') {
                        s = leftTable.row_from_name(sig.key);
                        if (!s)
                            return null;
                        s.left = offset ? left_tw : 0;
                        s.width = left_tw;
                    }
                    else {
                        s = rightTable.row_from_name(sig.key);
                        if (!s)
                            return null;
                        s.left = left_tw + svg_frame.width;
                        s.width = right_tw;
                    }
                    return s;
                }

                redraw = function(speed, update_tables) {
                    if (speed == null)
                        speed = default_speed;

                    if (update_tables) {
                        leftTable.update(left_th);
                        rightTable.update(right_th);
                    }

                    if (first_transition) {
                        model.devices.each(function(dev) {
                            if (!dev.view)
                                return;
                            dev.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                            dev.signals.each(function(sig) {
                                sig.view.animate({'fill-opacity': 0,
                                                  'stroke-opacity': 0}, speed, 'linear');
                                sig.view.label.animate({'opacity': 0}, speed);
                            });
                        });
                        model.maps.each(function(map) {
                            if (!map.view)
                                return;
                            let src = get_sig_pos(map.src, false);
                            let dst = get_sig_pos(map.dst, false);
                            if (!src || !dst)
                                return;
                            map.src.view.stop().animate({'path': rect_path(src),
                                                         'fill-opacity': 0,
                                                         'stroke-opacity': 0},
                                                         speed, 'linear');
                            map.dst.view.stop().animate({'path': rect_path(dst),
                                                         'fill-opacity': 0,
                                                         'stroke-opacity': 0},
                                                         speed, 'linear');
                        });
                    }
                    let invisible = false;
                    model.maps.each(function(map) {
                        if (!map.view)
                            return;
                        let src = get_sig_pos(map.src, true);
                        let dst = get_sig_pos(map.dst, true);
                        if (!src || !dst)
                            return;

                        let v_center = (src.cy + dst.cy) * 0.5;
                        let h_center = left_tw + svg_frame.width * 0.5;
                        let h_quarter = (h_center + src.left) * 0.5;

                        let y3 = src.cy * 0.9 + v_center * 0.1;
                        let y4 = dst.cy * 0.9 + v_center * 0.1;

                        if (src.left == dst.left) {
                            let mult = Math.abs(src.cy - dst.cy) * 0.25 + 35;
                            h_center = src.left < h_center ? left_tw + mult : left_tw + svg_frame.width - mult;
                        }

                        let path = [['M', src.left, src.cy],
                                    ['C', h_center, y3, h_center, y4,
                                     dst.left, dst.cy]];
                        let opacity = invisible ? 0 : map.status == "staged" ? 0.5 : 1.0;

                        if (map.view.new) {
                            map.view.attr({'path': [['M', src.left, src.cy],
                                                    ['C', src.left, src.cy, src.left,
                                                     src.cy, src.left, src.cy]],
                                           'stroke-dasharray': map.muted ? '--' : '',
                                           'arrow-end': 'block-wide-long',
                                           'stroke': map.view.selected ? 'red' : 'white'});
                            let len = Raphael.getTotalLength(path);
                            let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                            map.view.stop().animate({'path': path_mid,
                                                     'stroke-opacity': opacity},
                                                    speed * 0.5, 'linear', function() {
                                map.view.animate({'path': path}, speed * 0.5, 'linear');
                            });
                            map.view.new = false;
                        }
                        else {
                            map.view.stop().animate({'path': path,
                                                     'stroke-opacity': opacity,
                                                     'fill-opacity': '0',
                                                     'stroke': map.view.selected ? 'red' : 'white'},
                                                    speed, 'linear', function() {
                                map.view.attr({'arrow-end': 'block-wide-long',
                                               'stroke-dasharray': map.muted ? '--' : '' });
                            });
                        }
                    });
                    first_transition = false;
                }
                cleanup = function() {
                    // for animations, place signal and device objects under tables
                    model.devices.each(function(dev) {
                        let d = (   leftTable.row_from_name(dev.name)
                                 || rightTable.row_from_name(dev.name))
                        if (!d)
                            return;
                        dev.view.attr({'path': rect_path(d),
                                       'fill-opacity': 1});
                        dev.signals.each(function(sig) {
                            let s;
                            if (sig.direction == 'output') {
                                s = leftTable.row_from_name(sig.key);
                                if (!s)
                                    return;
                            }
                            else {
                                s = rightTable.row_from_name(sig.key);
                                if (!s)
                                    return;
                                s.left = container_frame.width - right_tw;
                            }
                            s.width = left_tw;
                            sig.view.attr({'path': rect_path(s)});
                        });
                    });
                }
                break;
            case 'canvas':
                leftTable.filter('both', null);
                leftTable.show_detail(true);

                redraw = function(speed, update_tables) {
                    if (speed == null)
                        speed = default_speed;

                    if (update_tables) {
                        leftTable.update(left_th);
                    }

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
                                         'stroke': 'white',
                                         'stroke-opacity': 0.75,
                                         'stroke-width': 20,
                                         'fill': 'white',
                                         'fill-opacity': 1};
                            if (first_transition) {
                                sig.view.animate(attrs, speed, 'linear');
                                sig.view.label.animate({'x': sig.view.canvas_object.left,
                                                        'y': sig.view.canvas_object.top,
                                                        'opacity': 1},
                                                       speed, 'linear').toFront();
                            }
                            else {
                                sig.view.attr(attrs);
                                sig.view.label.attr({'x': sig.view.canvas_object.left,
                                                     'y': sig.view.canvas_object.top,
                                                     'opacity': 1},
                                                    speed, 'linear').toFront();
                            }
                            if (first_transition) {
                                sig.view.drag(function(dx, dy, x, y, event) {
                                    x -= container_frame.left;
                                    y -= container_frame.top;
                                    let obj = sig.view.canvas_object
                                    obj.left = x;
                                    obj.top = y;
                                    constrain(obj, svg_frame, 5);
                                    sig.view.attr({'path': canvas_rect_path(obj,
                                                                            sig.direction)});
                                    sig.view.label.attr({'x': obj.left, 'y': obj.top}).toFront();
                                    redraw(0, false);
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
                            map.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, 'linear');
                            return;
                        }
                        let path = canvas_bezier(map);
                        map.view.attr({'arrow-end': 'block-wide-long'});
                        if (!map.view.canvas_object) {
                            map.view.canvas_object = true;
                            let pos = map.src.view.canvas_object;
                            let x = (pos.left + (pos.width * 0.5)
                                     * (map.src.direction == 'input' ? -1 : 1));
                            let y = pos.top;
                            map.view.attr({'path': [['M', x, y], ['l', 0, 0]]});
                            let len = Raphael.getTotalLength(path);
                            let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                            map.view.animate({'path': path_mid}, speed * 0.5, 'linear',
                                             function() {
                                map.view.animate({'path': path}, speed * 0.5, 'linear');
                            });
                        }
                        map.view.animate({'path': path,
                                          'stroke-opacity': 1,
                                          'fill-opacity': 0}, speed, 'linear');
                    });
                    first_transition = false;
                }
                cleanup = function() {
                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            if (sig.view)
                                sig.view.undrag();
                        });
                    });
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
                            let path = circle_path(sig.view.position.x, sig.view.position.y, 10);
                            sig.view.animate({'path': path,
                                              'fill': dev.view.color,
                                              'fill-opacity': 1,
                                              'stroke': 'white',
                                              'stroke-width': 1,
                                              'stroke-opacity': sig.direction == 'output' ? 1 : 0},
                                             speed, 'linear');
                            sig.view.label.animate({'x': sig.view.position.x,
                                                    'y': sig.view.position.y,
                                                    'opacity': 0}, speed);
                        });
                    });
                    model.maps.each(function(map) {
                        let src = map.src.view.position;
                        let dst = map.dst.view.position;
                        let mp = new_pos((src.x + dst.x) * 0.5, (src.y + dst.y) * 0.5);
                        mp.x += (mp.x - svg_frame.cx) * 0.2;
                        mp.y += (mp.y - svg_frame.cy) * 0.2;
                        let path = [['M', src.x, src.y],
                                    ['S', mp.x, mp.y, dst.x, dst.y]];
                        let len = Raphael.getTotalLength(path);
                        path = Raphael.getSubpath(path, 10, len - 10);
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
                let path = circle_path(svg_frame.left + svg_frame.width * 0.33,
                                       svg_frame.cy, 1);
                path.push(circle_path(svg_frame.left + svg_frame.width * 0.67,
                                      svg_frame.cy, 1));
                let outline = svgArea.path().attr({'path': path,
                                                   'stroke-opacity': 0,
                                                   'fill': 'lightgray',
                                                   'fill-opacity': 0.5}).toBack();

                redraw = function(speed) {
                    if (speed == null)
                        speed = default_speed;
                    let path = circle_path(svg_frame.left + svg_frame.width * 0.33,
                                           svg_frame.cy,
                                           svg_frame.height * 0.46);
                    path.push(circle_path(svg_frame.left + svg_frame.width * 0.67,
                                          svg_frame.cy,
                                          svg_frame.height * 0.46));
                    outline.animate({'path': path,
                                     'fill-opacity': 0.5}, speed, 'linear');
                    first_transition = false;
                }
                cleanup = function() {
                    if (outline) {
                        outline.remove();
                        outline = null;
                    }
                }
                break;
        }
        if (first_transition) {
            redraw(default_speed, true);
            setTimeout(arrange_tables, default_speed);
//            arrange_tables(default_speed);
//            setTimeout(redraw, default_speed);
        }
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
        svg_frame = fullOffset($('#svgDiv')[0]);
        svg_frame.cx = svg_frame.width * 0.5;
        svg_frame.cy = svg_frame.height * 0.5;
    };

    this.init = function() {
        // remove all previous DOM elements
        $(container).empty();
        container_frame = fullOffset($(container)[0]);
//        add_title_bars();
        add_svg_area();
        add_display_tables();

        cursor = svgArea.path().attr({'stroke-linecap': 'round'});
        this.switch_view('list');

        selection_handlers();

        add_model_callbacks();
        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function new_pos(x, y) {
        return {'x': x != null ? x : Math.random() * svg_frame.width,
            'y': y != null ? y : Math.random() * svg_frame.height};
    }

    function update_devices(dev, event) {
        if (event == 'removing' && dev.view) {
            dev.view.remove();
            return;
        }
        else if (event == 'added' && !dev.view) {
            let color = Raphael.getColor();
            let pos = new_pos(50, svg_frame.height - 50);
            dev.view = svgArea.path()
                            .attr({'path': [['M', pos.x, pos.y], ['l',0, 0]],
                                   'stroke': color,
                                   'fill': 'lightgray',
                                   'stroke-opacity': 0,
                                   'fill-opacity': 0});
            dev.view.color = color;
            dev.signals.each(function(sig) {
                update_signals(sig, 'added', false);
            });
            redraw(default_speed, true);
        }
        else if (event == 'removed')
            redraw(default_speed, true);
    }

    function update_signals(sig, event, repaint) {
        if (event == 'removing' && sig.view) {
            sig.view.label.remove();
            sig.view.remove();
        }
        else if (event == 'added' && !sig.view) {
            let dev = sig.device;
            // add circle for signal
            let pos = new_pos(50, svg_frame.height - 50);
            let path = circle_path(pos.x, pos.y, 3);
            sig.view = svgArea.path()
                            .attr({ 'path': path,
                                    'stroke': 'white',
                                    'fill': dev.view.color,
                                    'stroke-opacity': 0,
                                    'fill-opacity': 0,
                                    'stroke-linecap': 'round' });
            sig.view.position = pos;
            sig.view.label = svgArea.text(pos.x, pos.y, sig.key)
                            .attr({'opacity': 0,
                                   'font-size': 16,
                                   'pointer-events': 'none' });
            sig.view.hover(
                function() {
                    if (currentView != 'hive' && currentView != 'graph')
                        return;
                    let pos = labeloffset(sig.view.position, sig.key);
                    sig.view.label.attr({'x': pos.x,
                                         'y': pos.y,
                                         'opacity': 1}).toFront();
                },
                function() {
                    if (currentView != 'hive' && currentView != 'graph')
                        return;
                    sig.view.label.attr({'opacity': 0});
            });
            if (repaint)
                redraw(default_speed, true);
        }
        else if (event == 'removed')
            redraw(default_speed, true);
    }

    function update_maps(map, event) {
        if (event == 'removing' && map.view) {
            map.view.remove();
            return;
        }
        else if (event == 'added' && !map.view) {
            map.view = svgArea.path().attr({'stroke': 'white',
                                            'fill': mapfill,
                                            'stroke-opacity': 0,
                                            'fill-opacity': 0,
                                            'stroke-width': 2});
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
            // Prevent the browser from going back a page
            // but NOT if you're focus is an input and deleting text
            if (!$(':focus').is('input')) {
                e.preventDefault();
            }
            /* delete */
            model.maps.each(function(map) {
                if (map.view && map.view.selected)
                    $('#container').trigger('unmap', [map.src.key, map.dst.key]);
            });
        }
        else if (e.which == 65 && e.metaKey == true) { // Select all 'cmd+a'
            e.preventDefault();
            select_all();
        }
        else if (e.which == 65 && e.metaKey == true) {
            e.preventDefault();
            console.log('should add tab');
        }
        else if (e.which == 32 && currentView == 'graph') {
            model.devices.each(function(dev) {
                dev.signals.each(function(sig) {
                    if (!sig.view)
                        return;
                    sig.view.position = new_pos();
                });
            });
            redraw();
        }
    });

    function select_obj(obj) {
        if (obj.view.selected)
            return false;
        obj.view.selected = true;
        obj.view.animate({'stroke': 'red', 'fill': 'red'}, 50);
        return true;
    }

    this.zoom = function(x, y, delta) {
        if (y < container_frame.top + svg_frame.top) {
            if (x > container_frame.left + svg_frame.left) {
                if (topTable.zoom(x - container_frame.left - svg_frame.left, delta))
                    redraw(0, false);
            }
        }
        else if (x < container_frame.left + svg_frame.left) {
            if (leftTable.zoom(y - container_frame.top - svg_frame.top, delta))
                redraw(0, false);
        }
        else if (x > (container_frame.left + svg_frame.left + svg_frame.width)) {
            if (rightTable.zoom(y - container_frame.top - svg_frame.top, delta))
                redraw(0, false);
        }
        else if (currentView == 'list') {
            // send to both left and right tables
            let update = leftTable.zoom(y - container_frame.top - svg_frame.top, delta);
            update |= rightTable.zoom(y - container_frame.top - svg_frame.top, delta);
            if (update)
                redraw(0, false);
        }
        else if (currentView == 'grid') {
            // send to both left and top tables
            let update = leftTable.zoom(y - container_frame.top - svg_frame.top, delta);
            update |= topTable.zoom(x - container_frame.left - svg_frame.left, delta);
            if (update)
                redraw(0, false);
        }
        else {
            svgzoom += delta * 0.05;
            if (svgzoom < 0.1)
                svgzoom = 0.1;
            else if (svgzoom > 20)
                svgzoom = 20;
            svgArea.setViewBox(0, 0,
                               svg_frame.width * svgzoom,
                               svg_frame.height * svgzoom, false);
        }
    }

    this.pan = function(x, y, delta_x, delta_y) {
        if (y < container_frame.top + svg_frame.top) {
            if (x > container_frame.left + svg_frame.left) {
                topTable.pan(delta_x);
                redraw(0, false);
            }
        }
        else if (x < container_frame.left + svg_frame.left) {
            leftTable.pan(delta_y);
            redraw(0, false);
        }
        else if (x > (container_frame.left + svg_frame.left + svg_frame.width)) {
            rightTable.pan(delta_y);
            redraw(0, false);
        }
        else if (currentView == 'list') {
            // send to both left and right tables
            leftTable.pan(delta_y);
            rightTable.pan(delta_y);
            redraw(0, false);
        }
        else if (currentView == 'grid') {
            // send to both left and top tables
            leftTable.pan(delta_y);
            topTable.pan(delta_x);
            // TODO: should pan svg canvas instead
            redraw(0, false);
        }
        else {
            svgposx += delta_x / svgzoom;
            svgposy += delta_y;
            svgArea.setViewBox(svgposx, svgposy,
                               svg_frame.width * svgzoom,
                               svg_frame.height * svgzoom, false);
        }
    }

    this.filter_signals = function(searchbar, text) {
        if (searchbar == 'srcSearch') {
            srcregexp = new RegExp(text, 'i');
            if (currentView == 'list')
                leftTable.filter(null, text);
            else if (currentView == 'grid')
                topTable.filter(null, text);
        }
        else {
            dstregexp = new RegExp(text, 'i');
            if (currentView == 'list')
                rightTable.filter(null, text);
            else if (currentView == 'grid')
                leftTable.filter(null, text);
        }
        redraw(default_speed, true);
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
                if (!map.view || map.view.selected)
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
                    if (!map.view || map.view.selected)
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

        $('.tableDiv').on('mousedown', 'tr', function(e) {
            let draw_obj = false;
            let draw_edge = null;
            let left_attract = null, right_attract = null, top_attract = null;
            switch (currentView) {
                case 'list':
                    left_attract = svg_frame.left + svg_frame.width * 0.3;
                    right_attract = svg_frame.left + svg_frame.width * 0.7;
                    draw_edge = 'any';
                    break;
                case 'grid':
                    left_attract = svg_frame.left;
                    top_attract = svg_frame.top;
                    draw_edge = 'same';
                    break;
                case 'canvas':
                    draw_edge = false;
                    draw_obj = true;
                    draw_edge = 'none';
                    break;
                default:
                    return;
            }
            var src_row = this;
            var src_table = null;
            switch ($(src_row).parents('.tableDiv').attr('id')) {
                case "leftTable":
                    src_table = leftTable;
                    break;
                case "rightTable":
                    src_table = rightTable;
                    break;
                case "topTable":
                    src_table = topTable;
                    break;
                default:
                    console.log('unknown source row');
                    return;
            }

            $('svg').one('mouseenter.drawing', function() {
                deselect_all();

                var src = src_table.row_from_name(src_row.id.replace('\\/', '\/'));
                switch (src_table) {
                    case leftTable:
                         src.left += src.width;
                         src.cx += src.width;
                         break;
                    case rightTable:
                         src.left = container_frame.width - src.width;
                         src.cx = container_frame.width - src.cx;
                         break;
                     case topTable:
                         src.top += src.height;
                         src.cy += src.height;
                         break;
                }
                var dst = null;
                var width = labelwidth(src.id);
                var cursorLabel = draw_obj ? svgArea.text(0, 0, src.id).attr({'font-size': 16}) : null;

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    set_cursor_attributes(currentView);

                    let x = e.pageX - container_frame.left;
                    let y = e.pageY - container_frame.top;
                    let dst_table = null;
                    let path;
                    dst = null;

                    if (draw_obj) {
                        // draw canvas object
                        let temp = {'left': x, 'top': y,
                                    'width': width, 'height': 20 };
                        constrain(temp, svg_frame, 5);
                        path = canvas_rect_path(temp, src.isOutput ? 'output' : 'input');
                        cursor.attr({'path': path, 'stroke': 'white' });
                        cursorLabel.attr({'x': temp.left, 'y': temp.top});
                        return;
                    }

                    if (left_attract != null && x < left_attract) {
                        // snap to left table
                        rightTable.highlight_row(null, true);
                        topTable.highlight_row(null, true);
                        dst_table = leftTable;
                        dst = dst_table.row_from_position(e.pageX, e.pageY);
                        if (dst) {
                            x = dst.width;
                            y = dst.cy;
                        }
                    }
                    else if (right_attract != null && x > right_attract) {
                        // snap to right table
                        leftTable.highlight_row(null, true);
                        dst_table = rightTable;
                        dst = dst_table.row_from_position(e.pageX, e.pageY);
                        if (dst) {
                            x = container_frame.width - dst.width;
                            y = dst.cy;
                        }
                    }
                    else if (top_attract != null && y < top_attract) {
                        // snap to top table
                        leftTable.highlight_row(null, true);
                        dst_table = topTable;
                        dst = dst_table.row_from_position(e.pageX, e.pageY);
                        if (dst) {
                            x = dst.cx;
                            y = svg_frame.top;
                        }
                    }
                    else if (currentView == 'grid') {
                        // get dst from y-axis offset
                        dst_table = (src_table == leftTable) ? topTable : leftTable;
                        dst = dst_table.row_from_position(e.pageX, e.pageY);
                    }

                    if (src_table == dst_table) {
                        if (currentView == 'grid')
                            set_cursor_attributes('edge');
                        // draw smooth path from table to self
                        if (src_table == topTable)
                            path = self_path(src.cx + 200, 200, dst.cx + 200, 200);
                        else
                            path = self_path(src.left, src.cy + svg_frame.top,
                                             src.left, y + svg_frame.top);
                    }
                    else if (currentView == 'grid') {
                        // draw crosshairs and triangle pointing from src to dst
                        let h = (src_table == leftTable) ? dst : src;
                        let v = (src_table == leftTable) ? src : dst;
                        path = [['M', h.cx + v.width, v.cy + 200],
                                ['L', v.width, v.top + 200],
                                ['L', v.width, v.top + v.height + 200],
                                ['Z'],
                                ['M', h.cx + v.width, v.cy + 200],
                                ['L', h.left + v.width, 200],
                                ['L', h.left + h.width + v.width, 200],
                                ['Z']];
                    }
                    else if (dst) {
                        // draw bezier curve connecting src and dst
                        path = [['M', src.left, src.cy],
                                ['C', svg_frame.cx, src.cy,
                                 svg_frame.cx, dst.cy, x, dst.cy]];
                    }
                    else {
                        // draw bezier connecting src to cursor
                        let mp = (src.left + x) * 0.5;
                        path = [['M', src.left, src.cy],
                                ['C', mp, src.cy, mp, y, x, y]];
                    }
                    if (dst)
                        dst_table.highlight_row(null, true);
                    src_table.highlight_row(src, true);
                    if (dst)
                        dst_table.highlight_row(dst, false);

                    cursor.attr({'path': path});
                });
                $(document).on('mouseup.drawing', function(e) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    set_cursor_attributes('none');
                    if (dst && dst.id) {
                        $('#container').trigger('map', [src.id, dst.id]);
                    }
                    if (cursorLabel) {
                        cursorLabel.remove();
                        cursorLabel = null;
                    }
                    if (draw_obj) {
                        // add object to canvas
                        let sig = findSig(src.id);
                        if (!sig || sig.view.canvas_object)
                            return;
                        let obj = {'left': e.pageX - container_frame.left,
                                   'top': e.pageY - container_frame.top,
                                   'width': labelwidth(sig.key),
                                   'height': 20};
                        constrain(obj, svg_frame, 5);
                        sig.view.canvas_object = obj;
                        sig.view.attr({'path': canvas_rect_path(sig.view.canvas_object,
                                                                sig.direction),
                                      'stroke-width': 20,
                                      'stroke-opacity': 1 });
                        sig.view.label.attr({'x': obj.left, 'y': obj.top,
                                            'opacity': 1}).toFront();
                        sig.view.drag(function(dx, dy, x, y, event) {
                            x -= container_frame.left;
                            y -= container_frame.top;
                            let obj = sig.view.canvas_object
                            obj.left = x;
                            obj.top = y;
                            constrain(obj, svg_frame, 5);
                            sig.view.attr({'path': canvas_rect_path(obj, sig.direction),
                                          'stroke-width': 20,
                                          'stroke-opacity': 1 });
                            sig.view.label.attr({'x': obj.left, 'y': obj.top}).toFront();
                            redraw(0, false);
                        });
                        redraw(default_speed, false);
                    }
                });
            });
            $(document).one('mouseup.drawing', function(e) {
//                $("*").off('.drawing').removeClass('incompatible');
                $(document).off('.drawing');
                set_cursor_attributes('none');
            });
        });
    }
}

HivePlotView.prototype = {

    // when browser window gets resized
    on_resize : function () {
        container_frame = fullOffset($(container)[0]);
        svg_frame = fullOffset($('#svgDiv')[0]);
        svg_frame.cx = svg_frame.width * 0.5;
        svg_frame.cy = svg_frame.height * 0.5;
        this.switch_view();
    },

    cleanup : function () {
        document.onkeydown = null;
    }
};
