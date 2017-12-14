//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ListView extends View {
    constructor(frame, tables, canvas, model) {
        super('list', frame, {'left': tables.left, 'right': tables.right},
              canvas, model);

        // set left table properties
        this.tables.left.filterByDirection('output');
        this.tables.left.showDetail(true);

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.filterByDirection('input');
        this.tables.right.showDetail(true);

        let self = this;
        model.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);

            if (!dev.view)
                return;
            // change device click
            dev.view.unclick().click(function(e) {
                dev.collapsed ^= 3;
                self.updateDevices();
                self.draw(200);
            });
        });

        this.escaped = false;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, 0, this.frame.width * 0.4, this.frame.height, 0,
                                duration);
        this.tables.right.adjust(this.frame.width * 0.6, 0, this.frame.width * 0.4,
                                 this.frame.height, 0, duration,
                                 function() {self.draw(1000)});
        this.mapPane.left = this.frame.width * 0.4;
        this.mapPane.width = this.frame.width * 0.2;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawMaps(duration);
    }

    update() {
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
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0)
            this.updateDevices();
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
