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

        // remove associated svg elements for signals
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) { remove_object_svg(sig); });
        });
        // remove associated svg elements for maps
        this.database.maps.each(function(map) { remove_object_svg(map); });

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.inverted = true;

        this.resize();
    }

    updateDevices() {
        let self = this;
        let dev_num = this.database.devices.size();
        if (dev_num < 1)
            return;
        let index = 0;
        this.database.devices.each(function(dev) {
            dev.index = index++;
            if (!dev.view) {
                let path = [['M', self.mapPane.cx, self.mapPane.cy],
                            ['l', 0, 0]];
                dev.view = self.canvas.path().attr({'path': path,
                                                    'fill': dev.color,
                                                    'stroke': dev.color,
                                                    'fill-opacity': 0,
                                                    'stroke-opacity': 0,
                                                    'stroke-linecap': 'round'
                                                   });
            }
        });
    }

    drawDevices(duration) {
        let self = this;
        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        let lastPos = [cx + 75, cy];
        let angleInc = Math.PI * 2.0 / this.database.devices.size();
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let angle = (dev.index + 1) * angleInc;
            let pos = [cx + Math.cos(angle) * 75, cy + Math.sin(angle) * 75];
            let path;
            if (self.inverted) {
                path = [['M', cx, cy],
                        ['L', lastPos[0], lastPos[1]],
                        ['A', 75, 75, angleInc, 0, 1, pos[0], pos[1]],
                        ['Z']];
            }
            else {
                // TODO: draw devices as donut segments instead
            }
            dev.view.animate({'path': path,
                              'fill-opacity': 1}, duration, '>');
            lastPos = pos;
        });
    }

    updateLinks() {
        console.log('updateLinks()');
        let self = this;
        this.database.devices.each(function(dev) {
            dev.src_indices = [];
            dev.dst_indices = [];
        });
        this.database.links.each(function(link) {
                                 console.log('updatinglink');
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
                                 console.log('checking if link already has view');
            if (link.view)
                return;
                                 console.log('adding view to link');
            link.view = self.canvas.path();
//            let rgb = Raphael.getRGB(link.src.color);
//            let gradient = [];
//            gradient[0] = '0-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
//            rgb = Raphael.getRGB(link.dst.color);
//            gradient[1] = ')-rgba('+rgb.r+','+rgb.g+','+rgb.b+',';
//
//            link.view.attr({'fill': gradient[0]+0.25+gradient[1]+0.25+')',
//                            'stroke-opacity': 0});
//            link.view.setAlpha = function(alpha1, alpha2) {
//                if (!alpha2)
//                    alpha2 = alpha1;
//                this.attr({'fill': gradient[0]+alpha1+gradient[1]+alpha2+')'});
//            }
//            link.view.hover(
//                function() {
//                    link.view.toFront();
//                    link.view.setAlpha(0.5);
//                    this.mousemove(function (e, x) {
//                        let ratio = (x - link_pane.left) / link_pane.width;
//                        ratio = ratio * 0.25;
//                        link.view.setAlpha(0.5-ratio, 0.25+ratio);
//                    });
//                },
//                function() {
//                    this.unmousemove();
//                    this.setAlpha(0.25);
//            });
//            link.view.unclick().click(function(e, x) {
//                console.log('click');
//                // check if close to table
//                // enable dragging to new device
//            });
        });
    }

    ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    drawLinks(duration) {
        console.log('drawLinks()');
        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        let angleInc = Math.PI * 2.0 / this.database.devices.size();

        this.database.links.each(function(link) {
                                 console.log('checking link');
            if (!link.view)
                return;
            link.view.stop();
                                 console.log('drawig link');

            let src = link.src;
            let dst = link.dst;
            let angle = (src.index + 0.5) * angleInc;
            let srcPos = [Math.cos(angle) * 75, Math.sin(angle) * 75];
            angle = (dst.index + 0.5) * angleInc;
            let dstPos = [Math.cos(angle) * 75, Math.sin(angle) * 75];
            let path = [['M', cx + srcPos[0], cy + srcPos[1]],
                        ['C', cx + srcPos[0] * 2, cy + srcPos[1] * 2,
                         cx + dstPos[0] * 2, cy + dstPos[1] * 2,
                         cx + dstPos[0], cy + dstPos[1]]];
                                 console.log('path', path);
            link.view.animate({'path': path,
                               'stroke': 'white',
                               'stroke-width': 4,
                               'stroke-opacity': 1}, duration, '>');
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

        // clean up any objects created only for this view
    }
}
