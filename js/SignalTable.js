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

        this.minHeight = 17;

        this.targetHeight = 600;
        this.rowHeight = 0;

        this.num_devs = 0;
        this.num_sigs = 0;
        this.num_hidden_sigs = 0;

        this.resizeHandler = null;
        this.collapseAll = false;
        this.expandWidth = 0;

        this.ignoreCanvasObjects = false;

        this.title = 'SIGS';

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
            "<div id="+this.id+"Title class=tableTitle>"+
                "<strong>"+this.title+"</strong>"+
            "</div>"+
            "<div id="+this.id+"Scroller class=tableScroller>"+
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
                                  {duration: duration,
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

                $('#' + self.id + 'Scroller').css({
                    'left': innerLeft ? innerLeft : 0,
                    'top': 0,
                    'width': innerWidth ? innerWidth : '100%',
                    'height': self.frame.height - 20,
                });

                if (func)
                    func();
            },
            complete: function() {
                $('#'+self.id+'Title').css('float', (angle == 0) ? 'left' : 'right');
                self.updateTitle();
                self.targetHeight = height - 20;
                self.adjustRowHeight();
                if (func)
                    func();
        }});
    }

    filterByName() {
        this.update();
        this.grow();
        if (this.resizeHandler)
            this.resizeHandler();
        return true;
    }

    updateTitle() {
        let title = null;
        switch (this.direction) {
            case 'output':
                title = this.frame.width > 200 ? 'SOURCES' : 'SRC';
                break;
            case 'input':
                title = this.frame.width > 200 ? 'DESTINATIONS' : 'DST';
                break;
            default:
                title = 'SIGS';
                break;
        }
        this.title = title;
        if (!(this.num_sigs + this.num_hidden_sigs) || (this.frame.left + this.frame.width) < 0)
            title = '';
        else if (this.num_hidden_sigs > 0)
            title += " ("+this.num_sigs+" of "+(this.num_sigs + this.num_hidden_sigs)+")";
        else
            title += " ("+this.num_sigs+")";
        $('#'+this.id+'Title>strong').text(title);
    }

    filterByDirection(dir) {
        if (!dir)
            return;
        this.direction = (dir == 'both') ? null : dir;
        this.updateTitle();
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

    getRowFromName(id) {
        let self = this;

        function getTD() {
            let td = $("#"+self.id+" td[id='"+id+"']");
            if (!td.length) return null;

            let tr = $(td).parents('tr')[0];
            if ($(td).hasClass('invisible')) {
                // find last visible row
                let tr = $(td).parents('tr')[0];
                while ($(tr).hasClass('invisible')) {
                    tr = $(tr).prev();
                }
                if (!tr.length)
                    return null;
                td = $(tr).children('td').not('.filler, .invisible');
                if (self.location == 'left')
                    td = $(td).last();
                else
                    td = $(td).first();
            }
            return $(td);
        }

        if (getTD() == null) return null;

        if (this.snap == 'bottom') {
            //pos.left += this.frame.left + 20;
            return {get left(){ return getTD().position().left + self.frame.left + 20},
                    top: 0,
                    get width() {return getTD().height()},
                    get height() {return self.frame.width},
                    get x() {let td = getTD(); return td ? td.position().left + self.frame.left + 20 + td.height() * 0.5 : null},
                    get y() {return self.frame.width},
                    get vx() {return Math.cos(self.frame.angle)},
                    get vy() {return -Math.sin(self.frame.angle)},
                    id: id};
        }
        else {
            //pos.top += this.frame.top + 20;
            //pos.left = this.frame.left;
            let snap = this.snap == 'left' ? -1 : 1;
            return {get left() {return self.frame.left;},
                    get top() {return getTD().position().top + self.frame.top + 20;},
                    get width() {return self.frame.width},
                    get height() {return getTD().height();},
                    get x() {return self.snap == 'left' ? self.frame.left : self.frame.left + self.frame.width},
                    get y() {let td = getTD(); return td ? td.position().top + self.frame.top + 20 + td.height() * 0.5 : null},
                    get vx() {return Math.cos(self.frame.angle) * snap},
                    get vy() {return -Math.sin(self.frame.angle)},
                    id: id};
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
                x = this.div[0].offsetLeft + 20;
                break;
            case 'right':
                if (x > this.frame.left + this.frame.width * (1 + snapRatio))
                    return;
                x = this.div[0].offsetLeft + this.div[0].offsetWidth - 20;
                break;
            case 'bottom':
                let yoffset = $(this.div[0]).offset().top;
                if (y > yoffset + this.frame.width * (1 + snapRatio))
                    return;
                y = yoffset + this.frame.width - 20;
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
                      'id': row.id,
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
                      'id': row.id,
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
        return output;
    }

    highlightRow(row, clear) {
        if (clear)
            $('#'+this.id+' td').removeClass('tdsel');
        if (row && row.id) {
            let id = row.id.split('/');
            let first = true;
            while (id.length) {
                let sel = $("#"+this.id+" td[id='"+id.join('/')+"'");
                if (first)
                    sel = $(sel).filter('.leaf');
                else
                    sel = $(sel).not('.leaf');
                $(sel).addClass('tdsel');
                id.pop();
                first = false;
            }
        }
    }

    pan(dx, dy, x, y) {
        if (!dx && !dy)
            return false;
        if (x != null && y != null) {
            // check if position applies to this table
            if (x < this.frame.left)
                return false;
            if (this.snap == 'bottom') {
                if (x > this.frame.left + this.frame.height)
                    return false;
                if (y > this.frame.top || y < this.frame.top - this.frame.width)
                    return false;
            }
            else {
                if (x > this.frame.left + this.frame.width)
                    return false;
                if (y < this.frame.top || y > this.frame.top + this.frame.height)
                    return false;
            }
        }
        if (this.snap == "bottom") {
            // rotated 90deg: invert x and y
            let temp = x;
            x = y;
            y = temp;
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
        if (natRowHeight > this.minHeight) {
            // don't allow zoom < 1
            if (this.zoomed < 1)
                this.zoomed = 1;
        }
        let rowHeight = natRowHeight * this.zoomed;
        if (rowHeight < this.minHeight) {
            rowHeight = this.minHeight;
            this.zoomed = rowHeight / natRowHeight;
        }
        let changed = (Math.round(rowHeight) != Math.round(this.rowHeight));
        if (changed) {
            this.rowHeight = $("#"+this.id+' tbody tr')
                                .css('height', rowHeight+'px')
                                .height();
//            let self = this;
//            $("#"+this.id+" td").each(function(td) { self.autoRotate(this); });
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

    grow() {
        if (this.expand) {
            let tr = $("#"+this.id+" tr")[0];
            let tds = $(tr).children('td').not('.invisible');
            this.expandWidth = 0;
            if (this.location == 'left') {
                for (var i = 0; i < tds.length - 1; i++)
                    this.expandWidth += tds[i].offsetWidth;
            }
            else {
                for (var i = 1; i < tds.length; i++)
                    this.expandWidth += tds[i].offsetWidth;
            }
        }
    }

    autoRotate(td) {
        if ($(td).hasClass('leaf')) {
            return;
        }
        let id = $(td).attr('id');
        if (!id)
            return;
        let text = id.split('/').slice(-1)[0];
        let h = td.offsetHeight;
        let w = textWidth(text);
        if (w > this.minHeight && w < h) {
            $(td).addClass('tall');
            $(td).empty().append("<div>"+text+"</div>");
        }
        else {
            $(td).removeClass('tall');
            $(td).empty().append(text);
        }
    }

    update(targetHeight) {
        if (this.hidden)
            return;
        if (targetHeight)
            this.targetHeight = targetHeight - 20; // headers

        $(this.tbody).empty();
        let _self = this;
        let num_devs = 0;
        let num_sigs = 0;
        let num_hidden_sigs = 0;
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
        var tree = {"branches": {}, "num_leaves": 0};
        this.database.devices.each(function(dev) {
            if (dev.hidden) return;
            if (_self.direction == 'output' && dev.num_outputs < 1) return;
            else if (_self.direction == 'input' && dev.num_inputs < 1) return;

            let num_dev_sigs = 0;
            let sigs = [];

            function hide(sig) {
                sigs.push({
                    id: sig.key,
                    invisible: true
                });
                num_hidden_sigs += 1;
            }

            function ignore(sig) {}

            function add(sig) {
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
                    name: sig.name,
                    unit: typelen+unit, 
                    direction: sig.direction,
                    color: Raphael.hsl(dev.hue, 1, 0.5)
                });

                num_dev_sigs += 1;
            }

            dev.signals.each(function(sig) {
                if (sig.canvasObject && _self.ignoreCanvasObjects)
                    return ignore(sig);
                if (_self.direction &&  _self.direction != sig.direction)
                    return ignore(sig);
                let re = sig.direction == 'output' ? _self.database.srcRE : _self.database.dstRE;
                if (re && !re.test(sig.key))
                    return hide(sig);
                add(sig);
            });

            function print_tree(t, indent) {
                let spaces = "";
                for (i = 0; i < indent; i++)
                    spaces += " ";
                for (var i in t.branches) {
                    let b = t.branches[i];
                    let leaf = "";
                    if (b.leaf)
                        leaf = "*";
                    console.log(spaces, i, leaf, b.num_leaves, b.oscpath);
                    print_tree(b, indent+2);
                }
            }

            // add device and signals to the tree
            for (var i in sigs) {
                let sig = sigs[i];
                if (sig.invisible)
                    continue;
                var t = tree;
                let tokens = sig.id.split('/');
                let len = tokens.length;
                if (len > max_depth)
                    max_depth = len;
                for (var j in tokens) {
                    j = parseInt(j);
                    let b = t.branches;
                    if (b[tokens[j]] == null)
                        b[tokens[j]] = {"branches": {},
                                        "num_leaves": 0,
                                        "oscpath": tokens.slice(0, j+1).join('/')};
                    t.num_leaves += 1;
                    t = b[tokens[j]];
                    // store signal metadata in leaves
                    if (j == len - 1) {
                        t.leaf = sig;
                        t.num_leaves += 1;
                    }
                }
            }
//            print_tree(tree, 0);

            if (!_self.collapseAll && !(dev.collapsed & collapse_bit))
                num_sigs += num_dev_sigs;
            num_devs += 1;
        });

        let devRowType = 'odd';
        let sigRowType = 'odd';
        function add_tree(t, tds, target, depth) {
            let first = true;
            let left = _self.location == "left";
            for (var i in t.branches) {
                let b = t.branches[i];
                if (!tds || !first)
                    tds = [[b.num_leaves, i]];
                else
                    tds.push([b.num_leaves, i]);
                if (b.collapsed) {
                    console.log("collapsed!");
                }
                else {
                    if (b.leaf && !b.leaf.invisible) {
                        if (_self.location != "left")
                            tds = tds.reverse();
                        let line = "";
                        let len = tds.length;
                        let tokens = b.leaf.id.split('/');
                        for (var j in tds) {
                            let idx = parseInt(j);
                            let leaf = left ? (j == len-1) : (j == 0);
                            let device = left ? (j == 0) : (j == len-1);
                            if (leaf && _self.expand && !left)
                                line += "<td class='"+sigRowType+" filler'></td>";
                            line += "<td";
                            if (leaf) {
                                line += " class='leaf "+sigRowType+"'";
                                line += " id='"+b.leaf.id+"'";
                                if (depth < max_depth)
                                    line += " colspan="+(max_depth-depth);
                                line += ">"+tds[j][1]+" ("+b.leaf.unit+")</td>";
                                if (_self.expand && _self.location == "left")
                                    line += "<td class='"+sigRowType+" filler'></td>";
                                sigRowType = (sigRowType == 'odd') ? 'even' : 'odd';
                            }
                            else {
                                let id;
                                if (_self.location == 'left')
                                    id = tokens.slice(0, tokens.length-len+idx+1).join('/');
                                else
                                    id = tokens.slice(0, tokens.length-idx).join('/');
                                line += " id='"+id+"'";
                                line += " rowspan="+tds[j][0];
                                if (id.indexOf('/') == -1)
                                    line += " class=device";
                                line += ">"+tds[j][1]+"</td>";
                            }
                        }
                        target.append("<tr class='"+devRowType+"' style='background: "+b.leaf.color+"44' id="+b.leaf.id+">"+line+"</tr>");
                        tds = [[b.num_leaves - 1, i]];
                    }
                    add_tree(b, tds, target, depth + 1);
                }
                if (depth == 0)
                    devRowType = (devRowType == 'odd') ? 'even' : 'odd';
                first = false;
            }
        }
        add_tree(tree, [], $(this.tbody), 0);
        let tds = $("#"+this.id+" td");
        tds.each(function(td) { _self.autoRotate(this); });
        this.grow();

        $(tds).off('click');
        $(tds).on('click', function(e) {
            if ($(e.currentTarget).hasClass('leaf')) {
                // can't collapse leaves
                console.log("can't collapse leaves");
                return;
            }

            // toggle collapse
            function collapse_node(t, a) {
                for (var i in t.branches) {
                    if (i != a[0])
                        continue;
                    let b = t.branches[i];
                    if (a.length == 1) {
                        let new_state = b.collapsed ? false : true;
                        b.collapsed = new_state;
                        let id = b.oscpath;
                        // add/remove 'invisible' class from children
                        let children = $("#"+_self.id+" td[id^='"+id+"/']");
                        let num_leaves = $(children).filter('.leaf').length;
                        // also hide/show <tr> (except first)
                        children = $(children).add($("#"+_self.id+" tr[id^='"+id+"/']").not(":eq(0)"));
                        let depth = (id.match(/\//g) || []).length;
                        if (new_state) {
                            $(children).addClass('invisible');
                            $(e.currentTarget).attr({'colspan': max_depth - depth});
                            e.currentTarget.innerHTML = "<div>"+i+"...</div>";
                        }
                        else {
                            e.currentTarget.innerHTML = "<div>"+i+"</div>";
                            $(children).removeClass('invisible');
                        }

                        id = id.split('/');
                        let sel = e.currentTarget;
                        while (id.length) {
                            num_leaves = $("#"+_self.id+" td[id^='"+id.join('/')+"/']")
                                              .filter('.leaf')
                                              .not('.invisible')
                                              .length;
                            if (new_state)
                                num_leaves += 1;
                            if (num_leaves == 0)
                                num_leaves = 1;
                            $(sel).attr('rowspan', num_leaves);
                            if (num_leaves > i.length / 2)
                                $(sel).addClass('tall');
                            else
                                $(sel).removeClass('tall');
                            if (!new_state) {
                                $(sel).attr('colspan', 1);
                            }
                            id.pop()
                            if (id.length)
                                sel = $("#"+_self.id+" td[id='"+id.join('/')+"']");
                        }
                        return true;
                    }
                    return collapse_node(b, a.slice(1));
                }
                return false;
            }
            if (collapse_node(tree, $(e.currentTarget)[0].id.split('/'))) {
                _self.grow();
                if (_self.resizeHandler)
                    _self.resizeHandler();
            }
        });

        this.setSigPositions();
        this.num_devs = num_devs;
        this.num_sigs = num_sigs;
        this.num_hidden_sigs = num_hidden_sigs;
        this.adjustRowHeight();
        this.updateTitle();
    }

    setSigPosition(sig) {
        let self = this;
        if (self.direction != null && self.direction != sig.direction)
            return;
        if (self.ignoreCanvasObjects && sig.canvasObject)
            return;

        let row = self.getRowFromName(sig.key);
        if (row == null) {
            sig.hidden = true;
            return;
        }
        sig.hidden = false;
        sig.position = {
            get left() {return row.left;},
            set left(nl) {delete this.left; this.left = nl;},
            get top() {return row.top;},
            set top(nt) {delete this.top; this.top = nt;},
            get height() {return row.height;},
            set height(nh) {delete this.height; this.height = nh;},
            get width() {return row.width;},
            set width(nw) {delete this.width; this.width = nw;},
            get x() {return row.x;},
            set x(newx) {delete this.x; this.x = newx;},
            get vx() {return row.vx;},
            set vx(newx) {delete this.vx; this.vx = newx;},
            get y() {return row.y;},
            set y(newy) {delete this.y; this.y = newy;},
            get vy() {return row.vy;},
            set vy(newy) {delete this.vy; this.vy = newy;}
        }
    }

    setSigPositions() {
        let self = this;
        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                self.setSigPosition(sig);
            });
        });
    }
}
