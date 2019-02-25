//++++++++++++++++++++++++++++++++++++++//
//    Parallel Coordinates View Class   //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ParallelView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('parallel', frame, null, canvas, database, tooltip);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 500, null, 0, 0);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.pan = this.canvasPan;
//        this.zoom = this.canvasZoom;

        this.shortenPaths = 12;

        this.resize();
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

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
        let x = self.mapPane.left + self.mapPane.width - devInc * dev.index;
        let y = self.mapPane.top + height;
        dev.view.attr({'stroke-linecap': 'round'});
        dev.view.animate({'path': [['M', x, y],
                                   ['l', 0, -height]],
                         'stroke': dev.color,
                         'stroke-width': 26,
                         'stroke-opacity': 0.5,
                         'fill': dev.color,
                         'fill-opacity': 0}, duration, '>');
        if (!dev.view.label) {
            dev.view.label = self.canvas.text(0, 0, dev.name)
                                        .attr({'opacity': 0,
                                               'pointer-events': 'none',
                                               'font-size': 24,
                                               'fill': 'white',
                                               'text-anchor': 'end'});
        }
        let labely = y - height - 30;
        dev.view.label.attr({'text-anchor': 'end'})
                      .animate({'opacity': 0.5,
                                'transform': 't'+x+','+labely+'r-90,0,30'
                               }, duration, '>');
        dev.signals.each(function(sig) {
            if (!sig.view)
                return;
            // assign position along line
            sig.position.x = x;
            sig.position.y = y - sigInc * (sig.index);
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
            this.database.devices.each(function(dev) {
                self.drawDevice(dev, duration, devInc, self);
            });
        }
    }

//    getMapPath(map) {
//        if (!map.view)
//            return;
//
//        // draw L-R bezier
//        let src = map.src.position;
//        let dst = map.dst.position;
//        if (!src || !dst) {
//            console.log('missing signal positions for drawing map', map);
//            return null;
//        }
//
//        let path;
//
//        if (src.x == dst.x) {
//            // signals belong to same device
//            let offsetx = src.x + (src.y - dst.y) * 0.5;
//            path = [['M', src.x, src.y],
//                    ['C', offsetx, src.y, offsetx, dst.y, dst.x, dst.y]];
//        }
//        else {
//            let mpx = (src.x + dst.x) * 0.5;
//            path = [['M', src.x, src.y],
//                    ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
//        }
//
//        // shorten path so it doesn't draw over signals
//        let len = Raphael.getTotalLength(path);
//        return Raphael.getSubpath(path, 12, len - 12);
//    }

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
        if (elements.indexOf('devices') >= 0) {
            this.updateDevices();
            updated = true;
        }
        if (elements.indexOf('signals') >= 0) {
            this.updateSignals(function(sig) {
                if (!sig.position)
                    sig.position = position(null, null, self.frame);
                return false;
            });
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
