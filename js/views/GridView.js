//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GridView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('grid', frame, {'left': tables.left, 'right': tables.right},
              canvas, database, tooltip);

        // set left table properties
        this.tables.left.filterByDirection('output');
        this.tables.left.showDetail(false);
        this.tables.left.expand = true;

        // set right table properties
        this.tables.right.snap = 'bottom';
        this.tables.right.filterByDirection('input');
        this.tables.right.showDetail(false);
        this.tables.right.expand = true;

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

        this.leftExpandWidth = 200;
        this.rightExpandWidth = 200;

        this.update();
        this.resize(null, 1000);

        // move svg canvas to front
        $('#svgDiv').css('position', 'relative');
        $('#svgDiv').css('z-index', 2);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, this.rightExpandWidth-20, this.leftExpandWidth,
                                this.frame.height - this.rightExpandWidth + 20,
                                0, duration, null, 0, this.frame.width);
        this.tables.right.adjust(this.leftExpandWidth-20, this.rightExpandWidth,
                                 this.rightExpandWidth,
                                 this.frame.width - this.leftExpandWidth + 20,
                                 -Math.PI * 0.5, duration,
                                 function() {self.draw(1000)},
                                 this.rightExpandWidth-this.frame.height,
                                 this.frame.height);
        this.mapPane.left = this.leftExpandWidth;
        this.mapPane.width = this.frame.width - this.leftExpandWidth;
        this.mapPane.top = this.rightExpandWidth;
        this.mapPane.height = this.frame.height - this.rightExpandWidth;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.mapPane.top + this.mapPane.height * 0.5;
        this.draw();
    }

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
            let updated = false;
            if (this.tables.left.expandWidth != this.leftExpandWidth) {
                this.leftExpandWidth = this.tables.left.expandWidth;
                updated = true;
            }
            if (this.tables.right.expandWidth != this.rightExpandWidth) {
                this.rightExpandWidth = this.tables.right.expandWidth;
                updated = true;
            }
            if (updated)
                this.resize(null, 1000);
        }
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    cleanup() {
        super.cleanup();

        // move svg canvas to back
        $('#svgDiv').css('z-index', 0);

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
