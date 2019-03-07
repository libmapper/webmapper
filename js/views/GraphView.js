//++++++++++++++++++++++++++++++++++++++//
//          Graph View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GraphView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('graph', frame, null, canvas, database, tooltip, GraphMapPainter);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 500, null, 0, 0);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        // remove associated svg elements for devices
        this.database.devices.each(function(dev) {
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.shortenPaths = 12;

        this.xAxisProp = null;//'min';
        this.yAxisProp = null;//'max';
        var xMin = 0, xMax = 1, yMin = 0, yMax = 1;
        this.stepInterval = 100;

        this._labelAxes();
        this._updateRangeLabels();

        this.resize();
    }

    _resize(duration) {
        super._resize();
        $('#axes').stop(true, false)
                  .css({'left': this.frame.left + 50,
                        'top': this.frame.top + 50,
                        'width': this.frame.width - 100,
                        'height': this.frame.height - 100,
                        'opacity': 1,
                        'z-index': -1});
    }

    _labelAxes() {
        if (this.xAxisProp) {
            $('#xAxisLabel').text(this.xAxisProp);
            $('#axes').css('border-bottom', '1px solid white');
        }
        else {
            $('#xAxisLabel').text('');
            $('#axes').css('border-bottom', 'none');
        }
        if (this.yAxisProp) {
            $('#yAxisLabel').text(this.yAxisProp);
            $('#axes').css('border-left', '1px solid white');
        }
        else {
            $('#yAxisLabel').text('');
            $('#axes').css('border-left', 'none');
        }
    }

    _updateRangeLabels() {
        if (this.xAxisProp) {
            let xScale = (this.xMax - this.xMin) * this.canvas.zoom;
            let xPan = this.xMin + this.canvas.pan.x / this.canvas.zoom / (this.frame.width - 100) * xScale;
            $('#xAxisMin').text(xPan.toFixed(2));
            $('#xAxisMax').text((xPan + xScale).toFixed(2));
        }
        else {
            $('#xAxisMin').text('');
            $('#xAxisMax').text('');
        }

        if (this.yAxisProp) {
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
        // calculate ranges
        while (rangeChanged && iterations < 10) {
            iterations += 1;
            rangeChanged = false;
            database.devices.each(function(dev) {
                dev.signals.each(function(sig) {
                    let xVal = xProp == null ? null : sig[xProp];
                    let yVal = yProp == null ? null : sig[yProp];
                    let positionChanged = false;
                    if (xVal != null && xVal != undefined) {
                        let xValMin, xValMax;
                        if (xVal.length > 1) {
                            xValMin = xVal.reduce((a,b) => (a<b?a:b));
                            xValMax = xVal.reduce((a,b) => (a>b?a:b));
                            xVal = xVal.slice();
                        }
                        else {
                            xValMin = xValMax = xVal;
                            xVal = [xVal];
                        }
                        if (self.xMin == null || xValMin < self.xMin) {
                            self.xMin = xValMin;
                            rangeChanged = true;
                        }
                        if (self.xMax == null || xValMax > self.xMax) {
                            self.xMax = xValMax;
                            rangeChanged = true;
                        }
                        if (self.xMin != null && self.xMax != null) {
                            // calculate x position
                            let range = self.xMax - self.xMin;
                            for (var i in xVal) {
                                xVal[i] -= self.xMin;
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
                    if (yVal != null && yVal != undefined) {
                        let yValMin, yValMax;
                        if (yVal.length > 1) {
                            yValMin = yVal.reduce((a,b) => (a<b?a:b));
                            yValMax = yVal.reduce((a,b) => (a>b?a:b));
                            yVal = yVal.slice();
                        }
                        else {
                            yValMin = yValMax = yVal;
                            yVal = [yVal];
                        }
                        if (self.yMin == null || yValMin < self.yMin) {
                            self.yMin = yValMin;
                            rangeChanged = true;
                        }
                        if (self.yMax == null || yValMax > self.yMax) {
                            self.yMax = yValMax;
                            rangeChanged = true;
                        }
                        if (self.yMin != null && self.yMax != null) {
                            // calculate y position
                            let range = self.yMax - self.yMin;
                            for (var i in yVal) {
                                yVal[i] -= self.yMin;
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
                        // make sure sig.position has same length as sig.target
                        if (sig.position.x != undefined) {
                            let p = [sig.position];
                            for (var i = 0; i < len - 1; i++)
                                p.push(sig.position);
                            sig.position = p;
                        }
                    }
                });
            });
            if (rangeChanged)
                this._updateRangeLabels();
        }
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
            K_target_x = 0.002;
            K_repulse_x = 200;
            K_map_x = 0.01;
        }
        if (!self.yAxisProp) {
            K_target_y = 0.002;
            K_repulse_y = 200;
            K_map_y = 0.01;
        }
        let L = 100;
        this.database.devices.each(function(devA) {
            // attract positions towards targets
            devA.signals.each(function(sig) {
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
                let pA = sigA.position;
                let fA = sigA.force;
                let found = false;
                self.database.devices.each(function(devB) {
                    devB.signals.each(function(sigB) {
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
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : color,
                          'fill-opacity': 1,
                          'stroke': color,
                          'stroke-width': 6 * this.canvas.zoom,
                          'stroke-opacity': 1}, duration, '>');
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
                    sig.position = position(null, null, self.frame);
                return false;
            });
            this.sortSignals();
            if (this.stepping)
                window.clearInterval(this.stepping);
            this.stepping = setInterval(function() {
                if (self.forceDirect() == true) {
                    self.drawSignals(self.stepInterval);
                    self.drawMaps(self.stepInterval);
                }
                else {
                    console.log('done stepping');
                    window.clearInterval(self.stepping);
                }
            }, self.stepInterval);
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
    }

    pan(x, y, delta_x, delta_y) {
        this.canvasPan(x, y, delta_x, delta_y);
        this._updateRangeLabels();
    }

    zoom(x, y, delta) {
        this.canvasZoom(x, y, delta);
        this._updateRangeLabels();
        this.drawSignals();
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
    }
}

class GraphMapPainter extends MapPainter
{
    constructor(map, canvas, frame) { super(map, canvas, frame); }

    updateAttributes() {
        this._defaultAttributes();
    }

    updatePaths()
    {
        // draw a curved line from src to dst
        let srcs = this.map.src.position;
        let dsts = this.map.dst.position;

        let idx = 0;
        for (var i in srcs) {
            let src = srcs[i];
            for (var j in dsts) {
                let dst = dsts[j];
                let mid = {x: (src.x + dst.x) * 0.5, y: (src.y + dst.y) * 0.5};
                let origin = {x: this.frame.width * 0.5, y: this.frame.height * 0.5};

                this.pathspecs[idx] = [['M', src.x, src.y],
                                       ['S', mid.x, mid.y, dst.x, dst.y]];
                idx += 1;
            }
        }
    }
}
