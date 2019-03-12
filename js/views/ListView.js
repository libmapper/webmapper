//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ListView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('list', frame, {'left': tables.left, 'right': tables.right},
              canvas, database, tooltip, ListMapPainter);

        // set left table properties
        this.tables.left.filterByDirection('output');

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.filterByDirection('input');

        // set global table properties
        for (var i in this.tables) {
            let t = this.tables[i];
            t.showDetail(true);
            t.expand = false;
            t.scrolled = 0;
            t.zoomed = 1;
            t.update();
        }

        let self = this;
        this.database.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);

            if (!dev.view)
                return;
            // remove device labels
            if (dev.view.label) {
                dev.view.label.remove();
                dev.view.label = null;
            }
            // change device hover
            dev.view.unhover();
        });

        this.tables.left.collapseHandler = function() {self.drawMaps()};
        this.tables.right.collapseHandler = function() {self.drawMaps()};

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.escaped = false;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        this.resize(null, 500);
    }

    _resize(duration) {
        let self = this;
        this.tables.left.adjust(0, 0, this.frame.width * 0.4, this.frame.height, 0,
                                duration);
        this.tables.right.adjust(this.frame.width * 0.6, 0, this.frame.width * 0.4,
                                 this.frame.height, 0, duration,
                                 function() {self.draw(0)});
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
        let updated = false;
        if (elements.indexOf('devices') >= 0 || elements.indexOf('signals') >= 0) {
            this.updateDevices();
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
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

class ListMapPainter extends MapPainter
{
    constructor(map, canvas)
    {
        super(map, canvas);
    }

    updatePaths()
    {
        for (let i = 0; i < this.map.srcs.length; ++i)
        {
            let src = this.map.srcs[i].position;
            let dst = this.map.dst.position;

            if (Math.abs(src.x - dst.x) < 1)
                this.vertical(src, dst, i);
            else if (Math.abs(src.y - dst.y) < 1)
                this.horizontal(src, dst, i);
            else this.betweenTables(src, dst, i);
        }
    }

    betweenTables(src, dst, i) 
    {
        let mpx = (src.x + dst.x) * 0.5;
        this.pathspecs[i] = [['M', src.x, src.y],
                            ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
    }

    vertical(src, dst, i) 
    {
        // signals are inline vertically
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.y - dst.y) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctlx = src.x + offset * src.vx;
        this.pathspecs[i] = [['M', src.x, src.y], 
                            ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
    }

    horizontal(src, dst, i) 
    {
        // signals are inline horizontally
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.x - dst.x) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctly = src.y + offset * src.vy;
        this.pathspecs[i] = [['M', src.x, src.y],
                            ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }
}
