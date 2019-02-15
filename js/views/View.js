//++++++++++++++++++++++++++++++++++++++//
//              View Class              //
//++++++++++++++++++++++++++++++++++++++//

// public functions
// resize() // called when window size changes
// update() // called on changes to the database
// draw() // called by update/pan/scroll events
// cleanup() // called when view is destroyed
// type() // returns view type

'use strict';

class View {
    constructor(type, frame, tables, canvas, database, tooltip) {
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

        this.dragObj = 'map';

        // normalized table positions & dimensions
        this.leftTableLeft = 0;
        this.leftTableTop = 0;
        this.leftTableWidth = 0;
        this.leftTableHeight = 1;
        this.leftTableAngle = 0;

        this.rightTableLeft = 1;
        this.rightTableTop = 0;
        this.rightTableWidth = 0;
        this.rightTableHeight = 1;
        this.rightTableAngle = 0;

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

        this.svgZoom = 1;
        this.svgPosX = 0;
        this.svgPosY = 0;

        this.xAxis = null;
        this.yAxis = null;

        this.canvas.setViewBox(0, 0, frame.width, frame.height, false);
        this.tooltip.hide(true);

        // remove tableIndices from last view
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.tableIndices) {
                    delete sig.tableIndices;
                    sig.tableIndices = null;
                }
            });
        });

        this.origin = [this.mapPane.cx, this.mapPane.cy];

        this.sigLabel = null;

        // default to arrowheads on maps
        this.database.maps.each(function(map) {
            if (map.view)
                map.view.attr({'arrow-end': 'block-wide-long'});
        });

        this.update();
    }

    resize(newFrame) {
        if (newFrame)
            this.frame = newFrame;

        this.mapPane = {'left': this.frame.left,
                        'top': this.frame.top,
                        'width': this.frame.width,
                        'height': this.frame.height,
                        'cx': this.frame.width * 0.5,
                        'cy': this.frame.height * 0.5};

        this.origin = [this.mapPane.cx, this.mapPane.cy];

        this.draw(0);
    }

    tableIndices(key, direction) {
        let rows = [];
        for (var i in this.tables) {
            let s = this.tables[i].getRowFromName(key, direction);
            if (s)
                rows.push({'table': i, 'index': s.index});
        }
        return rows.length ? rows : null;
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
                let regexp = sig.direction == 'output' ? self.srcregexp : self.dstregexp;
                if (regexp && !regexp.test(sig.key)) {
                    remove_object_svg(sig);
                    sig.index = null;
                    return;
                }
                sig.index = sigIndex++;

                if (self.tables) {
                    // TODO: check if signalRep exists (e.g. canvas view)
                    sig.tableIndices = self.tableIndices(sig.key, sig.direction);
                    remove_object_svg(sig);
                }
                else {
                    sig.tableIndices = null;
                    if (!sig.view) {
                        sig.view = self.canvas.path(circle_path(0, self.frame.height, 0))
                                              .attr({'fill-opacity': 0,
                                                     'stroke-opacity': 0});
                        self.setSigDrag(sig);
                        self.setSigHover(sig);
                    }
                }
            });
            // if no signals visible, hide device also
            if (!sigIndex) {
                remove_object_svg(dev);
                dev.index = null;
                return;
            }

            dev.index = devIndex++;
            dev.numVisibleSigs = sigIndex + 1;
            if (self.tables) {
                dev.tableIndices = self.tableIndices(dev.key);
                if (!dev.tableIndices) {
                    remove_object_svg(dev);
                    return;
                }
            }
            else
                dev.tableIndices = null;

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
                                                    'stroke-linecap': 'round'
                                                   });
                dev.view.click(function(e) {
                    dev.collapsed ^= 3;
                    // TODO: hide signals
                    self.updateDevices();
                    self.draw(0);
                });
            }
        });
    }

    drawDevices(duration) {
        let self = this;
        let cx = this.frame.cx;
        this.database.devices.each(function(dev) {
            if (!dev.view || !dev.tableIndices || !dev.tableIndices.length)
                return;
            dev.view.stop();
            let path = null;
            if (dev.tableIndices.length == 1) {
                let row = dev.tableIndices[0];
                let pos = self.tables[row.table].getRowFromIndex(row.index);
                if (pos) {
                    path = [['M', pos.left, pos.top],
                            ['l', pos.width, 0],
                            ['l', 0, pos.height],
                            ['l', -pos.width, 0],
                            ['Z']];
                }
            }
            else if (self.tables.right.snap == 'left') {
                let lrow = null, rrow = null;
                let temp = dev.tableIndices[0];
                if (temp.table == 'left')
                    lrow = self.tables.left.getRowFromIndex(temp.index);
                else
                    rrow = self.tables.right.getRowFromIndex(temp.index);
                temp = dev.tableIndices[1];
                if (temp.table == 'right')
                    rrow = self.tables.right.getRowFromIndex(temp.index);
                else
                    lrow = self.tables.left.getRowFromIndex(temp.index);
                if (!lrow || !rrow)
                    return;
                // draw curve linking left and right tables
                path = [['M', lrow.left, lrow.top],
                        ['l', lrow.width, 0],
                        ['C', cx, lrow.top, cx, rrow.top, rrow.left, rrow.top],
                        ['l', rrow.width, 0],
                        ['l', 0, rrow.height],
                        ['l', -rrow.width, 0],
                        ['C', cx, rrow.bottom, cx, lrow.bottom,
                         lrow.right, lrow.bottom],
                        ['l', -lrow.width, 0],
                        ['Z']];
            }
            else {
                let lrow = null, trow = null;
                let temp = dev.tableIndices[0];
                if (temp.table == 'left')
                    lrow = self.tables.left.getRowFromIndex(temp.index);
                else
                    trow = self.tables.right.getRowFromIndex(temp.index);
                temp = dev.tableIndices[1];
                if (temp.table == 'right')
                    trow = self.tables.right.getRowFromIndex(temp.index);
                else
                    lrow = self.tables.left.getRowFromIndex(temp.index);
                if (!lrow || !trow)
                    return;
                // draw "cross" extending from left and top tables
                path = [['M', lrow.left, lrow.top],
                        ['L', trow.left, lrow.top],
                        ['L', trow.left, trow.top],
                        ['L', trow.right, trow.top],
                        ['L', trow.right, lrow.top],
                        ['L', self.frame.right, lrow.top],
                        ['L', self.frame.right, lrow.bottom],
                        ['L', trow.right, lrow.bottom],
                        ['L', trow.right, self.frame.bottom],
                        ['L', trow.left, self.frame.bottom],
                        ['L', trow.left, lrow.bottom],
                        ['L', lrow.left, lrow.bottom],
                        ['Z']];
            }
            if (path) {
                dev.view.toBack();
                dev.view.animate({'path': path,
                                  'fill': dev.color,
                                  'fill-opacity': 0.5,
                                  'stroke-opacity': 0}, duration, '>');
            }
        });
    }

    setDevHover(dev) {
        let self = this;
        let hovered = false;
        dev.view.unhover();
        dev.view.hover(
            function(e) {
                if (!hovered && !dev.view.label) {
                    self.tooltip.showTable(
                        dev.status+" device", {
                            name: dev.name,
                            signals: dev.signals.size()
                        }, e.x, e.y);
                    if (self.type == 'chord') {
                        dev.view.toFront();
                        // also move associated  links to front
                        self.database.links.each(function(link) {
                            if (link.view && (link.src == dev || link.dst == dev))
                                link.view.toFront();
                        });
                    }
                    dev.view.animate({'stroke-width': 50}, 0, 'linear');
                }
                hovered = true;
                self.hoverDev = dev;
                console.log('set hoverDev to', self.hoverDev);
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
                console.log('set hoverDev to', self.hoverDev);
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
                if (link.src.staged)
                    link.src.staged.view.toFront();
                link.dst.view.toFront();
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
                console.log('set hoverDev to', self.hoverDev);
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
                console.log('set hoverDev to', self.hoverDev);
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
                if (regexp && !regexp.test(sig.key)) {
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
    }

    drawSignals(duration) {
        let self = this;
        this.database.devices.each(function(dev) {
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
                self.tooltip.showTable(
                    "Map", {
                        source: map.src.key,
                        destination: map.dst.key,
                        mode: map.mode,
                        expression: map.expression,
                    }, e.x, e.y);
                map.view.animate({'stroke-width': MapPath.boldStrokeWidth}, 0, 'linear');

//                if (self.draggingFrom == null)
//                    return;
//                else if (map == self.draggingFrom) {
//                    // don't snap to self
//                    return;
//                }
//                self.snappingTo = map;
//                let src = self.draggingFrom.position;
//                let dst = sig.position;
//                let path = [['M', src.x, src.y],
//                            ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
//                             dst.x, dst.y]];
//                let len = Raphael.getTotalLength(path);
//                path = Raphael.getSubpath(path, 10, len - 10);
//                self.newMap.attr({'path': path});
            },
            function() {
                self.snappingTo = null;
                self.tooltip.hide();
                map.view.animate({'stroke-width': MapPath.strokeWidth}, 50, 'linear');
            }
        );
    }

    updateMaps() {
        let self = this;
        this.database.maps.each(function(map) {
            // todo: check if signals are visible
            if (!map.view) {
                let pos = map.src.position;
                let path = pos ? [['M', pos.x, pos.y], ['l', 10, 0]] : null;
                map.view = self.canvas.path(path);
                map.view.attr({'stroke-dasharray': map.muted ? '-' : '',
                               'stroke': map.selected ? 'red' : 'white',
                               'fill-opacity': 0,
                               'stroke-width': MapPath.strokeWidth,
                               'rrow-start': 'none'});
                map.view.new = true;
                self.setMapHover(map);
            }
        });
    }

    _tableRow(sig) {
        if (this.tables && sig.tableIndices) {
            let table = this.tables[sig.tableIndices[0].table];
            return table.getRowFromName(sig.key);
        }
        return null;
    }

    getMapPath(map) {
        if (this.tables) return this._getMapPathForTables(map);
        else return this._getMapPathForSigNodes(map);
    }

    _getMapPathForTables(map) {
        let src = this._tableRow(map.src);
        let dst = this._tableRow(map.dst);
        if (src && dst) {
            if (src.vx == dst.vx) {
                // same table
                if (map.view) map.view.attr({'arrow-end': 'block-wide-long'});
                if (src.x == dst.x) return MapPath.sameTable(src, dst, this.mapPane);
                else return MapPath.horizontal(src, dst); 
            }
            else if (src.vy != dst.vy) {
                // constrain positions to pane to indicate offscreen maps
                // todo: make function
                if (src.x < this.leftTableLeft) {
                    // constrain to bounds
                    // display a white dot
                }
                // draw intersection between tables
                if (map.view) map.view.attr({'arrow-end': 'none'});
                if (src.vx < 0.0001) {
                    return [['M', src.left + 2, dst.y],
                            ['L', src.left + src.width - 2, dst.top + 2],
                            ['l', 0, dst.height - 2],
                            ['Z']];
                }
                else {
                    return [['M', dst.x, src.top + 2],
                            ['L', dst.left + 2, src.top + src.height - 2],
                            ['l', dst.width - 2, 0],
                            ['Z']]
                }
            }
            else {
                // draw bezier curve between signal tables
                if (map.view) map.view.attr({'arrow-end': 'block-wide-long'});
                return MapPath.betweenTables(src, dst);
            }
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

    drawMaps(duration) {
        let self = this;
        this.database.maps.each(function(map) {
            if (!map.view)
                return;
            if (map.hidden) {
                map.view.hide();
                return;
            }
            map.view.stop();

            let path = self.getMapPath(map);
            if (self.shortenPaths) {
                // shorten path so it doesn't draw over signals
                let len = Raphael.getTotalLength(path);
                path = Raphael.getSubpath(path, self.shortenPaths,
                                          len - self.shortenPaths);
            }

            let fill = (self.type == 'grid' && path.length > 3) ? 1.0 : 0.0;
            let color = map.selected ? 'red' : 'white';
            if (!path) {
                map.view.hide();
                return;
            }

            if (map.view.new) {
                map.view.show();
                map.view.new = false;
                if (map.status == "staged") {
                    // draw map directly
                    map.view.attr({'path': path,
                                   'stroke-opacity': 0.5,
                                   'stroke': color,
                                   'stroke-dasharray': map.muted ? '-' : '',
                                   'fill-opacity': fill,
                                   'fill': color,
                                   'arrow-end': 'block-wide-long'
                                  })
                            .toFront();
                    return;
                }
                // draw animation following arrow path
                let len = Raphael.getTotalLength(path);
                let path_mid = Raphael.getSubpath(path, 0, len * 0.5);
                map.view.animate({'path': path_mid,
                                  'stroke-opacity': 1.0},
                                 duration * 0.5, '>')
                        .toFront();
            }
            else {
                map.view.show();
                map.view.animate({'path': path,
                                  'stroke-opacity': 1.0,
                                  'fill-opacity': fill,
                                  'fill': color,
                                  'stroke-width': MapPath.strokeWidth,
                                  'stroke': color},
                                 duration, '>')
                        .toFront();
            }
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
        this.svgPosX += delta_x * this.svgZoom;
        this.svgPosY += delta_y * this.svgZoom;

        this.canvas.setViewBox(this.svgPosX, this.svgPosY,
                               this.frame.width * this.svgZoom,
                               this.frame.height * this.svgZoom, false);
        this.tooltip.showBrief(
            'pan: ['+this.svgPosX.toFixed(2)+', '+this.svgPosY.toFixed(2)+']', 
            x, y);
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
        let newZoom = this.svgZoom + delta * 0.01;
        if (newZoom < 0.1)
            newZoom = 0.1;
        else if (newZoom > 20)
            newZoom = 20;
        if (newZoom == this.svgZoom)
            return;
        let zoomDiff = this.svgZoom - newZoom;
        this.svgPosX += x * zoomDiff;
        this.svgPosY += (y - this.frame.top) * zoomDiff;
        this.canvas.setViewBox(this.svgPosX, this.svgPosY,
                               this.frame.width * newZoom,
                               this.frame.height * newZoom, false);
        this.tooltip.showBrief( 'zoom: '+(100/newZoom).toFixed(2)+'%', x, y);
        this.svgZoom = newZoom;
    }

    resetPanZoom() {
        this.canvas.setViewBox(0, 0, this.frame.width, this.frame.height, false);
        this.svgZoom = 1;
        this.svgPosX = 0;
        this.svgPosY = 0;
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
            this.newMap.remove();
            this.newMap = null;
        }
    }

    setTableDrag() {
        let self = this;
        // dragging maps from table
        // if another table exists, we can drag between them
        // can also drag map to self
        // if tables are orthogonal we can simply drag to 2D space between them
        // if no other table exists, can drag out signal representation
        $('.tableDiv').on('mousedown', 'tr', function(e) {
            self.escaped = false;

            let src_row = this;
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
            if ($(src_row).hasClass('device')) {
                let dev = self.database.devices.find(src_row.id);
                if (dev) {
                    switch (src_table) {
                    case self.tables.left:
                        dev.collapsed ^= 1;
                        break;
                    case self.tables.right:
                        dev.collapsed ^= 2;
                        break;
                    case self.tables.top:
                        dev.collapsed ^= 4;
                        break;
                    default:
                        return;
                    }
                    self.updateDevices();
                    self.draw(0);
                }
                return;
            }

            $('svg').one('mouseenter.drawing', function() {
                deselectAllMaps(self.tables);

                var src = src_table.getRowFromName(src_row.id.replace('\\/', '\/'));
                var dst = null;

                self.newMap = self.canvas.path([['M', src.x, src.y],
                                                ['l', 0, 0]])
                                         .attr({'fill-opacity': 0,
                                                'stroke': 'white',
                                                'stroke-opacity': 1,
                                                'stroke-width': MapPath.strokeWidth});

                $('svg, .displayTable tbody tr').on('mousemove.drawing', function(e) {
                    // clear table highlights
                    let index;
                    for (index in self.tables)
                        self.tables[index].highlightRow(null, true);

                    if (self.escaped) {
                        $(document).off('.drawing');
                        $('svg, .displayTable tbody tr').off('.drawing');
                        return;
                    }

                    let x = e.pageX;
                    let y = e.pageY;
                    let path = null;
                    dst = null;
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
                        dst_table = self.tables[index];
                        break;
                    }

                    if (src_table == dst_table) {
                        // draw smooth path from table to self
                        path = MapPath.sameTable(src, dst, self.mapPane);
                    }
                    else if (dst) {
                        // draw bezier curve connecting src and dst
                        path = MapPath.betweenTables(src, dst);
                    }
                    else {
                        // draw smooth path connecting src to cursor
                        path = [['M', src.x, src.y],
                                ['S',
                                 src.x + src.vx * self.mapPane.width * 0.5,
                                 src.y + src.vy * self.mapPane.height * 0.5,
                                 x - self.frame.left, y - self.frame.top]];
                    }
                    src_table.highlightRow(src, false);
                    if (dst_table)
                        dst_table.highlightRow(dst, false);

                    self.newMap.attr({'path': path});
                });
                $(document).on('mouseup.drawing', function(e) {
                    $(document).off('.drawing');
                    $('svg, .displayTable tbody tr').off('.drawing');
                    if (dst && dst.id) {
                        $('#container').trigger('map', [src.id, dst.id]);
                        self.database.maps.add({'src': self.database.find_signal(src.id),
                                                'dst': self.database.find_signal(dst.id),
                                                'key': src.id + '->' + dst.id,
                                                'status': 'staged'});
                    }
                    // clear table highlights
                    self.tables.left.highlightRow(null, true);
                    self.tables.right.highlightRow(null, true);

                    self.newMap.remove();
                    self.newMap = null;
                });
            });
            $(document).one('mouseup.drawing', function(e) {
                $(document).off('.drawing');
            });
        });
    }

    cleanup() {
        // clean up any objects created only for this view
        $(document).off('.drawing');
        $('svg, .displayTable tbody tr').off('.drawing');
        $('.tableDiv').off('mousedown');
    }
}

class MapPath {
    constructor() {}

    static betweenTables(src, dst) {
        let mpx = (src.x + dst.x) * 0.5;
        return [['M', src.x, src.y],
                ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
    }

    static sameTable(srcrow, dstrow, mapPane) {
        // signals are part of the same table
        let diff = srcrow.y - dstrow.y
        let vert = Math.abs(diff);
        let scale = vert / mapPane.height;
        if (scale > 1) scale = 1;
        let ctlx = scale * 0.85 * mapPane.width;
        if (diff > 0) ctlx = ctlx + srcrow.x + 20;
        else ctlx = srcrow.x - 20 - ctlx;
        return [['M', srcrow.x, srcrow.y],
                ['C', ctlx, srcrow.y, ctlx, dstrow.y, dstrow.x, dstrow.y]];
    }

    static horizontal(src, dst) {
        // signals are inline horizontally
        let ctly = Math.abs(src.x - dst.x) * 0.5 * src.vy + src.y;
        return [['M', src.x, src.y],
                ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }
}

MapPath.strokeWidth = 4;
MapPath.boldStrokeWidth = 8;

