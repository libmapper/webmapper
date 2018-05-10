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

        this.radius = Math.min(frame.width, frame.height) * 0.25;

        this.onlineDevs = 0;
        this.offlineDevs = 0;

        this.onlineTitle = this.canvas.text(this.frame.width * 0.33, this.cy, "online devices")
                                      .attr({'font-size': 32,
                                             'opacity': 1,
                                             'fill': 'white',
                                             'x': this.frame.width * 0.25,
                                             'y': this.frame.height * 0.8});
        this.onlineTitle.node.setAttribute('pointer-events', 'none');
        this.offlineTitle = this.canvas.text(this.frame.width * 0.67, this.cy, "offline devices")
                                       .attr({'font-size': 32,
                                              'opacity': 1,
                                              'fill': 'white',
                                              'x': this.frame.width * 0.75,
                                              'y': this.frame.height * 0.8});
        this.offlineTitle.node.setAttribute('pointer-events', 'none');

        this.file = null;

        this.resize();
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

        this.radius = Math.min(this.frame.width, this.frame.height) * 0.25;

        this.onlineTitle.attr({'x': this.frame.width * 0.25,
                               'y': this.frame.height * 0.8});
        this.offlineTitle.attr({'x': this.frame.width * 0.75,
                                'y': this.frame.height * 0.8});
    }

    updateDevices() {
        let self = this;
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
        if (offlineInc > onlineInc)
            offlineInc = onlineInc;
        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        this.database.devices.each(function(dev) {
            let offline = (dev.status == 'offline');

            let r = self.radius + (offline ? 50 : 0);

            if (offline)
                dev.index = offlineIndex++;
            else
                dev.index = onlineIndex++;
            let angleInc = offline ? offlineInc : onlineInc;
            let angle = dev.index * angleInc;
            let pstart = {'angle': angle,
                          'x': cx + Math.cos(angle) * r,
                          'y': cy + Math.sin(angle) * r};
            angle += angleInc - 0.02;
            let pstop = {'angle': angle,
                         'x': cx + Math.cos(angle) * r,
                         'y': cy + Math.sin(angle) * r};

            if (!dev.view) {
                let path = [['M', pstart.x, pstart.y]];
                dev.view = self.canvas.path().attr({'path': path,
                                                    'stroke': dev.color,
                                                    'fill-opacity': 0,
                                                    'stroke-opacity': 0,
                                                    'stroke-linecap': 'butt',
                                                    'stroke-width': 0,
                                                   });
            }
            dev.view.pstart = pstart;
            dev.view.pstop = pstop;

            self.setDevHover(dev);
            if (offline)
                self.setDevDrag(dev);

        });
    }

    setDevDrag(dev) {
        // use angle from cursor to [cx,cy] to drag dev view around circle
        // snap to online devices
        // dragging inside online radius causes dev to stick to other device
        // when both sides are snapped, create maps
        // ensure can undo!
        let self = this;
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        let offline = (dev.status == 'offline');
        let angleInc = offline ? offlineInc : onlineInc;
        let halfAngleWidth = angleInc * 0.5 - 0.02;
        let cx;
        let cy = self.mapPane.cy;
        let angle = dev.index * angleInc;
        let startPos = [Math.cos(angle), Math.sin(angle)];
        angle += angleInc - 0.02;
        let stopPos = [Math.cos(angle), Math.sin(angle)];
        dev.view.drag(
            function(dx, dy, x, y, event) {
                x -= self.frame.left;
                y -= self.frame.top;
                let bbox = dev.view.getBBox();
                dev.view.translate(x - bbox.x - bbox.width * 0.5,
                                   y - bbox.y - bbox.height * 0.5);
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
        let cy = this.mapPane.cy;
        let lastPos = [1, 0];
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        if (offlineInc > onlineInc)
            offlineInc = onlineInc;
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let offline = (dev.status == 'offline');
            let r = self.radius + (offline ? 50 : 0);
            let angleInc = offline ? offlineInc : onlineInc;

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
        let tau = Math.PI * 2.0;
        this.database.devices.each(function(dev) {
            dev.link_angles = [];
        });
        this.database.links.each(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!src.view || !dst.view)
                return;

            if (!src.link_angles.includes(dst.view.pstart.angle)) {
                src.link_angles.push(dst.view.pstart.angle);
            }
            if (!dst.link_angles.includes(src.view.pstart.angle)) {
                dst.link_angles.push(src.view.pstart.angle);
            }
        });
        this.database.devices.each(function(dev) {
            if (!dev.link_angles || dev.link_angles.length <= 1)
                return;
            // sort
            dev.link_angles.sort().reverse();

            // split around self angle
            let i = 0;
            while (i < dev.link_angles.length) {
                let diff = (dev.link_angles[i] - dev.view.pstart.angle);
                if (diff < -Math.PI)
                    diff += tau;
                if (diff < 0)
                    break;
                i++;
            }

            if (i && i < dev.link_angles.length) {
                // rotate array
                let a = dev.link_angles;
                a.push.apply(a, a.splice(0, i));
            }
        });
        this.database.links.each(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!link.view) {
                link.view = self.canvas.path([['M', src.view.pstart.x,
                                               src.view.pstart.y],
                                              ['l', 0, 0]]);
            }
            link.src_index = (src.link_angles.length
                              ? src.link_angles.indexOf(dst.view.pstart.angle)
                              : 0);
            link.dst_index = (dst.link_angles.length
                              ? dst.link_angles.indexOf(src.view.pstart.angle)
                              : 0);
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

        let src = link.src;
        let dst = link.dst;

        let offline = src.status == 'offline' || dst.status == 'offline';
        let r = self.radius + (offline ? 50 : 0);

        let cx = self.mapPane.cx;
        let cy = self.mapPane.cy;

        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        if (offlineInc > onlineInc)
            offlineInc = onlineInc;
        let angleInc = offline ? offlineInc : onlineInc;

        let srcAngleInc = angleInc / src.link_angles.length;
        let srcStartAngle = src.view.pstart.angle;
        let srcStopAngle;
        if (src.link_angles.length > 1) {
            srcStartAngle += srcAngleInc * link.src_index;
            srcStopAngle = srcStartAngle + srcAngleInc - 0.02;
        }
        else
            srcStopAngle = link.src.view.pstop.angle;

        let srcStartPos = [cx + Math.cos(srcStartAngle) * r,
                           cy + Math.sin(srcStartAngle) * r];
        let srcStopPos = [cx + Math.cos(srcStopAngle) * r,
                          cy + Math.sin(srcStopAngle) * r];

        let dstAngleInc = angleInc / dst.link_angles.length;
        let dstStartAngle = dst.view.pstart.angle;
        let dstStopAngle;
        if (dst.link_angles.length > 1) {
            dstStartAngle += dstAngleInc * link.dst_index;
            dstStopAngle = dstStartAngle + dstAngleInc - 0.02;
        }
        else
            dstStopAngle = dst.view.pstop.angle;

        let dstStartPos = [cx + Math.cos(dstStartAngle) * r,
                           cy + Math.sin(dstStartAngle) * r];
        let dstStopPos = [cx + Math.cos(dstStopAngle) * r,
                          cy + Math.sin(dstStopAngle) * r];

        let srcAngle = (src.view.pstart.angle + src.view.pstop.angle) * 0.5;
        let dstAngle = (dst.view.pstart.angle + dst.view.pstop.angle) * 0.5;
        let midAngle = polarMean(srcAngle, dstAngle);

        let diff = polarDiff(srcAngle, midAngle);
        if (diff < 0)
            midAngle += Math.PI;

        midAngle = Math.round((Raphael.deg(-midAngle) + 90.0) % 360.0);
        // gradient string doesn't seem to like negative angles
        if (midAngle < 0)
            midAngle += 360;

        let colorString;
        if (offline)
            colorString = 'rgba(255, 255, 255, 0.25)';
        else {
            let rgb = Raphael.getRGB(link.src.color);
            let srcColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.75)';
            rgb = Raphael.getRGB(link.dst.color);
            let dstColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.75)';
            colorString = midAngle+'-'+srcColor+'-'+dstColor;
        }
        console.log(colorString);

        let path = [];
        path.push(['M', srcStartPos[0], srcStartPos[1]],
                  ['A', r, r, srcStopAngle - srcStartAngle, 0, 1, srcStopPos[0], srcStopPos[1]]);
        path.push(['Q', cx, cy, dstStartPos[0], dstStartPos[1]]);
        path.push(['A', r, r, dstStopAngle - dstStartAngle, 0, 1, dstStopPos[0], dstStopPos[1]]);
        path.push(['Q', cx, cy, srcStartPos[0], srcStartPos[1]]);
        path.push(['Z']);
//        let r2 = r + Raphael.deg(diff);
//        path.push(['M', srcStartPos[0], srcStartPos[1]],
//                  ['A', r, r, srcStopAngle - srcStartAngle, 0, 1, srcStopPos[0], srcStopPos[1]]);
//        path.push(['C', cx + Math.cos(srcStopAngle) * r2, cy + Math.sin(srcStopAngle) * r2,
//                   cx + Math.cos(dstStartAngle) * r2, cy + Math.sin(dstStartAngle) * r2,
//                   dstStartPos[0], dstStartPos[1]]);
//        path.push(['A', r, r, dstStopAngle - dstStartAngle, 0, 1, dstStopPos[0], dstStopPos[1]]);
//        path.push(['C', cx + Math.cos(dstStopAngle) * r2, cy + Math.sin(dstStartAngle) * r2,
//                   cx + Math.cos(srcStartAngle) * r2, cy + Math.sin(srcStartAngle) * r2,
//                   srcStartPos[0], srcStartPos[1]]);
//        path.push(['Z']);


        link.view.toBack().attr({'stroke-width': 0,
                                 'fill': colorString
                                })
                          .animate({'path': path}, duration, '>');

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
