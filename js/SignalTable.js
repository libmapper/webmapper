'use strict';

// An object for the overall display
class SignalTable {
    constructor(container, location, frame, database) {
        this.database = database;
        this.location = location;
        this.id = location + 'Table';
        this.detail = true;
        this.direction = null;
        this.snap = 'right';
        this.expand = false;
        this.scrolled = 0;
        this.zoomed = 1;

        this.targetHeight = 600;
        this.rowHeight = 0;
        this.regexp = null;

        this.num_devs = 0;
        this.num_sigs = 0;

        this.collapseAll = false;
        this.expandWidth = 0;

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
        $(this.div).append(
            "<div style='height: 20px; position:relative; width:100%'>"+
                "<div id="+this.id+"Title style='text-align:center; position:relative; width:100%; padding-left:20px; padding-right:20px'>"+
                    "<strong>"+this.title+"</strong>"+
                "</div>"+
            "</div>"+
            "<div id="+this.id+"Scroller style='height:calc(100% - 20px); width:100%; position:relative; overflow:auto'>"+
                "<table class='displayTable "+this.location+"'>"+
                    "<tbody></tbody>"+
                "</table>"+
            "</div>");
        this.table = $("#"+this.id+" .displayTable")[0];
        this.tbody = $("#"+this.id+" .displayTable tbody")[0];

        $('#'+this.id+' tr').hover(function() {
            $(this).toggleClass('hover');
        });
    }

    adjust(left, top, width, height, angle, duration, func, innerLeft, innerWidth) {
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
                'transform-origin': 'top left',
                'WebkitTransform': 'rotate(' + self.frame.angle + 'rad)',
                '-moz-transform': 'rotate(' + self.frame.angle + 'rad)',
                'transform': 'rotate(' + self.frame.angle + 'rad)',
                'text-align': self.frame.angle ? 'right' : 'left'
            });

            if (innerLeft != null && innerWidth != null) {
                $('#' + self.id + 'Scroller').css({
                    'left': innerLeft ? innerLeft : 0,
                    'top': 0,
                    'width': innerWidth ? innerWidth : '100%',
                    'height': self.frame.height - 20,
                });
            }
            if (func)
                func();
        }});
        $('#'+this.id+'Title').css('float', (angle == 0) ? 'left' : 'right');
        this.targetHeight = height - 20;
    }

    filterByName(string) {
        if (this.filterstring == string)
            return;
        this.filterstring = string;
        this.regexp = string ? 
            new RegExp(this.filterstring, 'i') : 
            new RegExp('.*');
        this.update();
        return true;
    }

    filterByDirection(dir) {
        if (dir)
            this.direction = (dir == 'both') ? null : dir;
        switch (dir) {
            case 'output':
                dir = 'SRC';
                break;
            case 'input':
                dir = 'DST';
                break;
            default:
                dir = 'SIGS';
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
            if ($(row).hasClass('invisible')) {
                continue;
            }
            if (j < idx) {
                ++j;
                continue;
            }
            if (this.snap == 'bottom') {
                let left = j * rowHeight - this.scrolled + this.frame.left + 20;
                let top = this.frame.top - this.frame.width;
                return {'left': left,
                        'right': left + rowHeight,
                        'top': top,
                        'bottom': top + this.frame.width,
                        'width': rowHeight,
                        'height': this.frame.width,
                        'x': left + rowHeight * 0.5,
                        'y': top + this.frame.width,
                        'vx': Math.cos(this.frame.angle),
                        'vy': -Math.sin(this.frame.angle),
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
            else {
                let left = row.offsetLeft + this.div[0].offsetLeft;
                let top = j * rowHeight - this.scrolled + 20 + this.frame.top;
                let snap = this.snap == 'left' ? -1 : 1;
                return {'left': left,
                        'right': left + row.offsetWidth,
                        'top': top,
                        'bottom': top + rowHeight,
                        'width': this.frame.width,
                        'height': rowHeight,
                        'x': this.snap == 'left' ? this.frame.left : this.frame.left + this.frame.width,
                        'y': top + rowHeight * 0.5,
                        'vx': Math.cos(this.frame.angle) * snap,
                        'vy': Math.sin(this.frame.angle),
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
        }
    }

    getRowFromName(name) {
        let id = name.replace('\/', '\\/');
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
                    let left = j * rowHeight - this.scrolled + this.frame.left + 20;
                    let top = this.frame.top - this.frame.width;
                    return {'left': left,
                            'top': top,
                            'width': rowHeight,
                            'height': row.offsetWidth,
                            'x': left + rowHeight * 0.5,
                            'y': top + this.frame.width,
                            'vx': Math.cos(this.frame.angle),
                            'vy': -Math.sin(this.frame.angle),
                            'id': row.id.replace('\\/', '\/'),
                            'type': $(row).hasClass('device') ? 'device' : 'signal',
                            'index': j};
                }
                else {
                    let left = row.offsetLeft + this.div[0].offsetLeft;
                    let top = j * rowHeight - this.scrolled + 20 + this.frame.top;
                    let snap = this.snap == 'left' ? -1 : 1;
                    return {'left': left,
                            'top': top,
                            'width': this.frame.width,
                            'height': rowHeight,
                            'x': this.snap == 'left' ? this.frame.left : this.frame.left + this.frame.width,
                            'y': top + rowHeight * 0.5,
                            'vx': Math.cos(this.frame.angle) * snap,
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

    getRowFromPosition(x, y, snapRatio) {
        if (x == null || y == null)
            return;
        if (!snapRatio)
            snapRatio = 100;
        switch (this.snap) {
            case 'left':
                if (x < this.frame.left - this.frame.width * snapRatio)
                    return;
                x = this.div[0].offsetLeft + this.div[0].offsetWidth * 0.1;
                break;
            case 'right':
                if (x > this.frame.left + this.frame.width * (1 + snapRatio))
                    return;
                x = this.div[0].offsetLeft + this.div[0].offsetWidth - 2;
                break;
            case 'bottom':
                let yoffset = $(this.div[0]).offset().top;
                if (y > yoffset + this.frame.width * (1 + snapRatio))
                    return;
                y = yoffset + this.frame.width - 2;
                break;
            default:
                console.log("unknown table snap property", this.snap);
                return;
        }

        let td = document.elementFromPoint(x, y);
        let row = $(td).parents('tr');
        let rowHeight = Math.round(this.rowHeight);
        row = row[0];
        if (!row) {
            console.log("error retrieving row");
            return;
        }

        let output;
        if (this.snap == 'bottom') {
            let left = row.offsetTop - this.scrolled + this.frame.left + 20;
            let top = row.offsetLeft;
            output = {'left': left,
                      'top': top,
                      'width': rowHeight,
                      'height': row.offsetWidth,
                      'x': left + rowHeight * 0.5,
                      'y': top + this.frame.width,
                      'vx': Math.cos(this.frame.angle),
                      'vy': -Math.sin(this.frame.angle),
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
        else {
            let left = row.offsetLeft + this.div[0].offsetLeft;
            let top = row.offsetTop - this.scrolled + 20 + this.frame.top;
            let snap = this.snap == 'left' ? -1 : 1;
            output = {'left': left,
                      'top': top,
                      'width': this.frame.width,
                      'height': rowHeight,
                      'x': this.snap == 'left' ? this.frame.left : this.frame.left + this.frame.width,
                      'y': top + rowHeight * 0.5,
                      'vx': Math.cos(this.frame.angle) * snap,
                      'vy': Math.sin(this.frame.angle),
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
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
        if (natRowHeight > 17) {
            // don't allow zoom < 1
            if (this.zoomed < 1)
                this.zoomed = 1;
        }
        let rowHeight = natRowHeight * this.zoomed;
        if (rowHeight < 17) {
            rowHeight = 17;
            this.zoomed = rowHeight / natRowHeight;
        }
        let changed = (Math.round(rowHeight) != Math.round(this.rowHeight));
        if (changed) {
            this.rowHeight = $("#"+this.id+' tbody tr')
                                .css('height', rowHeight+'px')
                                .height();
        }
        return changed;
    }

    zoom(delta, x, y, constrain) {
        if (!delta)
            return false;
        if (this.snap == "bottom") {
            // rotated 90deg: invert x and y
            let temp = x;
            x = y + this.frame.left;
            y = temp;
        }
        if (constrain && x != null && y != null) {
            // check if position applies to this table
            if (   x < this.frame.left
                || x > this.frame.left + this.frame.width
                || y < this.frame.top
                || y > this.frame.top + this.frame.height)
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

//        let offset = (this.snap == 'bottom') ? x - this.table.offsetLeft : y - 80;
//        offset -= 20;   // column headers
        let offset = y - 20;
        if (this.snap == 'bottom')
            offset -= this.frame.left;
        else
            offset -= this.frame.top;

        // old offset in rows
        let normOffset = (Math.floor(this.scrolled) + offset) / Math.round(oldRowHeight);
        let rowDiff = Math.round(this.rowHeight) - Math.round(oldRowHeight);
        this.pan(rowDiff * normOffset, rowDiff * normOffset);

        return true;
    }

    update(targetHeight) {
        if (targetHeight)
            this.targetHeight = targetHeight - 20; // headers

        $(this.tbody).empty();
        let _self = this;
        let num_devs = 0;
        let num_sigs = 0;
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

        var max_depth = 0;
        var tree = {"branches": {}, "num_branches": 0};
        this.database.devices.each(function(dev) {
            if (_self.direction == 'output' && dev.num_outputs < 1) return;
            else if (_self.direction == 'input' && dev.num_inputs < 1) return;

            let num_dev_sigs = 0;
            let sigs = [];

            function hide(sig) {
                sigs.push({
                    id: sig.key.replace('/', '\\/'), 
                    invisible: true
                });
            }

            function ignore(sig) {}

            function add(sig) {
                let name = sig.name.replace(/\,/g, '<wbr>/');
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

                sigs.push({
                    id: sig.key,
                    name: name,
                    unit: typelen+unit, 
                    direction: sig.direction,
                    color: dev.color
                });

                num_dev_sigs += 1;
            }

            dev.signals.each(function(sig) {
                // todo: check for filters
                if (_self.direction) {
                    if (sig.direction != _self.direction) 
                        return ignore(sig);
                }
                if (sig.canvas_object)
                    return ignore(sig);
                if (_self.regexp && !_self.regexp.test(sig.key))
                    return hide(sig);
                add(sig);
            });

            // sort signals by key (for now)
            sigs.sort(function(a, b) {
                a = a.name;
                b = b.name;
                return a < b ? -1 : (a > b ? 1 : 0);
            });

            function print_tree(foo, indent) {
                let spaces = "";
                for (i = 0; i < indent; i++)
                    spaces += " ";
                for (var i in foo.branches) {
                    let leaf = "";
                    if (foo.branches[i].leaf)
                        leaf = "*";
                    console.log(spaces, i, leaf, foo.branches[i].num_branches);
                    print_tree(foo.branches[i], indent+2);
                }
            }

            // add device and signals to the tree
            for (var i in sigs) {
                let sig = sigs[i];
                var t = tree;
                let tokens = sig.id.split('/');
                let len = tokens.length;
                if (len > max_depth)
                    max_depth = len;
                for (var j in tokens) {
                    let b = t.branches;
                    if (b[tokens[j]] == null)
                        b[tokens[j]] = {"branches": {}, "num_branches": 0};
                    t.num_branches += 1;
                    t = b[tokens[j]];
                    // store signal metadata in leaves
                    if (j == len - 1) {
                        t.leaf = sig;
                        t.num_branches += 1;
                    }
                }
            }
//            print_tree(tree, 0);

            if (!_self.collapseAll && !(dev.collapsed & collapse_bit))
                num_sigs += num_dev_sigs;
            num_devs += 1;
        });
        
        // sort branches of tree by key (for now)
        // https://stackoverflow.com/questions/5467129/sort-javascript-object-by-key
        let orderedtree = {"branches": {}, "num_branches": tree.num_branches};
        Object.keys(tree.branches).sort().forEach(function(key) {
            orderedtree.branches[key] = tree.branches[key];
        });

        let devRowType = 'odd';
        let sigRowType = 'odd';
        function add_tree(t, tds, target, depth) {
            let first = true;
            for (var i in t.branches) {
                let b = t.branches[i];
                if (!tds || !first)
                    tds = [[b.num_branches, i]];
                else
                    tds.push([b.num_branches, i]);
                if (b.leaf && !b.leaf.invisible) {
                    if (_self.location != "left")
                        tds = tds.reverse();
                    let line = "";
                    let len = tds.length;
                    for (var j in tds) {
                        let leaf = j == len -1;
                        if (_self.location != "left")
                            leaf = j == 0;
                        if (leaf && _self.expand && _self.location == "right")
                            line += "<td class='"+sigRowType+"' width=100%></td>";
                        line += "<td";
                        if (leaf) {
                            line += " class='leaf "+sigRowType+"'";
                            if (depth < max_depth)
                                line += " colspan="+(max_depth-depth);
                            line += ">"+tds[j][1]+" ("+b.leaf.unit+")</td>";
                            if (_self.expand && _self.location == "left")
                                line += "<td class='"+sigRowType+"' width=100%></td>";
                            sigRowType = (sigRowType == 'odd') ? 'even' : 'odd';
                        }
                        else {
                            line += " rowspan="+tds[j][0]+">";
                            if (tds[j][0] >= tds[j][1].length / 2)
                                line += "<div class=tall>"+tds[j][1]+"</div>";
                            else
                                line += tds[j][1];
                            line += "</td>";
                        }
                    }
                    target.append("<tr class='"+devRowType+"' style='background: "+b.leaf.color+"44' id="+b.leaf.id.replace('\/', '\\/')+">"+line+"</tr>");
                    tds = [[b.num_branches - 1, i]];
                }
                add_tree(b, tds, target, depth + 1);
                if (depth == 0)
                    devRowType = (devRowType == 'odd') ? 'even' : 'odd';
                first = false;
            }
        }
        add_tree(orderedtree, [], $(this.tbody), 0);

        if (this.expand) {
            let tr = $(this.tbody).children('tr')[0];
            let tds = $(tr).children('td');
            if (this.location == 'left') {
                let td = tds[tds.length - 2];
                this.expandWidth = td.offsetLeft + td.offsetWidth;
            }
            else {
                this.expandWidth = 0;
                for (var i = 1; i < tds.length; i++)
                    this.expandWidth += tds[i].offsetWidth;
            }
        }

        this.num_devs = num_devs;
        this.num_sigs = num_sigs;
        this.adjustRowHeight();
    }
}
