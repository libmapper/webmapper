//++++++++++++++++++++++++++++++++++++++//
//           Hive View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class HiveView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('hive', frame, tables, canvas, database, tooltip, pie, HiveMapPainter);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.shortenPaths = 12;

        this.aspect = 1;

        this.setup();
    }

    setup() {
        this.setMapPainter(HiveMapPainter);

        // hide tables
        this.tables.left.adjust(this.frame.width * -0.4, 0, 0,
                                this.frame.height, 0, 500, null, 0, 0);
        this.tables.right.adjust(this.frame.width, 0, 0,
                                 this.frame.height, 0, 500, null, 0, 0);
        this.tables.left.hidden = this.tables.right.hidden = true;

        // start with signals at origin
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.index && !sig.position)
                    sig.position = self.origin;
            })
        });
        this.setAllSigHandlers();

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
            let color = Raphael.hsl(dev.hue, 1, 0.5);
            dev.view.animate({'path': path,
                              'stroke': color,
                              'stroke-width': 26,
                              'stroke-opacity': 0.5,
                              'fill': color,
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
            dev.view.label.attr({'text-anchor': 'end'})
                          .animate({'opacity': 0.5,
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

    draw(duration) {
        this.drawDevices(duration);
        this.drawMaps(duration);
    }

    update() {
        let self = this;
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
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0) {
            let dev_num = this.database.devices.reduce(function(t, dev) {
                let uncollapsed = dev.collapsed ? 0 : 1;
                let unhidden = dev.hidden ? 0 : 1;
                return uncollapsed && unhidden + (t ? t : 0);
            });
            dev_num = dev_num > 1 ? dev_num - 1 : 1;
            let angleInc = (Math.PI * 0.5) / dev_num;
            let angle = -Math.PI * 0.5;
            let listIndex = 0;
            this.updateDevices(function(dev) {
                if (dev.collapsed)
                    listIndex++;
                else {
                    dev.angle = angle;
                    angle += angleInc;
                }
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

    cleanup() {
        super.cleanup();
        this.database.devices.each(function(dev) {dev.angle = null;});
    }
}

class HiveMapPainter extends ListMapPainter
{
    constructor(map, canvas, frame, database) {
        super(map, canvas, frame, database); 
        this.shortenPath = 12;
    }

    getNodePosition()
    {
        let origin = {x: this.frame.left, y: this.frame.top + this.frame.height};
        let node = super.getNodePosition();
        node.x = node.x + (node.x - origin.x) * this.midPointInflation;
        node.y = node.y + (node.y - origin.y) * this.midPointInflation;

        // adjust node x so that it won't overlap with a device
        let sigs = this.map.srcs.concat([this.map.dst]);
        for (let s of sigs)
        {
            if (distance(node.x, node.y, s.position.x, s.position.y) < 200)
            {
                node.x += 50;
                node.y += 50;
            }
        }
        return node;
    }

    oneToOne(src, dst, i)
    {
        // draw a curved line from src to dst
        let mid = {x: (src.x + dst.x) * 0.5, y: (src.y + dst.y) * 0.5};
        let origin = {x: this.frame.left, y: this.frame.top + this.frame.height};

        mid.x = mid.x + (mid.x - origin.x) * this.midPointInflation;
        mid.y = mid.y + (mid.y - origin.y) * this.midPointInflation;

        this.pathspecs[i] = [['M', src.x, src.y],
                             ['S', mid.x, mid.y, dst.x, dst.y]];
    }
}
