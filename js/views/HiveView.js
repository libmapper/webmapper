//++++++++++++++++++++++++++++++++++++++//
//           Hive View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class HiveView extends View {
    constructor(frame, tables, canvas, model) {
        super('hive', frame, null, canvas, model);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.resize();
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        this.mapPane.left = 50;
        this.mapPane.width = this.frame.width - 100;
        this.mapPane.top = 50;
        this.mapPane.height = this.frame.height - 100;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
    }

    drawDevices(duration) {
        let self = this;

        let dev_num = model.devices.size();
        if (dev_num && dev_num > 1)
            dev_num -= 1;
        else
            dev_num = 1;
        let angleInc = (Math.PI * -0.5) / dev_num;

        model.devices.each(function(dev) {
            if (!dev.view)
                return;
            dev.view.stop();
            let angle = dev.index * angleInc;
            let numSigs = dev.numVisibleSigs;
            let inc = numSigs ? 1 / numSigs : 1;

            dev.view.toBack();
            dev.view.animate({'path': [['M', self.mapPane.left,
                                        self.mapPane.top + self.mapPane.height],
                                       ['l', self.mapPane.width * Math.cos(angle),
                                        self.mapPane.height * Math.sin(angle)]],
                              'stroke': dev.color,
                              'stroke-width': 20,
                              'stroke-opacity': 0.5,
                              'fill': dev.color,
                              'fill-opacity': 0,
                              'stroke-linecap': 'round'}, duration, '>');
            dev.signals.each(function(sig) {
                if (!sig.view)
                    return;
                // assign position along line
                sig.position.x = self.mapPane.left + self.mapPane.width * inc * (sig.index + 1) * Math.cos(angle);
                sig.position.y = self.mapPane.top + self.mapPane.height + self.mapPane.height * inc * (sig.index + 1) * Math.sin(angle);
                self.drawSignal(sig, duration);
            });
        });
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
        if (elements.indexOf('devices') >= 0)
            this.updateDevices();
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }
}
