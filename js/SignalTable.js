'use strict';

// An object for the overall display
class Table {
    constructor(container, location, frame) {
        this.id = location + 'Table';
        this.detail = true;
        this.direction = null;
        this.snap = 'right';
        this.scrolled = 0;
        this.zoomed = 1;

        this.targetHeight = 600;
        this.rowHeight = 0;
        this.regexp = null;

        this.num_devs = 0;
        this.num_sigs = 0;

        this.collapseAll = false;

        this.title = 'SIGNALS';

        // The selected rows, for shift-selecting
        this.selectedRows = {};

        // Create the div containing the table
        $(container).append("<div class='tableDiv' id='"+this.id+"'></div>");
        this.div = $(container).children("#"+this.id);
        this.table;         // The table node itself
        this.tbody;         // The <tbody> node
        this.makeTable();

        this.frame = {'left': location == 'left' ? 0 : frame.width,
                      'top': 0,
                      'width': 0,
                      'height': frame.height, 'angle': 0};
    }

    makeTable() {
        $(this.div).empty();

        // Create the skeleton for the table within the div
        // TODO: move div properties to css
        if (this.detail) {
            $(this.div).append(
                "<div style='height:20px; position:relative; width:100%;'>"+
                    "<div id="+this.id+"Title style='float:left; position:relative; width:75%; padding-left:10px'>"+
                        "<strong>"+this.title+"</strong>"+
                    "</div>"+
                    "<div style='float:left; position:relative; width:25%; padding-left:20px'>"+
                        "<strong>TYPE</strong>"+
                    "</div>"+
                "</div>"+
                "<div id="+this.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<colgroup>"+
                            "<col style='width:75%'>"+
                            "<col style='width:25%'>"+
                        "</colgroup>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        else {
            $(this.div).append(
                "<div style='height: 20px; position:relative; width:100%'>"+
                    "<div id="+this.id+"Title style='float: left; position:relative; width:100%; text-align: center'>"+
                        "<strong>"+this.title+"</strong>"+
                    "</div>"+
                "</div>"+
                "<div id="+this.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        this.table = $("#"+this.id+" .displayTable")[0];
        this.tbody = $("#"+this.id+" .displayTable tbody")[0];

        $('#'+this.id+' tr').hover(function() {
            $(this).toggleClass('hover');
        });
    }

    adjust(left, top, width, height, angle, duration, func) {
        // stop any current animations
        $('#'+this.id).stop(true, false);

        if (left == null)
            left = this.frame.left;
        if (top == null)
            top = this.frame.top;
        if (width == null)
            width = this.frame.width;
        if (height == null)
            height = this.frame.height;
        if (angle == null)
            angle = this.frame.angle;
        if (duration == null)
            duration = 1000;

        let self = this;
        let left_was = this.frame.left;
        let top_was = this.frame.top;
        let width_was = this.frame.width;
        let height_was = this.frame.height;
        let angle_was = this.frame.angle;
        if (angle - angle_was > Math.PI)
            angle_was -= Math.PI * 2;
        else if (angle - angle_was < -Math.PI)
            angle_was += Math.PI * 2;

        $({someValue: 0}).animate({someValue: 1},
                                  {duration: duration * 0.33,
                                  step: function(now, fx) {
            let was = 1 - now;
            self.frame.left = left * now + left_was * was;
            self.frame.top = top * now + top_was * was;
            self.frame.width = width * now + width_was * was;
            self.frame.height = height * now + height_was * was;
            self.frame.angle = angle * now + angle_was * was;
            $('#' + self.id).css({
                'left': self.frame.left,
                'top': self.frame.top,
                'width': self.frame.width,
                'height': self.frame.height,
                'transform-origin': 'top right',
                'WebkitTransform': 'rotate(' + self.frame.angle + 'rad)',
                '-moz-transform': 'rotate(' + self.frame.angle + 'rad)',
                'transform': 'rotate(' + self.frame.angle + 'rad)'
            });
            if (func)
                func();
        }});
    }

    filterByName(string) {
        if (this.filterstring == string)
            return;
        this.filterstring = string;
        this.regexp = string ? new RegExp(this.filterstring, 'i') : null;
        if (this.regexp)
            this.update();
    }

    filterByDirection(dir) {
        if (dir)
            this.direction = (dir == 'both') ? null : dir;
        switch (dir) {
            case 'output':
                dir = 'SOURCES';
                break;
            case 'input':
                dir = 'DESTINATIONS';
                break;
            default:
                dir = 'SIGNALS';
                break;
        }
        $('#'+this.id+'Title>strong').text(dir);
        this.title = dir;
    }

    showDetail(show) {
        if (this.detail == show)
            return;
        this.detail = (show == true);
        this.makeTable(this);
    }

    get height() {
        return this.rowHeight * this.table.rows.length;
    }

    getRowFromIndex(idx) {
        let rowHeight = Math.round(this.rowHeight);
        let j = 0;
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if ($(row).hasClass('invisible'))
                continue;
            if (j < idx) {
                ++j;
                continue;
            }
            if (this.snap == 'bottom') {
                let left = j * rowHeight - this.scrolled + 200;
                let top = row.offsetLeft + this.div[0].offsetTop;
                return {'left': left,
                        'right': left + rowHeight,
                        'top': top,
                        'bottom': top + row.offsetWidth,
                        'width': rowHeight,
                        'height': row.offsetWidth,
                        'x': top + row.offsetWidth,
                        'y': left + rowHeight * 0.5,
                        'vx': Math.cos(this.frame.angle),
                        'vy': Math.sin(this.frame.angle),
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
            else {
                let left = row.offsetLeft + this.div[0].offsetLeft;
                let top = j * rowHeight - this.scrolled + 20 + this.div[0].offsetTop;
                return {'left': left,
                        'right': left + row.offsetWidth,
                        'top': top,
                        'bottom': top + rowHeight,
                        'width': row.offsetWidth,
                        'height': rowHeight,
                        'x': this.snap == 'left' ? left : left + row.offsetWidth,
                        'y': top + rowHeight * 0.5,
                        'vx': Math.cos(this.frame.angle),
                        'vy': Math.sin(this.frame.angle),
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
        }
    }

    getRowFromName(name) {
        let id = name.replace('/', '\\/');
        let rowHeight = Math.round(this.rowHeight);
        let j = 0;
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if (row.id == id) {
                if ($(row).hasClass('invisible')) {
                    if (name.indexOf('/') != -1)
                        return this.getRowFromName(name.split('/')[0]);
                    else
                        return null;
                }
                if (this.snap == 'bottom') {
                    let left = j * rowHeight - this.scrolled;
                    let top = row.offsetLeft;
                    return {'left': left,
                            'top': top,
                            'width': rowHeight,
                            'height': row.offsetWidth,
                            'x': left + rowHeight * 0.5,
                            'y': top + row.offsetWidth,
                            'vx': Math.cos(this.frame.angle),
                            'vy': Math.sin(this.frame.angle),
                            'id': row.id.replace('\\/', '\/'),
                            'type': $(row).hasClass('device') ? 'device' : 'signal',
                            'index': j};
                }
                else {
                    let left = row.offsetLeft;
                    let top = j * rowHeight - this.scrolled + 20;
                    return {'left': left,
                            'top': top,
                            'width': row.offsetWidth,
                            'height': rowHeight,
                            'x': this.snap == 'left' ? left : left + row.offsetWidth,
                            'y': top + rowHeight * 0.5,
                            'vx': Math.cos(this.frame.angle),
                            'vy': Math.sin(this.frame.angle),
                            'id': row.id.replace('\\/', '\/'),
                            'type': $(row).hasClass('device') ? 'device' : 'signal',
                            'index': j};
                }
                break;
            }
            else if (!$(row).hasClass('invisible'))
                ++j;
        }
    }

    getRowFromPosition(x, y, margin) {
        if (x == null || y == null)
            return;
        if (!margin)
            margin = 100;
        switch (this.snap) {
            case 'left':
                if (x < this.frame.left - this.frame.width * margin)
                    return;
                x = this.div[0].offsetLeft + this.div[0].offsetWidth * 0.5;
                break;
            case 'right':
                if (x > this.frame.left + this.frame.width * (1 + margin))
                    return;
                x = this.div[0].offsetLeft + this.div[0].offsetWidth * 0.5;
                break;
            case 'bottom':
                if (y > this.frame.top + this.frame.height * (1 + margin))
                    return;
                y = this.div[0].offsetTop + 50;
                break;
            default:
                console.log("unknown table snap property", this.snap);
                return;
        }

        let td = document.elementFromPoint(x, y);
        let row = $(td).parents('tr');
        let rowHeight = Math.round(this.rowHeight);
        row = row[0];
        let output;
        if (this.snap == 'bottom') {
            let left = row.offsetTop - this.scrolled;
            let top = row.offsetLeft;
            output = {'left': left,
                      'top': top,
                      'width': rowHeight,
                      'height': row.offsetWidth,
                      'x': left + rowHeight * 0.5,
                      'y': top + row.offsetWidth,
                      'vx': Math.cos(this.frame.angle),
                      'vy': Math.sin(this.frame.angle),
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
        else {
            let left = this.frame.left;
            let top = row.offsetTop - this.scrolled + 20;
            output = {'left': left,
                      'top': top,
                      'width': row.offsetWidth,
                      'height': rowHeight,
                      'x': this.snap == 'left' ? left : left + this.frame.width,
                      'y': top + rowHeight * 0.5,
                      'vx': this.snap == 'left' ? -Math.cos(this.frame.angle) : Math.cos(this.frame.angle),
                      'vy': Math.sin(this.frame.angle),
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
//        console.log('output', output);
        return output;
    }

    highlightRow(row, clear) {
        if (clear)
            $('#'+this.id+' tr').removeClass('trsel');
        if (row && row.id) {
            let dom_row = document.getElementById(row.id.replace('\/', '\\/'));
            if (dom_row)
                $(dom_row).addClass('trsel');
        }
    }

    pan(dx, dy, x, y) {
        if (!dx && !dy)
            return false;
        if (this.snap == "bottom") {
            // rotated 90deg: invert x and y
            let temp = x;
            x = y;
            y = temp;
        }
        if (x != null && y != null) {
            // check if position applies to this table
            if (   x < this.div[0].offsetLeft
                || x > this.div[0].offsetLeft + this.div[0].offsetWidth
                || y < this.div[0].offsetTop
                || y > this.div[0].offsetTop + this.div[0].offsetHeight) {
                return false;
            }
        }
        let delta = (this.snap == 'bottom') ? dx : dy;
        let new_scroll = this.scrolled + delta;
        this.scrolled = $("#"+this.id+"Scroller")
            .scrollTop(new_scroll)
            .scrollTop();
        if (this.scrolled == Math.floor(new_scroll)) {
            // keep fractional part
            this.scrolled = new_scroll;
        }
        return true;
    }

    adjustRowHeight() {
        // adjust row heights to fill table
        let natRowHeight = this.targetHeight / (this.num_devs + this.num_sigs);
        if (natRowHeight > 19) {
            // don't allow zoom < 1
            if (this.zoomed < 1)
                this.zoomed = 1;
        }
        let rowHeight = natRowHeight * this.zoomed;
        if (rowHeight < 19) {
            rowHeight = 19;
            this.zoomed = rowHeight / natRowHeight;
        }
        let changed = (Math.round(rowHeight) != Math.round(this.rowHeight));
        this.rowHeight = rowHeight;
        if (changed)
            $("#"+this.id+' tbody tr').css('height', this.rowHeight+'px');
        return changed;
    }

    zoom(delta, x, y, constrain) {
        if (!delta)
            return false;
        if (this.snap == "bottom") {
            // rotated 90deg: invert x and y
            let temp = x;
            x = y;
            y = temp;
        }
        if (constrain && x != null && y != null) {
            // check if position applies to this table
            if (   x < this.div[0].offsetLeft
                || x > this.div[0].offsetLeft + this.div[0].offsetWidth
                || y < this.div[0].offsetTop
                || y > this.div[0].offsetTop + this.div[0].offsetHeight)
                return null;
        }
        this.zoomed -= delta * 0.01;
        if (this.zoomed < 0.1)
            this.zoomed = 0.1;
        else if (this.zoomed > 20)
            this.zoomed = 20;

        let oldRowHeight = this.rowHeight;
        let changed = this.adjustRowHeight();
        if (!changed)
            return false;

        let offset = (this.snap == 'bottom') ? x - this.table.offsetLeft : y - 80;
        offset -= 20;   // column headers

        // old offset in rows
        let normOffset = (Math.floor(this.scrolled) + offset) / Math.round(oldRowHeight);
        let rowDiff = Math.round(this.rowHeight) - Math.round(oldRowHeight);
        this.pan(rowDiff * normOffset, rowDiff * normOffset);

        return true;
    }

    update(devices, targetHeight) {
        if (targetHeight)
            this.targetHeight = targetHeight - 20; // headers

        // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
        function toFixed_alt(value, precision) {
            var power = Math.pow(10, precision || 0);
            return String(Math.round(value * power) / power);
        }

        $(this.tbody).empty();
        let tbody = this.tbody;
        let num_devs = 0;
        let num_sigs = 0;
        let dir = this.direction;
        let id = this.id;
        let detail = this.detail;
        let regexp = this.regexp;
        let collapseAll = this.collapseAll;
        let collapse_bit;
        switch (this.snap) {
            case 'right':
                collapse_bit = 1;
                break;
            case 'left':
                collapse_bit = 2;
                break;
            default:
                collapse_bit = 4;
                break;
        }
        let title = this.title;

        devices.each(function(dev) {
            let num_dev_sigs = 0;
            let sigs = [];
            dev.signals.each(function(sig) {
                // todo: check for filters
                if (dir) {
                    if (sig.direction != dir)
                        return;
                }
                else if (sig.canvas_object)
                    return;
                if (regexp && !regexp.test(sig.key))
                    return;

                let name = sig.name.replace(/\,/g, '<wbr>/');
                let min = sig.min;
                if (typeof(min) == 'object') {
                    for (i in min)
                        min[i] = toFixed_alt(min[i], 4);
                }
                else if (typeof(min) == 'number')
                    min = toFixed_alt(min, 4);
                min = String(min).replace(/\,/g, '<wbr>, ');
                if (min.indexOf(',') >= 0)
                    min = '[ ' + min + ' ]';

                let max = sig.max;
                if (typeof(max) == 'object') {
                    for (i in max)
                        max[i] = toFixed_alt(max[i], 4);
                }
                else if (typeof(max) == 'number')
                    max = toFixed_alt(max, 4);
                max = String(max).replace(/\,/g, '<wbr>, ');
                if (max.indexOf(',') >= 0)
                    max = '[ ' + max + ' ]';
                let type;
                switch (sig.type) {
                    case 'i':
                        type = 'int';
                        break;
                    case 'f':
                        type = 'float';
                        break;
                    case 'd':
                        type = 'double';
                        break;
                    default:
                        type = '?';
                        break;
                }
                let typelen = sig.length == 1 ? type : type + '[' + sig.length + ']';
                let unit = sig.unit == 'unknown' ? '' : ' ('+sig.unit+')';
                let ioname = (sig.direction == 'input') ? '→'+name : name+'→';

                sigs.push([sig.key.replace('/', '\\/'), ioname, typelen+unit, sig.direction]);
                num_dev_sigs += 1;
            });
            if (num_dev_sigs <= 0)
                return;

            let devname = (collapseAll || (dev.collapsed & collapse_bit)
                           ? ' ▶ ' : '▼  ') + dev.name;
            $(tbody).append("<tr class='device' id="+dev.name+"><th colspan='2'>"+
                            devname+" ("+num_dev_sigs+" "+title.toLowerCase()+")"+
                            "</th></tr>");
            let even = false;
            for (var i in sigs) {
                let new_row = "<tr class='"+sigs[i][3];
                if (even)
                    new_row += " even";
                if (collapseAll || (dev.collapsed & collapse_bit))
                    new_row += " invisible";
                new_row += "' id="+sigs[i][0]+"><td>"+sigs[i][1]+"</td>";
                if (detail)
                    new_row += "<td>"+sigs[i][2]+"</td>";
                new_row += "</tr>";
                $(tbody).append(new_row);
                even = !even;
            }
            if (!collapseAll && !(dev.collapsed & collapse_bit))
                num_sigs += num_dev_sigs;
            num_devs += 1;
        });
        this.num_devs = num_devs;
        this.num_sigs = num_sigs;
        this.adjustRowHeight();
    }
}
