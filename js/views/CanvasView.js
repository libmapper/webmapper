//++++++++++++++++++++++++++++++++++++++//
//         Canvas View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class CanvasView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('canvas', frame, tables, canvas, database, tooltip, pie,
              CanvasMapPainter);

        this.leftExpandWidth = 200;

        this.dragging = null;
        this.trashing = false;

        this.setup();
    }

    setup() {
        this.setMapPainter(CanvasMapPainter);

        // set left table properties
        this.tables.left.hidden = false;
        this.tables.left.filterByDirection('both');
        this.tables.left.showDetail(true);
        this.tables.left.expand = true;
        this.tables.left.ignoreCanvasObjects = true;
        // update table to remove rows with associated canvasObjects
        this.tables.left.update();

        // hide right table
        this.tables.right.adjust(this.frame.width, 0, 0,
                                 this.frame.height, 0, 500, null, 0, 0);
        this.tables.right.hidden = true;

        this.setCanvasTableDrag();

        // remove device and unused signal svg
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (!sig.canvasObject) {
                    remove_object_svg(sig);
                    return;
                }
                let c = sig.canvasObject;
                sig.position.left = c.left;
                sig.position.top = c.top;
                sig.position.width = c.width;
                sig.position.height = c.height;
                if (sig.view) {
                    self.setSigHover(sig);
                    self.setSigDrag(sig);
                }
            });
            remove_object_svg(dev);
        });

        this.tables.left.resizeHandler = function() {
            if (self.tables.left.expandWidth != self.leftExpandWidth) {
                self.leftExpandWidth = self.tables.left.expandWidth;
                self.resize(null, 500);
            }
            self.drawMaps(0);
        };
        this.tables.right.resizeHandler = null;

        this.resize(null, 500);
    }

    _resize(duration) {
        let self = this;
        this.tables.left.adjust(0, 0, this.leftExpandWidth, this.frame.height,
                                0, duration, function() {self.drawMaps(duration)},
                                0, 0);
        this.mapPane.left = this.leftExpandWidth;
        this.mapPane.width = this.frame.width - this.leftExpandWidth;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    setSigHover(sig) {
        let self = this;
        sig.view.unhover();
        sig.view.hover(
            function() {
                if (self.draggingFrom == null)
                   return;
                if (sig == self.draggingFrom) {
                   // don't snap to self
                   return;
                }
                // snap to sig object
                self.snappingTo = sig;
                self.newMap.dst = sig;
                self.newMap.view.draw(0);
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
        sig.view.unmouseup();
        sig.view.mouseup(function() {
            if (self.trashing) {
                sig.view.label.remove();
                sig.view.remove();
                sig.view = null;
                sig.canvasObject = null;
                self.trashing = false;
                // update table to replace signal row and position getters
                self.tables.left.update();
                // update maps
                self.drawMaps(0);
                self.draggingFrom = self.snappingTo = null;
            }
            else if (self.draggingFrom && self.snappingTo) {
                mapper.map(self.draggingFrom.key, self.snappingTo.key);
                if (self.newMap) {
                    self.newMap.view.remove();
                    self.newMap = null;
                }
            }
            // move svg canvas to back
            $('#svgDiv').css({'position': 'relative', 'z-index': 0});
        });
        sig.view.undrag();
        sig.view.drag(
            function(dx, dy, x, y, event) {
                let x1 = x * self.canvas.zoom + self.canvas.pan.x;
                let y1 = y * self.canvas.zoom + self.canvas.pan.y;
                let p = sig.position;
                let c = sig.canvasObject;
                if (self.escaped) {
                    self.draggingFrom = null;
                    delete p.drag_offset;
                    self.dragging = null;
                    self.trashing = false;
                    if (self.newMap) {
                        self.newMap.view.remove();
                        self.newMap = null;
                    }
                    return;
                }
                if (self.dragging == 'obj') {
                    p.left = x1 + p.drag_offset.x;
                    p.top = y1 + p.drag_offset.y;
                    p.x = p.left + p.width * 0.5;
                    p.y = p.top + p.height * 0.5;
                    c.left = p.left;
                    c.top = p.top;
                    self.drawSignal(sig);

                    if (x < self.mapPane.left) {
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
                    x1 -= self.frame.left;
                    y1 -= self.frame.top;
                    self.newMap.dst.position.x = x1;
                    self.newMap.dst.position.y = y1;
                    self.newMap.view.draw(0);
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
                else {
                    self.dragging = 'obj';
                    // move svg canvas to front
                    $('#svgDiv').css({'z-index': 2});
                }
                if (self.dragging !== 'obj') {
                    self.newMap = 
                        {
                            'src': sig,
                            'srcs': [sig],
                            'dst': {'position': {'width': 2, 'x': x, 'y': y}, 'device': {'hidden' : false}, 'view': {}},
                            'selected': true,
                            'hidden': false
                        };
                    self.newMap.view = new self.mapPainter(self.newMap, self.canvas, self.frame, self.database);
                }
            },
            function(x, y, event) {
                self.draggingFrom = null;
                if (sig.canvasObject)
                    delete sig.position.drag_offset;
                self.dragging = null;
                if (self.newMap) {
                    self.newMap.view.remove();
                    self.newMap = null;
                }
                // move svg canvas to back
                $('#svgDiv').css({'z-index': 0});
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
        if (!sig.view.label) {
            // TODO: use canvasObject appearance to indicate signal direction
            let key = sig.key;
            sig.view.label = this.canvas.text(sig.position.x, sig.position.y, key);
            sig.view.label.node.setAttribute('pointer-events', 'none');
            sig.view.label.toFront();
            sig.view.label.attr({'font-size': 16,
                                 'opacity': 1,
                                 'fill': 'white'});
        }
        else
            sig.view.label.stop();

        if (!duration || duration < 0) {
            sig.view.attr(attrs);
            sig.view.label.attr({'x': sig.position.left,
                                 'y': sig.position.top});
        }
        else {
            sig.view.animate(attrs, duration, '>');
            sig.view.label.animate({'x': sig.position.left,
                                    'y': sig.position.top},
                                   duration, '>');
        }
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
        if (x < this.tables.left.frame.width) {
            if (this.tablePan(x, y, delta_x, delta_y))
                this.drawMaps();
        }
        else {
            this.tablePan(null, null, delta_x, delta_y);
            this.canvasPan(x, y, delta_x, delta_y);
            this.drawMaps(0);
        }
    }

    zoom(x, y, delta) {
        if (x < this.tables.left.frame.width) {
            if (this.tableZoom(x, y, delta))
                this.drawMaps();
        }
        else {
            this.canvasZoom(x, y, delta);
            this.drawMaps(0);
        }
    }

    resetPanZoom() {
        super.resetPanZoom();
        this.drawMaps(0);
    }

    setCanvasTableDrag() {
        let self = this;
        let table = this.tables.left;
        $('.tableDiv').off('mousedown');
        $('.tableDiv').on('mousedown', 'td.leaf', function(e) {
            self.escaped = false;
            var src_row = $(this).parent('tr')[0];

            $('#svgDiv').one('mouseenter.drawing', function() {
                // move svg canvas to front
                $('#svgDiv').css({'z-index': 2});

                deselectAllMaps(self.tables);
                var src = table.getRowFromName(src_row.id);
                var dst = null;
                var width = textWidth(src.id, 1.2);

                // add object to canvas
                let sig = self.database.find_signal(src.id);
                if (!sig)
                    return;

                let p = sig.position;
                p.left = (e.pageX - self.frame.left) * self.canvas.zoom + self.canvas.pan.x;
                p.top = sig.position.y = (e.pageY - self.frame.top) * self.canvas.zoom + self.canvas.pan.y;
                p.width = textWidth(sig.key, 1.2);
                p.height = 30;
                sig.canvasObject = {'left': p.left, 'top': p.top,
                                    'width': p.width, 'height': p.height};
                let c = sig.canvasObject;
                self.drawSignal(sig, 0);
                // remove signal from table
                table.update();
                self.drawMaps(0);

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    if (self.escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        return;
                    }
                    p.left = (e.pageX - self.frame.left) * self.canvas.zoom + self.canvas.pan.x;
                    p.top = (e.pageY - self.frame.top) * self.canvas.zoom + self.canvas.pan.y;
                    p.x = p.left + p.width * 0.5;
                    p.y = p.top + p.height * 0.5;
                    c.left = p.left;
                    c.top = p.top;
                    self.drawSignal(sig, 0);
                    self.drawMaps(0, sig);
                });
                $(document).on('mouseup.drawing', function(e) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');

                    self.setSigDrag(sig);
                    self.setSigHover(sig);

                    // move svg canvas to back
                    $('#svgDiv').css({'z-index': 0});
                });
            });
            $(document).one('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                // move svg canvas to back
                $('#svgDiv').css({'z-index': 0});
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
                if (sig.view.label) {
                    sig.view.label.remove();
                    sig.view.label = null;
                }
                // cache canvas object positions
                // TODO: use signalPainter instead?
            });
        });
        this.tables.left.update();
    }
}

class CanvasMapPainter extends MapPainter
{
    constructor(map, canvas, frame, database) {super(map, canvas, frame, database);}

    updatePaths() {
        let dst = this.map.dst;
        if (this.map.srcs.length === 1) {
            // draw a curved line from src to dst
            let src = this.map.srcs[0];
            if (!src.canvasObject && !dst.canvasObject)
                this.pathspecs[0] = this.vertical(src, dst);
            else
                this.pathspecs[0] = this.canvas_path(src, dst);
        }
        else {
            let sigs = this.map.srcs.filter(s => !s.hidden).map(s => s.position);
            sigs = sigs.concat([dst]);
            let xavg = sigs.map(s => s.x).reduce((accum, s) => accum + s) / sigs.length;
            let yavg = sigs.map(s => s.y).reduce((accum, s) => accum + s) / sigs.length;
            let node = this.getNodePosition(50);
            if (sigs.every(s => !s.canvasObject))
                node.x += 50;
            node.width = 0;
            node.left = node.x;
            node.top = node.y;
            let i = 0;
            for (; i < this.map.srcs.length; i++) {
                let src = this.map.srcs[i];
                if (src.hidden) continue;
                this.pathspecs[i] = this.canvas_path(src, {position: node,
                                                           canvasObject: true});
            }
            this.pathspecs[i] = this.canvas_path({position: node,
                                                  canvasObject: true}, dst);
            this.pathspecs[i+1] = this.circle_spec(node.x, node.y);
        }
    }

    getNodePosition(offset)
    {
        let self = this;
        function canvasPos(o) {
            let x = o.position.x;
            let y = o.position.y;
            if (!o.canvasObject) {
                x = x * self.canvas.zoom + self.canvas.pan.x;
                y = y * self.canvas.zoom + self.canvas.pan.y;
            }
            return {x: x, y: y};
        }
        let dst = this.map.dst;
        let sigs = this.map.srcs.filter(s => !s.hidden);
        if (sigs.length === 0) return null;
        sigs = sigs.concat([dst]);

        let x = sigs.map(s => canvasPos(s).x).reduce((accum, s) => accum + s) / sigs.length;
        let y = sigs.map(s => canvasPos(s).y).reduce((accum, s) => accum + s) / sigs.length;

        if (offset) {
            if (x === dst.x)
                x += offset * dst.vx;
            if (y === dst.y)
                y += offset * dst.vy;
        }

        return {x: x, y: y};
    }

    vertical(src, dst, minoffset = 30, maxoffset = 200)
    {
        src = src.position;
        dst = dst.position;

        let src_x, src_cx, src_y, dst_x, dst_cx, dst_y;

        let offset = Math.abs(src.y - dst.y) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;

        src_x = dst_x = src.x * this.canvas.zoom + this.canvas.pan.x;
        src_cx = dst_cx = (src.x + offset) * this.canvas.zoom + this.canvas.pan.x;
        src_y = src.y * this.canvas.zoom + this.canvas.pan.y;
        dst_y = dst.y * this.canvas.zoom + this.canvas.pan.y;

        return [['M', src_x, src_y], ['C', src_cx, src_y, dst_cx, dst_y, dst_x, dst_y]];
    }

    canvas_path(src, dst)
    {
        let srcPos = src.position;
        let dstPos = dst.position;
        let src_x, src_cx, src_y, dst_x, dst_cx, dst_y;

        if (src.canvasObject) {
            let offset = srcPos.width * 0.5;
            src_x = srcPos.left + offset;
            src_cx = srcPos.left + offset * 2;
            src_y = srcPos.top;
        }
        else {
            src_x = srcPos.x * this.canvas.zoom + this.canvas.pan.x;
            src_cx = src_x + srcPos.width * this.canvas.zoom * 0.5;
            src_y = srcPos.y * this.canvas.zoom + this.canvas.pan.y;
        }

        if (dst.canvasObject) {
            let offset = dstPos.width * -0.5;
            dst_x = dstPos.left + offset;
            dst_cx = dstPos.left + offset * 2;
            dst_y = dstPos.top;
        }
        else {
            dst_x = dstPos.x * this.canvas.zoom + this.canvas.pan.x;
            dst_cx = dst_x + dstPos.width * this.canvas.zoom * 0.5;
            dst_y = dstPos.y * this.canvas.zoom + this.canvas.pan.y;
        }
        return [['M', src_x, src_y], ['C', src_cx, src_y, dst_cx, dst_y, dst_x, dst_y]];
    }

    updateAttributes()
    {
        let num_srcs = this.map.srcs.length;
        if (num_srcs > 1)
        {
            let hidden = true;
            this._defaultAttributes(num_srcs + 2);
            let i = 0;
            for (; i < num_srcs; ++i)
            {
                hidden = hidden && this.map.srcs[i].hidden;
                if (this.map.srcs[i].hidden) this.attributes[i]['stroke'] = 'none';
                this.attributes[i]['arrow-end'] = 'none';
            }

            if (hidden)
            {
                this.attributes[i].stroke = 'none';
                this.attributes[i+1].stroke = 'none';
            }
            else
            {
                this.attributes[i+1].fill = this.map.selected ?
                MapPainter.selectedColor :
                MapPainter.defaultColor;
                this.attributes[i+1]['arrow-end'] = 'none'
            }
        }
        else this._defaultAttributes();
    }
}
