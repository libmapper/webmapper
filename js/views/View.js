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
    constructor(type, frame, tables, canvas, database, tooltip, pie, painter) {
        this.type = type;
        this.frame = frame;
        this.tables = tables,
        this.canvas = canvas;
        this.database = database;
        this.tooltip = tooltip;
        this.pie = pie;

        this.hoverDev = null;
        this.draggingFrom = null;
        this.snappingTo = null;
        this.escaped = false;

        this.animationTime = 500;

        this.newMap = null;
        this.converging = null;

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
    }

    // Subclasses should override the behavior of _resize rather than this one
    resize(newFrame, duration) {
        if (duration === undefined)
            duration = this.animationTime;
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
        for (var i in this.tables) {
            if (!this.tables[i].hidden)
                this.tables[i].update();
        }

        let self = this;
        let devIndex = 0;
        this.database.devices.each(function(dev) {
            // update device signals
            let sigIndex = 0;
            dev.signals.each(function(sig) {
                sig.hidden = (dev.hidden == true);
                let re = sig.direction == 'output' ? self.database.srcRE : self.database.dstRE;
                if (dev.hidden || (re && !re.test(sig.key))) {
                    if (sig.view)
                        sig.view.hide();
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
                else
                    sig.view.show();
            });
            // if no signals visible, hide device also
            if (dev.hidden || !sigIndex) {
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
                let color = Raphael.hsl(dev.hue, 1, 0.5);
                dev.view = self.canvas.path().attr({'path': path,
                                                    'fill': color,
                                                    'stroke': color,
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
            let gradient = [];
            gradient[0] = '0-hsla('+src.hue+',1,0.5,';
            gradient[1] = ')-hsla('+dst.hue+',1,0.5,';

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
                    function parseMaybeVector(val) {
                        if (val === null || typeof val === 'undefined')
                            return '';
                        if (Array.isArray(val)) {
                            // check if values are uniform
                            for (let i = 1; i < val.length; i++) {
                                if (val[i] != val[0])
                                    return val;
                            }
                            return val[0];
                        }
                        return val;
                    }
                    let minstring = parseMaybeVector(sig.min);
                    let maxstring = parseMaybeVector(sig.max);
                    let x, y;
                    if (Array.isArray(sig.position)) {
                       x = sig.position[0].x;
                       y = sig.position[0].y;
                    }
                    else {
                       x = sig.position.x;
                       y = sig.position.y;
                    }
                    self.tooltip.showTable(
                        sig.device.status+" signal", {
                            name: sig.key,
                            direction: sig.direction,
                            type: typestring,
                            unit: sig.unit,
                            minimum: minstring,
                            maximum: maxstring,
                        }, x, y);
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
                self.newMap.dst = sig;
                self.newMap.view.draw(0);
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

        function finish(convergent_method) {
            if (!self.escaped && self.draggingFrom && self.converging && convergent_method)
                mapper.converge(self.draggingFrom.key, self.converging, convergent_method);
            else if (self.draggingFrom && self.snappingTo)
                mapper.map(self.draggingFrom.key, self.snappingTo.key);
            self._unsnap_to_map();
            self.draggingFrom = null;
            if (self.newMap) {
                self.newMap.view.remove();
                self.newMap = null;
            }
            self.pie.hide();
        }

        let upx, upy;
        sig.view.undrag();
        sig.view.drag(
            function(dx, dy, x, y, event) {
                if (self.snappingTo)
                    return;
                if (self.escaped) {
                    return;
                }
                //x -= self.frame.left;
                y -= self.frame.top;
                upx = x; upy = y;
                if (!self.newMap) {
                    self.newMap =
                        {
                            'srcs': [sig],
                            'dst': {'position': {'x': x, 'y': y}, 'device': {'hidden' : false}, 'view': {}},
                            'selected': true,
                            'hidden': false
                        };
                    self.newMap.view = new self.mapPainter(self.newMap, self.canvas, self.frame, self.database);
                }
                else {
                    if (!self.snapping_to_map()) {
                        let snapped = self._get_map_snap(x-dx, y-dy, x, y);
                        if (snapped !== null) self._snap_to_map(snapped);
                    }
                    if (!self._continue_map_snap(x, y))
                    {
                        self._unsnap_to_map();
                        self.newMap.dst.position = {'x': x, 'y': y};
                    }
                }
                self.newMap.view.draw(0);
            },
            function(x, y, event) {
                self.escaped = false;
                self.draggingFrom = sig;
            },
            function(x, y, event) {
                if (self.snapping_to_map()) self._start_converging_pie_menu(upx, upy, finish);
                else finish();
            }
        );
    }

    setAllSigHandlers() {
        let self = this;
        this.database.devices.each(dev => 
            dev.signals.each(sig => {
                if (!sig.view) return;
                self.setSigHover(sig);
                self.setSigDrag(sig);
            })
        );;
    }

    updateSignals(func) {
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view)
                    sig.view.stop();

                // check regexp
                let re = (sig.direction == 'output'
                          ? self.database.srcRE : self.database.dstRE);
                if (sig.hidden || (re && !re.test(sig.key))) {
                    if (sig.view)
                        sig.view.hide();
                    sig.index = null;
                    sig.position = null;
                    return;
                }

                if (func && func(sig)) {
                    if (sig.view)
                        sig.view.hide();
                    return;
                }

                if (!sig.view && sig.position) {
                    sig.view = self.canvas.path()
                                          .attr({stroke_opacity: 0,
                                                 fill_opacity: 0});
                    self.setSigDrag(sig);
                    self.setSigHover(sig);
                }
                sig.view.show();
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
        let color = Raphael.hsl(sig.device.hue, 1, 0.5);
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : color,
                          'fill-opacity': 1,
                          'stroke': color,
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
                            source: map.srcs.map(s => s.key).join(', '),
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
            map.hidden = map.srcs.some(s => s.hidden) || map.dst.hidden;
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

    drawMaps(duration, signal) {
        this.database.maps.each(function(map) {
            if (!map.view)
                return;
            if (signal && map.srcs.every(s => s != signal) && map.dst != signal)
                return;
            else map.view.draw(duration);
        });
        if (this.newMap)
            this.newMap.view.draw(0);
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
        return updated;
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
        return updated;
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

    filterSignals(direction) {
        direction = direction == 'src' ? 'output' : 'input';
        let index, updated = false;
        switch (this.type) {
            case 'list':
            case 'grid':
                for (index in this.tables) {
                    let table = this.tables[index];
                    if (!table.direction || table.direction == direction)
                        updated |= table.filterByName();
                }
                if (updated) {
                    this.draw(0);
                }
                break;
            case 'canvas':
                // TODO: need to filter canvas objects also
                this.tables.left.filterByName();
                this.draw(0);
                break;
            case 'graph':
            case 'hive':
            case 'parallel':
                this.update('signals');
                this.draw();
                break;
            default:
                break;
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
        // dragging from table to table to make maps
        // the signal associated with the row where the dragging starts becomes the 
        // map's source signal, and if the user releases the drag over any other signal
        // then it becomes the destination for the map.
        $('.tableDiv').off('mousedown');
        $('.tableDiv').on('mousedown', 'td.leaf', function(e) {
            if (self.draggingFrom)
                return;
            self.escaped = false;

            let src_row = $(this).parent('tr')[0];
            let src_table = null;
            let dst_table = null;
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

            $('#svgDiv').one('mouseenter.drawing', function(e) {
                deselectAllMaps(self.tables);
                var src = src_table.getRowFromName(src_row.id);
                var dst = null;
                self.draggingFrom = self.database.find_signal(src.id);

                self.newMap = 
                {
                    'srcs': [self.draggingFrom],
                    'dst': {position: {x: 0, y: 0}},
                    'selected': true
                };
                self.newMap.view = new self.mapPainter(self.newMap, self.canvas, self.frame, self.database);

                let prev_svgx = e.pageX - self.frame.left;
                let prev_svgy = e.pageY - self.frame.top;
                let selected_path, selected_len, selected_pos;

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

                    for (index in self.tables) {
                        // check if cursor is within snapping range
                        let snap_factor = 0.05;
                        dst = self.tables[index].getRowFromPosition(x, y, snap_factor);
                        if (!dst) continue;
                        if (dst.id !== src.id) {
                            self.newMap.dst = self.database.find_signal(dst.id);
                            self.tables[index].highlightRow(dst, false);
                        }
                        else {
                            dst = null;
                        }
                        break;
                    }

                    let svgx = x - self.frame.left;
                    let svgy = y - self.frame.top;
                    if (!self.newMap.dst) {
                        if (!self.snapping_to_map()) {
                            let snapped = self._get_map_snap(prev_svgx, prev_svgy, svgx, svgy);
                            if (snapped !== null) {
                                self._snap_to_map(snapped); // sets dst to snapped map pos
                            }
                        }
                        if (!self._continue_map_snap(svgx, svgy)) {
                            self._unsnap_to_map();
                            self.newMap.dst = {position: {'x': svgx, 'y': svgy}};
                        }
                    }
                    else self._unsnap_to_map(); // snapping to table

                    self.newMap.view.draw(0);
                    src_table.highlightRow(src, false);
                    let dx = prev_svgx - svgx; let dy = prev_svgy - svgy;
                    if (dx*dx + dy*dy > 100) {
                        prev_svgx = svgx;
                        prev_svgy = svgy;
                    }
                });
                $(document).one('mouseup.drawing', function(e) {
                    function finish(convergent_method) {
                        if (!self.escaped) {
                            if (convergent_method !== null && self.snapping_to_map()) 
                                mapper.converge(src.id, self.converging, convergent_method);
                            else if (src && src.id && dst && dst.id) 
                                mapper.map(src.id, dst.id);
                        }
                        // clean up
                        self.tables.left.highlightRow(null, true);
                        self.tables.right.highlightRow(null, true);
                        self.draggingFrom = null;
                        self.pie.hide();
                        if (self.newMap) {
                            self.newMap.view.remove();
                            self.newMap = null;
                        }
                        if (self.snapping_to_map()) {
                            self._unsnap_to_map();

                            // **required so that you can keep making maps afterwards...
                            self.setTableDrag(); 
                        }
                        $('svg, .displayTable tbody tr').off('mousemove.drawing');
                    }
                    if (self.snapping_to_map())
                    {
                        // switch to pie menu interaction
                        // **so clicking convergent option doesn't start making new map
                        $('.tableDiv').off('mousedown'); 
                        
                        let x = e.pageX - self.frame.left;
                        let y = e.pageY - self.frame.top;
                        self._start_converging_pie_menu(x, y, finish);
                    }
                    else finish();
                });
            });
            $(document).one('mouseup.drawing', function(e) {
                $(document).off('.drawing');
                self.draggingFrom = null;
            });
        });
    }

    snapping_to_map()
    {
        return this.converging !== null
    }

    _start_converging_pie_menu(x, y, cb)
    {
        function finish(convergent_method) {
            $(document).off('.drawing');
            $('svg, .displayTable tbody tr').off('.drawing');
            cb(convergent_method);
        }

        let strong = false;
        let convergent_method = null;
        let self = this;
        function get_convergent_option(e) {
            let x = e.pageX - self.frame.left;
            let y = e.pageY - self.frame.top;
            convergent_method = self.pie.selection(x, y, strong);
        }

        this.pie.position(x, y);
        this.pie.show();

        $(document).off('.drawing');
        $(document).on('mousedown.drawing', function(e) {
            if (self.escaped) return finish(convergent_method);
            strong = true;
            get_convergent_option(e);
        });
        $(document).on('mouseup.drawing', function(e) {
            finish(convergent_method);
        });

        $('svg, .displayTable tbody tr').off('.drawing');
        $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
            if (self.escaped) return finish(convergent_method);
            get_convergent_option(e);
        });
    }

    _get_map_snap(x1, y1, x2, y2)
    {
        let converging = null;;
        this.database.maps.each(function(map) {
            if (converging !== null) return;
            if (map.view && map.view.edge_intersection(x1, y1, x2, y2))
                converging = map;
        });
        return converging;
    }

    _map_snap_position(map)
    {
        let selected_path = map.view.intersected;
        let selected_len = selected_path.getTotalLength();
        return selected_path.getPointAtLength(selected_len / 2);
    }

    _snap_to_map(snap_map)
    {
        this.database.maps.each(map => map.selected = false);
        if (this.snapping_to_map()) this.converging.view.draw(0); // unhighlight
        this.converging = snap_map;
        this.converging.selected = true;
        this.converging.view.draw(0);
        this.newMap.dst = {position: this._map_snap_position(this.converging)}
    }

    _continue_map_snap(x, y, snapdist = 50)
    {
        if (!this.snapping_to_map()) return false; // can't continue if haven't started
        let cp = this.converging.view.closest_point(x, y);
        if (cp.distance < snapdist) return true;
        return false;
    }

    _unsnap_to_map()
    {
        if (!this.snapping_to_map()) return; // can't unsnap if not snapped
        this.converging.selected = false;
        this.converging.view.draw(0);
        this.converging = null;
    }

    cleanup() {
        // clean up any objects created only for this view
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
        this.tooltip.hide(true);
    }

    // sets the map painter for the view and converts existing map views to use
    // the new painter. This should be called rather than setting the mapPainter
    // property of this manually, which does not update the painter owned by
    // each map
    setMapPainter(painter) {
        this.mapPainter = (painter === "undefined") ? MapPainter : painter;
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

