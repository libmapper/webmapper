//++++++++++++++++++++++++++++++++++++++//
//         Canvas View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class CanvasView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('canvas', frame, {'left': tables.left}, canvas, database, tooltip,
              CanvasMapPainter);

        // set left table properties
        this.tables.left.filterByDirection('both');
        this.tables.left.showDetail(true);
        this.tables.left.expand = true;
        this.tables.left.ignoreCanvasObjects = true;

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        this.setCanvasTableDrag();

        // remove device and unused signal svg
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.canvasObject)
                    self.setSigPosition(sig);
                else
                    remove_object_svg(sig);
                else if (sig.view) {
                    self.setSigHover(sig);
                    self.setSigDrag(sig);
                }
            });
            if (!dev.view)
                return;
            // remove device labels
            if (dev.view.label) {
                dev.view.label.remove();
                dev.view.label = null;
            }
        });

        this.leftExpandWidth = 200;
        this.resize(null, 500);

        this.dragging = null;
        this.trashing = false;
    }

    _resize(duration) {
        let self = this;
        this.tables.left.adjust(0, 0, this.leftExpandWidth, this.frame.height,
                                0, duration, function() {self.draw()}, 0, 0);
        this.mapPane.left = this.leftExpandWidth;
        this.mapPane.width = this.frame.width - this.leftExpandWidth;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    setSigHover(sig) {
        let self = this;
        sig.view.hover(
            function() {
                if (self.draggingFrom == null)
                   return;
                if (sig == self.draggingFrom) {
                   // don't snap to self
                   return;
                }
                // snap to sig object
                let src = self.draggingFrom.canvasObject;
                let dst = sig.canvasObject;
                let src_offset = src.width * 0.5 + 10;
                let dst_offset = dst.width * 0.5 + 10;
                let path = null;
                if (self.dragging == 'left') {
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
                self.snappingTo = sig;
                self.newMap.attr({'path': path});
                return;
            },
            function() {
                self.snappingTo = null;
            }
        );
    }

    // override signal drag so we can move signal representation around
    setSigDrag(sig) {
        let self = this;
        sig.view.mouseup(function() {
            if (self.draggingFrom && self.snappingTo) {
                $('#container').trigger('map', [self.draggingFrom.key,
                                                self.snappingTo.key]);
                if (self.newMap) {
                    self.newMap.remove();
                    self.newMap = null;
                }
            }
            else if (self.trashing) {
                sig.view.label.remove();
                sig.view.remove();
                sig.view = null;
                sig.canvasObject = null;
                self.trashing = false;
                // update table to replace signal row and position getters
                self.tables.left.update();
                // update maps
                self.drawMaps();
            }
        });
        sig.view.drag(
            function(dx, dy, x, y, event) {
                x = x * self.svgZoom + self.svgPosX;
                y = y * self.svgZoom + self.svgPosY;
                if (self.escaped) {
                    self.draggingFrom = null;
                    delete sig.canvasObject.drag_offset;
                    self.dragging = null;
                    self.trashing = false;
                    if (self.newMap) {
                        self.newMap.remove();
                        self.newMap = null;
                    }
                    return;
                }
                let obj = sig.canvasObject;
                if (self.dragging == 'obj') {
                    obj.left = x + obj.drag_offset.x;
                    obj.top = y + obj.drag_offset.y;
                    constrain(obj, self.mapPane, 5);

                    sig.view.stop()
                    sig.view.attr({'path': canvas_rect_path(obj)});
                    sig.view.label.attr({'x': obj.left,
                                         'y': obj.top,
                                         'opacity': 1})
                                  .toFront();

                    x -= self.mapPane.width + self.mapPane.left;
                    y -= self.mapPane.height + self.frame.top;
                    let dist = Math.sqrt(x * x + y * y)
                    if (dist < 100) {
                        sig.view.attr({'stroke': 'gray'});
                        self.trashing = true;
                    }
                    else {
                        sig.view.attr({'stroke': sig.device.color});
                        self.trashing = false;
                    }

                    // TODO: only redraw maps associated with this signal
                    self.drawMaps();
                    return;
                }
                else if (!self.snappingTo) {
                    let offset = obj.width * 0.5 + 10;
                    let arrow_start = 'none';
                    let arrow_end = 'none';
                    if (self.dragging == 'left') {
                        offset *= -1;
                        arrow_start = 'block-wide-long';
                    }
                    else
                        arrow_end = 'block-wide-long';
                    x -= self.frame.left;
                    y -= self.frame.top;
                    let path = [['M', obj.left + offset, obj.top],
                                ['C', obj.left + offset * 3, obj.top,
                                 x - offset * 3, y, x, y]];
                    self.newMap.attr({'path': path,
                                      'stroke': 'white',
                                      'stroke-opacity': 1,
                                      'arrow-start': arrow_start,
                                      'arrow-end': arrow_end});
                }
            },
            function(x, y, event) {
                x = x * self.svgZoom + self.svgPosX;
                y = y * self.svgZoom + self.svgPosY;
                self.escaped = false;
                self.draggingFrom = sig;
                let obj = sig.canvasObject;
                obj.drag_offset = position(obj.left - x, obj.top - y);
                if (x < obj.left - obj.width * 0.5 + 5)
                    self.dragging = 'left';
                else if (x > obj.left + obj.width * 0.5 - 5)
                    self.dragging = 'right';
                else
                    self.dragging = 'obj';
                self.newMap = self.canvas.path();
            },
            function(x, y, event) {
                self.draggingFrom = null;
                if (sig.canvasObject)
                    delete sig.canvasObject.drag_offset;
                self.dragging = null;
                if (self.newMap) {
                    self.newMap.remove();
                    self.newMap = null;
                }
            }
        );
    }

    drawSignal(sig, duration) {
        if (!sig.canvasObject) {
            // remove associated svg element
            remove_object_svg(sig);
            return;
        }
        let path = canvas_rect_path(sig.canvasObject);

        let attrs = {'path': path,
                     'stroke': sig.device.color,
                     'stroke-opacity': 0.75,
                     'stroke-width': 20,
                     'fill': 'white',
                     'fill-opacity': 1};
        if (!sig.view) {
            sig.view = this.canvas.path(path);
            this.setSigHover(sig);
            this.setSigDrag(sig);
        }
        else
            sig.view.stop();
        sig.view.attr({'stroke-linecap': 'round'});
        sig.view.animate(attrs, duration, '>');
        if (!sig.view.label) {
            let key = (sig.direction == 'input') ? '• ' + sig.key : sig.key + ' •';
            sig.view.label = this.canvas.text(sig.position.x, sig.position.y, key);
            sig.view.label.node.setAttribute('pointer-events', 'none');
        }
        else
            sig.view.label.stop();
        sig.view.label.attr({'font-size': 16})
                      .toFront();
        sig.view.label.animate({'x': sig.canvas_object.left,
                                'y': sig.canvas_object.top,
                                'opacity': 1,
                                'fill': 'white'},
                               duration, '>');
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
            let grow = false;
            if (this.tables.left.expandWidth != this.leftExpandWidth) {
                this.leftExpandWidth = this.tables.left.expandWidth;
                grow = true;
            }
            if (grow)
                this.resize(null, 500);
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    draw(duration) {
        this.drawSignals(duration);
        this.drawMaps(duration);
    }

    pan(x, y, delta_x, delta_y) {
        if (x < this.tables.left.frame.width)
            this.tablePan(x, y, delta_x, delta_y);
        else {
            this.canvasPan(x, y, delta_x, delta_y);
            this.drawMaps(0);
        }
    }

    zoom(x, y, delta) {
        if (x < this.tables.left.frame.width)
            this.tableZoom(x, y, delta);
        else {
            this.canvasZoom(x, y, delta);
            this.drawMaps();
        }
    }

    resetPanZoom() {
        super.resetPanZoom();
        this.drawMaps();
    }

    setCanvasTableDrag() {
        let self = this;
        let table = this.tables.left;
        $('.tableDiv').off('mousedown');
        $('.tableDiv').on('mousedown', 'td.leaf', function(e) {
            self.escaped = false;
            var src_row = $(this).parent('tr')[0];

            $('#svgDiv').one('mouseenter.drawing', function() {
                deselectAllMaps(self.tables);
                var src = table.getRowFromName(src_row.id);
                var dst = null;
                var width = labelwidth(src.id);

                // add object to canvas
                let sig = self.database.find_signal(src.id);
                if (!sig)
                    return;

                sig.canvasObject = {'left': e.pageX - self.frame.left,
                                    'top': e.pageY - self.frame.top,
                                    'width': labelwidth(sig.key),
                                    'height': 20 };
                constrain(sig.canvasObject, self.mapPane, 5);
                self.setSigPosition(sig);
                self.drawSignal(sig);
                // remove signal from table
                table.update();
                // TODO: only redraw maps associated with this signal
                self.drawMaps();

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    if (self.escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        return;
                    }
                    sig.canvasObject = {'left': e.pageX - self.frame.left,
                                        'top': e.pageY - self.frame.top,
                                        'width': labelwidth(sig.key),
                                        'height': 20 };
                    constrain(sig.canvasObject, self.mapPane, 5);
                    self.drawSignal(sig);
                    // TODO: only redraw maps associated with this signal
                    self.drawMaps();
                });
                $(document).on('mouseup.drawing', function(e) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');

                    self.setSigDrag(sig);
                    self.setSigHover(sig);
                });
            });
            $(document).one('mouseup.drawing', function(e) {
                $(document).off('.drawing');
            });
        });
    }

    setSigPosition(sig) {
        let o = sig.canvasObject;
        sig.position = {
            get left() {return o.left},
            set left(nl) {delete this.left; this.left = nl;},
            get top() {return o.top;},
            set top(nt) {delete this.top; this.top = nt;},
            get height() {return o.height;},
            set height(nh) {delete this.height; this.height = nh;},
            get width() {return o.width;},
            set width(nw) {delete this.width; this.width = nw;},
//            get x() {return row.x;},
//            set x(newx) {delete this.x; this.x = newx;},
//            get vx() {return row.vx;},
//            set vx(newx) {delete this.vx; this.vx = newx;},
            get y() {return o.top;},
            set y(newy) {delete this.y; this.y = newy;},
//            get vy() {return row.vy;},
//            set vy(newy) {delete this.vy; this.vy = newy;}
        };
    }

    cleanup() {
        super.cleanup();
        delete this.dragging;
        delete this.trashing;

        // clean up any objects created only for this view
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                sig.view.undrag();
                if (sig.view.label)
                    sig.view.label.remove();
            });
        });

        this.setTableDrag();
        this.tables.left.ignoreCanvasObjects = false;
    }
}

class CanvasMapPainter extends ListMapPainter
{
    constructor(map, canvas) {super(map, canvas);}

    updatePaths() {
        // draw a curved line from src to dst
        let src = this.map.src.position;
        let dst = this.map.dst.position;

        let src_cx, dst_cx;
        if (src.vx != undefined)
            src_cx = src.x + src.width * 0.5;
        else {
            let offset = src.width * 0.5 + 10;
            src.x = src.left + offset;
            src_cx = src.left + offset * 3;
        }
        if (dst.vx != undefined)
            dst_cx = dst.x + dst.width * 0.5;
        else {
            let offset = dst.width * -0.5 - 10;
            dst.x = dst.left + offset;
            dst_cx = dst.left + offset * 3;
        }

        this.pathspecs[0] = [['M', src.x, src.y],
                             ['C', src_cx, src.y, dst_cx, dst.y, dst.x, dst.y]];
        console.log(this.pathspecs[0]);
    }
}
