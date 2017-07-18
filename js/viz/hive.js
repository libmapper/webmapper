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
//    var mapfill = 'rgb(104,202,255)';
    var mapfill = 'black';
    var mappath = 'black';
    var mapsel = 'red';
    var easing = '>';
    var dragging = null;
    var draggingFrom = null;
    var snappingTo = null;
    var escaped = false;

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

    function canvas_rect_path(dim) {
        let path = [['M', dim.left - dim.width * 0.5, dim.top],
                    ['l', dim.width, 0]];
        return path;
    }

    function canvas_bezier(map) {
        let src = map.src.canvas_object;
        let dst = map.dst.canvas_object;
        let src_offset = (src.width * 0.5 + 10);
        let dst_offset = (dst.width * -0.5 - 10);
        return [['M', src.left + src_offset, src.top],
                ['C', src.left + src_offset * 3, src.top,
                      dst.left + dst_offset * 3, dst.top,
                      dst.left + dst_offset, dst.top]];
    }

    function grid_path(row, col) {
        if (row && col) {
            return [['M', col.left, col.top],
                    ['l', col.width, 0],
                    ['L', col.left + col.width, row.top],
                    ['L', row.left + row.width, row.top],
                    ['l', 0, row.height],
                    ['L', col.left + col.width, row.top + row.height],
                    ['L', col.left + col.width, col.top + col.height],
                    ['l', -col.width, 0],
                    ['L', col.left, row.top + row.height],
                    ['L', row.left, row.top + row.height],
                    ['l', 0, -row.height],
                    ['L', col.left, row.top],
                    ['z']];
        }
        else if (row)
            return [['M', 0, row.top],
                    ['l', container_frame.width, 0],
                    ['l', 0, row.height],
                    ['l', -container_frame.width, 0],
                    ['Z']];
        else if (col)
            return [['M', col.left, 0],
                    ['l', col.width, 0],
                    ['l', 0, container_frame.height],
                    ['l', -col.width, 0],
                    ['Z']];
        return null;
    }

    function list_path(src, dst, connect) {
        if (src && dst && connect) {
            let mp = container_frame.width * 0.5;
            return [['M', src.left, src.top],
                    ['l', src.width, 0],
                    ['C', mp, src.top, mp, dst.top, dst.left, dst.top],
                    ['l', dst.width, 0],
                    ['l', 0, dst.height],
                    ['l', -dst.width, 0],
                    ['C', mp, dst.top + dst.height, mp, src.top + src.height,
                     src.left + src.width, src.top + src.height],
                    ['l', -src.width, 0],
                    ['Z']];
        }
        let path = [];
        if (src) {
            path.push(['M', src.left, src.top],
                      ['l', src.width, 0],
                      ['l', 0, src.height],
                      ['l', -src.width, 0],
                      ['Z']);
        }
        if (dst) {
            path.push(['M', dst.left, dst.top],
                      ['l', dst.width, 0],
                      ['l', 0, dst.height],
                      ['l', -dst.width, 0],
                      ['Z']);
        }
        return path;
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
                map.view.animate({'stroke': mapsel}, 50);
                map.view.selected = true;
                updated = true;
            }
            if (map.view.attr('fill-opacity') > 0) {
                map.view.animate({'fill': mapsel}, 50);
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
        model.maps.each(function(map) {
            if (map.view && map.view.selected) {
                map.view.animate({'stroke': mappath,
                                  'fill': mapfill }, 50);
                map.view.selected = false;
                updated = true;
            }
        });
        if (updated)
            $('#container').trigger("updateMapProperties");
    }

    function set_cursor_attributes(view, color) {
        switch (view) {
            case 'grid':
                cursor.attr({'fill': 'rgb(104,202,255)',
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
                cursor.attr({'fill': 'black',
                             'fill-opacity': 1,
                             'stroke-opacity': 1,
                             'arrow-end': 'none',
                             'stroke-width': 20 });
                break;
            default:
                cursor.attr({'fill-opacity': 0,
                             'stroke': 'black',
                             'stroke-opacity': 1,
                             'arrow-end': 'block-wide-long',
                             'stroke-width': 2 });
                break;
        }
    }

    function set_sig_hover(sig) {
        sig.view.mouseup(function() {
            if (draggingFrom && snappingTo)
                $('#container').trigger('map', [draggingFrom.key, snappingTo.key]);
        });
        sig.view.hover(
            function() {
                if (currentView == 'canvas') {
                    if (draggingFrom == null)
                       return;
                    if (sig == draggingFrom) {
                       // don't snap to self
                       return;
                    }
                    // snap to sig object
                    let obj1 = draggingFrom.canvas_object;
                    let obj2 = sig.canvas_object;
                    let offset1 = obj1.width * 0.5 + 10;
                    let offset2 = obj2.width * 0.5 + 10;
                    let path = null;
                    if (dragging == 'left') {
                       path = [['M', obj1.left - offset1, obj1.top],
                               ['C', obj1.left - offset1 * 3, obj1.top,
                                obj2.left + offset2 * 3, obj2.top,
                                obj2.left + offset2, obj2.top]];
                    }
                    else {
                       path = [['M', obj1.left + offset1, obj1.top],
                               ['C', obj1.left + offset1 * 3, obj1.top,
                                obj2.left - offset2 * 3, obj2.top,
                                obj2.left - offset2, obj2.top]];
                    }
                    snappingTo = sig;
                    cursor.attr({'path': path});
                    return;
                }
                else if (currentView != 'hive' && currentView != 'graph')
                    return;
                let pos = labeloffset(sig.position, sig.key);
                if (!sig.view.label) {
                    sig.view.label = svgArea.text(pos.x, pos.y, sig.key);
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
                if (sig == draggingFrom) {
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
                cursor.attr({'path': path});
            },
            function() {
                snappingTo = null;
                if (currentView != 'hive' && currentView != 'graph')
                    return;
                if (sig.view.label) {
                    sig.view.stop();
                    sig.view.label.animate({'opacity': 0}, default_speed, easing,
                                           function() {
                        this.remove();
                        sig.view.label = null;
                    });
                }
            }
        );
    }

    function set_sig_drag(sig) {
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (currentView != 'canvas') {
                    if (snappingTo)
                        return;
                    x -= container_frame.left;
                    y -= container_frame.top;
                    let src = draggingFrom.position;
                    let path = [['M', src.x, src.y],
                                ['S', (src.x + x) * 0.6, (src.y + y) * 0.4,
                                   x, y]];
                    cursor.attr({'path': path,
                                 'stroke': 'black',
                                 'stroke-opacity': 1,
                                 'arrow-start': 'none',
                                 'arrow-end': 'block-wide-long'});
                    return;
                }
                if (escaped) {
                    draggingFrom = null;
                    delete sig.canvas_object.drag_offset;
                    dragging = null;
                    cursor.attr({'stroke-opacity': 0,
                                 'arrow-start': 'none',
                                 'arrow-end': 'none'});
                    return;
                }
                let obj = sig.canvas_object;
                if (dragging == 'obj') {
                    obj.left = x + obj.drag_offset.x;
                    obj.top = y + obj.drag_offset.y;
                    constrain(obj, svg_frame, 5);
                    sig.view.attr({'path': canvas_rect_path(obj)});
                    sig.view.label.attr({'x': obj.left,
                                         'y': obj.top}).toFront();
                    redraw(0, false);
                }
                else if (!snappingTo) {
                    let offset = obj.width * 0.5 + 10;
                    let arrow_start = 'none';
                    let arrow_end = 'none';
                    if (dragging == 'left') {
                        offset *= -1;
                        arrow_start = 'block-wide-long';
                    }
                    else
                        arrow_end = 'block-wide-long';
                    x -= container_frame.left;
                    y -= container_frame.top;
                    let path = [['M', obj.left + offset, obj.top],
                                ['C', obj.left + offset * 3, obj.top,
                                 x - offset * 3, y, x, y]];
                    cursor.attr({'path': path,
                                 'stroke': 'black',
                                 'stroke-opacity': 1,
                                 'arrow-start': arrow_start,
                                 'arrow-end': arrow_end});
                }
            },
            function(x, y, event) {
                escaped = false;
                draggingFrom = sig;
                if (currentView == 'canvas') {
                    let obj = sig.canvas_object;
                    obj.drag_offset = new_pos(obj.left - x, obj.top - y);
                    if (x < obj.left - obj.width * 0.5 + 5)
                        dragging = 'left';
                    else if (x > obj.left + obj.width * 0.5 - 5)
                        dragging = 'right';
                    else
                        dragging = 'obj';
                }
            },
            function(x, y, event) {
                draggingFrom = null;
                if (sig.canvas_object)
                    delete sig.canvas_object.drag_offset;
                dragging = null;
                cursor.attr({'stroke-opacity': 0,
                             'arrow-start': 'none',
                             'arrow-end': 'none'});
            }
        );
    }

    function remove_object_svg(obj) {
        if (!obj.view)
            return;
        if (obj.view.label) {
            obj.view.label.stop();
            obj.view.label.animate({'stroke-opacity': 0,
                                    'fill-opacity': 0}, default_speed, easing,
                                   function() {
                this.remove();
                obj.view.label = null;
            });
        }
        obj.view.stop();
        obj.view.animate({'stroke-opacity': 0,
                          'fill-opacity': 0}, default_speed, easing, function() {
            this.remove();
            obj.view = null;
        });
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
            case 'load':
                left_tw = container_frame.width * 0.25;
                left_th = container_frame.height;
                right_tw = container_frame.width * 0.25;
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

        svg_offset_left = function(rect) {
            rect.left = left_tw;
            rect.cx = left_tw;
            rect.top += top_th - 20;
            rect.cy += top_th - 20;
        }
        svg_offset_top = function(rect) {
            rect.left += left_tw;
            rect.cx += left_tw;
            rect.top = top_th;
            rect.cy = top_th;
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
                        angle = dev_index * -angleInc;
                        dev_index += 1;
                        let sig_index = 0;
                        let dev_start_path = null;
                        let dev_target_path = null;
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
                            let is_output = sig.direction == 'output';
                            if (!sig.view) {
                                sig.view = svgArea.path(circle_path(sig.position.x,
                                                                    sig.position.y,
                                                                    is_output ? 7 : 10));
                            }
                            set_sig_drag(sig);
                            set_sig_hover(sig);

                            let remove = false;
                            if (srcregexp && sig.direction == 'output') {
                                if (!srcregexp.test(sig.key))
                                    remove = true;
                            }
                            else if (dstregexp && !dstregexp.test(sig.key)) {
                                remove = true;
                            }
                            if (remove)
                                remove_object_svg(sig);

                            sig_index += 1;
                            let x = origin.x + width * inc * sig_index * Math.cos(angle);
                            let y = origin.y + height * inc * sig_index * Math.sin(angle);
                            if (dev_start_path) {
                                dev_start_path.push(['L', sig.position.x, sig.position.y]);
                                dev_target_path.push(['L', x, y]);
                            }
                            else {
                                dev_start_path = [['M', sig.position.x, sig.position.y]];
                                dev_target_path= [['M', x, y]];
                            }
                            let path = circle_path(x, y, is_output ? 7 : 10);
                            sig.view.stop();
                            sig.view.animate({'path': path,
                                              'fill': is_output ? 'black' : dev.color,
                                              'fill-opacity': 1,
                                              'stroke': dev.color,
                                              'stroke-width': 6,
                                              'stroke-opacity': sig.direction == 'output' ? 1 : 0}, speed, easing);
                            sig.position = new_pos(x, y);
                            if (sig.view.label) {
                                sig.view.label.animate({'x': x, 'y': y, 'opacity': 0},
                                                       speed, easing, function() {
                                    this.remove();
                                    sig.view.label = null;
                                });
                            }
                        });
//                        dev_start_path.push(['Z']);
//                        dev_target_path.push(['Z']);
                        if (!dev.view) {
                            dev.view = svgArea.path(dev_start_path)
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
                                          'stroke-linecap': 'round'}, speed, easing);
                    });
                    model.maps.each(function(map) {
                        let src = map.src.position;
                        let dst = map.dst.position;
                        if (!map.view) {
                            map.view = svgArea.path([['M', src.x, src.y], ['l', 0, 0]])
                                              .attr({'arrow-end': 'block-wide-long'});
                        }
                        let path = [['M', src.x, src.y],
                                    ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
                                     dst.x, dst.y]];
                        let len = Raphael.getTotalLength(path);
                        path = Raphael.getSubpath(path, 10, len - 10);
                        map.view.animate({'path': path,
                                          'fill-opacity': '0',
                                          'stroke-opacity': 1},
                                         speed, easing, function() {
                            map.view.attr({'arrow-end': 'block-wide-long'}).toFront();
                        });
                    });
                    first_transition = false;
                }
                break;
            case 'grid':
                leftTable.filter('output', null);
                leftTable.show_detail(false);
                topTable.filter('input', null);
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
                            remove_object_svg(sig);
                        });
                        let row = leftTable.row_from_name(dev.name);
                        if (row) {
                            row.left = 0;
                            row.top += top_th - 20;
                            row.width = container_frame.width;
                            row.cy += top_th - 20;
                        }
                        let col = topTable.row_from_name(dev.name);
                        if (col) {
                            col.left += left_tw;
                            col.cx += left_tw;
                            col.top = 0;
                            col.height = container_frame.height;
                        }
                        if (!row && !col) {
                            if (dev.view) {
                                dev.view.stop();
                                dev.view.animate({'fill-opacity': 0}, speed, easing,
                                                 function() {
                                    this.remove();
                                    dev.view = null;
                                });
                            }
                            return;
                        }
                        let path = grid_path(row, col);
                        if (!dev.view) {
                            dev.view = svgArea.path(path).attr({'fill-opacity': 0});
                        }
                        dev.view.stop();
                        dev.view.toBack();
                        dev.view.animate({'path': path,
                                          'fill': dev.color,
                                          'fill-opacity': 0.5,
                                          'stroke-opacity': 0,
                                         }, speed, easing);
                        dev.view.unclick().click(function(e) {
                            dev.collapsed = dev.collapsed == true ? false : true;
                            redraw(200, true);
                        });
                    });
                    model.maps.each(function(map) {
                        if (!map.view) {
                            map.view = svgArea.path();
                            map.view.new = true;
                        }
                        map.view.click(function(e) {
                            if (select_obj(map))
                                $('#container').trigger("updateMapProperties");
                        });
                        let path, curve = false;
                        src = topTable.row_from_name(map.src.key);
                        dst = leftTable.row_from_name(map.dst.key);
                        if (src) {
                            svg_offset_top(src);
                            if (dst) {
                                svg_offset_left(dst);
                                path = [['M', src.left + src.width, dst.top],
                                        ['L', src.left, dst.cy],
                                        ['L', src.left + src.width, dst.top + dst.height],
                                        ['Z']];
                            }
                            else {
                                dst = topTable.row_from_name(map.dst.key);
                                if (!dst)
                                    return
                                svg_offset_top(dst);
                                // both endpoints are 'input' signals
                                path = self_path(src.cx, top_th, dst.cx, top_th);
                                curve = true;
                            }
                        }
                        else if (dst) {
                            svg_offset_left(dst);
                            src = leftTable.row_from_name(map.src.key);
                            if (!src)
                                return
                            svg_offset_left(src);
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
                            svg_offset_left(src);
                            svg_offset_top(dst);
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
                                               'stroke': map.view.selected ? mapsel : mappath,
                                               'stroke-opacity': 1});
                                let len = Raphael.getTotalLength(path);
                                let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                                map.view.animate({'path': path_mid}, speed * 0.5, easing,
                                                 function() {
                                    map.view.animate({'path': path}, speed * 0.5, easing);
                                }).toFront();
                                map.view.new = false;
                            }
                            else {
                                map.view.animate({'path': path,
                                                  'fill-opacity': 0,
                                                  'stroke': map.view.selected ? mapsel : mappath,
                                                  'stroke-opacity': 1}, speed, easing).toFront();
                            }
                        }
                        else {
                            map.view.attr({'arrow-end': 'none'});
                            if (map.view.new) {
                                map.view.attr({'path': (src.cx > dst.cx)
                                              ? [['M', src.left + src.width, dst.top],
                                                 ['L', src.left + src.width, dst.cy],
                                                 ['L', src.left + src.width, dst.top + dst.height],
                                                 ['Z']]
                                              : [['M', dst.left, src.top + src.height],
                                                 ['L', dst.cx, src.top + src.height],
                                                 ['L', dst.left + dst.width, src.top + src.height],
                                                 ['Z']]});
                                map.view.new = false;
                            }
                            map.view.animate({'path': path,
                                              'fill-opacity': 1,
                                              'fill': map.view.selected ? mapsel : mapfill,
                                              'stroke-opacity': 0}, speed, easing);
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
                /* TODO: sorting */
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

                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            // remove associated svg elements
                            remove_object_svg(sig);
                        });
                        let src = leftTable.row_from_name(dev.name);
                        if (src) {
                            src.left = 0;
                            src.width = left_tw
                        }
                        let dst = rightTable.row_from_name(dev.name);
                        if (dst) {
                            dst.left = container_frame.width - right_tw;
                            dst.width = right_tw;
                        }
                        if (!src && !dst) {
                            if (dev.view) {
                                dev.view.stop();
                                dev.view.animate({'fill-opacity': 0}, speed, easing,
                                                 function() {
                                    this.remove();
                                    dev.view = null;
                                });
                            }
                            return;
                        }
                        let path = list_path(src, dst, true);
                        if (!dev.view) {
                            dev.view = svgArea.path(path).attr({'fill-opacity': 0});
                        }
                        else
                            dev.view.stop();
                        dev.view.toBack();
                        dev.view.animate({'path': path,
                                          'fill': dev.color,
                                          'fill-opacity': 0.5,
                                          'stroke-opacity': 0}, speed, easing);
                        dev.view.unclick().click(function(e) {
                            dev.collapsed = dev.collapsed == true ? false : true;
                            redraw(200, true);
                        });
                    });
                    let invisible = false;
                    model.maps.each(function(map) {
                        let src = get_sig_pos(map.src, true);
                        let dst = get_sig_pos(map.dst, true);
                        if (!src || !dst)
                            return;

                        if (!map.view) {
                            map.view = svgArea.path();
                            map.view.new = true;
                        }

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
                                           'stroke': map.view.selected ? mapsel : mappath});
                            let len = Raphael.getTotalLength(path);
                            let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                            map.view.stop().animate({'path': path_mid,
                                                     'stroke-opacity': opacity},
                                                    speed * 0.5, easing, function() {
                                map.view.animate({'path': path}, speed * 0.5, easing);
                            });
                            map.view.new = false;
                        }
                        else {
                            map.view.stop().animate({'path': path,
                                                     'stroke-opacity': opacity,
                                                     'fill-opacity': '0',
                                                     'stroke': map.view.selected ? mapsel : mappath},
                                                    speed, easing, function() {
                                map.view.attr({'arrow-end': 'block-wide-long',
                                               'stroke-dasharray': map.muted ? '--' : '' });
                            });
                        }
                    });
                    first_transition = false;
                }
                cleanup = function() {
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
                        let list = leftTable.row_from_name(dev.name);
                        if (list) {
                            list.left = 0;
                            list.width = left_tw
                        }
                        else {
                            if (dev.view) {
                                dev.view.stop();
                                dev.view.animate({'fill-opacity': 0}, speed, easing,
                                                 function() {
                                    this.remove();
                                    dev.view = null;
                                });
                            }
                            return;
                        }
                        let path = rect_path(list);
                        if (!dev.view) {
                            dev.view = svgArea.path(path).attr({'fill-opacity': 0});
                        }
                        else
                            dev.view.stop();
                        dev.view.toBack();
                            dev.view.animate({'path': path,
                                              'fill': dev.color,
                                              'fill-opacity': 0.5,
                                              'stroke-opacity': 0}, speed, easing);
                        dev.signals.each(function(sig) {
                            if (!sig.canvas_object) {
                                // remove associated svg element
                                remove_object_svg(sig);
                                return;
                            }
                            let path = canvas_rect_path(sig.canvas_object);

                            let attrs = {'path': path,
                                         'stroke': dev.color,
                                         'stroke-opacity': 0.75,
                                         'stroke-width': 20,
                                         'fill': 'white',
                                         'fill-opacity': 1};
                            if (!sig.view)
                                sig.view = svgArea.path(path);
                            else
                                sig.view.stop();
                            sig.view.attr({'stroke-linecap': 'round'});
                            sig.view.animate(attrs, speed, easing);
                            if (!sig.view.label) {
                                sig.view.label = svgArea.text(sig.position.x,
                                                              sig.position.y,
                                                              sig.key);
                                sig.view.label.node.setAttribute('pointer-events', 'none');
                            }
                            else
                                sig.view.label.stop();
                            sig.view.label.attr({'font-size': 16});
                            sig.view.label.animate({'x': sig.canvas_object.left,
                                                    'y': sig.canvas_object.top,
                                                    'opacity': 1,
                                                    'fill': 'white'},
                                                    speed, easing).toFront();
                            if (first_transition) {
                                set_sig_drag(sig);
                                set_sig_hover(sig);
                            }
                        });
                    });
                    model.maps.each(function(map) {
                        if (   !map.src.view
                            || !map.src.canvas_object
                            || !map.dst.view
                            || !map.dst.canvas_object) {
                            if (map.view) {
                                // remove associated svg element
                                map.view.attr({'arrow-end': 'none'});
                                map.view.animate({'stroke-opacity': 0,
                                                  'fill-opacity': 0}, speed, easing,
                                                 function() {
                                    this.remove();
                                    map.view = null;
                                });
                            }
                            return;
                        }
                        if (!map.view)
                            map.view = svgArea.path();
                        let path = canvas_bezier(map);
                        map.view.attr({'arrow-end': 'block-wide-long'});
                        if (!map.canvas_object) {
                            map.canvas_object = true;
                            let pos = map.src.canvas_object;
                            let x = pos.left + (pos.width * 0.5 + 10);
                            let y = pos.top;
                            map.view.attr({'path': [['M', x, y], ['l', 0, 0]],
                                           'stroke-opacity': 1,
                                           'fill-opacity': 0});
                            let len = Raphael.getTotalLength(path);
                            let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                            map.view.animate({'path': path_mid}, speed * 0.5, easing,
                                             function() {
                                map.view.animate({'path': path}, speed * 0.5, easing);
                            });
                        }
                        else {
                            map.view.animate({'path': path,
                                              'stroke-opacity': 1,
                                              'fill-opacity': 0}, speed, easing);
                        }
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
                        if (dev.view) {
                            // remove associated svg element
                            dev.view.stop();
                            dev.view.animate({'stroke-opacity': 0,
                                              'fill-opacity': 0}, speed, easing,
                                             function() {
                                this.remove();
                                dev.view = null;
                            });
                        }
                        dev.signals.each(function(sig) {
                            let pos = sig.position;
                            let is_output = sig.direction == 'output';
                            if (!sig.view) {
                                sig.view = svgArea.path(circle_path(pos.x, pos.y,
                                                                    is_output ? 7 : 10));
                            }
                            set_sig_hover(sig);
                            let path = circle_path(pos.x, pos.y,
                                                   is_output ? 7 : 10);
                            sig.view.stop();
                            sig.view.animate({'path': path,
                                              'fill': is_output ? 'black' : dev.color,
                                              'fill-opacity': 1,
                                              'stroke': dev.color,
                                              'stroke-width': 6,
                                              'stroke-opacity': sig.direction == 'output' ? 1 : 0},
                                             speed, easing);
                            if (sig.view.label) {
                                sig.view.label.stop();
                                sig.view.label.animate({'x': pos.x, 'y': pos.y,
                                                        'opacity': 0}, speed, easing,
                                                       function() {
                                    this.remove();
                                    sig.view.label = null;

                                });
                            }
                        });
                    });
                    model.maps.each(function(map) {
                        let src = map.src.position;
                        let dst = map.dst.position;
                        if (!map.view)
                            map.view = svgArea.path([['M', src.x, src.y], ['l', 0, 0]]);
                        let mp = new_pos((src.x + dst.x) * 0.5, (src.y + dst.y) * 0.5);
                        mp.x += (mp.x - svg_frame.cx) * 0.2;
                        mp.y += (mp.y - svg_frame.cy) * 0.2;
                        let path = [['M', src.x, src.y],
                                    ['S', mp.x, mp.y, dst.x, dst.y]];
                        let len = Raphael.getTotalLength(path);
                        path = Raphael.getSubpath(path, 10, len - 10);
                        map.view.stop();
                        map.view.animate({'path': path,
                                          'stroke-opacity': 1,
                                          'fill-opacity': 0}, speed, easing,
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
                                                   'fill-opacity': 0.25}).toBack();

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
                                     'fill-opacity': 0.5}, speed, easing);
                    first_transition = false;
                }
                cleanup = function() {
                    if (outline) {
                        outline.remove();
                        outline = null;
                    }
                }
                break;
            case 'load':
                leftTable.collapseAll = true;
                leftTable.filter('output', null);
                leftTable.show_detail(false);

                rightTable.collapseAll = true;
                rightTable.filter('input', null);
                rightTable.show_detail(false);

                var fileRep = {};
                fileRep.devices = [];
                let maps = null;
                let links = {};

                function set_device_target(dev_idx, table, name) {
                    fileRep.devices[dev_idx].target_table = table;
                    fileRep.devices[dev_idx].target_name = name;
                }

                function parse_file(file) {
                    file = JSON.parse(file);
                    console.log("parsing file:", file.fileversion, file.mapping);
                    if (!file.fileversion || !file.mapping) {
                        console.log("unknown file type");
                        return;
                    }
                    if (file.fileversion != "2.2") {
                        console.log("unsupported fileversion", file.fileversion);
                        return;
                    }
                    if (!file.mapping.maps || !file.mapping.maps.length) {
                        console.log("no maps in file");
                        return;
                    }
                    maps = file.mapping.maps;
                    let devs = {};
                    let num_devs = 0;
                    for (var i in maps) {
                        let map = maps[i];
                        for (var j in map.sources) {
                            let dev = map.sources[j].split('/')[0];
                            if (dev in devs)
                                devs[dev].src += 1;
                            else {
                                devs[dev] = {"src": 1, "dst": 0};
                                num_devs += 1;
                            }
                        }
                        for (var j in map.destinations) {
                            let dev = map.destinations[j].split('/')[0];
                            if (dev in devs)
                                devs[dev].dst += 1;
                            else {
                                devs[dev] = {"src": 0, "dst": 1};
                                num_devs += 1;
                            }
                        }
                    }
                    if (num_devs == 0) {
                        console.log("no devices found in file!");
                        return;
                    }
                    let angleInc = Math.PI * 2.0 / num_devs;
                    let count = 0;
                    for (key in devs) {
                        let device = {};
                        device.view = svgArea.path([['M', svg_frame.cx, svg_frame.cy],
                                                    ['l', 0, 0]])
                                             .attr({'stroke-width': '200px',
                                                   'stroke-opacity': 0.5})
                                             .toBack();
                        let pos_x = svg_frame.cx + 200 * Math.sin(count * angleInc);
                        let pos_y = svg_frame.cy + 200 * Math.cos(count * angleInc);
                        device.view.animate({'path': [['M', svg_frame.cx, svg_frame.cy],
                                                      ['L', pos_x, pos_y]]});
                        device.view.index = count;

                        // enable dragging to a different target device
                        device.view.drag(function(dx, dy, x, y, event) {
                            if (x < svg_frame.cx) {
                                set_device_target(this.index, 'left',
                                                  leftTable.row_from_position(x, y).id);
                            }
                            else {
                                set_device_target(this.index, 'right',
                                                  rightTable.row_from_position(x, y).id);
                            }
                            redraw(0, false);
                        });

                        pos_x = svg_frame.cx + 180 * Math.sin(count * angleInc);
                        pos_y = svg_frame.cy + 180 * Math.cos(count * angleInc);
                        device.label = svgArea.text(pos_x, pos_y,
                                                    key+' ('+
                                                    devs[key].src+' src, '+
                                                    devs[key].dst+' dst)');
                        device.label.attr({'font-size': 16, 'fill': 'white'});
                        device.label.node.setAttribute('pointer-events', 'none');

                        device.source_name = key;

                        fileRep.devices.push(device);
                        count += 1;
                    }
                    fileRep.label.attr({'text': 'click to load'});
                    var loaded = true;
                }

                redraw = function(speed, update_tables) {
                    if (speed == null)
                        speed = default_speed;

                    if (update_tables) {
                        leftTable.update(left_th);
                        rightTable.update(right_th);
                    }

                    model.devices.each(function(dev) {
                        dev.signals.each(function(sig) {
                            // remove associated svg elements
                            remove_object_svg(sig);
                        });
                        // TODO: use color to represent device compatibility?
                        // each device in file to be loaded gets unique color
                        // present devices are grey if no match, color if match
                        // may need to represent high compatibility with multiple devices
                        // perhaps we could create a color namespace hash instead?

                        // TODO: enable dragging device connections
                        // TODO: fix pan & zoom
                        // TODO: enable file picker
                        // TODO: parse file for devices
                        // TODO: generate labeled arrows for each device
                        // TODO: add 'click to load button?'
                        // TODO later: namespace matching
                        // TODO: filter out devices with 0 matches
                        // TODO later: represent match ratio with color
                        // TODO later: show recent files
                        // TODO later: discuss versioning, equivalent save view
                        let src = leftTable.row_from_name(dev.name);
                        if (src) {
                            src.left = 0;
                            src.width = left_tw
                        }
                        let dst = rightTable.row_from_name(dev.name);
                        if (dst) {
                            dst.left = container_frame.width - right_tw;
                            dst.width = right_tw;
                        }
                        if (!src && !dst) {
                            if (dev.view) {
                                dev.view.stop();
                                dev.view.animate({'fill-opacity': 0}, speed, easing,
                                                 function() {
                                    this.remove();
                                    dev.view = null;
                                });
                            }
                            return;
                        }
                        let path = list_path(src, dst, false);
                        if (!dev.view) {
                            dev.view = svgArea.path(path).attr({'fill-opacity': 0});
                        }
                        else
                            dev.view.stop();
                        dev.view.toBack();
                        dev.view.animate({'path': path,
                                          'fill': dev.color,
                                          'fill-opacity': 0.5,
                                          'stroke-opacity': 0}, speed, easing);
                    });
                    model.maps.each(function(map) {
                        // remove associated svg elements
                        remove_object_svg(map);
                        // generate link key
                        // TODO: extend to complex maps
                        let srctab = map.src.direction == 'output' ? 'l' : 'r';
                        let dsttab = map.dst.direction == 'output' ? 'l' : 'r';
                        let key = (srctab + '.' + map.src.device.name
                                   + '->'
                                   + dsttab + '.' + map.dst.device.name);
                        let src, dst;
                        if (map.src.direction == 'output') {
                            src = leftTable.row_from_name(map.src.device.name);
                            src.left += left_tw;
                        }
                        else {
                            src = rightTable.row_from_name(map.src.device.name);
                            src.left = container_frame.width - right_tw;
                        }
                        if (!src)
                            return;
                        if (map.dst.direction == 'output') {
                            dst = leftTable.row_from_name(map.dst.device.name);
                            dst.left += left_tw;
                        }
                        else {
                            dst = rightTable.row_from_name(map.dst.device.name);
                            dst.left = container_frame.width - right_tw;
                        }
                        if (!dst)
                            return;
                        let mp = svg_frame.cx;
                        let path;
                        let angle = src.left < dst.left ? 0 : 180;
                        if (srctab == dsttab) {
                            if (src.top == dst.top) {
                                // same row
                                path = [['M', src.left, src.top],
                                        ['S', src.left + src.height, src.cy,
                                         src.left, src.top + src.height],
                                        'Z'];
                            }
                            else {
                                if (src.top > dst.top) {
                                    let temp = src;
                                    src = dst;
                                    dst = temp;
                                    angle = 90;
                                }
                                else
                                    angle == 270;
                                let qp = src.left > mp ? mp + src.height : mp - src.height;
                                path = [['M', src.left, src.top],
                                        ['C', mp, src.top,
                                              mp, dst.top + dst.height,
                                              dst.left, dst.top + dst.height],
                                        ['l', 0, -dst.height],
                                        ['C', qp, dst.top,
                                              qp, src.top + src.height,
                                              src.left, src.top + src.height],
                                        ['Z']];
                            }
                        }
                        else {
                            path = [['M', src.left, src.top],
                                    ['C', mp, src.top, mp, dst.top, dst.left, dst.top],
                                    ['l', 0, dst.height],
                                    ['C', mp, dst.top + dst.height, mp, src.top + src.height,
                                     src.left, src.top + src.height],
                                    ['Z']];
                        }
                        let rgb = Raphael.getRGB(map.src.device.color);
                        let gradient = angle+'-';
                        gradient += 'rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.5)-';
                        rgb = Raphael.getRGB(map.dst.device.color);
                        gradient += 'rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.5)';

                        let link;
                        if (key in links)
                            link = links[key];
                        else {
                            link = svgArea.path([['M', src.left, src.top],
                                                 ['l', 0, src.height],
                                                 ['Z']]);
                            links[key] = link;
                        }
                        link.attr({'fill': gradient, 'stroke-opacity': 0});
                        link.animate({'path': path}, speed, 'linear');
                    });

                    if (first_transition) {
                        // load file representation
                        fileRep.view = svgArea.circle(svg_frame.cx, svg_frame.cy, 100);
                        fileRep.view.attr({'fill': 'black', 'stroke': 'white'});
                        fileRep.view.hover(
                            function() {
                                this.animate({'stroke': 'red',
                                              'stroke-width': 10}, default_speed, 'linear');
                            },
                            function() {
                                this.animate({'stroke': 'black',
                                              'stroke-width': 0}, default_speed, 'linear');

                        });
                        fileRep.view.click(function() {
                            if (maps) {
                                // load file using chosen device mapping
                                for (var i in maps) {
                                    let map = maps[i];
                                    // fix expression
                                    if (map.expression) {
                                        // TODO: better regexp to avoid conflicts with user vars
                                        map.expression = map.expression.replace(/src/g, "x");
                                        map.expression = map.expression.replace(/dst/g, "y");
                                    }

                                    // TODO: extend to support convergent maps
                                    let src = map.sources[0].split('/');
                                    delete map.sources;
                                    let dst = map.destinations[0].split('/');
                                    delete map.destinations;

                                    // find device correspondence
                                    for (var i in fileRep.devices) {
                                        let d = fileRep.devices[i];
                                        if (d.source_name == src[0]) {
                                           src[0] = d.target_name;
                                           break;
                                        }
                                    }
                                    for (var i in fileRep.devices) {
                                        let d = fileRep.devices[i];
                                        if (d.source_name == dst[0]) {
                                           dst[0] = d.target_name;
                                           break;
                                        }
                                    }
                                    src = src.join('/');
                                    dst = dst.join('/');
                                    $('#container').trigger('map', [src, dst, map]);
                                }
                                fileRep.label.attr({'text': 'select file'});
                            }
                            // remove any existing device reps
                            for (var i in fileRep.devices) {
                                let dev = fileRep.devices[i];
                                if (dev.label)
                                    dev.label.animate({'stroke-opacity': 0}, default_speed,
                                                       'linear', function() {
                                        this.remove();
                                    });
                                if (dev.view)
                                    dev.view.animate({'stroke-opacity': 0}, default_speed,
                                                      'linear', function() {
                                        this.remove();
                                    });
                            }
                            if (maps) {
                                maps = null;
                                return;
                            }
                            var input = $(document.createElement("input"));
                            input.attr("type", "file");
                            // add onchange handler if you wish to get the file :)
                            input.on('change', function(e) {
                                f = e.target.files[0];
                                let reader = new FileReader();
                                reader.onload = (function(file) {
                                    return function(e) {
                                        parse_file(e.target.result)
                                    };
                                })(f);
                                reader.readAsText(f);
                            });
                            input.trigger("click"); // open dialog
                            return false; // avoiding navigation
                        });

                        fileRep.label = svgArea.text(svg_frame.cx, svg_frame.cy, 'select file');
                        fileRep.label.attr({'font-size': 36,
                                           'fill': 'white'});
                        fileRep.label.node.setAttribute('pointer-events', 'none');
                        first_transition = false;
                    }

                    for (var i in fileRep.devices) {
                        let dev = fileRep.devices[i];
                        let target_table = dev.target_table;
                        let target_name = dev.target_name;
                        if (!target_table || !target_name) {
                            continue;
                        }
                        let color = model.devices.find(target_name).color;
                        let target;
                        if (target_table == 'left')
                            target = leftTable.row_from_name(target_name);
                        else if (target_table == 'right')
                            target = rightTable.row_from_name(target_name);
                        else
                            continue;
                        if (!target)
                            continue;
                        let path;

                        if (target_table == 'left') {
                            path = [['M', svg_frame.cx, svg_frame.cy],
                                    ['S', svg_frame.cx, target.cy,
                                          left_tw, target.cy]];
                            dev.label.attr({'x': left_tw + 10,
                                            'y': target.cy,
                                            'text-anchor': 'start'});
                        }
                        else {
                            path = [['M', svg_frame.cx, svg_frame.cy],
                                    ['S', svg_frame.cx, target.cy,
                                          container_frame.width - right_tw, target.cy]];
                            dev.label.attr({'x': container_frame.width - right_tw - 10,
                                            'y': target.cy,
                                            'text-anchor': 'end'});
                        }
                        dev.view.attr({'path': path,
                                       'stroke-width': target.height,
                                       'stroke': color,
                                       'stroke-opacity': 0.5});
                    }
                };

                cleanup = function() {
                    leftTable.collapseAll = false;
                    rightTable.collapseAll = false;
                    if (!fileRep)
                        return
                    for (var i in fileRep.devices) {
                        let dev = fileRep.devices[i];
                        if (dev.label)
                            dev.label.remove();
                        if (dev.view)
                            dev.view.remove();
                    }
                    if (fileRep.label)
                        fileRep.label.remove();
                    if (fileRep.view)
                        fileRep.view.remove();
                    for (var i in links) {
                        links[i].animate({'fill-opacity': 0}, default_speed, 'linear',
                                         function() {
                            this.remove();
                        });
                    }
                    links = null;
                }
                break;
        }
        if (first_transition) {
            redraw(default_speed, true);
            setTimeout(arrange_tables, default_speed);
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
        return { 'x': x != null ? x : Math.random() * svg_frame.width,
                 'y': y != null ? y : Math.random() * svg_frame.height };
    }

    function update_devices(dev, event) {
        if (event == 'removing' && dev.view) {
            dev.view.remove();
            dev.view = null;
            return;
        }
        else if (event == 'added' && !dev.view) {
            dev.color = Raphael.getColor();
            if (currentView == 'grid' || currentView == 'hive') {
                let pos = new_pos(50, svg_frame.height - 50);
                dev.view = svgArea.path()
                                .attr({'path': [['M', pos.x, pos.y], ['l',0, 0]],
                                       'stroke': dev.color,
                                       'fill': 'lightgray',
                                       'stroke-opacity': 0,
                                       'fill-opacity': 0});
            }
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
            if (sig.view.label) {
                sig.view.label.remove();
                sig.view.label = null;
            }
            sig.view.remove();
            sig.view = null;
        }
        else if (event == 'added' && !sig.view) {
            sig.position = new_pos(50, svg_frame.height - 50);
            if (currentView == 'list' || currentView == 'canvas' || currentView == 'grid')
                return;
            if (repaint)
                redraw(default_speed, true);
        }
        else if (event == 'removed')
            redraw(default_speed, true);
    }

    function update_maps(map, event) {
        if (event == 'removing' && map.view) {
            map.view.remove();
            map.view = null;
            return;
        }
        else if (event == 'added' && !map.view) {
            redraw();
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
                    sig.position = new_pos();
                });
            });
            redraw();
        }
        else if (e.which == 27) {
            escaped = true;
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
        else if (currentView == 'list' || currentView == 'load') {
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
        else if (currentView == 'list' || currentView == 'load') {
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
        if (!text || !text.length)
            text = 'empty';
        if (searchbar == 'srcSearch') {
            srcregexp = text ? new RegExp(text, 'i') : null;
            if (currentView == 'list' || currentView == 'canvas')
                leftTable.filter(null, text);
            else if (currentView == 'grid')
                topTable.filter(null, text);
        }
        else {
            dstregexp = text ? new RegExp(text, 'i') : null;
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
            if (dragging)
                return;
            escaped = false;

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
                if (stop == true || escaped == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                update = false;
                model.maps.each(function(map) {
                    if (!map.view || map.view.selected)
                        return;
                    if (edge_intersection(map.view, x1, y1, x2, y2)) {
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
            escaped = false;
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
            if ($(src_row).hasClass('device')) {
                let dev = model.devices.find(src_row.id);
                if (dev) {
                    dev.collapsed = dev.collapsed == true ? false : true;
                    redraw(200, true);
                }
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

                var color = 'white';
                if (currentView == 'canvas') {
                    let devname = src_row.id.split('\\')[0];
                    let dev = model.devices.find(devname);
                    if (dev)
                        color = dev.color;
                }

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    if (escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        set_cursor_attributes('none');
                        if (cursorLabel) {
                            cursorLabel.remove();
                            cursorLabel = null;
                        }
                        return;
                    }
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
                        path = canvas_rect_path(temp);
                        cursor.attr({'path': path, 'stroke': color,
                                     'stroke-opacity': 0.75 });
                        cursorLabel.attr({'x': temp.left, 'y': temp.top,
                                          'fill': 'white'});
                        return;
                    }

                    if (left_attract != null && x < left_attract) {
                        // snap to left table
                        rightTable.highlight_row(null, true);
                        topTable.highlight_row(null, true);
                        dst_table = leftTable;
                        dst = dst_table.row_from_position(e.pageX, e.pageY);
                        if (dst) {
                            if (dst.id == src.id)
                                return;
                            if ($(dst).hasClass('device'))
                                return;
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
                            if (dst.id == src.id)
                                return;
                            if ($(dst).hasClass('device'))
                                return;
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
                            if (dst.id == src.id)
                                return;
                            if ($(dst).hasClass('device'))
                                return;
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
                            path = self_path(src.cx + 200, 200,
                                             dst.cx + 200, 200);
                        else if (currentView == 'grid')
                            path = self_path(src.left, src.cy + 180,
                                             src.left, y + 180);
                        else
                            path = self_path(src.left, src.cy, src.left, y);
                    }
                    else if (currentView == 'grid') {
                        // draw crosshairs and triangle pointing from src to dst
                        if (src_table == leftTable) {
                            let dstHalfWidth = dst.width * 0.5;
                            path = [['M', 200, src.top + 180],
                                    ['l', dst.left, 0],
                                    ['l', dstHalfWidth, 20 - src.top],
                                    ['l', dstHalfWidth, src.top + src.height - 20],
                                    ['l', -dst.left - dst.width, 0],
                                    ['Z']];
                        }
                        else {
                            let dstHalfHeight = dst.height * 0.5;
                            path = [['M', src.left + 200, 200],
                                    ['l', 0, dst.top - 20],
                                    ['l', -src.left, dstHalfHeight],
                                    ['l', src.left + src.width, dstHalfHeight],
                                    ['l', 0, -dst.top - dst.height],
                                    ['Z']];
                        }
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
                        if (!sig)
                            return;
                        if (!sig.view) {
                            sig.view = svgArea.path(circle_path(sig.position.x,
                                                                sig.position.y, 10));
                        }
                        if (!sig.view.label) {
                            sig.view.label = svgArea.text(sig.position.x,
                                                          sig.position.y,
                                                          sig.key);
                            sig.view.label.node.setAttribute('pointer-events', 'none');
                        }
                        else if (sig.canvas_object) {
                            // for now we only allow one instance of signal on canvas
                            return;
                        }
                        let obj = {'left': e.pageX - container_frame.left,
                                   'top': e.pageY - container_frame.top,
                                   'width': labelwidth(sig.key),
                                   'height': 20};
                        constrain(obj, svg_frame, 5);
                        sig.canvas_object = obj;
                        sig.view.attr({'path': canvas_rect_path(sig.canvas_object),
                                       'stroke-width': 20,
                                       'stroke-opacity': 0.75,
                                       'stroke': sig.device.color });
                        sig.view.label.attr({'x': obj.left,
                                             'y': obj.top,
                                             'fill': 'white',
                                             'opacity': 1}).toFront();
                        set_sig_drag(sig);
                        set_sig_hover(sig);
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
