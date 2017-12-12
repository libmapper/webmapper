//++++++++++++++++++++++++++++++++++++++//
//         Canvas View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class CanvasView extends View {
    constructor(frame, tables, canvas, model) {
        super('canvas', frame, {'left': tables.left}, canvas, model);

        // set left table properties
        this.tables.left.filterByDirection('both');
        this.tables.left.showDetail(true);

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        // remove device and unused signal svg
        let self = this;
        this.model.devices.each(function(dev) {
            remove_object_svg(dev);
            dev.signals.each(function(sig) {
                if (!sig.canvas_object)
                    remove_object_svg(sig);
                else {
                    self.set_sig_hover(sig);
                    self.set_sig_drag(sig);
                }
            });
        });

        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, 0, this.frame.width * 0.25, this.frame.height,
                                0, duration, function() {self.draw()});
        this.mapPane.left = this.frame.width * 0.25;
        this.mapPane.width = this.frame.width * 0.75;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    setSigHover(sig) {
        sig.view.hover(
            function() {
                if (draggingFrom == null)
                   return;
                if (sig == draggingFrom) {
                   // don't snap to self
                   return;
                }
                // snap to sig object
                let src = draggingFrom.canvas_object;
                let dst = sig.canvas_object;
                let src_offset = src.width * 0.5 + 10;
                let dst_offset = dst.width * 0.5 + 10;
                let path = null;
                if (dragging == 'left') {
                   path = [['M', src.left - src_offset, src.top],
                           ['C', src.left - src_offset * 3, src.top,
                            dst.left + dst_offset * 3, dst.top,
                            dst.left + dst_offset, dst.top]];
                }
                else {
                   path = [['M', src.left + src_offset, src.top],
                           ['C', src.left + src_offset * 3, src.top,
                            dst.left - dst_offset * 3, dst.top,
                            dst.left - dst_offset, dst.top]];
                }
                snappingTo = sig;
                new_map.attr({'path': path});
                return;
            },
            function() {
                snappingTo = null;
            }
        );
    }

    // override signal drag so we can move signal representation around
    setSigDrag(sig) {
        let self = this;
        sig.view.mouseup(function() {
            if (draggingFrom && snappingTo) {
                $('#container').trigger('map', [draggingFrom.key, snappingTo.key]);
                if (self.newMap) {
                    self.newMap.remove();
                    self.newMap = null;
                }
            }
            else if (trashing) {
                sig.view.label.remove();
                sig.view.remove();
                sig.view = null;
                sig.canvas_object = null;
                trashing = false;
                self.redraw(0, false);
            }
        });
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (escaped) {
                    self.draggingFrom = null;
                    delete sig.canvas_object.drag_offset;
                    dragging = null;
                    trashing = false;
                    if (self.newMap) {
                        self.newMap.remove();
                        self.newMap = null;
                    }
                    return;
                }
                let obj = sig.canvas_object;
                if (dragging == 'obj') {
                    obj.left = x + obj.drag_offset.x;
                    obj.top = y + obj.drag_offset.y;
                    constrain(obj, self.mapPane, 5);

                    sig.view.stop()
                    sig.view.attr({'path': canvas_rect_path(obj)});
                    sig.view.label.attr({'x': obj.left,
                                         'y': obj.top,
                                         'opacity': 1}).toFront();

                    x -= self.mapPane.width + map_pane.left;
                    y -= self.mapPane.height + frame.top;
                    let dist = Math.sqrt(x * x + y * y)
                    if (dist < 100) {
                        sig.view.attr({'stroke': 'gray'});
                        trashing = true;
                    }
                    else {
                        sig.view.attr({'stroke': sig.device.color});
                        trashing = false;
                    }
                    self.redraw(0, false);
                    return;
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
                    x -= frame.left;
                    y -= frame.top;
                    let path = [['M', obj.left + offset, obj.top],
                                ['C', obj.left + offset * 3, obj.top,
                                 x - offset * 3, y, x, y]];
                    new_map.attr({'path': path,
                                  'stroke': 'white',
                                  'stroke-opacity': 1,
                                  'arrow-start': arrow_start,
                                  'arrow-end': arrow_end});
                }
            },
            function(x, y, event) {
                escaped = false;
                draggingFrom = sig;
                let obj = sig.canvas_object;
                obj.drag_offset = position(obj.left - x, obj.top - y);
                if (x < obj.left - obj.width * 0.5 + 5)
                    dragging = 'left';
                else if (x > obj.left + obj.width * 0.5 - 5)
                    dragging = 'right';
                else
                    dragging = 'obj';
                self.newMap = canvas.path();
            },
            function(x, y, event) {
                draggingFrom = null;
                if (sig.canvas_object)
                    delete sig.canvas_object.drag_offset;
                dragging = null;
                if (self.newMap) {
                    self.newMap.remove();
                    self.newMap = null;
                }
            }
        );
    }

    drawSignal(sig, duration) {
        if (!sig.canvas_object) {
            // remove associated svg element
            remove_object_svg(sig);
            return;
        }
        let path = canvas_rect_path(sig.canvas_object);

        let attrs = {'path': path,
                     'stroke': sig.device.color,
                     'stroke-opacity': 0.75,
                     'stroke-width': 20,
                     'fill': 'white',
                     'fill-opacity': 1};
        if (!sig.view) {
            sig.view = canvas.path(path);
            this.setSigHover(sig);
            this.setSigDrag(sig);
        }
        else {
            sig.view.stop();
            if (first_draw) {
                set_sig_hover(sig);
                set_sig_drag(sig);
            }
        }
        sig.view.attr({'stroke-linecap': 'round'});
        sig.view.animate(attrs, duration, '>');
        if (!sig.view.label) {
            let key = (sig.direction == 'input') ? '→ ' + sig.key : sig.key + ' →';
            sig.view.label = canvas.text(sig.position.x, sig.position.y, key);
            sig.view.label.node.setAttribute('pointer-events', 'none');
        }
        else
            sig.view.label.stop();
        sig.view.label.attr({'font-size': 16});
        sig.view.label.animate({'x': sig.canvas_object.left,
                                'y': sig.canvas_object.top,
                                'opacity': 1,
                                'fill': 'white'},
                               duration, '>').toFront();
    }

    drawMaps(duration) {
        // todo: add optional mapAttachPoint to sig representation
        // if present, use it instead of table
        // needs direction
        let self = this;
        model.maps.each(function(map) {
            if (!map.view)
                return;
            map.view.stop();
            let path = canvas_bezier(map, self.tables.left, self.mapPane.left);
            if (!path) {
                console.log("failed to create bezier path");
                return;
            }
            let color;
            let len = Raphael.getTotalLength(path) * 0.5;
            if (map.src.canvas_object && map.dst.canvas_object)
                color = 'white';
            else
                color = 'lightgray';
            if (map.view.new) {
                map.view.attr({'path': [['M', path[0][1], path[0][2]],
                                        ['l', 0, 0]],
                               'stroke-opacity': 1,
                               'fill-opacity': 0});
                let path_mid = Raphael.getSubpath(path, 0, len);
                map.view.animate({'path': path_mid}, duration * 0.5, '>',
                                 function() {
                    map.view.animate({'path': path}, duration * 0.5, '>');
                });
                map.view.new = false;
            }
            else {
                map.view.animate({'path': path,
                                  'stroke-opacity': 1,
                                  'fill-opacity': 0}, duration, '>');
            }
            map.view.attr({'stroke-width': 2,
                           'arrow-end': 'block-wide-long',
                           'stroke': color});
        });
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
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0)
            this.updateDevices();
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawMaps(duration);
    }

    pan(x, y, delta_x, delta_y) {
        if (x < this.tables.left.frame.width)
            this.tablePan(x, y, delta_x, delta_y);
        else
            this.canvasPan(x, y, delta_x, delta_y);
    }

    zoom(x, y, delta) {
        if (x < this.tables.left.frame.width)
            this.tableZoom(x, y, delta);
        else
            this.canvasZoom(x, y, delta);
    }

//    $('.tableDiv').on('mousedown', 'tr', function(e) {
//        escaped = false;
//        var src_row = this;
//        if ($(src_row).hasClass('device')) {
//            let dev = model.devices.find(src_row.id);
//            if (dev) {
//                dev.collapsed ^= 1;
//                redraw(200, true);
//            }
//            return;
//        }
//
//        $('svg').one('mouseenter.drawing', function() {
//            deselect_all_maps();
//
//            var src = tables.left.row_from_name(src_row.id.replace('\\/', '\/'));
//            src.left += src.width;
//            src.cx += src.width;
//            var dst = null;
//            var width = labelwidth(src.id);
//
//            // add object to canvas
//            let sig = model.find_signal(src.id);
//            if (!sig)
//                return;
//
//            let x = e.pageX - frame.left;
//            let y = e.pageY - frame.top;
//
//            if (!sig.view) {
//                sig.view = canvas.path().attr({'stroke-width': 20,
//                                               'stroke-opacity': 0.75,
//                                               'stroke': sig.device.color,
//                                               'stroke-linecap': 'round'});
//                sig.view.label = canvas.text(x, y, sig.key)
//                                       .attr({'fill': 'white',
//                                              'opacity': 1,
//                                              'font-size': 16})
//                                       .toFront();
//                sig.view.label.node.setAttribute('pointer-events', 'none');
//            }
//
//            // draw canvas object
//            let temp = { 'left': x, 'top': y, 'width': width, 'height': 20 };
//            constrain(temp, map_pane, 5);
//            sig.view.attr({'path': canvas_rect_path(temp)});
//
//            $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
//                if (escaped) {
//                    $(document).off('.drawing');
//                    $('svg, .displayTable tbody tr').off('.drawing');
//                    return;
//                }
//                let x = e.pageX - frame.left;
//                let y = e.pageY - frame.top;
//
//                // draw canvas object
//                let temp = { 'left': x, 'top': y, 'width': width, 'height': 20 };
//                constrain(temp, map_pane, 5);
//                sig.view.attr({'path': canvas_rect_path(temp)});
//                sig.view.label.attr({'x': temp.x, 'y': temp.y}).toFront();
//            });
//            $(document).on('mouseup.drawing', function(e) {
//                $(document).off('.drawing');
//                $('svg, .displayTable tbody tr').off('.drawing');
//
//                let obj = { 'left': e.pageX - frame.left,
//                            'top': e.pageY - frame.top,
//                            'width': labelwidth(sig.key),
//                            'height': 20 };
//                constrain(obj, map_pane, 5);
//                sig.canvas_object = obj;
//
//                set_sig_drag(sig);
//                set_sig_hover(sig);
//                redraw(1000, false);
//            });
//        });
//        $(document).one('mouseup.drawing', function(e) {
//            $(document).off('.drawing');
//        });
//    });

    cleanup() {
        super.cleanup();

        // clean up any objects created only for this view
        model.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view)
                    sig.view.undrag();
            });
        });
    }
}
