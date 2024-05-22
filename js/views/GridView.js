//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GridView extends View {
    constructor(frame, tables, canvas, graph, tooltip, pie) {
        super('grid', frame, {'left': tables.left, 'right': tables.right},
              canvas, graph, tooltip, pie, GridMapPainter);

        this.escaped = false;
        this.leftExpandWidth = 200;
        this.rightExpandWidth = 200;
        this.setup();
    }

    setup() {
        this.setMapPainter(GridMapPainter);
        this.setTableDrag();

        // set left table properties
        this.tables.left.filterByDirection('OUTGOING');

        // set right table properties
        this.tables.right.snap = 'bottom';
        this.tables.right.filterByDirection('INCOMING');

        // set global table properties
        for (var i in this.tables) {
            let t = this.tables[i];
            t.hidden = false;
            t.showDetail(false);
            t.expand = true;
            t.filler = true;
            t.scrolled = 0;
            t.zoomed = 1;
        }

        let self = this;
        this.graph.devices.forEach(function(dev) {
            dev.signals.forEach(remove_object_svg);
            remove_object_svg(dev);
        });

        this.tables.left.resizeHandler = function() {
            if (self.tables.left.expandWidth != self.leftExpandWidth) {
                self.leftExpandWidth = self.tables.left.expandWidth;
                self.resize(null, 500);
            }
            self.drawMaps(0);
        };
        this.tables.right.resizeHandler = function() {
            if (self.tables.right.expandWidth != self.rightExpandWidth) {
                self.rightExpandWidth = self.tables.right.expandWidth;
                self.resize(null, 500);
            }
            self.drawMaps(0);
        };

        this.update();
        this.resize(null, 500);

        // move svg canvas to front
        $('#svgDiv').css({'position': 'relative', 'z-index': 2});
    }

    _resize(duration) {
        let self = this;
        this.tables.left.adjust(0, this.rightExpandWidth-6, this.leftExpandWidth,
                                this.frame.height - this.rightExpandWidth + 6,
                                0, duration, null, 0, this.frame.width);
        this.tables.right.adjust(this.leftExpandWidth-6, this.rightExpandWidth,
                                 this.rightExpandWidth,
                                 this.frame.width - this.leftExpandWidth + 6,
                                 -Math.PI * 0.5, duration,
                                 function() {self.draw(500)},
                                 this.rightExpandWidth-this.frame.height,
                                 this.frame.height);
        this.mapPane.left = this.leftExpandWidth;
        this.mapPane.width = this.frame.width - this.leftExpandWidth;
        this.mapPane.top = this.rightExpandWidth;
        this.mapPane.height = this.frame.height - this.rightExpandWidth;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.mapPane.top + this.mapPane.height * 0.5;

        $('#svgDiv').css({'left': this.mapPane.left,
                          'top': this.mapPane.top});
        $('svg').css({'left': -this.mapPane.left,
                      'top': -this.mapPane.top});
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
            let grow = false;
            if (this.tables.left.expandWidth != this.leftExpandWidth) {
                this.leftExpandWidth = this.tables.left.expandWidth;
                grow = true;
            }
            if (this.tables.right.expandWidth != this.rightExpandWidth) {
                this.rightExpandWidth = this.tables.right.expandWidth;
                grow = true;
            }
            if (grow)
                this.resize(null, 500);
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

        // reposition svg canvas and send to back
        $('#svgDiv').css({'z-index': 0,
                          'left': 0,
                          'top': 0});
        $('svg').css({'left': 0,
                      'top': 0});

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
                path.push(['M', self.leftExpandWidth, self.rightExpandWidth + td[0].offsetTop + td[0].offsetHeight],
                          ['l', 0, -td[0].offsetHeight]);
                width = td[0].offsetWidth;
            }
            td = $("#rightTableScroller td[id='"+dev.name+"']");
            if (td.length) {
                path.push(['M', self.leftExpandWidth + td[0].offsetTop, self.rightExpandWidth],
                          ['l', td[0].offsetHeight, 0]);
                width = td[0].offsetWidth;
            }
            console.log(path);
            if (path.length) {
                if (!dev.view)
                    dev.view = self.canvas.path();
                dev.view.attr({ 'path': path,
                                'stroke-width': 0 });
            }
        });
    }
}

class GridMapPainter extends ListMapPainter
{
    constructor(map, canvas, frame, graph) {super(map, canvas, frame, graph);}

    convergent()
    {
        this.pathspecs = []; // so that there won't be any spare triangles left lying about
        let dst = this.map.dst.position;
        for (let i = 0; i < this.map.srcs.length; ++i)
        {
            let src = this.map.srcs[i].position;
            this.oneToOne(src, dst, i);
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
        let len = this.map.srcs.length;
        let srctodst = src.vx == 1;
        let mid = srctodst ? {x: dst.x, y: src.y} : {x: src.x, y: dst.y};
        let end = srctodst ? {x: dst.x, y: dst.y < src.y ? dst.y : src.y}
                           : {x: dst.x < src.x ? dst.x : src.x, y: dst.y};

        this.pathspecs[i] = [['M', src.x, src.y],
                            ['L', mid.x, mid.y],
                            ['L', end.x, end.y]];

        if (typeof dst.left === 'undefined') // dst is not a table row (i.e. user is making a map)
        {
            return;
        }

        let stroke = this.attributes[i+len]['stroke-width'];
        if (srctodst) this.pathspecs[i+len] = 
            [['M', dst.x, src.top + stroke + 1],
             ['L', dst.left + stroke, src.top + src.height - stroke + 2],
             ['l', dst.width - stroke - 2, 0],
             ['Z']]

        else this.pathspecs[i+len] =
            [['M', src.left + stroke, dst.y],
             ['L', src.left + src.width - stroke + 2, dst.top + stroke],
             ['l', 0, dst.height - stroke - 2],
             ['Z']];
    }

    horizontal(src, dst, i)
    {
        // signals are inline horizontally
        let offset = this.offset(src.x, dst.x);
        let ctly = src.y + offset * src.vy;
        console.log('horizontal, ctly=', ctly, offset, src.vy);
        this.pathspecs[i] = [['M', src.x, src.y],
                             ['C', src.x, ctly, dst.x, ctly, dst.x, dst.y]];
    }

    // disable drawing convergent maps in grid view for now
    updatePaths()
    {
        let i = 0, len = this.map.srcs.length;
        let dst = this.map.dst.position;
        for (; i < len; i++) {
            this.oneToOne(this.map.srcs[i].position, dst, i);
        }
    }

    updateAttributes()
    {
        let len = this.map.srcs.length;
        this._defaultAttributes(2*len);

        for (let i = 0; i < len; ++i)
        {
            this.attributes[i+len]['stroke-dasharray'] = MapPainter.defaultDashes;
            this.attributes[i+len]['arrow-end'] = 'none';
            this.attributes[i+len]['stroke-linejoin'] = 'round';
            this.attributes[i+len]['fill'] = (this.map.selected
                                              ? MapPainter.selectedColor
                                              : MapPainter.defaultColor );

            let src = this.map.srcs[i].position;
            let dst = this.map.dst.position;
            if (src.x == dst.x || src.y == dst.y) continue;
            else this.attributes[i]['arrow-end'] = 'none';
        }
    }
}
