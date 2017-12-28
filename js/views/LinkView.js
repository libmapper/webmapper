//++++++++++++++++++++++++++++++++++++++//
//           Link View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class LinkView extends View {
    constructor(frame, tables, canvas, model) {
        super('link', frame, {'left': tables.left, 'right': tables.right},
              canvas, model);

        // set left table properties
        this.tables.left.collapseAll = true;
        this.tables.left.filterByDirection('output');
        this.tables.left.showDetail(false);

        // set right table properties
        this.tables.right.snap = 'left';
        this.tables.right.collapseAll = true;
        this.tables.right.filterByDirection('input');
        this.tables.right.showDetail(false);

        // remove associated svg elements for signals
        model.devices.each(function(dev) {
            dev.signals.each(function(sig) { remove_object_svg(sig); });
        });
        // remove associated svg elements for maps
        model.maps.each(function(map) { remove_object_svg(map); });

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.tables.left.adjust(0, 0, this.frame.width * 0.3,
                                this.frame.height, 0, duration);
        this.tables.right.adjust(this.frame.width * 0.7, 0, this.frame.width * 0.3,
                                 this.frame.height, 0, duration);
        this.mapPane.left = this.frame.width * 0.3;
        this.mapPane.width = this.frame.width * 0.4;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;
        this.draw(duration);
    }

    ratio(array, item) {
        let index = array.indexOf(item);
        return index >= 0 ? index / array.length : 0;
    }

    drawLinks(duration) {
        let lh = this.tables.left.rowHeight;
        let rh = this.tables.right.rowHeight;
        let ls = this.tables.left.scrolled;
        let rs = this.tables.right.scrolled;
        let cx = this.mapPane.cx;

        function ratio(array, item) {
            let index = array.indexOf(item);
            return index >= 0 ? index / array.length : 0;
        }

        let self = this;

        model.links.each(function(link) {
            if (!link.view)
                return;
            link.view.stop();

            let src = link.src;
            let dst = link.dst;
            let lh_frac = lh / src.linkDstIndices.length;
            let lt = ((src.index + ratio(src.linkDstIndices, dst.index)) * lh
                      - self.tables.left.scrolled + 20);
            let rh_frac = rh / dst.linkSrcIndices.length;
            let rt = ((dst.index + ratio(dst.linkSrcIndices, src.index)) * rh
                      - self.tables.right.scrolled + 20);
            let path = [['M', self.mapPane.left, lt],
                        ['C', cx, lt, cx, rt,
                         self.mapPane.left + self.mapPane.width, rt],
                        ['l', 0, rh_frac],
                        ['C', cx, rt + rh_frac, cx, lt + lh_frac,
                         self.mapPane.left, lt + lh_frac],
                        ['Z']];
            link.view.animate({'path': path}, duration, '>');
        });
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'links'];
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
        if (elements.indexOf('links') >= 0)
            this.updateLinks();
        this.draw(1000);
    }

    drawDevices(duration) {
        let self = this;
        model.devices.each(function(dev) {
            if (!dev.view || !dev.tableIndices || !dev.tableIndices.length)
                return;
            dev.view.stop();
            let path = [];
            for (var i in dev.tableIndices) {
                let row = dev.tableIndices[i];
                let pos = self.tables[row.table].getRowFromIndex(row.index);
                if (!pos)
                    continue;
                path.push(['M', pos.left, pos.top],
                          ['l', pos.width, 0],
                          ['l', 0, pos.height],
                          ['l', -pos.width, 0],
                          ['Z']);
            }
            if (path.length) {
                dev.view.toBack();
                dev.view.animate({'path': path,
                                  'fill': dev.color,
                                  'fill-opacity': 0.5,
                                  'stroke-opacity': 0}, duration, '>');
            }
        });
    }

    draw(duration) {
        this.drawDevices(duration);
        this.drawLinks(duration);
    };

    cleanup() {
        super.cleanup();

        // clean up any objects created only for this view
        this.tables.left.collapseAll = false;
        this.tables.right.collapseAll = false;

        this.model.devices.each(function(dev) {
            delete dev.linkSrcIndices;
            delete dev.linkDstIndices;
        });
        this.model.links.each(remove_object_svg);
    }
}
