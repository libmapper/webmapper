//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ListView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('list', frame, {'left': tables.left, 'right': tables.right},
              canvas, database, tooltip, ListMapPainter);

        this.setup();
    }

    setup() {
        this.setMapPainter(ListMapPainter);
        this.setTableDrag();

        // set left table properties
        this.tables.left.filterByDirection('output');

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.filterByDirection('input');

        // set global table properties
        for (var i in this.tables) {
            let t = this.tables[i];
            t.hidden = false;
            t.showDetail(true);
            t.expand = false;
            t.scrolled = 0;
            t.zoomed = 1;
            t.update();
        }

        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(remove_object_svg);
            if (!dev.view)
                return;
            dev.view.unhover();
            remove_object_svg(dev);
        });

        this.tables.left.collapseHandler = function() {self.drawMaps()};
        this.tables.right.collapseHandler = function() {self.drawMaps()};

        this.escaped = false;

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

    pan(x, y, delta_x, delta_y) {
        if (this.tablePan(x, y, delta_x, delta_y))
            this.drawMaps();
    }

    zoom(x, y, delta) {
        if (this.tableZoom(x, y, delta))
            this.drawMaps();
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
        let src = this.map.src.position;
        let dst = this.map.dst.position;

        if (!src.y || !dst.y) {
            this.hide();
            return;
        }
        this.show();

        if (Math.abs(src.x - dst.x) < 1)
            this.vertical(src, dst);
        else if (Math.abs(src.y - dst.y) < 1)
            this.horizontal(src, dst);
        else this.betweenTables(src, dst);
    }

    betweenTables(src, dst) 
    {
        let mpx = (src.x + dst.x) * 0.5;
        this.pathspecs[0] = [['M', src.x, src.y],
                             ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
    }

    vertical(src, dst) 
    {
        // signals are inline vertically
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.y - dst.y) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctlx = src.x + offset * src.vx;
        this.pathspecs[0] = [['M', src.x, src.y], 
                             ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
    }

    horizontal(src, dst) 
    {
        // signals are inline horizontally
        let minoffset = 30;
        let maxoffset = 200;
        let offset = Math.abs(src.x - dst.x) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        let ctly = src.y + offset * src.vy;
        this.pathspecs[0] = [['M', src.x, src.y],
                             ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }
}
