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

        this.radius = 150;

        this.resize();

        this.title = this.canvas.text(this.cx, this.cy, "Network")
                                .attr({'font-size': 32,
                                       'opacity': 1,
                                       'fill': 'white',
                                       'x': this.mapPane.cx,
                                       'y': this.mapPane.cy + 170});
        this.title.node.setAttribute('pointer-events', 'none');
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
        let ro = this.radius;
        let ri = 150 * 0.8;
        let cx = this.mapPane.cx;
        let cy = this.mapPane.cy;
        let lastPos = [1, 0];
        let angleInc = Math.PI * 2.0 / this.database.devices.size();
        this.database.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let startAngle = dev.index * angleInc;
            let stopAngle = (dev.index + 1) * angleInc - 0.05;
            let startPos = [Math.cos(startAngle), Math.sin(startAngle)];
            let stopPos = [Math.cos(stopAngle), Math.sin(stopAngle)];
            let path = [['M', cx + startPos[0] * ri, cy + startPos[1] * ri],
                        ['L', cx + startPos[0] * ro, cy + startPos[1] * ro],
                        ['A', ro, ro, angleInc, 0, 1, cx + stopPos[0] * ro, cy + stopPos[1] * ro],
                        ['L', cx + stopPos[0] * ri, cy + stopPos[1] * ri],
                        ['A', ri, ri, angleInc, 0, 0, cx + startPos[0] * ri, cy + startPos[1] * ri],
                        ['Z']];
            dev.view.animate({'path': path,
                              'fill-opacity': 1,
                              'stroke-opacity': 0,
                             }, duration, '>');
        });
    }

    updateLinks() {
        console.log('updateLinks()');
        let self = this;
        let angleInc = Math.PI * 2.0 / this.database.devices.size();
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
            if (link.view)
                return;
            let angle = (src.index + 0.5) * angleInc;
            let srcPos = [self.frame.cx + Math.cos(angle) * 150,
                          self.frame.cy + Math.sin(angle) * 150];
            link.view = self.canvas.path([['M', srcPos[0], srcPos[1]]]);
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
        let r = this.radius * 0.8;
        let angleInc = Math.PI * 2.0 / this.database.devices.size();

        this.database.links.each(function(link) {
            if (!link.view)
                return;
            link.view.stop();

            let src = link.src;
            let dst = link.dst;
            let srcAngle = (src.index + 0.66) * angleInc;
            let dstAngle = (dst.index + 0.33) * angleInc;
            let srcPos = [cx + Math.cos(srcAngle) * r, cy + Math.sin(srcAngle) * r];
            let dstPos = [cx + Math.cos(dstAngle) * r, cy + Math.sin(dstAngle) * r];
            let path = [['M', srcPos[0], srcPos[1]],
                        ['S', cx, cy, dstPos[0], dstPos[1]]];
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
        this.title.remove();

        // clean up any objects created only for this view
    }
}
