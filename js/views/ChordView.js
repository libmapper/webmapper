//++++++++++++++++++++++++++++++++++++++//
//           Chord View Class           //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ChordView extends View {
    constructor(frame, tables, canvas, database) {
        super('chord', frame, null, canvas, database);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        this.database.devices.each(function(dev) {
            // remove device labels (if any)
            if (dev.view && dev.view.label)
                dev.view.label.remove();
            // remove associated svg elements for signals
            dev.signals.each(function(sig) { remove_object_svg(sig); });
        });
        // remove associated svg elements for maps
        this.database.maps.each(function(map) { remove_object_svg(map); });

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.radius = 150;

        this.resize();

        this.onlineDevs = 0;
        this.offlineDevs = 0;

        this.onlineTitle = this.canvas.text(this.frame.width * 0.33, this.cy, "online devices")
                                      .attr({'font-size': 32,
                                             'opacity': 1,
                                             'fill': 'white',
                                             'x': this.frame.width * 0.25,
                                             'y': this.mapPane.cy + 210});
        this.onlineTitle.node.setAttribute('pointer-events', 'none');
        this.offlineTitle = this.canvas.text(this.frame.width * 0.67, this.cy, "offline devices")
                                       .attr({'font-size': 32,
                                              'opacity': 1,
                                              'fill': 'white',
                                              'x': this.frame.width * 0.75,
                                              'y': this.mapPane.cy + 210});
        this.offlineTitle.node.setAttribute('pointer-events', 'none');

        this.file = null;
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        this.mapPane.left = 0;
        this.mapPane.width = this.frame.width;
        this.mapPane.top = 0;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    updateDevices() {
        let self = this;
        let r = this.radius;
        this.onlineDevs = 0;
        this.offlineDevs = 0;
        let dev_num = this.database.devices.size();
        if (dev_num < 1)
            return;
        this.database.devices.each(function(dev) {
            if (dev.status == 'offline')
                self.offlineDevs++;
            else
                self.onlineDevs++;
        });
        let onlineIndex = 0;
        let offlineIndex = 0;
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        let cy = this.mapPane.cy;
        this.database.devices.each(function(dev) {
            let offline = (dev.status == 'offline');
            if (offline)
                dev.index = offlineIndex++;
            else
                dev.index = onlineIndex++;
            let x = self.frame.cx * (offline ? 0.75 : 0.25);
            let half = (dev.index + 0.5) * (offline ? offlineInc : onlineInc);
            dev.position = position(x + Math.cos(half) * r, cy + Math.sin(half) * r);
            if (!dev.view) {
                let path = [['M', x, cy]];
                dev.view = self.canvas.path().attr({'path': path,
                                                    'stroke': dev.color,
                                                    'fill-opacity': 0,
                                                    'stroke-opacity': 0,
                                                    'stroke-linecap': 'butt',
                                                    'stroke-width': 0,
                                                   });
            }
            self.setDevHover(dev);
            if (offline)
                self.setDevDrag(dev);
        });
    }

    setDevDrag(dev) {
        let self = this;
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        let offline = (dev.status == 'offline');
        let angleInc = offline ? offlineInc : onlineInc;
        let halfAngleWidth = angleInc * 0.5 - 0.02;
        let cx;
        let cy = self.mapPane.cy;
        let angle = dev.index * angleInc;
        let a = angle - halfAngleWidth;
        let startPos = [Math.cos(a), Math.sin(a)];
        a = angle + halfAngleWidth;
        let stopPos = [Math.cos(a), Math.sin(a)];
        dev.view.drag(
            function(dx, dy, x, y, event) {
                x -= self.frame.left;
                y -= self.frame.top;
                let bbox = dev.view.getBBox();
                dev.view.translate(x - bbox.x - bbox.width * 0.5,
                                   y - bbox.y - bbox.height * 0.5);
//                let cx = self.frame.width * (x < self.frame.cx ? 0.25 : 0.75);
//                dx = x - cx;
//                dy = y - self.frame.cy;
//                let r = sqrt(dx*dx + dy*dy);
//                let path = [['M', x, y],
//                            ['A', r, r, angleInc, 0, 1, cx + stopPos[0] * r, cy + stopPos[1] * r]];
//                dev.view.attr({'path': [[]]});
                $('#status').stop(true, false)
                            .css({'left': x + 20,
                                  'top': y});
            },
            function(x, y, event) {
                dev.escaped = false;
                self.draggingFrom = dev;
                dev.view.toFront()
                        .animate({'path': circle_path(x, y, 30),
                                  'stroke-width': 1,
                                  'fill': dev.color,
                                  'fill-opacity': 1
                                 }, 1000, 'linear');
            },
            function(x, y, event) {
                self.draggingFrom = null;
                dev.view.animate({'path': dev.view.path,
                                  'stroke-width': 40,
                                  'fill-opacity': 0,
                                  'transform': 't0,0r0'
                                 }, 1000, 'linear');
                $('#status').stop(true, false)
                            .animate({opacity: 0}, {duration: 500});
                // TODO: redraw device
                // TODO: reset translation attribute
                // TODO: apply link edits?
            }
        );
    }

    drawDevices(duration) {
        let self = this;
        let r = this.radius;
        let cy = this.mapPane.cy;
        let lastPos = [1, 0];
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let offline = (dev.status == 'offline');
            let angleInc = offline ? offlineInc : onlineInc;
            let halfAngleWidth = angleInc * 0.5 - 0.02;
            let cx = self.frame.width * (offline ? 0.75 : 0.25);
            let angle = dev.index * angleInc;

            // TODO: draw +/- angleWidth around dev angle (dev easier to find/animate to later)

            let a = angle - halfAngleWidth;
            dev.view.pstart = {'angle': a,
                               'x': cx + Math.cos(a) * r,
                               'y': cy + Math.sin(a) * r};
            a = angle + halfAngleWidth;
            dev.view.pstop = {'angle': a,
                              'x': cx + Math.cos(a) * r,
                              'y': cy + Math.sin(a) * r};
            dev.view.path = [['M', dev.view.pstart.x, dev.view.pstart.y],
                             ['A', r, r, angleInc, 0, 1,
                              dev.view.pstop.x, dev.view.pstop.y]];
            dev.view.attr({'stroke-linecap': 'butt'});
            dev.view.animate({'path': dev.view.path,
                              'fill-opacity': 0,
                              'stroke-opacity': 1,
                              'stroke-width': 40,
                             }, duration, '>');
        });
    }

    updateLinks() {
        let self = this;
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        let r = this.radius - 20;
        this.database.devices.each(function(dev) {
            dev.src_indices = [];
            dev.dst_indices = [];
        });
        this.database.links.each(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!src.dst_indices.includes(dst.dst_index)) {
                src.dst_indices.push(dst.dst_index);
                src.dst_indices.sort();
            }
            if (!dst.src_indices.includes(src.src_index)) {
                dst.src_indices.push(src.src_index);
                dst.src_indices.sort();
            }
            let x = self.frame.width * (link.status == 'offline' ? 0.75 : 0.25);
            if (!link.view) {
                let angle = (src.index + 0.33) * (src.status == 'offline' ? offlineInc : onlineInc);
                let srcPos = [x + Math.cos(angle) * r,
                              self.frame.cy + Math.sin(angle) * r];
                link.view = self.canvas.path([['M', srcPos[0], srcPos[1]],
                                              ['l', 0, 0]]);
            }
            self.setLinkHover(link);
        });
    }

    ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    drawLink(link, duration, self) {
        if (!link.view)
            return;
        link.view.stop();

        let r = self.radius - 19;
        let endPointRadius = 12;
        let cx = self.mapPane.cx;
        let cy = self.mapPane.cy;
        let src = link.src;
        let dst = link.dst;
        let offline = link.status == 'offline';
        let onlineInc = Math.PI * 2.0 / self.onlineDevs;
        let offlineInc = Math.PI * 2.0 / self.offlineDevs;
        let srcAngle = (src.index - 0.33) * (src.status == 'offline' ? offlineInc : onlineInc);
        let dstAngle = (dst.index + 0.33) * (dst.status == 'offline' ? offlineInc : onlineInc);
        let x = self.frame.width * (link.status == 'offline' ? 0.75 : 0.25);
        let srcPos = [x + Math.cos(srcAngle) * r, cy + Math.sin(srcAngle) * r];
        let dstPos = [x + Math.cos(dstAngle) * r, cy + Math.sin(dstAngle) * r];

        let path = [];
        path.push(link.src.view.path.slice());
        path[0].push(['Q', x, cy, link.dst.view.pstart.x, link.dst.view.pstart.y]);
        path[0].push(link.dst.view.path[1]);
        path[0].push(['Q', x, cy, link.src.view.pstart.x, link.src.view.pstart.y]);
        path[0].push(['Z']);
        console.log(path);

        let midAngle = (link.src.view.pstart.angle + link.dst.view.pstop.angle) * 0.5;
        console.log(link.src.view.pstart.angle, link.dst.view.pstop.angle, midAngle);
        if (Math.abs(link.src.view.pstart.angle - link.dst.view.pstop.angle) < Math.PI)
            midAngle *= -1;
        midAngle = Raphael.deg(midAngle);
        let gradString = (midAngle+90)+'-'+link.dst.color+'-'+link.src.color;
        link.view.toBack().attr({'path': path,
                                 'stroke-width': 0,
                                 'fill': gradString,
                                 'fill-opacity': 0.5
                                });

    }

    drawLinks(duration) {
        let self = this;

        this.database.links.each(function(link) {
            self.drawLink(link, duration, self);
        });
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'links'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('devices') >= 0) {
            this.updateDevices();
            if (this.onlineTitle)
                this.onlineTitle.attr({'text': this.onlineDevs+' online devices'});
            if (this.offlineTitle)
                this.offlineTitle.attr({'text': this.offlineDevs+' offline devices'});
        }
        if (elements.indexOf('links') >= 0)
            this.updateLinks();
        this.draw(1000);
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawLinks(duration);
    };
//
//    this.stageFile = function(file) {
//        this.file = file;
//        draw(duration);
//    };

    cleanup() {
        super.cleanup();
        if (this.onlineTitle)
            this.onlineTitle.remove();
        if (this.offlineTitle)
            this.offlineTitle.remove();
        database.links.each(function(link) {
            if (!link.view)
                return;
            if (link.view.startPoint)
                link.view.startPoint.remove();
            if (link.view.stopPoint)
                link.view.stopPoint.remove();
        });

        // clean up any objects created only for this view
    }
}
