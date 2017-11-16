// An object for the overall display
function mapperTable(model, id, orientation, detail)
{
    var tableHeight = 0;
    var frame = null;

    // The most recently selected rows, for shift-selecting
    var selected = new Assoc();

    this.unmappedVisible = true; // Are unmapped signals visible?

    this.on_resize = function() {
        tableHeight = $('#'+this.id).height();
        frame = fullOffset(this.table);
        frame.cx = frame.left + frame.width * 0.5;
        frame.cy = frame.top + frame.height * 0.5;
        width = frame.width;
    };

    this.direction = null;
    this.orientation = orientation;
    this.id = id;
    this.detail = null;
    this.parent;        // The node containing the table
    this.div;           // The div node (and status)
    this.table;         // The table node itself
    this.tbody;         // The <tbody> node
    this.title = 'Signals';

    this.nRows;         // Number of rows (e.g. devices or signals) present
    this.nVisibleRows;  // Number of rows actually visible to the user
    this.nCols;         // Number of columns in table
    this.scrolled = 0;
    this.zoomed = 1;

    this.border = false;
    this.row_height = 0;
    this.regexp = null;
    this.targetHeight = 600;
    this.num_devs = 0;
    this.num_sigs = 0;
    this.collapseAll = false;
    this.title = 'SIGNALS';

    this.width = 0;

    function makeTable(self) {
        $(self.div).empty();

        // Create the skeleton for the table within the div
        // TODO: move div properties to css
        if (self.detail) {
            $(self.div).append(
                "<div style='height:20px; position:relative; width:100%;'>"+
                    "<div id="+self.id+"Title style='float:left; position:relative; width:75%; padding-left:10px'>"+
                        "<strong>"+self.title+"</strong>"+
                    "</div>"+
                    "<div style='float:left; position:relative; width:25%; padding-left:20px'>"+
                        "<strong>TYPE</strong>"+
                    "</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<colgroup>"+
                            "<col style='width:75%'>"+
                            "<col style='width:25%'>"+
                        "</colgroup>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        else if (self.id == 'topTable') {
            $(self.div).append(
                "<div style='height: 200px; position:relative; width:20px'>"+
                    "<div id="+self.id+"Title style='float: left; position:relative; width:200px; text-align:center; transform-origin: 0% 0%; transform: translate(0%, 200px) rotate(270deg);'>"+
                        "<strong>"+self.title+"</strong>"+
                    "</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='left:20px; top:0px; height:100%; width:calc(100% - 20px); position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        else {
            $(self.div).append(
                "<div style='height: 20px; position:relative; width:100%'>"+
                    "<div id="+self.id+"Title style='float: left; position:relative; width:100%; text-align: center'>"+
                        "<strong>"+self.title+"</strong>"+
                    "</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        self.table = $("#"+self.id+" .displayTable")[0];
        self.tbody = $("#"+self.id+" .displayTable tbody")[0];

        frame = fullOffset(self.table);
        frame.cx = frame.left + frame.width * 0.5;
        frame.cy = frame.top + frame.height * 0.5;
    }

    // Should be passed a the node for the parent
    this.create_within = function(parent) {
        this.parent = parent;

        // Create the div containing the table
        $(this.parent).append("<div class='tableDiv' id='"+id+"'></div>");
        this.div = $(this.parent).children("#"+this.id);
        tableHeight = $('.tableDiv').height();

        makeTable(this);
        this.add_handlers(this);
    };

//    this.set_title = function(title) {
////        console.log('set_title', title, this.title);
//        this.title = title;
//        $('#'+this.id+' h2').text(title);
//    }

    this.filter_text = function(string) {
        this.filterstring = string;
        this.regexp = string ? new RegExp(this.filterstring, 'i') : null;
    }

    this.filter_dir = function(dir) {
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

    this.show_detail = function(show) {
        if (this.detail == show)
            return;
        this.detail = (show == true);
        makeTable(this);
        this.add_handlers(this);
    }

    this.border_mode = function(enabled) {
        this.border = (enabled == true);

        $(this.table).css({'width': this.border ? '200px' : '100%'});
//        $(this.table 'td').css({'width': this.border ? '50px' : '75px'});
    }

    this.height = function() {
        return this.row_height * this.table.rows.length;
    }

    this.row_from_index = function(idx) {
        let row_height = Math.round(this.row_height);
        let j = 0;
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if ($(row).hasClass('invisible'))
                continue;
            if (j < idx) {
                ++j;
                continue;
            }
            if (this.orientation == 'top') {
                let left = j * row_height - this.scrolled;
                let top = row.offsetLeft;
                return {'left': left,
                        'top': top,
                        'width': row_height,
                        'height': row.offsetWidth,
                        'cx': left + row_height * 0.5,
                        'cy': top + row.offsetWidth * 0.5,
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'isOutput': $(row).hasClass('output'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
            else {
                let left = row.offsetLeft;
                let top = j * row_height - this.scrolled + 20;
                return {'left': left,
                        'top': top,
                        'width': row.offsetWidth,
                        'height': row_height,
                        'cx': left + row.offsetWidth * 0.5,
                        'cy': top + this.row_height * 0.5,
                        'id': row.id.replace('\\/', '\/'),
                        'even': $(row).hasClass('even'),
                        'isOutput': $(row).hasClass('output'),
                        'type': $(row).hasClass('device') ? 'device' : 'signal',
                        'index': j};
            }
        }
    }

    this.row_from_name = function(name) {
        let id = name.replace('/', '\\/');
        let row_height = Math.round(this.row_height);
        let j = 0;
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if (row.id == id) {
                if ($(row).hasClass('invisible')) {
                    if (name.indexOf('/') != -1)
                        return this.row_from_name(name.split('/')[0]);
                    else
                        return null;
                }
                if (this.orientation == 'top') {
                    let left = j * row_height - this.scrolled;
                    let top = row.offsetLeft;
                    return {'left': left,
                            'top': top,
                            'width': row_height,
                            'height': row.offsetWidth,
                            'cx': left + row_height * 0.5,
                            'cy': top + row.offsetWidth * 0.5,
                            'id': row.id.replace('\\/', '\/'),
                            'even': $(row).hasClass('even'),
                            'isOutput': $(row).hasClass('output'),
                            'type': $(row).hasClass('device') ? 'device' : 'signal',
                            'index': j};
                }
                else {
                    let left = row.offsetLeft;
                    let top = j * row_height - this.scrolled + 20;
                    return {'left': left,
                            'top': top,
                            'width': row.offsetWidth,
                            'height': row_height,
                            'cx': left + row.offsetWidth * 0.5,
                            'cy': top + this.row_height * 0.5,
                            'id': row.id.replace('\\/', '\/'),
                            'even': $(row).hasClass('even'),
                            'isOutput': $(row).hasClass('output'),
                            'type': $(row).hasClass('device') ? 'device' : 'signal',
                            'index': j};
                }
                break;
            }
            else if (!$(row).hasClass('invisible'))
                ++j;
        }
    }

    this.row_from_position = function(x, y) {
        if (x == null || y == null)
            return;
        if (this.orientation == 'top') {
            y = frame.top + 50;
        }
        else {
            x = this.div[0].offsetLeft + 50;
        }
        let td = document.elementFromPoint(x, y);
        let row = $(td).parents('tr');
        let row_height = Math.round(this.row_height);
        row = row[0];
        let output;
        if (this.orientation == 'top') {
            let left = row.offsetTop - this.scrolled;
            let top = row.offsetLeft;
            output = {'left': left,
                      'top': top,
                      'width': row_height,
                      'height': row.offsetWidth,
                      'cx': left + row.offsetHeight * 0.5,
                      'cy': top + row.offsetWidth * 0.5,
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
        else {
            let left = row.offsetLeft;
            let top = row.offsetTop - this.scrolled + 20;
            output = {'left': left,
                      'top': top,
                      'width': row.offsetWidth,
                      'height': row_height,
                      'cx': left + row.offsetWidth * 0.5,
                      'cy': top + row.offsetHeight * 0.5,
                      'id': row.id.replace('\\/', '\/'),
                      'type': $(row).hasClass('device') ? 'device' : 'signal'};
        }
        return output;
    }

    this.highlight_row = function(row, clear) {
        if (clear)
            $('#'+this.id+' tr').removeClass('trsel');
        if (row && row.id) {
            let dom_row = document.getElementById(row.id.replace('\/', '\\/'));
            if (dom_row)
                $(dom_row).addClass('trsel');
        }
    }

    this.pan = function(delta) {
        let new_scroll = this.scrolled + delta;
        if (this.id == 'topTable') {
            this.scrolled = $("#"+this.id+"Scroller")
                                .scrollLeft(new_scroll)
                                .scrollLeft();
        }
        else {
            this.scrolled = $("#"+this.id+"Scroller")
                                .scrollTop(new_scroll)
                                .scrollTop();
        }
        if (this.scrolled == Math.floor(new_scroll)) {
            // keep fractional part
            this.scrolled = new_scroll;
        }
        return Math.floor(this.scrolled) + 20;
    }

    this.set_row_height = function() {
        // adjust row heights to fill table
        let nat_row_height = this.targetHeight / (this.num_devs + this.num_sigs);
        if (nat_row_height > 18) {
            // don't allow zoom < 1
            if (this.zoomed < 1)
                this.zoomed = 1;
        }
        let row_height = nat_row_height * this.zoomed;
        if (row_height < 18) {
            row_height = 18;
            this.zoomed = row_height / nat_row_height;
        }
        let changed = (Math.round(row_height) != Math.round(this.row_height));
        this.row_height = row_height;
        if (changed)
            $("#"+this.id+' tbody tr').css('height', this.row_height+'px');
        return changed;
    }

    this.zoom = function(offset, delta) {
        this.zoomed -= delta * 0.01;
        if (this.zoomed < 0.1)
            this.zoomed = 0.1;
        else if (this.zoomed > 20)
            this.zoomed = 20;

        let old_row_height = this.row_height;
        let changed = this.set_row_height();
        if (!changed)
            return false;

        offset -= 20;   // column headers

        // old offset in rows
        let norm_offset = (Math.floor(this.scrolled) + offset) / Math.round(old_row_height);
        let row_diff = Math.round(this.row_height) - Math.round(old_row_height);
        this.pan(row_diff * norm_offset);

        return true;
    }

    this.update = function(targetHeight) {
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
        switch (this.orientation) {
            case 'left':
                collapse_bit = 1;
                break;
            case 'right':
                collapse_bit = 2;
                break;
            default:
                collapse_bit = 4;
                break;
        }
        let title = this.title;

        model.devices.each(function(dev) {
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
        this.set_row_height();
    }

    function select_tr(tr) {
        if (!tr)
            return;

        var t = $(tr);
        var name = tr.firstChild.innerHTML.replace(/<wbr>/g,'');

        if (t.hasClass("trsel")) {
            t.removeClass("trsel");
            selected.remove(name);
        } else {
            t.addClass("trsel");
            selected.add(name);
        }
        $('#container').trigger("updateMapProperties");
    }

    this.add_handlers = function(self) {
        $('#'+this.id+' tr').hover(function() {
            $(this).toggleClass('hover');
        });
//        $('.displayTable tbody').on({
//            mousedown: function(e) {
//                if (e.shiftKey == false)
//                    deselect_all();
//                select_tr(this);
//            },
//            click: function(e) { e.stopPropagation(); }
//        }, 'tr');


//        $('#'+this.id).on('mousedown', 'tr', function(tableClick) {
//            var sourceRow = this;
//            $(document).one('mouseup.drawing', function(mouseUpEvent) {
//                $("*").off('.drawing').removeClass('incompatible');
//                $(document).off('.drawing');
//            });
//        });
    }
}
