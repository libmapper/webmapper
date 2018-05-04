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
    constructor(type, frame, tables, canvas, database) {
        this.type = type;
        this.frame = frame;
        this.tables = tables,
        this.canvas = canvas;
        this.database = database;

        this.srcregexp = null;
        this.dstregexp = null;

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
        $('#status').text('');

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
            this.tables[i].update(this.frame.height);

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
                    self.draw(200);
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
                path = [['M', pos.left, pos.top],
                        ['l', pos.width, 0],
                        ['l', 0, pos.height],
                        ['l', -pos.width, 0],
                        ['Z']];
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
        dev.view.unhover().hover(
            function(e) {
                if (self.draggingFrom)
                    return;
                if (!hovered && !dev.label) {
                    // show label
                    $('#status').stop(true, false)
                                .empty()
                                .append("<table class=infoTable>"+
                                            "<tbody>"+
                                                "<tr><th colspan='2'>"+dev.status+" device</th></tr>"+
                                                "<tr><td>name</td><td>"+dev.name+"</td></tr>"+
                                                "<tr><td>signals</td><td>"+dev.signals.size()+"</td></tr>"+
                                            "</tbody>"+
                                        "</table>")
                                .css({'left': e.x + 20,
                                      'top': e.y,
                                      'opacity': 1});
                    dev.view.toFront().animate({'stroke-width': 50}, 0, 'linear');
                }
                hovered = true;
//                if (self.draggingFrom == null)
//                    return;
//                else if (dev == self.draggingFrom) {
//                    // don't snap to self
//                    return;
//                }
//                self.snappingTo = dev;
//                let src = self.draggingFrom.position;
//                let dst = dev.position;
//                let path = [['M', src.x, src.y],
//                            ['S', (src.x + dst.x) * 0.6, (src.y + dst.y) * 0.4,
//                             dst.x, dst.y]];
//                let len = Raphael.getTotalLength(path);
//                path = Raphael.getSubpath(path, 10, len - 10);
//                self.newMap.attr({'path': path});
            },
            function() {
//                self.snappingTo = null;
                if (!self.draggingFrom) {
                    $('#status').stop(true, false)
                                .animate({opacity: 0}, {duration: 2000});
                    dev.view.animate({'stroke-width': 40}, 500, 'linear');
                           hovered = false;
                }
            }
        );
    }

    setDevDrag(dev) {
        let self = this;
        dev.view.mouseup(function() {
            if (self.draggingFrom && self.snappingTo)
                $('#container').trigger('map', [self.draggingFrom.key,
                                                self.snappingTo.key]);
        });
        dev.view.undrag().drag(
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
                                      'stroke-width': 2,
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

    setLinkHover(link) {
        let self = this;
        link.view.unhover().hover(
            function(e) {
                // show label
                $('#status').stop(true, false)
                            .empty()
                            .append("<table class=infoTable>"+
                                        "<tbody>"+
                                            "<tr><th colspan='2'>Link</th></tr>"+
                                            "<tr><td>source</td><td>"+link.src.key+"</td></tr>"+
                                            "<tr><td>destination</td><td>"+link.dst.key+"</td></tr>"+
                                        "</tbody>"+
                                    "</table>")
                            .css({'left': e.x + 20,
                                  'top': e.y,
                                  'opacity': 1});
                link.view.toFront().animate({'fill-opacity': 0.75}, 0, 'linear');
                link.src.view.toFront();
                link.dst.view.toFront();
            },
            function() {
                $('#status').stop(true, false)
                            .animate({opacity: 0}, {duration: 2000});
                link.view.animate({'fill-opacity': 0.5}, 0, 'linear');
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
//            link.view.hover(
//                function() {
//                    link.view.toFront();
//                    link.view.setAlpha(0.5);
//                    this.mousemove(function (e, x) {
//                        let ratio = (x - self.mapPane.left) / self.mapPane.width;
//                        ratio = ratio * 0.25;
//                        link.view.setAlpha(0.5-ratio, 0.25+ratio);
//                    });
//                },
//                function() {
//                    this.unmousemove();
//                    this.setAlpha(0.25);
//            });
//            link.view.unclick().click(function(e, x) {
//                console.log('click');
//                // check if close to table
//                // enable dragging to new device
//            });
            self.setLinkHover(link);
        });
    }

    setSigHover(sig) {
        let self = this;
        sig.view.unhover().hover(
            function() {
                if (!sig.view.label) {
                    // show label
                    let typestring = sig.length > 1 ? sig.type+'['+sig.length+']' : sig.type;
                    let minstring = sig.min != null ? sig.min : '';
                    let maxstring = sig.max != null ? sig.max : '';
                    $('#status').stop(true, false)
                                .empty()
                                .append("<table class=infoTable>"+
                                            "<tbody>"+
                                                "<tr><th colspan='2'>"+sig.device.status+" signal</th></tr>"+
                                                   "<tr><td>name</td><td>"+sig.key+"</td></tr>"+
                                                   "<tr><td>direction</td><td>"+sig.direction+"</td></tr>"+
                                        "<tr><td>type</td><td>"+typestring+"</td></tr>"+
                                        "<tr><td>unit</td><td>"+sig.unit+"</td></tr>"+
                                        "<tr><td>minimum</td><td>"+minstring+"</td></tr>"+
                                        "<tr><td>maximum</td><td>"+maxstring+"</td></tr>"+
                                           "</tbody>"+
                                        "</table>")
                                .css({'left': sig.position.x + 20,
                                      'top': sig.position.y + 70,
                                      'opacity': 1});
                    sig.view.animate({'stroke-width': 15}, 0, 'linear');
                }
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
                $('#status').stop(true, false)
                            .animate({opacity: 0}, {duration: 2000});
                sig.view.animate({'stroke-width': 6}, 50, 'linear');
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
        sig.view.undrag().drag(
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
                                      'stroke-width': 2,
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
        map.view.hover(
            function(e) {
                // show label
                $('#status').stop(true, false)
                            .empty()
                            .append("<table class=infoTable>"+
                                        "<tbody>"+
                                            "<tr><th colspan='2'>Map</th></tr>"+
                                                "<tr><td>source</td><td>"+map.src.key+"</td></tr>"+
                                                "<tr><td>destination</td><td>"+map.dst.key+"</td></tr>"+
                                                "<tr><td>mode</td><td>"+map.mode+"</td></tr>"+
                                                "<tr><td>expression</td><td>"+map.expression+"</td></tr>"+
                                        "</tbody>"+
                                    "</table>")
                            .css({'left': e.x + 20,
                                  'top': e.y,
                                  'opacity': 1});
                map.view.animate({'stroke-width': 4}, 0, 'linear');

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
                $('#status').stop(true, false)
                            .animate({opacity: 0}, {duration: 2000});
                map.view.animate({'stroke-width': 2}, 50, 'linear');
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
                               'stroke': map.view.selected ? 'red' : 'white',
                               'fill-opacity': 0,
                               'stroke-width': 2,
                               'arrow-start': 'none'});
                map.view.new = true;
                self.setMapHover(map);
            }
        });
    }

    mapPath(map) {
        let self = this;
        function tableRow(sig) {
            if (self.tables && sig.tableIndices) {
                let table = self.tables[sig.tableIndices[0].table];
                return table.getRowFromIndex(sig.tableIndices[0].index);
            }
            return null;
        }
        let src = tableRow(map.src);
        let dst = tableRow(map.dst);
        if (src && dst) {
            /* If src and dst are from same table we will always draw a bezier
             * curve using the signal spacing for calculating control points. */
            if (src.vx == dst.vx) {
                // same table
                if (src.x == dst.x) {
                    // signals are inline vertically
                    let ctlx = Math.abs(src.y - dst.y) * 0.5 * src.vx + src.x;
                    return [['M', src.x, src.y],
                            ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
                }
                else {
                    // signals are inline horizontally
                    let ctly = Math.abs(src.x - dst.x) * 0.5 * src.vy + src.y;
                    return [['M', src.x, src.y],
                            ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
                }
            }
            else if (src.vy != dst.vy) {
                // draw intersection between tables
                return ((src.x > dst.x)
                        ? [['M', src.left, dst.y],
                           ['L', src.left + src.width, dst.top],
                           ['l', 0, dst.height],
                           ['Z']]
                        : [['M', dst.x, src.top],
                           ['L', dst.left, src.top + src.height],
                           ['l', dst.width, 0],
                           ['Z']]);
            }
            else {
                // draw bezier curve between signal tables
                let mpx = (src.x + dst.x) * 0.5;
                return [['M', src.x, src.y],
                        ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
            }
        }
        if (!src)
            src = map.src.position
        if (!dst)
            dst = map.dst.position;
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
                map.view.attr({'stroke-opacity': 0}, duration, '>');
                return;
            }
            map.view.stop();

            let path = self.mapPath(map);
            if (!path) {
                console.log('problem generating path for map', map);
                return;
            }

            if (map.view.new) {
                map.view.new = false;
                if (map.status == "staged") {
                    // draw map directly
                    map.view.attr({'path': path,
                                   'stroke-opacity': 0.5,
                                   'stroke': map.view.selected ? 'red' : 'white',
                                   'stroke-dasharray': map.muted ? '-' : '',
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
//                map.view.attr({'arrow-end': 'block-wide-long'});
                map.view.animate({'path': path,
                                  'stroke-opacity': 1.0,
                                  'fill-opacity': 0,
                                  'stroke-width': 2,
                                  'stroke': map.view.selected ? 'red' : 'white'},
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
        $('#status').stop(true, false)
                    .text('pan: ['+this.svgPosX.toFixed(2)+', '+this.svgPosY.toFixed(2)+']')
                    .css({'left': x + 10,
                          'top': y + 60,
                          'opacity': 1})
                    .animate({opacity: 0}, {duration: 2000});
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

        $('#status').stop(true, false)
                    .text('zoom: '+(100/newZoom).toFixed(2)+'%')
                    .css({'left': x + 10,
                          'top': y + 60,
                          'opacity': 1})
                    .animate({opacity: 0}, {duration: 2000});

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
                this.draw(1000);
            }
        }
        else {
            if (direction == 'src')
                this.srcregexp = text ? new RegExp(text, 'i') : null;
            else
                this.dstregexp = text ? new RegExp(text, 'i') : null;
            this.update('signals');
            this.draw(1000);
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
                    self.draw(200);
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
                                                'stroke-width': 2});

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
                        if (dst) {
                            dst_table = self.tables[index];
                            break;
                        }
                    }

                    if (src_table == dst_table) {
                        // draw smooth path from table to self
                        let dist = Math.abs(src.x - dst.x) + Math.abs(src.y - dst.y) * 0.5;
                        path = [['M', src.x, src.y],
                                ['C',
                                 src.x + src.vx * dist,
                                 src.y + src.vy * dist,
                                 dst.x + dst.vx * dist,
                                 dst.y + dst.vy * dist,
                                 dst.x, dst.y]];
                    }
                    else if (dst) {
                        // draw bezier curve connecting src and dst
                        path = [['M', src.x, src.y],
                                ['C',
                                 src.x + src.vx * self.mapPane.width * 0.5,
                                 src.y + src.vy * self.mapPane.height * 0.5,
                                 dst.x + dst.vx * self.mapPane.width * 0.5,
                                 dst.y + dst.vy * self.mapPane.height * 0.5,
                                 dst.x, dst.y]];
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
