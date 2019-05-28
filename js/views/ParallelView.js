//++++++++++++++++++++++++++++++++++++++//
//    Parallel Coordinates View Class   //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ParallelView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('parallel', frame, tables, canvas, database, tooltip, pie,
              ParallelMapPainter);

        this.pan = this.canvasPan;

        this.shortenPaths = 12;

        this.setup();
    }

    setup() {
        this.setMapPainter(ParallelMapPainter);
        this.setAllSigHandlers();

        // hide tables
        this.tables.left.adjust(this.frame.width * -0.4, 0, 0,
                                this.frame.height, 0, 500, null, 0, 0);
        this.tables.right.adjust(this.frame.width, 0, 0,
                                 this.frame.height, 0, 500, null, 0, 0);
        this.tables.left.hidden = this.tables.right.hidden = true;

        this.resize();
    }

    _resize(duration) {
        this.mapPane.left = 50;
        this.mapPane.width = this.frame.width - 100;
        this.mapPane.top = 50;
        this.mapPane.height = this.frame.height - 100;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    drawDevice(dev, duration, devInc, self) {
        if (!dev.view)
            return;
        let height = self.mapPane.height * (dev.view.zoom ? dev.view.zoom : 1.0);
        dev.view.stop();
        let numSigs = dev.numVisibleSigs - 1;
        let sigInc = numSigs > 1 ? height / (numSigs - 1) : height;

        dev.view.toBack();
        let x = self.mapPane.left + devInc * dev.index;
        let y = self.mapPane.top + height;
        let color = Raphael.hsl(dev.hue, 1, 0.5);
        dev.view.attr({'stroke-linecap': 'round'});
        dev.view.animate({'path': [['M', x, y],
                                   ['l', 0, -height]],
                          'stroke': color,
                          'stroke-width': 26,
                          'stroke-opacity': 0.5,
                          'fill': color,
                          'fill-opacity': 0}, duration, '>');
        if (!dev.view.label) {
            dev.view.label = self.canvas.text(0, 0, dev.name)
                                        .attr({'opacity': 0,
                                               'pointer-events': 'none',
                                               'font-size': 16,
                                               'fill': 'white',
                                               'text-anchor': 'end'});
        }
        let labely = y - height - 30;
        dev.view.label.attr({'text-anchor': 'end'})
                      .animate({'opacity': 0.5,
                                'x': 0,
                                'y': 0,
                                'transform': 't'+x+','+labely+'r-90,0,30'
                               }, duration, '>');
        dev.signals.forEach(function(sig) {
            if (!sig.view)
                return;
            // assign position along line
            sig.position.x = x;
            sig.position.y = y - sigInc * (sig.index);
            sig.position.vx = sig.position.x < self.frame.width / 2 ? 1 : -1;
            self.drawSignal(sig, duration);
        });
    }

    drawDevices(duration, dev) {
        let self = this;

        let dev_num = this.database.devices.reduce(function(t, d) {
            let unhidden = d.hidden ? 0 : 1;
            return t ? t + unhidden : unhidden;
        });
        if (dev_num && dev_num > 1)
            dev_num -= 1;
        else
            dev_num = 1;
        let devInc = self.mapPane.width / dev_num;

        if (dev)
            self.drawDevice(dev, duration, devInc, self);
        else {
            this.database.devices.forEach(function(dev) {
                self.drawDevice(dev, duration, devInc, self);
            });
        }
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawMaps(duration);
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
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0) {
            this.updateDevices();
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    pan(x, y, delta_x, delta_y) {
        
    }

    zoom(x, y, delta) {
        // check if cursor is over a device
        if (this.hoverDev) {
            // zoom this device only
            let dev = this.hoverDev;
            let newZoom = dev.view.zoom ? dev.view.zoom : 1.0;
            newZoom -= delta * 0.01;
            if (newZoom < 0.1)
                newZoom = 0.1;
            else if (newZoom > 20)
                newZoom = 20;
            dev.view.zoom = newZoom;
            this.drawDevices(0, dev);
            this.drawMaps(0);
        }
        else
            this.canvasZoom(x, y, delta);
    }
}

class ParallelMapPainter extends ListMapPainter
{
    constructor(map, canvas, frame, database) { 
        super(map, canvas, frame, database); 
        this.shortenPath = 12;
    }

    getNodePosition()
    {
        // adjust node x so that it won't overlap with a device
        let node = super.getNodePosition();
        let sigs = this.map.srcs.map(s => s.signal).filter(s => !s.hidden);
        sigs = sigs.concat([this.map.dst.signal]);
        for (let s of sigs)
        {
            if (Math.abs(node.x - s.position.x) < 50)
            {
                node.x += 50;
                node.y += 50;
            }
        }
        return node;
    }

    offset(a, b, minoffset = 30, maxoffset = 200)
    {
        let offset = (a - b) * 0.5;
        let abs_offset = Math.abs(offset);
        if (abs_offset > maxoffset) abs_offset = maxoffset;
        if (abs_offset < minoffset) abs_offset = minoffset;
        return abs_offset * ((offset < 0) ? -1 : 1);
    }

    oneToOne(src, dst, i)
    {
        // skip maps if src or dst y is zero, due to filtering
        if (!src.y || !dst.y) {
            this.pathspecs[i] = null;
            return;
        }

        if (Math.abs(src.x - dst.x) < 1)
            this.vertical(src, dst, i);
        else
            this.betweenTables(src, dst, i);
    }
}
