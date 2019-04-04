//++++++++++++++++++++++++++++++++++++++//
//          Graph View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

/* The graph view plots signals on a 2D graph, with x and y axes chosen by the
 * user from the signals' properties. Interestingly, some signal properties
 * (such as min and max) may have vector values, meaning that a given signal
 * may have more than one location on the graph. To handle this situation,
 * this view uses an array of signal positions. */

class GraphView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('graph', frame, null, canvas, database, tooltip, pie, GraphMapPainter);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 500, null, 0, 0);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        // remove associated svg elements for devices
        this.database.devices.each(function(dev) {
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.xAxisProp = 'min';
        this.yAxisProp = 'max';
        this.hidden = {'x': 0, 'y': 0};
        var xMin = null, xMax = null, yMin = null, yMax = null;
        this.stepInterval = 2;

        this._labelAxes();

        // temporary
        // TODO: populate menus using signal properties
        $('#xAxisMenu').empty().append("<a>none</a><a>min</a><a>max</a><a>name</a><a>device name</a>");
        $('#yAxisMenu').empty().append("<a>device name</a><a>name</a><a>max</a><a>min</a><a>none</a>");

        let self = this;
        $('.axisLabel').on('click', function(e) {
            let axis = e.currentTarget.id[0];
            let menu = $('#'+axis+'AxisMenu');
            if ($(menu).hasClass('show')) {
                $(menu).removeClass('show');
                $(menu).children('a').off('click');
                return;
            }
            $(menu).addClass('show');

            // hide other axis menu if it is showing
            let other = (axis == 'x') ? 'y' : 'x';
            $('#'+other+axis.slice(1)+'Menu').removeClass('show');
            $('#'+other+axis.slice(1)+'Menu').children('a').off('click');

            // listen for menu item clicks
            $(menu).children('a').one('click', function(a) {
                $(menu).removeClass('show');
                let prop = a.currentTarget.innerHTML;
                if (prop === 'none')
                    prop = null;
                if (axis == 'x' && self.xAxisProp != prop)
                    self.xAxisProp = prop;
                else if (axis == 'y' && self.yAxisProp != prop)
                    self.yAxisProp = prop;
                else
                    return;
                self.stopStepping();
                self.xMin = self.xMax = self.yMin = self.yMax = null;
                self.sortSignals();
                self._labelAxes();
                if (!self.xAxisProp || !self.yAxisProp) {
                    // need to call force-directed layout
                    self.startStepping();
                }
                else {
                    // can just draw directly
                    self.draw(500);
                }
            });
            e.stopPropagation();
            let axes = $('#axes');
            $(axes).css('pointer-events', 'all');
            $(axes).one('click', function() {
                $('.dropdown-content').removeClass('show').children('a').off('click');
                $(axes).css('pointer-events', 'none');
            });
        });

        this.resize();
    }

    _resize(duration) {
        super._resize();
        $('#axes').stop(true, false)
                  .css({'left': this.frame.left + 25,
                        'top': this.frame.top + 25,
                        'width': this.frame.width - 50,
                        'height': this.frame.height - 50,
                        'opacity': 1,
                        'z-index': 10});
    }

    _labelAxes() {
        let hidden = this.hidden.x > 0 ? ' ('+this.hidden.x+' hidden)' : '';
        if (this.xAxisProp) {
            $('#xAxisLabel').text('▲ '+this.xAxisProp+hidden)
                            .css('border-radius', '0px 0px 20px 20px');
            $('#axes').css('border-bottom', '1px solid rgba(255, 255, 255, 0.75)');

        }
        else {
            $('#xAxisLabel').text('x: none')
                            .css('border-radius', '20px 20px 0px 0px');
            $('#axes').css('border-bottom', 'none');
        }
        hidden = this.hidden.y > 0 ? ' ('+this.hidden.y+' hidden)' : '';
        if (this.yAxisProp) {
            $('#yAxisLabel').text('◀ '+this.yAxisProp+hidden)
                            .css('border-radius', '0px 20px 20px 0px');
            $('#axes').css('border-left', '1px solid rgba(255, 255, 255, 0.75)');
        }
        else {
            $('#yAxisLabel').text('y: none')
                            .css('border-radius', '20px 0px 0px 20px');
            $('#axes').css('border-left', 'none');
        }
    }

    _updateRangeLabels() {
        if (this.xAxisProp && typeof this.xMin != 'string') {
            let xScale = (this.xMax - this.xMin) * this.canvas.zoom;
            let xPan = this.xMin + this.canvas.pan.x / this.canvas.zoom / (this.frame.width - 100) * xScale;
            $('#xAxisMin').text(xPan.toFixed(2));
            $('#xAxisMax').text((xPan + xScale).toFixed(2));
        }
        else {
            $('#xAxisMin').text('');
            $('#xAxisMax').text('');
        }

        if (this.yAxisProp && typeof this.yMin != 'string') {
            let yScale = (this.yMax - this.yMin) * this.canvas.zoom;
            let yPan = this.yMin + this.canvas.pan.y / this.canvas.zoom / (this.frame.height - 100) * yScale;
            $('#yAxisMin').text(yPan.toFixed(2));
            $('#yAxisMax').text((yPan + yScale).toFixed(2));
        }
        else {
            $('#yAxisMin').text('');
            $('#yAxisMax').text('');
        }
    }

    sortSignals() {
        let xProp = this.xAxisProp;
        let yProp = this.yAxisProp;
        let rangeChanged = true;
        let self = this;
        let iterations = 0;
        let tx = this.frame.left + this.frame.width * 0.5;
        let ty = this.frame.top + this.frame.height * 0.5;
        this.hidden.x = this.hidden.y = 0;
        // calculate ranges
        while (rangeChanged && iterations < 10) {
            iterations += 1;
            rangeChanged = false;
            database.devices.each(function(dev) {
                dev.signals.each(function(sig) {
                    let xVal, yVal;
                    if (xProp == null)
                        xVal = null;
                    else  {
                        if (xProp.indexOf('device ') == 0)
                            xVal = sig.device[xProp.slice(7)];
                        else
                            xVal = sig[xProp];
                        if (xVal == null)
                            self.hidden.x += 1;
                    }
                    if (yProp == null)
                        yVal = null;
                    else {
                        if (yProp.indexOf('device ') == 0)
                            yVal = sig.device[yProp.slice(7)];
                        else
                            yVal = sig[yProp];
                        if (yVal == null)
                            self.hidden.y += 1;
                    }
                    let positionChanged = false;
                    if (xVal === undefined) xVal = null;
                    if (yVal === undefined) yVal = null;
                    if (xProp && (xVal === null) || yProp && (yVal === null)) {
                        if (sig.position) {
                            positionChanged = true;
                        }
                        if (sig.view) {
                            sig.view.hide();
                        }
                        return;
                    }
                    sig.view.show();
                    if (xVal != null) {
                        let min, max;
                        if (typeof xVal != "string" && xVal.length > 1) {
                            min = xVal.reduce((a,b) => (a<b?a:b));
                            max = xVal.reduce((a,b) => (a>b?a:b));
                            xVal = xVal.slice();
                        }
                        else {
                            min = max = xVal;
                            xVal = [xVal];
                        }
                        if (self.xMin == null || min < self.xMin) {
                            self.xMin = min;
                            rangeChanged = true;
                        }
                        if (self.xMax == null || max > self.xMax) {
                            self.xMax = max;
                            rangeChanged = true;
                        }
                        if (self.xMin != null && self.xMax != null) {
                            // calculate x position
                            if (typeof self.xMin == 'string') {
                                min = stringToInt(self.xMin);
                                max = stringToInt(self.xMax);
                                for (var i = 0; i < xVal.length; i++)
                                    xVal[i] = stringToInt(xVal[i]);
                            }
                            else {
                                min = self.xMin;
                                max = self.xMax;
                            }
                            let range = max - min;
                            for (var i in xVal) {
                                xVal[i] -= min;
                                if (range != 0)
                                    xVal[i] = xVal[i] / range * (self.frame.width - 100);
                                xVal[i] += 50;
                            }
                            if (xVal != sig.position.x)
                                positionChanged = true;
                        }
                    }
                    else
                        positionChanged = true;
                    if (yVal != null) {
                        let min, max;
                        if (typeof yVal != "string" && yVal.length > 1) {
                            min = yVal.reduce((a,b) => (a<b?a:b));
                            max = yVal.reduce((a,b) => (a>b?a:b));
                            yVal = yVal.slice();
                        }
                        else {
                            min = max = yVal;
                            yVal = [yVal];
                        }
                        if (self.yMin == null || min < self.yMin) {
                            self.yMin = min;
                            rangeChanged = true;
                        }
                        if (self.yMax == null || max > self.yMax) {
                            self.yMax = max;
                            rangeChanged = true;
                        }
                        if (self.yMin != null && self.yMax != null) {
                            // calculate y position
                            if (typeof self.yMin == 'string') {
                                min = stringToInt(self.yMin);
                                max = stringToInt(self.yMax);
                                for (var i = 0; i < yVal.length; i++)
                                    yVal[i] = stringToInt(yVal[i]);
                            }
                            else {
                                min = self.yMin;
                                max = self.yMax;
                            }
                            let range = max - min;
                            for (var i in yVal) {
                                yVal[i] -= min;
                                if (range != 0)
                                    yVal[i] = yVal[i] / range * (self.frame.height - 100);
                                yVal[i] = self.frame.height - yVal[i] - 50;
                            }
                            if (yVal != sig.position.y)
                                positionChanged = true;
                        }
                    }
                    else
                        positionChanged = true;
                    if (positionChanged) {
                        // update signal position target
                        let t = [];
                        let f = [];
                        let len = xVal ? xVal.length : 1;
                        if (yVal && yVal.length > len)
                            len = yVal.length;
                        for (var i = 0; i < len; i++) {
                            t.push({'x': xVal ? xVal[i] : tx,
                                    'y': yVal ? yVal[i] : ty});
                            f.push({'x': 0, 'y': 0});
                        }
                        sig.target = t;
                        sig.force = f;
                        if (!sig.position) {
                            sig.position = [];
                            let p = {'x': tx, 'y': ty};
                            for (var i = 0; i < len; i++)
                                sig.position.push(p);
                        }
                        else if (sig.position.x != undefined) {
                            let p = [sig.position];
                            for (var i = 0; i < len - 1; i++)
                                p.push(sig.position);
                            sig.position = p;
                        }
                        else if (sig.position.length > len) {
                            sig.position = sig.position.slice(0, len);
                        }
                        else if (sig.position.length < len) {
                            let p = sig.position[sig.position.length-1];
                            for (var i = sig.position.length; i < len; i++)
                                sig.position.push(p);
                        }
                        // if x and y axis are defined, copy target to position
                        if (self.xAxisProp && self.yAxisProp)
                            sig.position = sig.target;
                    }
                });
            });
        }
        this._updateRangeLabels();
    }

    forceDirect() {
        let self = this;
        let moved = false;
        let K_repulse_x = 0.0;
        let K_repulse_y = 0.0;
        let K_target_x = 1.1;
        let K_target_y = 1.1;
        let K_map_x = 0.0;
        let K_map_y = 0.0;
        if (!self.xAxisProp) {
            K_target_x = 0.01;
            K_repulse_x = 1000;
            K_map_x = 0.01;
        }
        if (!self.yAxisProp) {
            K_target_y = 0.01;
            K_repulse_y = 1000;
            K_map_y = 0.01;
        }
        let L = 100;
        this.database.devices.each(function(devA) {
            // attract positions towards targets
            devA.signals.each(function(sig) {
                if (!sig.target)
                    return;
                for (var i in sig.position) {
                    let dx = sig.target[i].x - sig.position[i].x;
                    let dy = sig.target[i].y - sig.position[i].y;
                    if (dx == 0 && dy == 0)
                        continue;
                    let fx = K_target_x * dx;
                    let fy = K_target_y * dy;
                    sig.force[i].x = sig.force[i].x * 0.5 + fx;
                    sig.force[i].y = sig.force[i].y * 0.5 + fy;
                }
            });
            // repel signal positions
            devA.signals.each(function(sigA) {
                if (!sigA.target)
                    return;
                let pA = sigA.position;
                let fA = sigA.force;
                let found = false;
                self.database.devices.each(function(devB) {
                    devB.signals.each(function(sigB) {
                        if (!sigB.target)
                            return;
                        if (found == true) {
                            let pB = sigB.position;
                            let fB = sigB.force;
                            let mapped = false;
                            // check if signals are mapped
                            self.database.maps.each(function(map) {
                                if (map.src == sigA && map.dst != sigB)
                                    mapped = true;
                                else if (map.dst == sigA && map.src == sigB)
                                    mapped = true;
                            });
                            for (var i in pA) {
                                for (var j in pB) {
                                    let dx = pB[j].x - pA[i].x;
                                    let dy = pB[j].y - pA[i].y;
                                    if (dx == 0)
                                        dx = Math.random();
                                    if (dy == 0)
                                        dy = Math.random();
                                    let distSq = dx*dx + dy*dy;
                                    let dist = Math.sqrt(distSq);
                                    let fx = K_repulse_x / distSq * dx / dist;
                                    let fy = K_repulse_y / distSq * dy / dist;
                                    if (mapped) {
                                        // add spring attraction for map
                                        fx -= K_map_x * (dist - L) * dx / dist;
                                        fy -= K_map_y * (dist - L) * dy / dist;
                                    }
                                    fA[i].x -= fx;
                                    fA[i].y -= fy;
                                    fB[j].x += fx;
                                    fB[j].y += fy;
                                }
                            }
                        }
                        else if (sigB == sigA)
                            found = true;
                    });
                });
                // update position
                let newPos = [];
                for (var i in sigA.position) {
                    let x = sigA.position[i].x;
                    let y = sigA.position[i].y;
                    if (Math.abs(fA[i].x) > 1 || Math.abs(fA[i].y) > 1) {
                        // limit forces arbitrarily
                        if (fA[i].x > 100)
                            fA[i].x = 100;
                        else if (fA[i].x < -100)
                            fA[i].x = -100;
                        if (fA[i].y > 100)
                            fA[i].y = 100;
                        if (fA[i].y < -100)
                            fA[i].y = -100;
                        x += fA[i].x;
                        y += fA[i].y;
                        moved = true;
                    }
                    newPos.push({'x': x, 'y': y});
                }
                if (moved)
                    sigA.position = newPos;
            });
        });
        return moved;
    }

    drawSignal(sig, duration) {
        if (!sig.view)
            return;
        sig.view.stop();
        let pos = sig.position;
        let path = null;
        for (var i in pos) {
            let circle = circle_path(pos[i].x, pos[i].y, 10 * this.canvas.zoom);
            if (!path)
                path = circle;
            else {
                path = path.concat(circle);
            }
        }
        let is_output = sig.direction == 'output';
        let color = Raphael.hsl(sig.device.hue, 1, 0.5);
        if (duration) {
            sig.view.animate({'path': path,
                              'fill': is_output ? 'black' : color,
                              'fill-opacity': 1,
                              'stroke': color,
                              'stroke-width': 6 * this.canvas.zoom,
                              'stroke-opacity': 1}, duration, '>');
        }
        else {
            sig.view.attr({'path': path,
                           'fill': is_output ? 'black' : color,
                           'fill-opacity': 1,
                           'stroke': color,
                           'stroke-width': 6 * this.canvas.zoom,
                           'stroke-opacity': 1});
        }
    }

    startStepping() {
        let self = this;
        if (this.stepping)
            window.clearInterval(this.stepping);
        this.stepping = setInterval(function() {
            if (self.forceDirect() == true) {
                self.draw(0);
            }
            else {
                console.log('done stepping');
                window.clearInterval(self.stepping);
                self.stepping = null;
            }
        }, self.stepInterval);
    }

    stopStepping() {
        console.log('done stepping');
        window.clearInterval(this.stepping);
        this.stepping = null;
    }

    update() {
        let elements;
        let self = this;
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
        if (elements.indexOf('signals') >= 0) {
            this.updateSignals(function(sig) {
                if (!sig.position)
                    sig.position = [position(null, null, self.frame)];
                return false;
            });
            this.sortSignals();
            this._labelAxes();
            if (!this.xAxisProp || !this.yAxisProp) {
                // need to call force-directed layout
                this.startStepping();
            }
            else {
                // can just draw directly
                this.draw(500);
            }
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
        this.canvasPan(x, y, delta_x, delta_y);
        this._updateRangeLabels();
    }

    zoom(x, y, delta) {
        this.canvasZoom(x, y, delta);
        this._updateRangeLabels();
        this.draw();
    }

    resetPanZoom() {
        super.resetPanZoom();
        this.draw(0);
    }

    cleanup() {
        super.cleanup();
        $('#axes').stop(true, false)
                  .animate({opacity: 0}, {duration: 2000});
        if (this.stepping) {
            window.clearInterval(this.stepping);
            delete this.stepping;
        }
        // for now, restore signal positions to singular value
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.position)
                    sig.position = sig.position[0];
                if (sig.target)
                    delete sig.target;
            });
        });

        $('#xAxisLabel').off('click');
        $('#yAxisLabel').off('click');
    }
}

class GraphMapPainter extends MapPainter
{
    constructor(map, canvas, frame) { super(map, canvas, frame); }

    updateAttributes() {
        this._defaultAttributes();
        // constant width
        let width = (this._highlight ? MapPainter.boldStrokeWidth : MapPainter.defaultStrokeWidth);
        this.attributes[0]['stroke-width'] = width * this.canvas.zoom;
        this.shortenPath = 12;
    }

    updatePaths()
    {
        // draw a curved line from src to dst
        let srcs = this.map.src.position;
        let dsts = this.map.dst.position;

        // check if number of src or dst positions has changed
        let len = srcs.length * dsts.length;
        if (this.pathspecs.length > len) {
            for (var i = len; i < this.paths.length; i++) {
                let path = this.paths[i];
                path.stop();
                path.unhover();
                path.undrag();
                path.remove();
                path = null;
            }
            this.paths = this.paths.slice(0, len);
            this.pathspecs = this.pathspecs.slice(0, len);
        }

        let idx = 0;
        for (var i in srcs) {
            let src = srcs[i];
            for (var j in dsts) {
                let dst = dsts[j];
                let mid = {x: (src.x + dst.x) * 0.5, y: (src.y + dst.y) * 0.5};
                let origin = {x: this.frame.width * 0.5, y: this.frame.height * 0.5};

                mid.x = mid.x + (mid.x - origin.x) * this.midPointInflation;
                mid.y = mid.y + (mid.y - origin.y) * this.midPointInflation;

                this.pathspecs[idx] = [['M', src.x, src.y],
                                       ['S', mid.x, mid.y, dst.x, dst.y]];
                idx += 1;
            }
        }
    }
}
