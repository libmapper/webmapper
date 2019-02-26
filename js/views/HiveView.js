//++++++++++++++++++++++++++++++++++++++//
//           Hive View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class HiveView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('hive', frame, null, canvas, database, tooltip);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000, null, 0, 0);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000, null, 0, 0);

        // start with signals at origin
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.index && !sig.position)
                    sig.position = this.origin;
            });
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.shortenPaths = 12;

        this.aspect = 1;

        this.resize();
    }

    _resize(duration) {
        this.mapPane.left = 50;
        this.mapPane.width = this.frame.width - 100;
        this.mapPane.top = 50;
        this.mapPane.height = this.frame.height - 100;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;

        this.origin = [this.mapPane.left, this.frame.height - 100];
        this.aspect = this.mapPane.width / this.mapPane.height;
    }

    drawDevices(duration) {
        let self = this;
        let listIndex = 0;
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let numSigs = dev.numVisibleSigs;
            let inc = numSigs ? 1 / numSigs : 1;

            dev.view.toBack();
            dev.view.attr({'stroke-linecap': 'round'});
            let path = [];
            let x = Math.cos(dev.angle) * self.mapPane.width;
            let y = Math.sin(dev.angle) * self.mapPane.height;
            if (dev.collapsed) {
                path = [['M', self.mapPane.right - 200,
                         self.mapPane.top + listIndex * 20],
                        ['l', 200, 0]];
                listIndex++;
            }
            else {
                path = [['M', self.mapPane.left,
                         self.mapPane.top + self.mapPane.height],
                        ['l', x, y]]
            }
            dev.view.animate({'path': path,
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
                                                   'text-anchor': 'end'
                                                  });

            }
            let angle = Raphael.deg(Math.atan(y / x));
            x += self.mapPane.left;
            y += self.frame.height - self.mapPane.top - 30;
            dev.view.label.animate({'opacity': 0.5,
                                    'transform': 't'+x+','+y+'r'+angle+',0,30'
                                   }, duration, '>');

            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                if (dev.collapsed) {
                    remove_object_svg(sig);
                    return;
                }
                // assign position along line
                sig.position.x = self.mapPane.left + self.mapPane.width * inc * (sig.index + 2) * Math.cos(dev.angle);
                sig.position.y = self.mapPane.top + self.mapPane.height + self.mapPane.height * inc * (sig.index + 2) * Math.sin(dev.angle);
                self.drawSignal(sig, duration);
            });
        });
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
//        // calculate midpoint
//        let mpx = (src.x + dst.x) * 0.5;
//        let mpy = (src.y + dst.y) * 0.5;
//
//        if (map.src.device == map.dst.device) {
//            // signals belong to same device
//            mpx += (src.y - dst.y) * 0.5;
//            mpy -= (src.x - dst.x) * 0.5;
//            path = [['M', src.x, src.y],
//                    ['S', mpx, mpy, dst.x, dst.y]];
//        }
//        else {
//            // inflate midpoint around origin to create a curve
//            mpx += (mpx - this.origin[0]) * 0.2;
//            mpy += (mpy - this.origin[1]) * 0.2;
//            path = [['M', src.x, src.y],
//                    ['S', mpx, mpy, dst.x, dst.y]];
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
            let dev_num = this.database.devices.reduce(function(temp, dev) {
                let uncollapsed = dev.collapsed ? 0 : 1;
                return temp ? temp + uncollapsed : uncollapsed;
            });
            dev_num = dev_num > 1 ? dev_num - 1 : 1;
            let angleInc = (Math.PI * -0.5) / dev_num;
            let hiveIndex = 0;
            let listIndex = 0;
            this.updateDevices(function(dev) {
                if (dev.collapsed)
                    listIndex++;
                else {
                    dev.angle = hiveIndex * angleInc;
                    hiveIndex++;
                }
                return false;
            });
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
            this.draw(1000);
    }

    cleanup() {
        super.cleanup();
        this.database.devices.each(function(dev) {dev.angle = null;});
    }
}
