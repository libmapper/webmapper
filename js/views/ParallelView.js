//++++++++++++++++++++++++++++++++++++++//
//    Parallel Coordinates View Class   //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ParallelView extends View {
    constructor(frame, tables, canvas, database) {
        super('hive', frame, null, canvas, database);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        // remove link svg
        this.database.links.each(remove_object_svg);

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
    }

    drawDevices(duration) {
        let self = this;

        let dev_num = this.database.devices.size();
        if (dev_num && dev_num > 1)
            dev_num -= 1;
        else
            dev_num = 1;
        let devInc = self.mapPane.width / dev_num;

        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let numSigs = dev.numVisibleSigs - 1;
            let sigInc = numSigs > 0 ? self.mapPane.height / numSigs : self.mapPane.height;

            dev.view.toBack();
            let x = self.mapPane.left + self.mapPane.width - devInc * dev.index;
            let y = self.mapPane.top + self.mapPane.height;
            dev.view.animate({'path': [['M', x, y],
                                       ['l', 0, -self.mapPane.height]],
                              'stroke': dev.color,
                              'stroke-width': 20,
                              'stroke-opacity': 0.5,
                              'fill': dev.color,
                              'fill-opacity': 0,
                              'stroke-linecap': 'round'}, duration, '>');
            if (!dev.view.label) {
                dev.view.label = self.canvas.text(0, 0, dev.name)
                                            .attr({'opacity': 0,
                                                   'pointer-events': 'none',
                                                   'font-size': 24,
                                                   'fill': 'white',
                                                   'text-anchor': 'start'
                                                  });
            }
            dev.view.label.animate({'x': x, 'y': y-20,
                                    'opacity': 0.5,
                                    'transform': 'r-90,'+x+','+y,
                                   }, duration, '>');
            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                // assign position along line
                sig.position.x = x;
                sig.position.y = y - sigInc * (sig.index + 0.5);
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

        if (src.x == dst.x) {
            // signals belong to same device
            let offsetx = src.x + (src.y - dst.y) * 0.5;
            path = [['M', src.x, src.y],
                    ['C', offsetx, src.y, offsetx, dst.y, dst.x, dst.y]];
        }
        else {
            let mpx = (src.x + dst.x) * 0.5;
            path = [['M', src.x, src.y],
                    ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
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
        if (elements.indexOf('devices') >= 0)
            this.updateDevices();
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }
}
