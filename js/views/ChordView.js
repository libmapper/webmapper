//++++++++++++++++++++++++++++++++++++++//
//           Chord View Class           //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ChordView extends View {
    constructor(frame, tables, canvas, graph, tooltip, pie) {
        super('chord', frame, tables, canvas, graph, tooltip, pie);

        this.radius = 200;

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.onlineInc = Math.PI * 0.5;
        this.offlineInc = Math.PI * 0.5;

        this.onlineDevs = 0;
        this.offlineDevs = 0;

        this.file = null;

        this.setup();
    }

    setup() {
        // disable signal filter
        $('#signalFilterDiv').addClass('disabled');

        // hide tables
        this.tables.left.adjust(this.frame.width * -0.4, 0, 0,
                                this.frame.height, 0, 500, null, 0, 0);
        this.tables.right.adjust(this.frame.width, 0, 0,
                                 this.frame.height, 0, 500, null, 0, 0);
        this.tables.left.hidden = this.tables.right.hidden = true;

        let self = this;
        this.graph.devices.forEach(function(dev) {
            if (dev.view) {
                self.setDevClick(dev);
                self.setDevHover(dev);
            }
            // remove associated svg elements for signals
            dev.signals.forEach(function(sig) { remove_object_svg(sig); });
        });
        // remove associated svg elements for maps
        this.graph.maps.forEach(function(map) { remove_object_svg(map); });

        this.devCount = this.canvas.text(this.mapPane.cx, this.mapPane.cy, " ")
                                   .attr({'font-size': 100,
                                          'opacity': 0.25,
                                          'fill': 'white',
                                          'x': this.mapPane.cx,
                                          'y': this.mapPane.cy});
        this.devCount.node.setAttribute('pointer-events', 'none');

        this.updateDevices();
        this.resize();
    }

    _resize(duration) {
        this.mapPane.left = 0;
        this.mapPane.width = this.frame.width;
        this.mapPane.top = 0;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;

        this.radius = Math.min(this.frame.width, this.frame.height) * 0.25;

        this.devCount.attr({'x': this.mapPane.cx,
                            'y': this.mapPane.cy});
    }

    gap(numDevs) {
        return numDevs > 1 ? 0.9 : 0.999999;
    }

    updateDevices() {
        let self = this;
        this.onlineDevs = 0;
        this.offlineDevs = 0;
        let dev_num = this.graph.devices.size();
        if (dev_num == 0) {
            this.canvas.waiting.show();
            return;
        }
        this.canvas.waiting.hide();

        this.graph.devices.forEach(function(dev) {
            if (dev.status == 'offline')
                self.offlineDevs++;
            else
                self.onlineDevs++;
        });
        if (this.onlineDevs > 0)
            this.onlineInc = Math.PI * 2.0 / this.onlineDevs;
        else
            this.onlineInc = 0;
        if (this.offlineDevs > 0)
            this.offlineInc = Math.PI * 2.0 / this.offlineDevs;
        else
            this.offlineInc = 0;

        let onlineIndex = 0;
        let offlineIndex = 0;

        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        this.graph.devices.forEach(function(dev) {
            let offline = (dev.status == 'offline');
            let r = self.radius ? self.radius : 0;

            if (offline)
                dev.index = offlineIndex++;
            else
                dev.index = onlineIndex++;
            let angleInc = offline ? self.offlineInc : self.onlineInc;
            let numDevs = offline ? self.offlineDevs : self.onlineDevs;
            let angle = (dev.index - 0.45) * angleInc;
            let pstart = {'angle': angle,
                          'x': cx + Math.cos(angle) * r,
                          'y': cy + Math.sin(angle) * r};
            angle += angleInc * self.gap(numDevs);
            let pstop = {'angle': angle,
                         'x': cx + Math.cos(angle) * r,
                         'y': cy + Math.sin(angle) * r};

            if (!dev.view) {
                let path = [['M', cx, cy]];
                dev.view = self.canvas.path().attr({'path': path,
                                                    'fill-opacity': 0,
                                                    'stroke-opacity': 0,
                                                    'stroke-linecap': 'butt',
                                                    'stroke-width': 0});
                self.setDevClick(dev);
                self.setDevHover(dev);
            }
            dev.view.pstart = pstart;
            dev.view.pstop = pstop;
            dev.view.radius = r;

            if (!dev.view.label) {
                let midAngle = dev.view.pstart.angle + angleInc * 0.45;
                let anchor = 'start';
                if (midAngle > Math.PI * 0.5 && midAngle < Math.PI * 1.5) {
                    midAngle += Math.PI;
                    anchor = 'end';
                }
                midAngle = Raphael.deg(midAngle);
                dev.view.label = self.canvas.text(0, 0, dev.name);
                dev.view.label.attr({'opacity': 0,
                                     'pointer-events': 'none',
                                     'font-size': 16,
                                     'fill': 'white',
                                     'text-anchor': anchor,
                                     'x': cx,
                                     'y': cy});
                dev.view.label.node.setAttribute('pointer-events', 'none');
            }
            if (!dev.view.stick) {
                let path = [['M', cx, cy]];
                let color = Raphael.hsl(dev.hue, dev.hidden ? 0 : 1, 0.5);
                dev.view.stick = self.canvas.path().attr({'path': path,
                                                          'stroke': color,
                                                          'stroke-width': 2});
            }

            if (offline)
                self.setDevDrag(dev);
        });
    }

    setDevClick(dev) {
        let self = this;
        dev.view.unclick().click(function(e) {
            // check if any other devices are hidden
            let hidden = self.graph.devices.map(d => d.hidden ? 1 : 0)
                                           .reduce((a, h) => a + h);
            if (dev.hidden) {
                // unhide
                dev.hidden = false;
            }
            else if (hidden === 0) {
                // 'solo' this device by hiding all others
                self.graph.devices.forEach(d => d.hidden = (d !== dev));
            }
            else if (hidden === self.graph.devices.size() - 1) {
                // unhide all devices
                self.graph.devices.forEach(d => d.hidden = false);
            }
            else
                dev.hidden = true;
            self.graph.devices.forEach(d => command.send("set_dev", { "name"    : d.name,
                                                                      "hidden"  : d.hidden,
                                                                      "publish" : false }));
            self.showDevLabel(self, dev, e);
            self.draw(0);
        });
    }

    setDevDrag(dev) {
        // when both sides are snapped, create maps
        // ensure can undo!
        let self = this;
        let offline = (dev.status == 'offline');
        let cx = self.mapPane.cx;
        let cy = self.mapPane.cy;
        let lastAngle = null;
        let r, cx2, angleInc, angle, numDevs;
        dev.view.mouseup(function() {
            if (self.draggingFrom && self.snappingTo) {
                dev.staged = self.snappingTo;
                dev.status = 'staged';
            }
            else {
                // return to original position
                r = self.radius;
                cx2 = cx * 1.5;
                angleInc = self.offlineInc;
                angle = (dev.index - 0.45) * angleInc;
                self.snappingTo = null;
                dev.view.pstart = {'angle': angle,
                                   'x': cx2 + Math.cos(angle) * r,
                                   'y': cy + Math.sin(angle) * r};
                angle += angleInc * self.gap(self.offlineDevs);
                dev.view.pstop = {'angle': angle,
                                  'x': cx2 + Math.cos(angle) * r,
                                  'y': cy + Math.sin(angle) * r};
                dev.view.radius = r;
                self.drawDevice(dev, 500, self);
                for (var i in dev.links) {
                    let link = self.graph.links.find(dev.links[i]);
                    if (link)
                        self.drawLink(link, 500, self);
                }
            }
            self.draggingFrom = self.snappingTo = null;
            if (dev.status == 'staged')
                dev.status = 'offline';
        });
        dev.view.undrag();
        dev.view.drag(
            function(dx, dy, x, y, event) {
                x -= self.frame.left;
                y -= self.frame.top;

                if (x > self.mapPane.cx) {
                    r = self.radius;
                    cx2 = cx * 1.5;
                    angleInc = self.offlineInc;
                    numDevs = self.offlineDevs;
                    angle = (dev.index - 0.45) * angleInc;
                    self.snappingTo = null;
                }
                else {
                    // calculate new angle
                    r = self.radius + (self.snappingTo ? 40 : 50);
                    cx2 = cx * 0.5;
                    angleInc = self.onlineInc;
                    numDevs = self.onlineDevs;
                    angle = Math.atan2(y - cy, x - cx2);
                    angle = (Math.round(angle / angleInc) - 0.45) * angleInc;
                }
                if (angle == lastAngle)
                    return;

                dev.view.pstart = {'angle': angle,
                                   'x': cx2 + Math.cos(angle) * r,
                                   'y': cy + Math.sin(angle) * r};
                angle += angleInc * self.gap(numDevs);
                dev.view.pstop = {'angle': angle,
                                  'x': cx2 + Math.cos(angle) * r,
                                  'y': cy + Math.sin(angle) * r};
                dev.view.radius = r;
                self.drawDevice(dev, 500, self);
                for (var i in dev.links) {
                    let link = self.graph.links.find(dev.links[i]);
                    if (link)
                        self.drawLink(link, 500, self);
                }
                lastAngle = angle;
            },
            function(x, y, event) {
                dev.escaped = false;
                self.draggingFrom = dev;
            },
            function(x, y, event) {
                self.draggingFrom = null;
                lastAngle = null;
                // TODO: redraw device
                // TODO: reset translation attribute
                // TODO: apply link edits?
            }
        );
    }

    drawDevice(dev, duration, self) {
        if (!dev.view)
            return;
        dev.view.stop();
        dev.view.label.stop();
        let offline = (dev.status == 'offline');
        let angleInc, numDevs;
        if (offline == 'offline') {
            if (dev.draggingFrom) {
                angleInc = self.onlineInc;
                numDevs = self.onlineDevs;
            }
            else {
                angleInc = self.offlineInc;
                numDevs = self.offlineDevs;
            }
        }
        else {
            angleInc = self.onlineInc;
            numDevs = self.onlineDevs;
        }

        let r = self.radius ? self.radius : 0;
        let cx = self.mapPane.cx;
        let cy = self.mapPane.cy;
        let angle = (dev.index - 0.45) * angleInc;
        let pstart = {'angle': angle,
                      'x': cx + Math.cos(angle) * r,
                      'y': cy + Math.sin(angle) * r};
        angle += angleInc * self.gap(numDevs);
        let pstop = {'angle': angle,
                     'x': cx + Math.cos(angle) * r,
                     'y': cy + Math.sin(angle) * r};

        dev.view.path = [['M', pstart.x, pstart.y],
                         ['A', r, r, angleInc,
                          fuzzyEq(angleInc, 6.283, 0.01) ? 1 : 0, 1,
                          pstop.x, pstop.y]];
        let color = Raphael.hsl(dev.hue, dev.hidden ? 0 : 1, 0.5);
        dev.view.attr({'stroke-linecap': 'butt'})
                .animate({'path': dev.view.path,
                          'stroke': color,
                          'fill-opacity': 0,
                          'stroke-opacity': 1,
                          'stroke-width': 40,
                          'transform': 't0,0r0'
                         }, duration, '>');

        let midAngle = dev.view.pstart.angle + angleInc * 0.45;
        let x = Math.cos(midAngle);
        let y = Math.sin(midAngle);
        let offset = x > 0 ? 100 : -100;
        if (offset < 0)
            dev.view.label.attr({'text-anchor': 'end'});
        else
            dev.view.label.attr({'text-anchor': 'start'});
        dev.view.label.animate({'opacity': dev.hidden ? 0.5 : 1.0,
                                'x': cx + x * r * 1.5 + offset,
                                'y': cy + y * r * 1.5,
                                'transform': 't0,0r0'
                               }, duration, '>');
        let mult = 1.5 * r;
        dev.view.stick.animate({'stroke': color,
                                'path': [['M', cx + x * r, cy + y * r],
                                         ['L', cx + x * mult, cy + y * mult],
                                         ['l', offset, 0]]},
                               duration, '>');
    }

    drawDevices(duration) {
        let self = this;
        this.graph.devices.forEach(function(dev) {
            self.drawDevice(dev, duration, self);
        });
    }

    updateLinks() {
        let self = this;
        let tau = Math.PI * 2.0;
        this.graph.devices.forEach(function(dev) {
            dev.link_angles = [];
        });
        this.graph.links.forEach(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!src.view || !dst.view || src == dst)
                return;

            if (!src.link_angles.includes(dst.view.pstart.angle)) {
                src.link_angles.push(dst.view.pstart.angle);
            }
            if (!dst.link_angles.includes(src.view.pstart.angle)) {
                dst.link_angles.push(src.view.pstart.angle);
            }
        });
        this.graph.devices.forEach(function(dev) {
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
        this.graph.links.forEach(function(link) {
            let src = link.src;
            let dst = link.dst;
            if (!link.view) {
                link.view = self.canvas.path();
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

        if (!src.view || !dst.view)
            return;

        let cx = self.mapPane.cx;
        let cy = self.mapPane.cy;
        let angleInc;
        let r = self.radius - 19;
        let offline = src.status == 'offline';
        if (src.staged) {
            r += 40;
            angleInc = self.onlineInc;
            src = src.staged;
        }
        else {
            if (src == self.draggingFrom) {
                r += self.snappingTo ? 40 : 50;
            }
            angleInc = offline ? self.offlineInc : self.onlineInc;
        }

        let srcAngleInc = angleInc / src.link_angles.length * 0.9;
        let srcStartAngle = src.view.pstart.angle;
        let srcStopAngle;
        if (src.link_angles.length > 1) {
            srcStartAngle += srcAngleInc * link.src_index;
            srcStopAngle = srcStartAngle + srcAngleInc;
        }
        else
            srcStopAngle = link.src.view.pstop.angle;

        let srcStartPos = [cx + Math.cos(srcStartAngle) * r,
                           cy + Math.sin(srcStartAngle) * r];
        let srcStopPos = [cx + Math.cos(srcStopAngle) * r,
                          cy + Math.sin(srcStopAngle) * r];

        r = self.radius - 19;
        offline = dst.status == 'offline' && dst != self.draggingFrom;
        if (dst.staged) {
            r += 40;
            angleInc = self.onlineInc;
            dst = dst.staged;
        }
        else {
            if (dst == self.draggingFrom) {
                r += self.snappingTo ? 40 : 50;
            }
            angleInc = offline ? self.offlineInc : self.onlineInc;
        }

        let dstAngleInc = angleInc / dst.link_angles.length * 0.9;
        let dstStartAngle = dst.view.pstart.angle;
        let dstStopAngle;
        if (dst.link_angles.length > 1) {
            dstStartAngle += dstAngleInc * link.dst_index;
            dstStopAngle = dstStartAngle + dstAngleInc;
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

        let midAngleDeg = Math.round((Raphael.deg(-midAngle) + 90.0) % 360.0);
        // gradient string doesn't seem to like negative angles
        if (midAngleDeg < 0)
            midAngleDeg += 360;

        let srcColor = 'hsl(' + src.hue + ','+(src.hidden ? 0 : 1)+',0.5)';
        let dstColor = 'hsl(' + dst.hue + ','+(dst.hidden ? 0 : 1)+',0.5)';
        let fillString = midAngleDeg+'-'+srcColor+'-'+dstColor;

        let path = [];
        if (src == dst) {
            r = self.radius * 1.1;
            if (angleInc > 1.1) {
                angleInc = 1;
                angleInc += src.view.pstart.angle;
                path = [['M', (src.view.pstart.x-cx)*1.1+cx, (src.view.pstart.y-cy)*1.1+cy],
                        ['A', r, r, angleInc, fuzzyEq(angleInc, 6.283, 0.01) ? 1 : 0, 1,
                         cx + Math.cos(angleInc) * r, cy + Math.sin(angleInc) * r]];
            }
            else {
                path = [['M', (src.view.pstart.x-cx)*1.1+cx, (src.view.pstart.y-cy)*1.1+cy],
                        ['A', r, r, angleInc, fuzzyEq(angleInc, 6.283, 0.01) ? 1 : 0, 1,
                         (src.view.pstop.x-cx)*1.1+cx, (src.view.pstop.y-cy)*1.1+cy]];
            }

            let len = Raphael.getTotalLength(path);
            path = Raphael.getSubpath(path, 20, len-20);
            link.view.toBack().attr({'stroke-width': 40,
                                     'stroke': Raphael.hsl(src.hue, src.hidden ? 0 : 1, 0.5),
                                     'fill': 'none',
                                     'stroke-linecap': 'round'});
        }
        else {
            let cx1 = cx, cy1 = cy, cx2 = cx, cy2 = cy;
            angleInc *= 0.1;
            if (fuzzyEq(Math.abs(polarDiff(srcStopAngle, dstStartAngle)), angleInc, 0.1)) {
                cx1 = cx * 0.5 + (srcStopPos[0] + dstStartPos[0]) * 0.25;
                cy1 = cy * 0.5 + (srcStopPos[1] + dstStartPos[1]) * 0.25;
            }
            if (fuzzyEq(Math.abs(polarDiff(srcStartAngle, dstStopAngle)), angleInc, 0.1)) {
                cx2 = cx * 0.5 + (srcStartPos[0] + dstStopPos[0]) * 0.25;
                cy2 = cy * 0.5 + (srcStartPos[1] + dstStopPos[1]) * 0.25;
            }

            path.push(['M', srcStartPos[0], srcStartPos[1]],
                      ['A', r, r, srcStopAngle - srcStartAngle, 0, 1, srcStopPos[0], srcStopPos[1]]);
            path.push(['Q', cx1, cy1, dstStartPos[0], dstStartPos[1]]);
            path.push(['A', r, r, dstStopAngle - dstStartAngle, 0, 1, dstStopPos[0], dstStopPos[1]]);
            path.push(['Q', cx2, cy2, srcStartPos[0], srcStartPos[1]]);
            path.push(['Z']);

            link.view.toBack().attr({'stroke-width': 0,
                                     'fill': fillString});
        }

        if (link.view.getTotalLength() == undefined) {
            link.view.attr({'path': path});
            $(link.view.node).css("opacity", 0);
            $(link.view.node).animate({opacity: 0.75}, duration);
        }
        else {
            $(link.view.node).css("opacity", 0.75);
            link.view.animate({'path': path}, duration, '>');
        }
    }

    drawLinks(duration) {
        let self = this;

        this.graph.links.forEach(function(link) {
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
        let updated = false;
        if (elements.indexOf('devices') >= 0) {
            this.updateDevices();
            if (this.onlineDevs)
                this.devCount.attr({'text': ''});
            else
                this.devCount.attr({'text': 'waiting for devices'});
            updated = true;
        }
        if (elements.indexOf('links') >= 0) {
            this.updateLinks();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawLinks(duration);
    };

    cleanup() {
        super.cleanup();

        // clean up any objects created only for this view
        if (this.devCount)
            this.devCount.remove();
        graph.links.forEach(function(link) {
            if (!link.view)
                return;
            remove_object_svg(link, 200);
        });
        graph.devices.forEach(function(dev) {
            if (!dev.view)
                return;
            if (dev.view.stick) {
                dev.view.stick.remove();
                dev.view.stick = null;
            }
            dev.view.unclick();
            dev.view.unhover();
        });

        $('#signalFilterDiv').removeClass('disabled');
    }
}
