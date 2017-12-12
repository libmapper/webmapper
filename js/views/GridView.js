//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GridView extends View {
    constructor(frame, tables, canvas, model) {
        super('grid', frame, {'left': tables.left, 'right': tables.right},
              canvas, model);

        // set left table properties
        tables.left.filterByDirection('output');
        tables.left.showDetail(false);

        // set right table properties
        this.tables.right.snap = 'bottom';
        tables.right.filterByDirection('input');
        tables.right.showDetail(false);

        let self = this;
        model.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(function(sig) {
                remove_object_svg(sig);
            });
            if (!dev.view)
                return;
            // change device click
            dev.view.unclick().click(function(e) {
                dev.collapsed ^= 3;
                self.updateDevices();
                self.draw(200);
            });
        });

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
        this.tables.left.adjust(0, 180, 200, this.frame.height - 180, 0, duration);
        this.tables.right.adjust(-20, 0, 200, this.frame.width - 180, -Math.PI * 0.5, duration,
                                 function() {self.draw()});
        this.mapPane.left = 200;
        this.mapPane.width = this.frame.width - 200;
        this.mapPane.top = 200;
        this.mapPane.height = this.frame.height - 200;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.mapPane.top + this.mapPane.height * 0.5;
        this.draw();
    }

    draw(duration) {
        this.drawDevices(duration);
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

        model.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });
    }
}
