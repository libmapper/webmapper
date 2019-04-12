//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ListView extends View {
    constructor(frame, tables, canvas, database, tooltip, pie) {
        super('list', frame, {'left': tables.left, 'right': tables.right},
              canvas, database, tooltip, pie, ListMapPainter);

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
    constructor(map, canvas, frame, database)
    {
        super(map, canvas, frame, database);
    }

    updatePaths()
    {
        if (this.map.srcs.length > 1) this.convergent();
        else
        {
            let src = this.map.srcs[0].position;
            let dst = this.map.dst.position;
            this.oneToOne(src, dst, 0);
        }
    }

    oneToOne(src, dst, i)
    {
        // skip maps if src or dst y is zero, due to filtering
        if (!src.y || !dst.y) {
            this.pathspecs[i] = null;
            return;
        }

        if (Math.abs(src.x - dst.x) < 1)
            this.vertical(src, dst, i);
        else if (Math.abs(src.y - dst.y) < 1)
            this.horizontal(src, dst, i);
        else this.betweenTables(src, dst, i);
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
        let offset = this.offset(src.y, dst.y);
        let ctlx = src.x + offset * src.vx;
        this.pathspecs[i] = [['M', src.x, src.y], 
                            ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
    }

    horizontal(src, dst, i) 
    {
        // signals are inline horizontally
        let offset = this.offset(src.x, dst.x);
        let ctly = src.y + offset * src.vy;
        this.pathspecs[i] = [['M', src.x, src.y],
                            ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }

    offset(a, b, minoffset = 30, maxoffset = 200)
    {
        let offset = Math.abs(a - b) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        return offset;
    }

    convergent()
    {
        let dst = this.map.dst.position;
        let srcs = this.map.srcs.map(src => src.position);
        if (srcs.map(src => Math.abs(src.x - dst.x) < 1).every(b => b))
            this.convergent_vertical();
        else if (srcs.map(src => Math.abs(src.y - dst.y) < 1).every(b => b))
            this.convergent_horizontal();
        else this.convergent_betweenTables();
    }

    convergent_betweenTables()
    {
        let node = this.getNodePosition();
        let i = 0;
        for (; i < this.map.srcs.length; ++i)
        {
            if (this.map.srcs[i].hidden) 
            {
                this.pathspecs[i] = null;
                continue;
            }
            let src = this.map.srcs[i].position;
            this.betweenTables(src, node, i);
        }
        this.betweenTables(node, this.map.dst.position, i);

        if (node !== null) this.pathspecs[i+1] = this.circle_spec(node.x, node.y);
        else this.pathspecs[i+1] = null;
    }

    convergent_horizontal()
    {
        let src, dst = this.map.dst.position;
        let i = 0;
        for (; i < this.map.srcs.length; ++i)
        {
            if (this.map.srcs[i].hidden) 
            {
                this.pathspecs[i] = null;
                continue;
            }
            src = this.map.srcs[i].position;
            this.horizontal(src, dst, i);
        }
        this.horizontal(src, dst, i);

        let furthest_src = null;
        let furthest_dist = Number.NEGATIVE_INFINITY;
        for (let s of this.map.srcs)
        {
            let src = s.position;
            let dist = Math.abs(src.x - dst.x);
            if (dist > furthest_dist || furthest_src === null)
            {
                furthest_src = src;
                furthest_dist = dist;
            }
        }
        let offset = this.offset(furthest_src.x, dst.x) / 4;
        this.pathspecs[i+1] = this.circle_spec(dst.x, dst.y + offset * dst.vy);
    }

    convergent_vertical()
    {
        let src, dst = this.map.dst.position;
        let i = 0;
        for (; i < this.map.srcs.length; ++i)
        {
            if (this.map.srcs[i].hidden) 
            {
                this.pathspecs[i] = null;
                continue;
            }
            src = this.map.srcs[i].position;
            this.vertical(src, dst, i);
        }
        this.vertical(src, dst, i);

        let furthest_src = null;
        let furthest_dist = Number.NEGATIVE_INFINITY;
        for (let s of this.map.srcs)
        {
            let src = s.position;
            let dist = Math.abs(src.y - dst.y);
            if (dist > furthest_dist || furthest_src === null)
            {
                furthest_src = src;
                furthest_dist = dist;
            }
        }
        let offset = 50;
        this.pathspecs[i+1] = this.circle_spec(dst.x + offset * dst.vx, dst.y);
    }

    circle_spec(x, y, radius = 10)
    {
        return [['M', x - radius, y],
                ['A', radius, radius, 0, 0, 0, x + radius, y],
                ['A', radius, radius, 0, 0, 0, x - radius, y],
                ['A', radius, radius, 0, 0, 0, x + radius, y]]; // repeated in case of shortening in e.g. parallel view
    }

    getNodePosition()
    {
        let dst = this.map.dst.position;
        let sigs = this.map.srcs.filter(s => !s.hidden).map(s => s.position);
        if (sigs.length === 0) return null;

        let yavg = sigs.map(s => s.y).reduce((accum, s) => accum + s) / sigs.length;
        let ymin = yavg < dst.y ? yavg : dst.y;
        let ymax = yavg > dst.y ? yavg : dst.y;

        sigs = sigs.concat([dst]);
        let xmin = null;
        let xmax = null;
        for (let s of sigs)
        {
            if (xmin === null || s.x < xmin) xmin = s.x;
            if (xmax === null || s.x > xmax) xmax = s.x;
        }
        if (xmin === null || xmax === null) return null;
        return {x: (xmin + xmax) / 2, y: (ymin + ymax) / 2}
    }

    updateAttributes()
    {
        let num_srcs = this.map.srcs.length;
        if (num_srcs > 1)
        {
            let hidden = true;
            this._defaultAttributes(num_srcs + 2);
            let i = 0;
            for (; i < num_srcs; ++i)
            {
                hidden = hidden && this.map.srcs[i].hidden;
                if (this.map.srcs[i].hidden) this.attributes[i]['stroke'] = 'none';
                this.attributes[i]['arrow-end'] = 'none';
            }

            if (hidden)
            {
                this.attributes[i].stroke = 'none';
                this.attributes[i+1].stroke = 'none';
            }
            else
            {
                this.attributes[i+1].fill = this.map.selected ? 
                                            MapPainter.selectedColor : 
                                            MapPainter.defaultColor;
                this.attributes[i+1]['arrow-end'] = 'none'
            }
        }
        else this._defaultAttributes();
    }
}

var ListViewSlices =
[
    {angle: 90, color: 'none', items: [
        ConvergentMappingSlices[0].items[0], 
        ConvergentMappingSlices[1].items[0], 
        ConvergentMappingSlices[2].items[0], 
        ConvergentMappingSlices[3].items[0]
    ]},
    {angle: 270, color: 'none'},
    {angle: 271, color: 'none'},
    {angle: 272, color: 'none'}
];
