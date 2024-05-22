//++++++++++++++++++++++++++++++++++++++//
//           List View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ListView extends View {
    constructor(frame, tables, canvas, graph, tooltip, pie) {
        super('list', frame, {'left': tables.left, 'right': tables.right},
              canvas, graph, tooltip, pie, ListMapPainter);

        this.setup();
    }

    setup() {
        this.setMapPainter(ListMapPainter);
        this.setTableDrag();

        // set left table properties
        this.tables.left.filterByDirection('OUTGOING');

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.filterByDirection('INCOMING');

        // set global table properties
        for (var i in this.tables) {
            let t = this.tables[i];
            t.hidden = false;
            t.showDetail(true);
            t.expand = false;
            t.filler = false;
            t.scrolled = 0;
            t.zoomed = 1;
            t.update();
        }

        let self = this;
        this.graph.devices.forEach(function(dev) {
            dev.signals.forEach(remove_object_svg);
            if (!dev.view)
                return;
            dev.view.unhover();
            remove_object_svg(dev);
        });

        this.tables.left.resizeHandler = function() {self.drawMaps()};
        this.tables.right.resizeHandler = function() {self.drawMaps()};

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
            this.drawMaps(0);
    }

    zoom(x, y, delta) {
        if (this.tableZoom(x, y, delta))
            this.drawMaps();
    }

    cleanup() {
        super.cleanup();

        let self = this;
        this.graph.devices.forEach(function(dev) {
            dev.signals.forEach(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
            // try looking up device <td> positions in left and right tables
            let path = [];
            let width = 40;
            let td = $("#leftTableScroller td[id='"+dev.name+"']");
            if (td.length) {
                path.push(['M', self.frame.width * 0.4, td[0].offsetTop + td[0].offsetHeight],
                          ['l', 0, -td[0].offsetHeight]);
                width = td[0].offsetWidth;
            }
            td = $("#rightTableScroller td[id='"+dev.name+"']");
            if (td.length) {
                path.push(['M', self.frame.width * 0.6, td[0].offsetTop],
                          ['l', 0, td[0].offsetHeight]);
                width = td[0].offsetWidth;
            }
            if (path.length) {
                if (!dev.view)
                    dev.view = self.canvas.path();
                dev.view.attr({ 'path': path,
                                'stroke-width': 0 });
            }
        });
    }
}

class ListMapPainter extends MapPainter
{
    constructor(map, canvas, frame, graph)
    {
        super(map, canvas, frame, graph);
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
        else
            this.betweenTables(src, dst, i);
    }

    betweenTables(src, dst, i, dstPos)
    {
        let mpx = this.frame.cx;
        if (src.isnode)
            mpx = dstPos ? dst.x : (src.x + dst.x) * 0.5;

        if (dst.isnode == true) {
            let offset = 50;
            this.pathspecs[i] = [['M', src.x, src.y],
                                 ['C', mpx, src.y, dst.x + dst.vx * offset, dst.y, dst.x, dst.y]];
        }
        else {
            this.pathspecs[i] = [['M', src.x, src.y],
                                 ['C', mpx, src.y, mpx, dst.y, dst.x, dst.y]];
        }
    }

    vertical(src, dst, i) 
    {
        // signals are inline vertically
        let offset = this.offset(src.y, dst.y);
        let ctlx = src.x + offset * src.vx;
        this.pathspecs[i] = [['M', src.x, src.y], 
                             ['C', ctlx, src.y, ctlx, dst.y, dst.x, dst.y]];
    }

    offset(a, b, minoffset = 30, maxoffset = 200)
    {
        let offset = Math.abs(a - b) * 0.5;
        if (offset > maxoffset) offset = maxoffset;
        if (offset < minoffset) offset = minoffset;
        return offset;
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
                if (this.map.srcs[i].hidden)
                    this.attributes[i]['stroke'] = 'none';
                this.attributes[i]['arrow-end'] = 'none';
            }

            if (hidden)
            {
                this.attributes[i].stroke = 'none';
                this.attributes[i+1].stroke = 'none';
            }
            else
            {
                this.attributes[i+1].fill = (this.map.selected
                                             ? MapPainter.selectedColor
                                             : MapPainter.defaultColor);
                this.attributes[i+1]['arrow-end'] = 'none'
            }
        }
        else this._defaultAttributes();
    }

    getNodePosition() {
        let offset = 50;
        let dst = this.map.dst.position;
        return {x: dst.x + dst.vx * offset, y: dst.y, vx: dst.vx, vy: 0, isnode: 1};
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
