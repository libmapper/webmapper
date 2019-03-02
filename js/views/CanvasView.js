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
        // update table to remove rows with associated canvasObjects
        this.tables.left.update();

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        this.setCanvasTableDrag();

        // remove device and unused signal svg
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (!sig.canvasObject) {
                    remove_object_svg(sig);
                    return;
                }
                let o = sig.canvasObject;
                sig.position.left = o.left;
                sig.position.top = o.top;
                sig.position.width = o.width;
                sig.position.height = o.height;
                if (sig.view) {
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
                let src = self.draggingFrom.position;
                let dst = sig.position;
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
                x = x * self.canvas.zoom + self.canvas.pan.x;
                y = y * self.canvas.zoom + self.canvas.pan.y;
                let p = sig.position;
                if (self.escaped) {
                    self.draggingFrom = null;
                    delete p.drag_offset;
                    self.dragging = null;
                    self.trashing = false;
                    if (self.newMap) {
                        self.newMap.remove();
                        self.newMap = null;
                    }
                    return;
                }
                if (self.dragging == 'obj') {
                    sig.position.left = x + p.drag_offset.x;
                    p.top = y + p.drag_offset.y;
                    constrain(p, self.mapPane, 5);
                    self.drawSignal(sig);

                    x -= self.mapPane.width + self.mapPane.left;
                    y -= self.mapPane.height + self.frame.top;
                    let dist = Math.sqrt(x * x + y * y)
                    if (dist < 100) {
                        sig.view.attr({'stroke': 'gray'});
                        self.trashing = true;
                    }
                    else {
                        sig.view.attr({'stroke': Raphael.hsl(sig.device.hue, 1, 0.3)});
                        self.trashing = false;
                    }

                    self.drawMaps(0, sig);
                    return;
                }
                else if (!self.snappingTo) {
                    let offset = p.width * 0.5 + 10;
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
                    let path = [['M', p.left + offset, p.top],
                                ['C', p.left + offset * 3, p.top,
                                 x - offset * 3, y, x, y]];
                    self.newMap.attr({'path': path,
                                      'stroke': 'white',
                                      'stroke-opacity': 1,
                                      'arrow-start': arrow_start,
                                      'arrow-end': arrow_end});
                }
            },
            function(x, y, event) {
                x = x * self.canvas.zoom + self.canvas.pan.x;
                y = y * self.canvas.zoom + self.canvas.pan.y;
                self.escaped = false;
                self.draggingFrom = sig;
                let p = sig.position;
                p.drag_offset = position(p.left - x, p.top - y);
                if (x < p.left - p.width * 0.5 + 5)
                    self.dragging = 'left';
                else if (x > p.left + p.width * 0.5 - 5)
                    self.dragging = 'right';
                else
                    self.dragging = 'obj';
                self.newMap = self.canvas.path();
            },
            function(x, y, event) {
                self.draggingFrom = null;
                if (sig.canvasObject)
                    delete sig.position.drag_offset;
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
        let path = [['M', sig.position.left - sig.position.width * 0.5, sig.position.top],
                    ['l', sig.position.width, 0]];

        let attrs = {'path': path,
                     'stroke': Raphael.hsl(sig.device.hue, 1, 0.3),
                     'stroke-opacity': 1,
                     'stroke-width': sig.canvasObject.height,
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
            sig.view.label = this.canvas.text(sig.position.left, sig.position.top, key);
            sig.view.label.node.setAttribute('pointer-events', 'none');
        }
        else
            sig.view.label.stop();
        sig.view.label.toFront();
        sig.view.label.attr({'font-size': 16});
        sig.view.label.animate({'x': sig.position.left,
                                'y': sig.position.top,
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

                sig.canvasObject = true;
                sig.position.left = e.pageX - self.frame.left;
                sig.position.top = sig.position.y = e.pageY - self.frame.top;

                sig.position.width = labelwidth(sig.key);
                sig.position.height = 20;
                constrain(sig.position, self.mapPane, 5);
                self.drawSignal(sig);
                // remove signal from table
                table.update();
                self.drawMaps();

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    if (self.escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        return;
                    }
                    sig.position.left = e.pageX - self.frame.left;
                    sig.position.top = e.pageY - self.frame.top;
                    constrain(sig.position, self.mapPane, 5);
                    self.drawSignal(sig);
                    self.drawMaps(0, sig);
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

    cleanup() {
        super.cleanup();
        delete this.dragging;
        delete this.trashing;

        this.tables.left.ignoreCanvasObjects = false;

        // clean up any objects created only for this view
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                sig.view.undrag();
                if (sig.view.label)
                    sig.view.label.remove();
                // cache canvas object positions
                // TODO: use signalPainter instead?
                sig.canvasObject = {left: sig.position.left,
                                    top: sig.position.top,
                                    width: sig.position.width,
                                    height: sig.position.height};
            });
        });
        this.tables.left.update();
        this.setTableDrag();
    }
}

class CanvasMapPainter extends ListMapPainter
{
    constructor(map, canvas) {super(map, canvas);}

    updatePaths() {
        // draw a curved line from src to dst
        let src = this.map.src.position;
        let dst = this.map.dst.position;

        let src_x, src_cx, src_y, dst_x, dst_cx, dst_y;

        if (this.map.src.canvasObject) {
            let offset = src.width * 0.5 + 10;
            src_x = src.left + offset;
            src_cx = src.left + offset * 3;
            src_y = src.top;
        }
        else {
            src_x = src.x * this.canvas.zoom + this.canvas.pan.x;
            src_cx = src_x + src.width * this.canvas.zoom * 0.5;
            src_y = src.y * this.canvas.zoom + this.canvas.pan.y;
        }

        if (this.map.dst.canvasObject) {
            let offset = dst.width * -0.5 - 10;
            dst_x = dst.left + offset;
            dst_cx = dst.left + offset * 3;
            dst_y = dst.top;
        }
        else {
            dst_x = dst.x * this.canvas.zoom + this.canvas.pan.x;
            dst_cx = dst_x + dst.width * this.canvas.zoom * 0.5;
            dst_y = dst.y * this.canvas.zoom + this.canvas.pan.y;
        }

        this.pathspecs[0] = [['M', src_x, src_y],
                             ['C', src_cx, src_y, dst_cx, dst_y, dst_x, dst_y]];
    }
}
