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

        this.onlineTitle = this.canvas.text(this.frame.width * 0.33, this.cy, "Active")
                                      .attr({'font-size': 32,
                                             'opacity': 1,
                                             'fill': 'white',
                                             'x': this.frame.width * 0.25,
                                             'y': this.mapPane.cy + 210});
        this.onlineTitle.node.setAttribute('pointer-events', 'none');
        this.offlineTitle = this.canvas.text(this.frame.width * 0.67, this.cy, "File: tester.json")
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
            let x = self.frame.width * (offline ? 0.75 : 0.25);
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
//                if (x > self.mapPane.cx) {
//                    cx = self.frame.width * 0.75;
//                }
//                else {
//                    cx = self.frame.width * 0.25
//                }
//                let diffx = x - cx;
//                let diffy = y - cy;
//                let r = Math.sqrt(diffx * diffx + diffy * diffy);
//                if (r < self.radius)
//                    r = self.radius;
//                let path = [['M', cx + startPos[0] * r, cy + startPos[1] * r],
//                            ['A', r, r, angleInc, 0, 1, cx + stopPos[0] * r, cy + stopPos[1] * r]];
//                dev.view.stop().animate({'path': path}, 20, 'linear');
                let bbox = dev.view.getBBox();
                dev.view.stop().translate(x - bbox.x - bbox.width * 0.5,
                                          y - bbox.y - bbox.height * 0.5);
            },
            function(x, y, event) {
                self.escaped = false;
                self.draggingFrom = dev;
            },
            function(x, y, event) {
                self.draggingFrom = null;
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
            let startPos = [Math.cos(a), Math.sin(a)];
            a = angle + halfAngleWidth;
            let stopPos = [Math.cos(a), Math.sin(a)];
//            let path = [['M', cx + startPos[0] * ri, cy + startPos[1] * ri],
//                        ['L', cx + startPos[0] * ro, cy + startPos[1] * ro],
//                        ['A', ro, ro, angleInc, 0, 1, cx + stopPos[0] * ro, cy + stopPos[1] * ro],
//                        ['L', cx + stopPos[0] * ri, cy + stopPos[1] * ri],
//                        ['A', ri, ri, angleInc, 0, 0, cx + startPos[0] * ri, cy + startPos[1] * ri],
//                        ['Z']];
//            dev.view.animate({'path': path,
//                              'fill-opacity': 1,
//                              'stroke-opacity': 0,
//                             }, duration, '>');
            let path = [['M', cx + startPos[0] * r, cy + startPos[1] * r],
                        ['A', r, r, angleInc, 0, 1, cx + stopPos[0] * r, cy + stopPos[1] * r]];
            dev.view.attr({'stroke-linecap': 'butt'});
            dev.view.animate({'path': path,
                              'fill-opacity': 0,
                              'stroke-opacity': offline ? 0.5 : 1,
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
                console.log('link.addingview');
                link.view = self.canvas.path([['M', srcPos[0], srcPos[1]],
                                              ['l', 0, 0]]);
            }
            if (!link.view.startPoint) {
                link.view.startPoint = self.canvas.path([['M', x, self.frame.cy],
                                                         ['l', 0, 0]]);
            }
            if (!link.view.stopPoint) {
                link.view.stopPoint = self.canvas.path([['M', x, self.frame.cy],
                                                        ['l', 0, 0]]);
            }
            self.setLinkHover(link);
        });
    }

    ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    drawLinks(duration) {
        let self = this;
        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        let r = this.radius - 19;
        let onlineInc = Math.PI * 2.0 / this.onlineDevs;
        let offlineInc = Math.PI * 2.0 / this.offlineDevs;
        let endPointRadius = 12;

        this.database.links.each(function(link) {
            if (!link.view)
                return;
            link.view.stop();

            let src = link.src;
            let dst = link.dst;
            let srcAngle = (src.index - 0.33) * (src.status == 'offline' ? offlineInc : onlineInc);
            let dstAngle = (dst.index + 0.33) * (dst.status == 'offline' ? offlineInc : onlineInc);
            let x = self.frame.width * (link.status == 'offline' ? 0.75 : 0.25);
            let srcPos = [x + Math.cos(srcAngle) * r, cy + Math.sin(srcAngle) * r];
            let dstPos = [x + Math.cos(dstAngle) * r, cy + Math.sin(dstAngle) * r];
            let path = [['M', srcPos[0], srcPos[1]],
                        ['S', x, cy, dstPos[0], dstPos[1]]];
            link.view.animate({'path': path,
                               'stroke': src.color,
                               'stroke-width': 5,
                               'stroke-opacity': 1}, duration, '>');
            path = [['M', srcPos[0] + endPointRadius * 0.65,
                     srcPos[1] + endPointRadius * -0.65],
                    ['a', endPointRadius, endPointRadius, 0, 1, 0, 0.001, 0.001],
                    ['z']]
            link.view.startPoint.animate({'path': path,
                                          'fill': src.color,
                                          'stroke-opacity': 0});
            path = [['M', dstPos[0] + endPointRadius * 0.65,
                    dstPos[1] + endPointRadius * -0.65],
                    ['a', endPointRadius, endPointRadius, 0, 1, 0, 0.001, 0.001],
                    ['z']]
            link.view.stopPoint.animate({'path': path,
                                         'fill': src.color,
                                         'stroke': 'white',
                                         'stroke-opacity': 0});
//                     .attr({'arrow-start': 'diamond-wide-long'});
//            link.view.start.animate({'path'});
//            let x = self.frame.width * (link.status == 'offline' ? 0.75 : 0.25);
//            let srcInc = (src.status == 'offline') ? offlineInc : onlineInc;
//            let dstInc = (dst.status == 'offline') ? offlineInc : onlineInc;
//            let srcPos = [x + Math.cos(src.index * srcInc) * r,
//                          cy + Math.sin(src.index * srcInc) * r,
//                          x + Math.cos((src.index + 1) * srcInc - 0.05) * r,
//                          cy + Math.sin((src.index + 1) * srcInc - 0.05) * r];
//            let dstPos = [x + Math.cos(dst.index * dstInc) * r,
//                          cy + Math.sin(dst.index * dstInc) * r,
//                          x + Math.cos((dst.index + 1) * dstInc - 0.05) * r,
//                          cy + Math.sin((dst.index + 1) * dstInc - 0.05) * r];
//            let path = [['M', srcPos[0], srcPos[1]],
//                        ['A', r, r, srcInc, 0, 1, srcPos[2], srcPos[3]],
//                        ['S', x, cy, dstPos[0], dstPos[1]],
//                        ['A', r, r, dstInc, 0, 1, dstPos[2], dstPos[3]],
//                        ['S', x, cy, srcPos[0], srcPos[1]]];
//            let rgb = Raphael.getRGB(src.color);
//            let angle = Raphael.deg((src.index * srcInc + dst.index * dstInc) * 0.5)+270;
//                                 console.log('using angle', angle);
//            let gradient = [];
//            gradient[0] = angle+'-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
//            rgb = Raphael.getRGB(dst.color);
//            gradient[1] = ')-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
//            link.view.animate({'path': path,
//                               'fill': gradient[0]+1+gradient[1]+1+')',
//                               'fill-opacity': 1,
//                               'stroke-opacity': 0}, duration, '>')
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
                this.onlineTitle.attr({'text': 'Active\n('+this.onlineDevs+' devices)'});
            if (this.offlineTitle)
                this.offlineTitle.attr({'text': 'tester.json\n('+this.offlineDevs+' devices)'});
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
