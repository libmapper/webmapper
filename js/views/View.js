//++++++++++++++++++++++++++++++++++++++//
//              View Class              //
//++++++++++++++++++++++++++++++++++++++//

// public functions
// resize() // called when window size changes
// update() // called on changes to the database
// draw() // called by update/pan/scroll events
// cleanup() // called when view is destroyed
// type() // returns view type

class View {
    constructor(type, frame, tables, canvas, database, tooltip, painter) {
        this.type = type;
        this.frame = frame;
        this.tables = tables,
        this.canvas = canvas;
        this.database = database;
        this.tooltip = tooltip;

        this.srcregexp = null;
        this.dstregexp = null;

        this.hoverDev = null;
        this.draggingFrom = null;
        this.snappingTo = null;
        this.escaped = false;

        this.newMap = null;

        if (tables) {
            this.setTableDrag();
        }

        this.mapPane = {'left': frame.left,
                        'top': frame.top,
                        'width': frame.width,
                        'height': frame.height,
                        'cx': this.frame.width * 0.5,
                        'cy': this.frame.height * 0.5
        };

        this.canvas.zoom = 1;
        this.canvas.pan = {x: 0, y: 0};

        this.xAxis = null;
        this.yAxis = null;

        this.canvas.setViewBox(0, 0, frame.width, frame.height, false);
        this.tooltip.hide(true);

        this.origin = [this.mapPane.cx, this.mapPane.cy];

        this.sigLabel = null;

        if (typeof painter === "undefined")
            this.setMapPainter(MapPainter);
        else
            this.setMapPainter(painter);
    }

    // Subclasses should override the behavior of _resize rather than this one
    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;
        this._resize(duration);
        this.canvas.setViewBox(0, 0, this.frame.width, this.frame.height, false);
        this.draw(duration);
    }

    // Define subclass specific resizing related tasks
    _resize() {
        this.mapPane = {'left': this.frame.left,
                        'top': this.frame.top,
                        'width': this.frame.width,
                        'height': this.frame.height,
                        'cx': this.frame.width * 0.5,
                        'cy': this.frame.height * 0.5};

        this.origin = [this.mapPane.cx, this.mapPane.cy];
    }

    updateDevices(func) {
        for (var i in this.tables)
            this.tables[i].update();

        let self = this;
        let devIndex = 0;
        this.database.devices.each(function(dev) {
            // update device signals
            let sigIndex = 0;
            dev.signals.each(function(sig) {
                sig.hidden = (dev.hidden == true);
                let regexp = sig.direction == 'output' ? self.srcregexp : self.dstregexp;
                if (self.tables || dev.hidden || (regexp && !regexp.test(sig.key))) {
                    remove_object_svg(sig);
                    sig.index = null;
                    return;
                }
                sig.index = sigIndex++;

                if (!sig.view) {
                    sig.view = self.canvas.path(circle_path(0, self.frame.height, 0))
                                          .attr({'fill-opacity': 0,
                                                 'stroke-opacity': 0});
                    self.setSigDrag(sig);
                    self.setSigHover(sig);
                }
            });
            // if no signals visible, hide device also
            if (self.tables || dev.hidden || !sigIndex) {
                remove_object_svg(dev);
                dev.index = null;
                return;
            }

            dev.index = devIndex++;
            dev.numVisibleSigs = sigIndex + 1;

            if (func && func(dev)) {
                remove_object_svg(dev);
                return;
            }

            if (!dev.view) {
                let path = [['M', self.frame.left + 50, self.frame.height - 50],
                            ['l', 0, 0]];
                dev.view = self.canvas.path().attr({'path': path,
                                                    'fill': dev.color,
                                                    'stroke': dev.color,
                                                    'fill-opacity': 0,
                                                    'stroke-opacity': 0,
                                                    'stroke-linecap': 'round'});
            }
        });
    }

    drawDevices() {
        // don't draw devices or signals by default
        // e.g. because you're using a signal table
    }

    setDevHover(dev) {
        let self = this;
        let hovered = false;
        dev.view.unhover();
        dev.view.hover(
            function(e) {
                if (!hovered) {
                    self.tooltip.showTable(
                        dev.status+" device", {
                            name: dev.name,
                            signals: dev.signals.size()
                        }, e.x, e.y);
                    if (self.type == 'chord') {
                        // also move associated  links to front
                        self.database.links.each(function(link) {
                            if (link.view && (link.src == dev || link.dst == dev))
                                link.view.toFront();
                        });
                        dev.view.toFront();
                    }
                    dev.view.animate({'stroke-width': 50}, 0, 'linear');
                    if (dev.view.label)
                        dev.view.label.toFront();
                }
                hovered = true;
                self.hoverDev = dev;
                if (self.draggingFrom == null)
                    return;
                else if (dev == self.draggingFrom) {
                    // don't snap to self
                    return;
                }
                self.snappingTo = dev;
            },
            function() {
                self.snappingTo = null;
                if (!self.draggingFrom) {
                    self.tooltip.hide();
                    dev.view.animate({'stroke-width': 40}, 500, 'linear');
                    hovered = false;
                }
                self.hoverDev = null;
            }
        );
    }

    setLinkHover(link) {
        let self = this;
        link.view.unhover();
        link.view.hover(
            function(e) {
                self.tooltip.showTable(
                    link.status+" link", {
                        source: link.src.key,
                        destination: link.dst.key
                    }, e.x, e.y);
                link.view.toFront().animate({'stroke-width': 1}, 0, 'linear');
                link.src.view.toFront();
                if (link.src.view.label)
                    link.src.view.label.toFront();
                if (link.src.staged)
                    link.src.staged.view.toFront();
                link.dst.view.toFront();
                if (link.dst.view.label)
                    link.dst.view.label.toFront();
                if (link.dst.staged)
                    link.dst.staged.view.toFront();
            },
            function() {
                self.tooltip.hide();
                link.view.animate({'stroke-width': 0}, 0, 'linear');
            }
        );
    }

    updateLinks() {
        let self = this;
        this.database.devices.each(function(dev) {
            dev.linkSrcIndices = [];
            dev.linkDstIndices = [];
        });
        this.database.links.each(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!src.linkDstIndices.includes(dst.index)) {
                src.linkDstIndices.push(dst.index);
                src.linkDstIndices.sort();
            }
            if (!dst.linkSrcIndices.includes(src.index)) {
                dst.linkSrcIndices.push(src.index);
                dst.linkSrcIndices.sort();
            }
            if (link.view)
                return;
            link.view = self.canvas.path();
            let rgb = Raphael.getRGB(src.color);
            let gradient = [];
            gradient[0] = '0-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
            rgb = Raphael.getRGB(dst.color);
            gradient[1] = ')-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';

            link.view.attr({'fill': gradient[0]+0.25+gradient[1]+0.25+')',
                            'stroke-opacity': 0});
            link.view.setAlpha = function(alpha1, alpha2) {
                if (!alpha2)
                    alpha2 = alpha1;
                this.attr({'fill': gradient[0]+alpha1+gradient[1]+alpha2+')'});
            }
            self.setLinkHover(link);
        });
    }

    setSigHover(sig) {
        let self = this;
        sig.view.unhover();
        sig.view.hover(
            function() {
                if (!sig.view.label) {
                    // show label
                    let type;
                    switch (sig.type) {
                        case 'i':
                            type = 'int';
                            break;
                        case 'f':
                            type = 'float';
                            break;
                        case 'd':
                            type = 'double';
                            break;
                        default:
                            type = '?';
                            break;
                    }
                    let typestring = sig.length > 1 ? type+'['+sig.length+']' : type;
                    let minstring = sig.min != null ? sig.min : '';
                    let maxstring = sig.max != null ? sig.max : '';
                    self.tooltip.showTable(
                        sig.device.status+" signal", {
                            name: sig.key,
                            direction: sig.direction,
                            type: typestring,
                            unit: sig.unit,
                            minimum: minstring,
                            maximum: maxstring,
                        }, sig.position.x, sig.position.y);
                    sig.view.animate({'stroke-width': 15}, 0, 'linear');
                }
                self.hoverDev = sig.device;
                if (self.draggingFrom == null)
                    return;
                else if (sig == self.draggingFrom) {
                    // don't snap to self
                    return;
                }
                self.snappingTo = sig;
                let src = self.draggingFrom.position;
                let dst = sig.position;
                let path = [['M', src.x, src.y],
                            ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
                             dst.x, dst.y]];
                let len = Raphael.getTotalLength(path);
                path = Raphael.getSubpath(path, 12, len - 12);
                self.newMap.attr({'path': path});
            },
            function() {
                self.snappingTo = null;
                self.tooltip.hide();
                sig.view.animate({'stroke-width': 6}, 50, 'linear');
                self.hoverDev = null;
            }
        );
    }

    setSigDrag(sig) {
        let self = this;
        sig.view.mouseup(function() {
            if (self.draggingFrom && self.snappingTo)
                $('#container').trigger('map', [self.draggingFrom.key,
                                                self.snappingTo.key]);
        });
        sig.view.undrag();
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (self.snappingTo)
                    return;
                if (self.escaped) {
                    return;
                }
                x -= self.frame.left;
                y -= self.frame.top;
                let src = self.draggingFrom.position;
                let path = [['M', src.x, src.y],
                            ['S', (src.x + x) * 0.6, (src.y + y) * 0.4, x, y]];
                if (!self.newMap) {
                    self.newMap = self.canvas.path(path);
                    self.newMap.attr({'stroke': 'white',
                                      'stroke-width': MapPath.strokeWidth,
                                      'stroke-opacity': 1,
                                      'fill': 'none',
                                      'arrow-start': 'none',
                                      'arrow-end': 'block-wide-long'});
                }
                else
                    self.newMap.attr({'path': path});
            },
            function(x, y, event) {
                self.escaped = false;
                self.draggingFrom = sig;
            },
            function(x, y, event) {
                self.draggingFrom = null;
                if (self.newMap) {
                    self.newMap.remove();
                    self.newMap = null;
                }
            }
        );
    }

    updateSignals(func) {
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view)
                    sig.view.stop();

                // check regexp
                let regexp = (sig.direction == 'output'
                              ? self.srcregexp : self.dstregexp);
                if (sig.hidden || (regexp && !regexp.test(sig.key))) {
                    remove_object_svg(sig);
                    sig.index = null;
                    sig.position = null;
                    return;
                }

                if (func && func(sig)) {
                    remove_object_svg(sig);
                    return;
                }

                if (!sig.view && sig.position) {
                    let path = circle_path(sig.position.x, sig.position.y, 10);
                    sig.view = self.canvas.path(path)
                                          .attr({stroke_opacity: 0,
                                                 fill_opacity: 0});
                    self.setSigDrag(sig);
                    self.setSigHover(sig);
                }
            });
        });
    }

    drawSignal(sig, duration) {
        if (!sig.view)
            return;
        sig.view.stop();
        let pos = sig.position;
        let is_output = sig.direction == 'output';

        let path = circle_path(pos.x, pos.y, 10);
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : sig.device.color,
                          'fill-opacity': 1,
                          'stroke': sig.device.color,
                          'stroke-width': 6,
                          'stroke-opacity': 1}, duration, '>');
        if (sig.hidden) sig.view.hide();
    }

    drawSignals(duration) {
        let self = this;
        this.database.devices.each(function(dev) {
            if (dev.hidden)
                return;
            dev.signals.each(function(sig) {
                self.drawSignal(sig, duration);
            });
        });
    }

    setMapHover(map) {
        let self = this;
        map.view.unhover();
        map.view.hover(
            function(e) {
                if (!self.draggingFrom) {
                    self.tooltip.showTable(
                        "Map", {
                            source: map.src.key,
                            destination: map.dst.key,
                            mode: map.mode,
                            expression: map.expression,
                        }, e.x, e.y);
                }
                map.view.highlight();
            },
            function() {
                self.snappingTo = null;
                self.tooltip.hide();
                map.view.unhighlight();
            }
        );
    }

    updateMaps() {
        let self = this;
        this.database.maps.each(function(map) {
            map.hidden = map.src.hidden || map.dst.hidden;
            if (map.hidden) {
                remove_object_svg(map);
                return;
            }
            if (!map.view) {
                map.view = new self.mapPainter(map, self.canvas, self.frame, self.database);
                self.setMapHover(map);
            }
        });
    }

    _tableRow(sig) {
        let row = null;
        for (var i in this.tables) {
            row = this.tables[i].getRowFromName(sig.key);
            if (row)
                break;
        }
        return row;
    }

    getMapPath(map) {
        if (this.tables) return this._getMapPathForTables(map);
        else return this._getMapPathForSigNodes(map);
    }

    _getMapPathForTables(map) {
        let src = this._tableRow(map.src);
        let dst = this._tableRow(map.dst);
        if (!src || !dst)
            return null;
        if (src.vx == dst.vx) {
            // same table
            if (map.view) map.view.attr({'arrow-end': 'block-wide-long'});
            return MapPath.sameTable(src, dst, this.mapPane);
        }
        else if (src.vy != dst.vy) {
            // constrain positions to pane to indicate offscreen maps
            // todo: make function
            if (src.x < this.leftTableLeft) {
                // constrain to bounds
                // display a white dot
            }
            // draw intersection between tables
            if (map.view) map.view.attr({'arrow-end': 'none',
                                         'stroke-linejoin': 'round'});
            if (src.vx < 0.0001) {
                return [['M', src.left + MapPath.strokeWidth, dst.y],
                        ['L', src.left + src.width - MapPath.strokeWidth + 2, dst.top + MapPath.strokeWidth],
                        ['l', 0, dst.height - MapPath.strokeWidth - 2],
                        ['Z']];
            }
            else {
                return [['M', dst.x, src.top + MapPath.strokeWidth + 1],
                        ['L', dst.left + MapPath.strokeWidth, src.top + src.height - MapPath.strokeWidth + 2],
                        ['l', dst.width - MapPath.strokeWidth - 2, 0],
                        ['Z']]
            }
        }
        else {
            // draw bezier curve between signal tables
            if (map.view) map.view.attr({'arrow-end': 'block-wide-long'});
            return MapPath.betweenTables(src, dst);
        }
    }

    _getMapPathForSigNodes(map) {
        let src = map.src.position
        let dst = map.dst.position;
        if (!src || !dst)
            return null;

        // calculate midpoint
        let mpx = (src.x + dst.x) * 0.5;
        let mpy = (src.y + dst.y) * 0.5;

        // inflate midpoint around origin to create a curve
        mpx = mpx + (mpx - this.origin[0]) * 0.2;
        mpy = mpy + (mpy - this.origin[1]) * 0.2;

        return [['M', src.x, src.y],
                ['S', mpx, mpy, dst.x, dst.y]];
    }

    drawMaps(duration, signal) {
        this.database.maps.each(function(map) {
            if (!map.view)
                return;
            if (signal && map.src != signal && map.dst != signal)
                return;
            else map.view.draw(duration);
        });
    }

    update() {
        this.updateDevices();
        this.updateMaps();
    }

    tablePan(x, y, delta_x, delta_y) {
        x -= this.frame.left;
        y -= this.frame.top;
        let index, updated = false;
        for (index in this.tables) {
            updated = this.tables[index].pan(delta_x, delta_y, x, y);
            if (updated)
                break;
        }
        if (updated == false) {
            // send to all tables
            for (index in this.tables)
                updated |= this.tables[index].pan(delta_x, delta_y);
        }
        if (updated)
            this.draw(0);
    }

    canvasPan(x, y, delta_x, delta_y) {
        x -= this.frame.left;
        y -= this.frame.top;
        this.canvas.pan.x += delta_x * this.canvas.zoom;
        this.canvas.pan.y += delta_y * this.canvas.zoom;

        this.canvas.setViewBox(this.canvas.pan.x, this.canvas.pan.y,
                               this.frame.width * this.canvas.zoom,
                               this.frame.height * this.canvas.zoom, false);
        this.tooltip.showBrief('pan: ['+this.canvas.pan.x.toFixed(2)+', '
                               +this.canvas.pan.y.toFixed(2)+']', x, y);
    }

    tableZoom(x, y, delta) {
        x -= this.frame.left;
        y -= this.frame.top;
        let index, updated = false;
        for (index in this.tables) {
            updated = this.tables[index].zoom(delta, x, y, true);
            if (updated != null)
                break;
        }
        if (updated == null) {
            // send to all tables
            for (index in this.tables)
                updated |= this.tables[index].zoom(delta, x, y, false);
        }
        if (updated)
            this.draw(0);
    }

    canvasZoom(x, y, delta) {
        x -= this.frame.left;
        y -= this.frame.top;
        let newZoom = this.canvas.zoom + delta * 0.01;
        if (newZoom < 0.1)
            newZoom = 0.1;
        else if (newZoom > 20)
            newZoom = 20;
        if (newZoom == this.canvas.zoom)
            return;
        let zoomDiff = this.canvas.zoom - newZoom;
        this.canvas.pan.x += x * zoomDiff;
        this.canvas.pan.y += (y - this.frame.top) * zoomDiff;
        this.canvas.setViewBox(this.canvas.pan.x, this.canvas.pan.y,
                               this.frame.width * newZoom,
                               this.frame.height * newZoom, false);
        this.tooltip.showBrief( 'zoom: '+(100/newZoom).toFixed(2)+'%', x, y);
        this.canvas.zoom = newZoom;
    }

    resetPanZoom() {
        this.canvas.setViewBox(0, 0, this.frame.width, this.frame.height, false);
        this.canvas.zoom = 1;
        this.canvas.pan.x = 0;
        this.canvas.pan.y = 0;
    }

    filterSignals(direction, text) {
        direction = direction == 'src' ? 'output' : 'input';
        let index, updated = false;
        if (this.tables) {
            for (index in this.tables) {
                let table = this.tables[index];
                if (!table.direction || table.direction == direction)
                    updated |= table.filterByName(text);
            }
            if (updated) {
                this.update('signals');
                this.draw(0);
            }
        }
        else {
            if (direction == 'output')
                this.srcregexp = text ? new RegExp(text, 'i') : null;
            else
                this.dstregexp = text ? new RegExp(text, 'i') : null;
            this.update('signals');
            this.draw(0);
        }
    }

    escape() {
        this.escaped = true;
        this.draggingFrom = null;
        if (this.newMap) {
            if (this.newMap.view) this.newMap.view.remove();
            this.newMap = null;
        }
        if (this.tables) {
            for (var index in this.tables)
                this.tables[index].highlightRow(null, true);
        }
    }

    setTableDrag() {
        let self = this;
        // dragging maps from table
        // if another table exists, we can drag between them
        // can also drag map to self
        // if tables are orthogonal we can simply drag to 2D space between them
        // if no other table exists, can drag out signal representation
        $('.tableDiv').off('mousedown');
        $('.tableDiv').on('mousedown', 'td.leaf', function(e) {
            self.escaped = false;

            let src_row = $(this).parent('tr')[0];
            let src_table = null;
            switch ($(src_row).parents('.tableDiv').attr('id')) {
                case "leftTable":
                    src_table = self.tables.left;
                    break;
                case "rightTable":
                    src_table = self.tables.right;
                    break;
                default:
                    console.log('unknown source row');
                    return;
            }

            $('#svgDiv').one('mouseenter.drawing', function() {
                deselectAllMaps(self.tables);
                var src = src_table.getRowFromName(src_row.id);
                var dst = null;
                self.draggingFrom = self.database.find_signal(src.id);

                self.newMap = 
                {
                    get src() {return self.draggingFrom},
                    'dst': null
                };
                self.newMap.view = new self.mapPainter(self.newMap, self.canvas, self.frame, self.database);

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    // clear table highlights
                    let index;
                    for (index in self.tables)
                        self.tables[index].highlightRow(null, true);

                    if (self.escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        self.draggingFrom = null;
                        return;
                    }

                    let x = e.pageX;
                    let y = e.pageY;
                    dst = null;
                    self.newMap.dst = null;
                    let dst_table = null;

                    for (index in self.tables) {
                        // check if cursor is within snapping range
                        dst = self.tables[index].getRowFromPosition(x, y, 0.2);
                        if (!dst) continue;
                        if (dst.id == src.id) {
                            // don't try to map a sig to itself
                            dst = null;
                            continue;
                        }
                        self.newMap.dst = self.database.find_signal(dst.id);
                        dst_table = self.tables[index];
                        break;
                    }

                    if (!self.newMap.dst) {
                        self.newMap.dst = {position: {'x': x - self.frame.left,
                                                      'y': y - self.frame.top}};
                    }
                    self.newMap.view.draw();

                    src_table.highlightRow(src, false);
                    if (dst_table)
                        dst_table.highlightRow(dst, false);
                });
                $(document).on('mouseup.drawing', function(e) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    if (!self.escaped && dst && dst.id) {
                        $('#container').trigger('map', [src.id, dst.id]);
                        self.database.maps.add({'src': self.database.find_signal(src.id),
                                                'dst': self.database.find_signal(dst.id),
                                                'key': src.id + '->' + dst.id,
                                                'status': 'staged'});
                    }
                    // clear table highlights
                    self.tables.left.highlightRow(null, true);
                    self.tables.right.highlightRow(null, true);
                    self.draggingFrom = null;
                    if (self.newMap) {
                        self.newMap.view.remove();
                        self.newMap = null;
                    }
                });
            });
            $(document).one('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                self.draggingFrom = null;
            });
        });
    }

    cleanup() {
        // clean up any objects created only for this view
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
    }

    // sets the map painter for the view and converts existing map views to use
    // the new painter. This should be called rather than setting the mapPainter
    // property of this manually, which does not update the painter owned by
    // each map
    setMapPainter(newpainterclass) {
        this.mapPainter = newpainterclass;
        let self = this;
        this.database.maps.each(function(map) {
            if (!map.view) return;
            let newview = new self.mapPainter(map, self.canvas, self.frame, self.database);
            newview.copy(map.view);
            map.view = newview;
        });
    }
}

class MapPath {
    constructor() {}

    static betweenTables(src, dst) {
        if (Math.abs(src.vx) == Math.abs(dst.vx)) {
            // tables are parallel
            let mpx = (src.x + dst.x) * 0.5;
            return [['M', src.x, src.y],
                    ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
        }
        let dx = dst.x - src.x;
        let dy = dst.y - src.y;
        let vertical = fuzzyEq(src.vy, 0, 0.001);
        return [['M', src.x, src.y],
                ['l', vertical ? dx : 0, vertical ? 0 : dy],
                ['L', dst.x, dst.y]];
    }

    static sameTable(srcrow, dstrow, mapPane) {
        // signals are part of the same table
        if (Math.abs(srcrow.x - dstrow.x) < 1)
            return this.vertical(srcrow, dstrow, mapPane);
        else
            return this.horizontal(srcrow, dstrow, mapPane);
    }

    static vertical(src, dst, mapPane) {
        // signals are inline vertically
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.y - dst.y) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctlx = src.x + offset * src.vx;
        return [['M', src.x, src.y],
                ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
    }

    static horizontal(src, dst) {
        // signals are inline horizontally
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.x - dst.x) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctly = src.y + offset * src.vy;
        return [['M', src.x, src.y],
                ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }
}

MapPath.strokeWidth = 4;
MapPath.boldStrokeWidth = 8;

