//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GridView extends View {
    constructor(frame, tables, canvas, database) {
        super('grid', frame, {'left': tables.left, 'right': tables.right},
              canvas, database);

        // set left table properties
        tables.left.filterByDirection('output');
        tables.left.showDetail(false);

        // set right table properties
        this.tables.right.snap = 'bottom';
        this.tables.right.filterByDirection('input');
        this.tables.right.showDetail(false);

        let self = this;
        this.database.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.map_pane;
        this.escaped = false;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        this.update();
        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, 180, this.frame.width, this.frame.height - 180, 0, duration);
        this.tables.right.adjust(180, this.frame.height, this.frame.height, this.frame.width - 180,
                                 -Math.PI * 0.5, duration,
                                 function() {self.draw(1000)});
        this.mapPane.left = 200;
        this.mapPane.width = this.frame.width - 200;
        this.mapPane.top = 200;
        this.mapPane.height = this.frame.height - 200;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.mapPane.top + this.mapPane.height * 0.5;
        this.draw();
    }

//    getMapPath(map) {
//        let self = this;
//        function tableRow(sig) {
//            if (self.tables && sig.tableIndices) {
//                let table = self.tables[sig.tableIndices[0].table];
//                return table.getRowFromIndex(sig.tableIndices[0].index);
//            }
//            return null;
//        }
//        let src = tableRow(map.src);
//        let dst = tableRow(map.dst);
//        if (!src || !dst)
//            return;
//
//        /* If src and dst are from same table we will always draw a bezier
//         * curve using the signal spacing for calculating control points. */
//        if (src.vx == dst.vx) {
//            // same table
//            if (map.view)
//                map.view.attr({'arrow-end': 'block-wide-long'});
//            if (src.x == dst.x) {
//                // signals are inline vertically
//                let ctlx = Math.abs(src.y - dst.y) * 0.5 * src.vx + src.x;
//                return [['M', src.x, src.y],
//                        ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
//            }
//            else {
//                // signals are inline horizontally
//                let ctly = Math.abs(src.x - dst.x) * 0.5 * src.vy + src.y;
//                return [['M', src.x, src.y],
//                        ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
//            }
//        }
//        else {
//            // draw intersection between tables
//            if (map.view) {
//                map.view.attr({'arrow-end': 'none'});
//            }
//            if (src.vx < 0.0001) {
//                return [['M', src.left, dst.y],
//                        ['L', src.left + src.width, dst.top],
//                        ['l', 0, dst.height],
//                        ['Z']];
//            }
//            else {
//                return [['M', dst.x, src.top],
//                        ['L', dst.left, src.top + src.height],
//                        ['l', dst.width, 0],
//                        ['Z']]
//            }
//        }
//    }

    draw(duration) {
//        this.drawDevices(duration);
        this.drawMaps(duration);
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'maps'];
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
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    cleanup() {
        super.cleanup();

        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });
    }
}
