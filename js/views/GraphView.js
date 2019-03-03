//++++++++++++++++++++++++++++++++++++++//
//          Graph View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GraphView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('graph', frame, null, canvas, database, tooltip, GraphMapPainter);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 500, null, 0, 0);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 500, null, 0, 0);

        // remove associated svg elements for devices
        this.database.devices.each(remove_object_svg);

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.shortenPaths = 12;

        this.xAxisProp = 'direction'
        this.yAxisProp = null;

        this.resize();
    }

    _resize(duration) {
        super._resize();
        $('#axes').stop(true, false)
                  .text('foooooo')
                  .css({'left': this.frame.left + 50,
                        'top': this.frame.top + 50,
                        'width': this.frame.width - 100,
                        'height': this.frame.height - 100,
                        'opacity': 1,
                        'z-index': -1});
    }

    update() {
        let elements;
        let self = this;
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
        let updated = false;
        if (elements.indexOf('signals') >= 0) {
            this.updateSignals(function(sig) {
                if (!sig.position)
                    sig.position = position(null, null, self.frame);
                return false;
            });
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    draw(duration) {
        this.drawSignals(duration);
        this.drawMaps(duration);
    }

    cleanup() {
        super.cleanup();
        $('#axes').stop(true, false)
                  .animate({opacity: 0}, {duration: 2000});
    }
}

class GraphMapPainter extends MapPainter
{
    constructor(map, canvas, frame) { super(map, canvas, frame); }

    updateAttributes() {
        this._defaultAttributes();
    }
}
