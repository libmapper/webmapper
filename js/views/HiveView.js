//++++++++++++++++++++++++++++++++++++++//
//           Hive View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class HiveView extends View {
    constructor(frame, tables, canvas, database) {
        super('hive', frame, null, canvas, database);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

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

        this.origin = [this.mapPane.left, this.frame.height - 100];
    }

    drawDevices(duration) {
        let self = this;
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let numSigs = dev.numVisibleSigs;
            let inc = numSigs ? 1 / numSigs : 1;

            dev.view.toBack();
            dev.view.animate({'path': [['M', self.mapPane.left,
                                        self.mapPane.top + self.mapPane.height],
                                       ['l', self.mapPane.width * Math.cos(dev.angle),
                                        self.mapPane.height * Math.sin(dev.angle)]],
                              'stroke': dev.color,
                              'stroke-width': 20,
                              'stroke-opacity': 0.5,
                              'fill': dev.color,
                              'fill-opacity': 0,
                              'stroke-linecap': 'round'}, duration, '>');
            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                // assign position along line
                sig.position.x = self.mapPane.left + self.mapPane.width * inc * (sig.index + 1) * Math.cos(dev.angle);
                sig.position.y = self.mapPane.top + self.mapPane.height + self.mapPane.height * inc * (sig.index + 1) * Math.sin(dev.angle);
                self.drawSignal(sig, duration);
            });
        });
    }

    mapPath(map) {
        if (!map.view)
            return;

        // draw L-R bezier
        let src = map.src.position;
        let dst = map.dst.position;
        if (!src || !dst) {
            console.log('missing signal positions for drawing map', map);
            return null;
        }

        let path;

        // calculate midpoint
        let mpx = (src.x + dst.x) * 0.5;
        let mpy = (src.y + dst.y) * 0.5;

        if (map.src.device == map.dst.device) {
            // signals belong to same device
            mpx += (src.y - dst.y) * 0.5;
            mpy -= (src.x - dst.x) * 0.5;
            path = [['M', src.x, src.y],
                    ['S', mpx, mpy, dst.x, dst.y]];
        }
        else {
            // inflate midpoint around origin to create a curve
            mpx += (mpx - this.origin[0]) * 0.2;
            mpy += (mpy - this.origin[1]) * 0.2;
            path = [['M', src.x, src.y],
                    ['S', mpx, mpy, dst.x, dst.y]];
        }

        // shorten path so it doesn't draw over signals
        let len = Raphael.getTotalLength(path);
        return Raphael.getSubpath(path, 10, len - 10);
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawMaps(duration);
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
        if (elements.indexOf('devices') >= 0) {
            let dev_num = this.database.devices.size();
            dev_num = dev_num > 1 ? dev_num - 1 : 1;
            let angleInc = (Math.PI * -0.5) / dev_num;
            this.updateDevices(function(dev) {
                dev.angle = dev.index * angleInc;
            });
        }
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    cleanup() {
        super.cleanup();
        this.database.devices.each(function(dev) {dev.angle = null;});
    }
}
