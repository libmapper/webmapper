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
        this.database.devices.each(remove_object_svg);

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.shortenPaths = 12;

        this.xAxisProp = 'minimum';
        this.yAxisProp = 'maximum';
        var xMin = 0, xMax = 1, yMin = 0, yMax = 1;

        this._labelAxes();

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
        $('#xAxisLabel').text(this.xAxisProp);
        $('#yAxisLabel').text(this.yAxisProp);
    }

    updateRangeLabels() {
        // scale
        let xScale = (this.xMax - this.xMin) * this.canvas.zoom;
        let yScale = (this.yMax - this.yMin) * this.canvas.zoom;

        let xPan = this.xMin + this.canvas.pan.x / this.canvas.zoom / (this.frame.width - 100) * xScale;
        let yPan = this.yMin + this.canvas.pan.y / this.canvas.zoom / (this.frame.height - 100) * yScale;

        $('#xAxisMin').text(xPan.toFixed(2));
        $('#xAxisMax').text((xPan + xScale).toFixed(2));
        $('#yAxisMin').text(yPan.toFixed(2));
        $('#yAxisMax').text((yPan + yScale).toFixed(2));
    }

    sortSignals(xProp, yProp) {
        let rangeChanged = true;
        let self = this;
        let iterations = 0;
        // calculate ranges
        while (rangeChanged && iterations < 10) {
            iterations += 1;
            rangeChanged = false;
            database.devices.each(function(dev) {
                dev.signals.each(function(sig) {
                    let xVal = xProp == null ? null : sig[xProp];
                    let yVal = yProp == null ? null : sig[yProp];
                    let positionChanged = false;
                    if (xVal == null || yVal == null) {
                        console.log('error:', sig.key, xProp, xVal, yProp, yVal);
                        return;
                    }
//                    console.log(sig.key, xProp, xVal, yProp, yVal);
                    let xValMin, xValMax;
                    if (xVal.length > 1) {
                        // TODO: handle multiple values
                        xValMin = xVal.reduce((a,b) => (a<b?a:b));
                        xValMax = xVal.reduce((a,b) => (a>b?a:b));
                    }
                    else
                        xValMin = xValMax = xVal;
                    let yValMin, yValMax;
                    if (yVal.length > 1) {
                        // TODO: handle multiple values
                        yValMin = yVal.reduce((a,b) => (a<b?a:b));
                        yValMax = yVal.reduce((a,b) => (a>b?a:b));
                    }
                    else
                        yValMin = yValMax = yVal;
                    if (self.xMin == null || xValMin < self.xMin) {
                        self.xMin = xValMin;
                        rangeChanged = true;
                    }
                    if (self.xMax == null || xValMax > self.xMax) {
                        self.xMax = xValMax;
                        rangeChanged = true;
                    }
                    if (self.yMin == null || yValMin < self.yMin) {
                        self.yMin = yValMin;
                        rangeChanged = true;
                    }
                    if (self.yMax == null || yValMax > self.yMax) {
                        self.yMax = yValMax;
                        rangeChanged = true;
                    }
                    if (self.xMin != null && self.xMax != null) {
                        // calculate x position
                        let x = xValMin - self.xMin;
                        let width = xValMax - xValMin;
                        if ((self.xMax - self.xMin) != 0) {
                            x = x / (self.xMax - self.xMin) * (self.frame.width - 100);
                            width = width / (self.xMax - self.xMin) * (self.frame.width - 100);
                        }
                        x += 50;
                        if (x != sig.position.x) {
                            sig.position.x = x;
//                            sig.position.width = width ? width : 20;
                            positionChanged = true;
                        }
                    }
                    if (self.yMin != null && self.yMax != null) {
                        // calculate y position
                        let y = yValMin - self.yMin;
                        let height = yValMax - yValMin;
                        if ((self.yMax - self.yMin) != 0) {
                            y = y / (self.yMax - self.yMin) * (self.frame.height - 100);
                            height = height / (self.yMax - self.yMin) * (self.frame.height - 100);
                        }
                        y = self.frame.height - y - 50;
                        if (y != sig.position.y) {
                            sig.position.y = y;
//                            sig.position.height = height ? height : 20;
                            positionChanged = true;
                        }
                    }
                    if (positionChanged) {
                        // draw signal
                        self.drawSignal(sig, 500);
                        self.drawMaps(sig, 500);
                    }
                });
            });
            if (rangeChanged)
                this.updateRangeLabels();
        }
    }

    drawSignal2(sig, duration) {
        if (!sig.view)
            return;
        sig.view.stop();
        let pos = sig.position;
        console.log(sig.key, pos);
        let path = [['M', pos.x, pos.y],
                    ['l', pos.width, 0],
                    ['l', 0, pos.height],
                    ['l', -pos.width, 0],
                    ['Z']];
        let is_output = sig.direction == 'output';
        let color = Raphael.hsl(sig.device.hue, 1, 0.5);
        sig.view.animate({'path': path,
                          'fill': is_output ? 'black' : color,
                          'fill-opacity': 1,
                          'stroke': color,
                          'stroke-width': 6,
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
            this.sortSignals('min', 'max');
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
        this.canvasPan(x, y, delta_x, delta_y);
        this.updateRangeLabels();
    }

    zoom(x, y, delta) {
        this.canvasZoom(x, y, delta);
        this.updateRangeLabels();
    }

    cleanup() {
        super.cleanup();
        $('#axes').stop(true, false)
                  .animate({opacity: 0}, {duration: 2000});
    }
}

class GraphMapPainter extends MapPainter
{
    constructor(map, canvas, frame) { super(map, canvas, frame); }

    updateAttributes() {
        this._defaultAttributes();
    }
}
